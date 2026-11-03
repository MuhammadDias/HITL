from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import classroom, dashboard
from .db import init_db
from .inference import load_model, predict_from_drawing

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


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
def predict(payload: DrawingPayload):
    candidates = predict_from_drawing(payload.drawing)
    return {"candidates": candidates}


