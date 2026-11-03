# backend/app/reports.py
"""Class statistics, drawing rendering and per-class export."""
import csv
import io
import json
import sqlite3
import zipfile
from typing import Dict, List

from PIL import Image, ImageDraw

# Decision vocabulary as the teacher sees it.
DECISION_LABELS = {"accept": "Menerima", "correct": "Merevisi", "override": "Menolak"}


def _pct(part: int, whole: int) -> float:
    return round(100.0 * part / whole, 1) if whole else 0.0


def _decision_breakdown(counts: Dict[str, int]) -> Dict[str, float]:
    total = sum(counts.values())
    return {d: _pct(counts.get(d, 0), total) for d in DECISION_LABELS}


def class_stats(conn: sqlite3.Connection, class_id: int) -> dict:
    """Per-student and class-level decision percentages for one class."""
    students = conn.execute(
        "SELECT id, number, name FROM students WHERE class_id = ? ORDER BY number", (class_id,)
    ).fetchall()
    rows = conn.execute(
        """
        SELECT student_id, decision_type, COUNT(*) AS n, AVG(top1_confidence) AS conf
        FROM submissions WHERE class_id = ?
        GROUP BY student_id, decision_type
        """,
        (class_id,),
    ).fetchall()

    per_student: Dict[int, Dict[str, int]] = {}
    conf_sum: Dict[int, float] = {}
    for r in rows:
        per_student.setdefault(r["student_id"], {})[r["decision_type"]] = r["n"]
        conf_sum[r["student_id"]] = conf_sum.get(r["student_id"], 0.0) + r["conf"] * r["n"]

    student_rows = []
    class_counts: Dict[str, int] = {}
    for s in students:
        counts = per_student.get(s["id"], {})
        total = sum(counts.values())
        for d, n in counts.items():
            class_counts[d] = class_counts.get(d, 0) + n
        student_rows.append(
            {
                "id": s["id"],
                "number": s["number"],
                "name": s["name"],
                "total": total,
                "counts": {d: counts.get(d, 0) for d in DECISION_LABELS},
                "percent": _decision_breakdown(counts),
                "avg_model_confidence": round(conf_sum[s["id"]] / total, 4) if total else None,
            }
        )

    # Average of each student's own percentages, so heavy players don't dominate.
    active = [s for s in student_rows if s["total"]]
    student_average = {
        d: round(sum(s["percent"][d] for s in active) / len(active), 1) if active else 0.0
        for d in DECISION_LABELS
    }
    total_submissions = sum(class_counts.values())
    return {
        "total_submissions": total_submissions,
        "students_joined": len(students),
        "students_active": len(active),
        "counts": {d: class_counts.get(d, 0) for d in DECISION_LABELS},
        "percent": _decision_breakdown(class_counts),
        "student_average_percent": student_average,
        "students": student_rows,
    }


def render_drawing_png(strokes: List[List[dict]], size: int = 320) -> bytes:
    """Render stroke points (any coordinate space) centered on a white square."""
    img = Image.new("RGB", (size, size), "white")
    points = [p for stroke in strokes for p in stroke]
    if points:
        xs = [float(p.get("x", 0.0)) for p in points]
        ys = [float(p.get("y", 0.0)) for p in points]
        min_x, min_y = min(xs), min(ys)
        extent = max(max(xs) - min_x, max(ys) - min_y) or 1.0
        pad = size * 0.1
        scale = (size - 2 * pad) / extent
        off_x = pad + ((size - 2 * pad) - (max(xs) - min_x) * scale) / 2
        off_y = pad + ((size - 2 * pad) - (max(ys) - min_y) * scale) / 2
        draw = ImageDraw.Draw(img)
        width = max(3, size // 60)
        for stroke in strokes:
            pts = [
                (off_x + (float(p.get("x", 0.0)) - min_x) * scale, off_y + (float(p.get("y", 0.0)) - min_y) * scale)
                for p in stroke
            ]
            if len(pts) == 1:
                x, y = pts[0]
                draw.ellipse([x - width / 2, y - width / 2, x + width / 2, y + width / 2], fill="black")
            elif pts:
                draw.line(pts, fill="black", width=width, joint="curve")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


EXPORT_COLUMNS = [
    "id_jawaban", "sekolah", "kelas", "no_absen", "nama_murid", "level", "waktu_utc",
    "keputusan", "label_akhir", "rank_dipilih",
    "tebakan_1", "confidence_1", "tebakan_2", "confidence_2", "tebakan_3", "confidence_3",
    "file_gambar",
]


def _export_rows(conn: sqlite3.Connection, class_id: int) -> List[sqlite3.Row]:
    return conn.execute(
        """
        SELECT sub.*, st.number AS student_number, st.name AS student_name,
               c.name AS class_name, sc.name AS school_name
        FROM submissions sub
        JOIN students st ON st.id = sub.student_id
        JOIN classes c ON c.id = sub.class_id
        JOIN schools sc ON sc.id = c.school_id
        WHERE sub.class_id = ?
        ORDER BY st.number, sub.created_at
        """,
        (class_id,),
    ).fetchall()


def _image_name(row: sqlite3.Row) -> str:
    return f"gambar/absen-{row['student_number']:02d}_jawaban-{row['id']}.png"


def export_csv(conn: sqlite3.Connection, class_id: int) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(EXPORT_COLUMNS)
    for r in _export_rows(conn, class_id):
        cands = json.loads(r["candidates_json"])
        flat = []
        for i in range(3):
            c = cands[i] if i < len(cands) else {}
            flat += [c.get("label", ""), c.get("confidence", "")]
        writer.writerow(
            [
                r["id"], r["school_name"], r["class_name"], r["student_number"], r["student_name"],
                r["level_id"], r["created_at"], DECISION_LABELS[r["decision_type"]], r["final_label"],
                r["source_rank"] or "", *flat, _image_name(r),
            ]
        )
    return buf.getvalue()


def export_zip(conn: sqlite3.Connection, class_id: int) -> bytes:
    """data.csv plus one PNG per answer under gambar/."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # utf-8-sig so Excel shows names with accents correctly.
        zf.writestr("data.csv", export_csv(conn, class_id).encode("utf-8-sig"))
        for r in _export_rows(conn, class_id):
            zf.writestr(_image_name(r), render_drawing_png(json.loads(r["strokes_json"])))
    return buf.getvalue()
