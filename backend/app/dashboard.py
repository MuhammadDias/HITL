# backend/app/dashboard.py
"""Admin (guru) and superadmin endpoints."""
import json
import secrets
import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from .auth import (
    create_session,
    current_user,
    ensure_school_access,
    hash_password,
    require_superadmin,
    verify_password,
)
from .db import get_db
from .reports import DECISION_LABELS, class_stats, export_csv, export_zip, render_drawing_png

router = APIRouter(prefix="/api")


def _user_out(user: sqlite3.Row, conn: sqlite3.Connection) -> dict:
    school = None
    if user["school_id"] is not None:
        row = conn.execute("SELECT id, name FROM schools WHERE id = ?", (user["school_id"],)).fetchone()
        school = dict(row) if row else None
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"], "school": school}


def _get_class(conn: sqlite3.Connection, user: sqlite3.Row, class_id: int) -> sqlite3.Row:
    row = conn.execute(
        """
        SELECT c.*, s.name AS school_name FROM classes c JOIN schools s ON s.id = c.school_id
        WHERE c.id = ?
        """,
        (class_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Kelas tidak ditemukan.")
    ensure_school_access(user, row["school_id"])
    return row


def _class_summary(conn: sqlite3.Connection, c: sqlite3.Row) -> dict:
    stats = class_stats(conn, c["id"])
    return {
        "id": c["id"],
        "name": c["name"],
        "school_id": c["school_id"],
        "school_name": c["school_name"],
        "student_count": c["student_count"],
        "join_token": c["join_token"],
        "created_at": c["created_at"],
        "students_joined": stats["students_joined"],
        "total_submissions": stats["total_submissions"],
        "percent": stats["percent"],
        "student_average_percent": stats["student_average_percent"],
    }


# ---------------------------------------------------------------- auth


class LoginBody(BaseModel):
    email: str
    password: str


@router.post("/auth/login")
def login(body: LoginBody, conn: sqlite3.Connection = Depends(get_db)):
    user = conn.execute("SELECT * FROM users WHERE email = ?", (body.email.strip(),)).fetchone()
    if user is None or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau password salah.")
    token = create_session(conn, user["id"])
    return {"token": token, "user": _user_out(user, conn)}


@router.get("/auth/me")
def me(user: sqlite3.Row = Depends(current_user), conn: sqlite3.Connection = Depends(get_db)):
    return _user_out(user, conn)


@router.post("/auth/logout")
def logout(request: Request, conn: sqlite3.Connection = Depends(get_db)):
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        conn.execute("DELETE FROM sessions WHERE token = ?", (header[7:].strip(),))
    return {"ok": True}


# ---------------------------------------------------------------- schools (superadmin)


class SchoolBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    address: str = Field(default="", max_length=240)


class AdminBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=8, max_length=200)


@router.get("/schools")
def list_schools(_: sqlite3.Row = Depends(require_superadmin), conn: sqlite3.Connection = Depends(get_db)):
    rows = conn.execute(
        """
        SELECT s.*,
          (SELECT COUNT(*) FROM classes c WHERE c.school_id = s.id) AS class_count,
          (SELECT COUNT(*) FROM students st JOIN classes c ON c.id = st.class_id WHERE c.school_id = s.id) AS student_count,
          (SELECT COUNT(*) FROM users u WHERE u.school_id = s.id) AS admin_count,
          (SELECT COUNT(*) FROM submissions sub JOIN classes c ON c.id = sub.class_id WHERE c.school_id = s.id) AS submission_count
        FROM schools s ORDER BY s.name
        """
    ).fetchall()
    return [dict(r) for r in rows]


@router.post("/schools", status_code=201)
def create_school(body: SchoolBody, _: sqlite3.Row = Depends(require_superadmin), conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.execute("INSERT INTO schools (name, address) VALUES (?, ?)", (body.name.strip(), body.address.strip()))
    return dict(conn.execute("SELECT * FROM schools WHERE id = ?", (cur.lastrowid,)).fetchone())


@router.get("/schools/{school_id}")
def get_school(school_id: int, _: sqlite3.Row = Depends(require_superadmin), conn: sqlite3.Connection = Depends(get_db)):
    school = conn.execute("SELECT * FROM schools WHERE id = ?", (school_id,)).fetchone()
    if school is None:
        raise HTTPException(status_code=404, detail="Sekolah tidak ditemukan.")
    admins = conn.execute(
        "SELECT id, name, email, created_at FROM users WHERE school_id = ? ORDER BY name", (school_id,)
    ).fetchall()
    classes = conn.execute(
        """
        SELECT c.*, s.name AS school_name FROM classes c JOIN schools s ON s.id = c.school_id
        WHERE c.school_id = ? ORDER BY c.name
        """,
        (school_id,),
    ).fetchall()
    students = conn.execute(
        """
        SELECT st.id, st.number, st.name, st.class_id, c.name AS class_name, st.created_at,
          (SELECT COUNT(*) FROM submissions sub WHERE sub.student_id = st.id) AS submission_count
        FROM students st JOIN classes c ON c.id = st.class_id
        WHERE c.school_id = ? ORDER BY c.name, st.number
        """,
        (school_id,),
    ).fetchall()
    return {
        **dict(school),
        "admins": [dict(a) for a in admins],
        "classes": [_class_summary(conn, c) for c in classes],
        "students": [dict(s) for s in students],
    }


@router.post("/schools/{school_id}/admins", status_code=201)
def create_admin(
    school_id: int,
    body: AdminBody,
    _: sqlite3.Row = Depends(require_superadmin),
    conn: sqlite3.Connection = Depends(get_db),
):
    if conn.execute("SELECT 1 FROM schools WHERE id = ?", (school_id,)).fetchone() is None:
        raise HTTPException(status_code=404, detail="Sekolah tidak ditemukan.")
    try:
        cur = conn.execute(
            "INSERT INTO users (email, name, password_hash, role, school_id) VALUES (?, ?, ?, 'admin', ?)",
            (body.email.strip(), body.name.strip(), hash_password(body.password), school_id),
        )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Email sudah dipakai akun lain.")
    return {"id": cur.lastrowid, "name": body.name.strip(), "email": body.email.strip()}


# ---------------------------------------------------------------- classes


class ClassBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    student_count: int = Field(ge=1, le=60)
    school_id: Optional[int] = None  # required for superadmin; ignored for admin


@router.get("/classes")
def list_classes(
    school_id: Optional[int] = None,
    user: sqlite3.Row = Depends(current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    if user["role"] != "superadmin":
        school_id = user["school_id"]
    sql = "SELECT c.*, s.name AS school_name FROM classes c JOIN schools s ON s.id = c.school_id"
    params: tuple = ()
    if school_id is not None:
        sql += " WHERE c.school_id = ?"
        params = (school_id,)
    rows = conn.execute(sql + " ORDER BY s.name, c.name", params).fetchall()
    return [_class_summary(conn, c) for c in rows]


@router.post("/classes", status_code=201)
def create_class(body: ClassBody, user: sqlite3.Row = Depends(current_user), conn: sqlite3.Connection = Depends(get_db)):
    school_id = body.school_id if user["role"] == "superadmin" else user["school_id"]
    if school_id is None:
        raise HTTPException(status_code=400, detail="Pilih sekolah untuk kelas ini.")
    if conn.execute("SELECT 1 FROM schools WHERE id = ?", (school_id,)).fetchone() is None:
        raise HTTPException(status_code=404, detail="Sekolah tidak ditemukan.")
    cur = conn.execute(
        "INSERT INTO classes (school_id, name, student_count, join_token, created_by) VALUES (?, ?, ?, ?, ?)",
        (school_id, body.name.strip(), body.student_count, secrets.token_urlsafe(9), user["id"]),
    )
    return _class_summary(conn, _get_class(conn, user, cur.lastrowid))


@router.get("/classes/{class_id}")
def get_class(class_id: int, user: sqlite3.Row = Depends(current_user), conn: sqlite3.Connection = Depends(get_db)):
    c = _get_class(conn, user, class_id)
    return {**_class_summary(conn, c), "stats": class_stats(conn, class_id)}


@router.delete("/classes/{class_id}", status_code=204)
def delete_class(class_id: int, user: sqlite3.Row = Depends(current_user), conn: sqlite3.Connection = Depends(get_db)):
    _get_class(conn, user, class_id)
    conn.execute("DELETE FROM classes WHERE id = ?", (class_id,))
    return Response(status_code=204)


@router.get("/classes/{class_id}/submissions")
def list_submissions(
    class_id: int,
    student_id: Optional[int] = None,
    decision: Optional[str] = None,
    user: sqlite3.Row = Depends(current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    _get_class(conn, user, class_id)
    sql = """
        SELECT sub.id, sub.level_id, sub.decision_type, sub.source_rank, sub.final_label,
               sub.candidates_json, sub.created_at, st.id AS student_id, st.number AS student_number,
               st.name AS student_name
        FROM submissions sub JOIN students st ON st.id = sub.student_id
        WHERE sub.class_id = ?
    """
    params: list = [class_id]
    if student_id is not None:
        sql += " AND sub.student_id = ?"
        params.append(student_id)
    if decision in DECISION_LABELS:
        sql += " AND sub.decision_type = ?"
        params.append(decision)
    rows = conn.execute(sql + " ORDER BY sub.created_at DESC, sub.id DESC", params).fetchall()
    out = []
    for r in rows:
        item = dict(r)
        item["candidates"] = json.loads(item.pop("candidates_json"))
        out.append(item)
    return out


@router.get("/submissions/{submission_id}/image.png")
def submission_image(
    submission_id: int, user: sqlite3.Row = Depends(current_user), conn: sqlite3.Connection = Depends(get_db)
):
    row = conn.execute(
        """
        SELECT sub.strokes_json, c.school_id FROM submissions sub JOIN classes c ON c.id = sub.class_id
        WHERE sub.id = ?
        """,
        (submission_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Jawaban tidak ditemukan.")
    ensure_school_access(user, row["school_id"])
    png = render_drawing_png(json.loads(row["strokes_json"]))
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "private, max-age=3600"})


# ---------------------------------------------------------------- export (superadmin)


def _export_filename(c: sqlite3.Row, ext: str) -> str:
    safe = "".join(ch if ch.isalnum() else "-" for ch in f"{c['school_name']}-{c['name']}").strip("-")
    return f"{safe or 'kelas'}.{ext}"


@router.get("/classes/{class_id}/export.csv")
def export_class_csv(
    class_id: int, user: sqlite3.Row = Depends(require_superadmin), conn: sqlite3.Connection = Depends(get_db)
):
    c = _get_class(conn, user, class_id)
    return Response(
        content=export_csv(conn, class_id).encode("utf-8-sig"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{_export_filename(c, "csv")}"'},
    )


@router.get("/classes/{class_id}/export.zip")
def export_class_zip(
    class_id: int, user: sqlite3.Row = Depends(require_superadmin), conn: sqlite3.Connection = Depends(get_db)
):
    c = _get_class(conn, user, class_id)
    return Response(
        content=export_zip(conn, class_id),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{_export_filename(c, "zip")}"'},
    )
