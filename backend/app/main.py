import sqlite3
from typing import Optional

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import classroom, dashboard
from .db import get_db, init_db
from .difficulty import apply_difficulty, effective_difficulty
from .inference import load_model, predict_probs

app = FastAPI(title="Momo Backend", version="0.1.0")
app.include_router(dashboard.router)
app.include_router(classroom.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Lets the admin dashboard read export filenames cross-origin.
    expose_headers=["Content-Disposition"],
)


@app.on_event("startup")
def startup_event():
    init_db()
    # Warmup model during backend startup
    load_model()


class DrawingPayload(BaseModel):
    drawing: dict
    # Sent by the game when NEXT_PUBLIC_PREDICTION_SEND_CONTEXT=1 (camelCase per its contract).
    level_id: Optional[str] = Field(default=None, alias="levelId")

    model_config = {"populate_by_name": True, "extra": "ignore"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
def predict(payload: DrawingPayload, conn: sqlite3.Connection = Depends(get_db)):
    labels, probs = predict_probs(payload.drawing)
    difficulty = effective_difficulty(conn, payload.level_id)
    candidates = apply_difficulty(labels, probs, difficulty, payload.drawing, payload.level_id or "")
    return {
        "candidates": candidates,
        # For dashboards/logs: which level and how much the answer was degraded (0 = raw model).
        "difficulty": {"levelId": payload.level_id, "value": difficulty},
    }


