# backend/app/classroom.py
"""Public endpoints used by the game when a student opens a class link."""
import json
import sqlite3
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .db import get_db

router = APIRouter(prefix="/api")

MAX_POINTS = 20_000  # guards against oversized payloads from a single drawing


def _class_by_token(conn: sqlite3.Connection, token: str) -> sqlite3.Row:
    row = conn.execute(
        """
        SELECT c.id, c.name, c.student_count, s.name AS school_name
        FROM classes c JOIN schools s ON s.id = c.school_id WHERE c.join_token = ?
        """,
        (token,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Link kelas tidak valid.")
    return row


@router.get("/join/{token}")
def class_info(token: str, conn: sqlite3.Connection = Depends(get_db)):
    c = _class_by_token(conn, token)
    taken = [r["number"] for r in conn.execute("SELECT number FROM students WHERE class_id = ?", (c["id"],))]
    return {
        "class_name": c["name"],
        "school_name": c["school_name"],
        "student_count": c["student_count"],
        "taken_numbers": sorted(taken),
    }


class JoinBody(BaseModel):
    number: int = Field(ge=1)
    name: str = Field(min_length=1, max_length=80)


@router.post("/join/{token}/students")
def join_class(token: str, body: JoinBody, conn: sqlite3.Connection = Depends(get_db)):
    c = _class_by_token(conn, token)
    if body.number > c["student_count"]:
        raise HTTPException(status_code=400, detail=f"Nomor absen di kelas ini hanya 1–{c['student_count']}.")
    name = body.name.strip()
    # Re-joining with the same number (e.g. another device) keeps one student row.
    conn.execute(
        """
        INSERT INTO students (class_id, number, name) VALUES (?, ?, ?)
        ON CONFLICT (class_id, number) DO UPDATE SET name = excluded.name
        """,
        (c["id"], body.number, name),
    )
    row = conn.execute(
        "SELECT id FROM students WHERE class_id = ? AND number = ?", (c["id"], body.number)
    ).fetchone()
    return {"student_id": row["id"], "number": body.number, "name": name, "class_name": c["name"]}


class Point(BaseModel):
    x: float
    y: float
    width: Optional[float] = None


class Candidate(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    confidence: float = Field(ge=0, le=1)


class SubmissionBody(BaseModel):
    join_token: str
    student_id: int
    level_id: str = Field(min_length=1, max_length=80)
    strokes: List[List[Point]]
    candidates: List[Candidate] = Field(min_length=3, max_length=3)
    decision_type: Literal["accept", "correct", "override"]
    source_rank: Optional[int] = Field(default=None, ge=1, le=3)
    final_label: str = Field(min_length=1, max_length=80)


@router.post("/submissions", status_code=201)
def create_submission(body: SubmissionBody, conn: sqlite3.Connection = Depends(get_db)):
    c = _class_by_token(conn, body.join_token)
    student = conn.execute(
        "SELECT id FROM students WHERE id = ? AND class_id = ?", (body.student_id, c["id"])
    ).fetchone()
    if student is None:
        raise HTTPException(status_code=400, detail="Murid tidak terdaftar di kelas ini.")
    if sum(len(s) for s in body.strokes) > MAX_POINTS:
        raise HTTPException(status_code=413, detail="Gambar terlalu besar.")
    strokes = [[p.model_dump(exclude_none=True) for p in s] for s in body.strokes]
    candidates = [cand.model_dump() for cand in body.candidates]
    cur = conn.execute(
        """
        INSERT INTO submissions (class_id, student_id, level_id, strokes_json, candidates_json,
          decision_type, source_rank, final_label, top1_label, top1_confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            c["id"], body.student_id, body.level_id, json.dumps(strokes), json.dumps(candidates),
            body.decision_type, body.source_rank, body.final_label.strip(),
            candidates[0]["label"], candidates[0]["confidence"],
        ),
    )
    return {"id": cur.lastrowid}
