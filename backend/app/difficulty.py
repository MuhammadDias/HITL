# backend/app/difficulty.py
"""Per-level AI difficulty: degrade the model's prediction so students must verify it.

The model itself is unchanged. For a level with difficulty d (0-100) the backend
1. flattens the probability distribution (top-1 confidence drops), and
2. with a probability that grows with d, moves a look-alike label to rank 1 and the
   model's real top-1 to rank 2 (so "Pilih lain" can still fix it).
The result is deterministic per drawing: "Coba lagi" on the same sketch gives the
same answer; a new sketch gets a new roll.
"""
import hashlib
import json
import math
import sqlite3
from typing import Dict, List, Optional, Tuple

# Level ids and names as used by the game (frontend/implementation/src/domain/levels.ts).
LEVELS: List[Tuple[str, str]] = [
    ("stage-1-foundation", "Bab 1 · Jembatan Pertama"),
    ("stage-2-ambiguity", "Bab 2 · Menara Lipatan"),
    ("stage-3-validation", "Bab 3 · Lorong Kabut Penghapus"),
]
# Suggested values: easy -> hard. Disabled until a superadmin turns a level on.
DEFAULTS: Dict[str, Dict] = {
    "stage-1-foundation": {"enabled": False, "difficulty": 0},
    "stage-2-ambiguity": {"enabled": False, "difficulty": 40},
    "stage-3-validation": {"enabled": False, "difficulty": 70},
}

# Labels the model (and students) tend to confuse; first existing entry is used.
LOOKALIKES: Dict[str, List[str]] = {
    "tangga": ["pagar", "anak tangga"],
    "anak tangga": ["tangga", "zigzag"],
    "pagar": ["tangga", "anak tangga"],
    "jembatan": ["bangku", "meja"],
    "bangku": ["meja", "jembatan"],
    "meja": ["bangku", "jembatan"],
    "papan luncur": ["bangku", "jembatan"],
    "gergaji": ["zigzag", "pisau"],
    "zigzag": ["gergaji", "petir"],
    "petir": ["zigzag", "garis"],
    "pisau": ["pedang", "gergaji"],
    "pedang": ["pisau", "garis"],
    "ular": ["garis", "zigzag"],
    "garis": ["ular", "petir"],
    "kaktus": ["api unggun", "pagar"],
    "api unggun": ["kaktus", "payung"],
    "laba-laba": ["api unggun", "ular"],
    "awan": ["payung", "ember"],
    "ember": ["awan", "meja"],
    "payung": ["awan", "api unggun"],
}

# How strongly difficulty 100 acts. Kept here so the dashboard preview can mirror them.
MAX_TEMPERATURE_GAIN = 2.0   # T = 1 + gain * d  -> probs ** (1/T)
MAX_SWAP_PROBABILITY = 0.6   # chance the look-alike takes rank 1 at d = 1


# ---------------------------------------------------------------- settings storage

def get_settings(conn: sqlite3.Connection) -> List[dict]:
    rows = {r["level_id"]: r for r in conn.execute("SELECT * FROM level_difficulty")}
    out = []
    for level_id, name in LEVELS:
        row = rows.get(level_id)
        base = DEFAULTS[level_id]
        out.append(
            {
                "level_id": level_id,
                "name": name,
                "enabled": bool(row["enabled"]) if row else base["enabled"],
                "difficulty": int(row["difficulty"]) if row else base["difficulty"],
            }
        )
    return out


def save_settings(conn: sqlite3.Connection, levels: List[dict]) -> None:
    for item in levels:
        conn.execute(
            """
            INSERT INTO level_difficulty (level_id, enabled, difficulty, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT (level_id) DO UPDATE SET enabled = excluded.enabled,
              difficulty = excluded.difficulty, updated_at = excluded.updated_at
            """,
            (item["level_id"], 1 if item["enabled"] else 0, int(item["difficulty"])),
        )


def effective_difficulty(conn: sqlite3.Connection, level_id: Optional[str]) -> int:
    """0 when the level is unknown or its difficulty is switched off."""
    if not level_id:
        return 0
    row = conn.execute(
        "SELECT enabled, difficulty FROM level_difficulty WHERE level_id = ?", (level_id,)
    ).fetchone()
    if row is None:
        base = DEFAULTS.get(level_id)
        return int(base["difficulty"]) if base and base["enabled"] else 0
    return int(row["difficulty"]) if row["enabled"] else 0


# ---------------------------------------------------------------- degradation

def _seed(drawing: dict, level_id: str) -> float:
    """Stable number in [0, 1) for this sketch + level."""
    key = json.dumps({"d": drawing.get("strokes"), "l": level_id}, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(key.encode()).digest()
    return int.from_bytes(digest[:8], "big") / 2**64


def apply_difficulty(
    labels: List[str], probs: List[float], difficulty: int, drawing: dict, level_id: str
) -> List[dict]:
    """Return the Top-3 candidates after applying difficulty 0-100."""
    d = max(0, min(100, int(difficulty))) / 100.0
    pairs = sorted(zip(labels, probs), key=lambda p: p[1], reverse=True)
    if d <= 0:
        return [{"label": l, "confidence": round(float(p), 6)} for l, p in pairs[:3]]

    # 1) Flatten: raise every probability to 1/T and renormalize.
    temperature = 1.0 + MAX_TEMPERATURE_GAIN * d
    flat = [(l, math.pow(max(p, 1e-9), 1.0 / temperature)) for l, p in pairs]
    total = sum(p for _, p in flat) or 1.0
    flat = [(l, p / total) for l, p in flat]
    order = [l for l, _ in flat]
    conf = [p for _, p in flat]

    # 2) Maybe let a look-alike overtake rank 1; the real top-1 moves to rank 2.
    if _seed(drawing, level_id) < MAX_SWAP_PROBABILITY * d:
        top1 = order[0]
        lookalike = next((c for c in LOOKALIKES.get(top1, []) if c in order), order[1])
        rest = [l for l in order if l not in (lookalike, top1)]
        order = [lookalike, top1] + rest

    return [{"label": l, "confidence": round(float(c), 6)} for l, c in zip(order[:3], conf[:3])]
