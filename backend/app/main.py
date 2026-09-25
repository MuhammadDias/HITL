from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .inference import load_model, predict_from_drawing

app = FastAPI(title="Momo Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
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


