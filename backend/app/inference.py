# backend/app/inference.py
import os
import sys
from functools import lru_cache
from pathlib import Path
from typing import List, Dict

import numpy as np
from PIL import Image, ImageDraw
import tensorflow as tf

# 1. Tambahkan ROOT_DIR ke sys.path agar Python bisa menemukan config.py di root
ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# 2. Impor CATEGORIES langsung dari config (BUKAN train.config)
from config import CATEGORIES, NUM_CLASSES

DEFAULT_MODEL = str(ROOT_DIR / "weights" / "model_4_mobilenetv2_best.keras")


def _draw_stroke_28(
    img: Image.Image,
    stroke: List[Dict],
    min_x: float,
    min_y: float,
    scale_extent: float,
    width_span: float,
    height_span: float,
    margin_pct: float = 0.05,
) -> None:
    """Menggambar stroke ke kanvas grayscale 28x28."""
    draw = ImageDraw.Draw(img)
    if not stroke:
        return

    canvas_size = img.size[0]  # 28 px
    margin = int(canvas_size * margin_pct)
    usable = canvas_size - 2 * margin

    points = []
    widths = []
    for p in stroke:
        nx = (float(p.get("x", 0.0)) - min_x) / scale_extent
        ny = (float(p.get("y", 0.0)) - min_y) / scale_extent
        px = max(0, min(canvas_size - 1, int(round(margin + nx * usable))))
        py = max(0, min(canvas_size - 1, int(round(margin + ny * usable))))
        points.append((px, py))

        raw_w = p.get("width")
        if raw_w is not None and float(raw_w) < 1.0:
            w = max(1, int(round(float(raw_w) * usable)))
        elif raw_w is not None:
            w = max(1, int(round(float(raw_w))))
        else:
            w = 2
        widths.append(w)

    if len(points) < 2:
        if points:
            x, y = points[0]
            w = widths[0]
            draw.ellipse((x - w // 2, y - w // 2, x + w // 2, y + w // 2), fill="white")
        return

    for i in range(1, len(points)):
        prev = points[i - 1]
        curr = points[i]
        w = widths[i]
        draw.line([prev, curr], fill="white", width=w)


def drawing_to_tensor(drawing: dict) -> np.ndarray:
    """Konversi JSON gambar QuickDraw ke tensor shape (28, 28, 1)."""
    canvas = Image.new("L", (28, 28), "black")
    strokes = drawing.get("strokes", []) or []

    all_pts = [pt for stroke in strokes if isinstance(stroke, list) for pt in stroke]
    if not all_pts:
        min_x, max_x, min_y, max_y = 0.0, 1.0, 0.0, 1.0
    else:
        min_x = min(float(p.get("x", 0.0)) for p in all_pts)
        max_x = max(float(p.get("x", 0.0)) for p in all_pts)
        min_y = min(float(p.get("y", 0.0)) for p in all_pts)
        max_y = max(float(p.get("y", 0.0)) for p in all_pts)

    width_span = max(max_x - min_x, 1e-5)
    height_span = max(max_y - min_y, 1e-5)
    scale_extent = max(width_span, height_span)

    for stroke in strokes:
        if isinstance(stroke, list):
            _draw_stroke_28(
                canvas,
                stroke,
                min_x,
                min_y,
                scale_extent,
                width_span,
                height_span,
            )

    arr = np.asarray(canvas, dtype=np.float32)
    # Normalisasi ke [0.0, 1.0] (di dalam model MobileNetV2 nanti dikali 255.0)
    arr = arr / 255.0
    arr = np.expand_dims(arr, axis=-1)  # (28, 28, 1)
    return arr


@lru_cache(maxsize=1)
def load_model():
    """Memuat model Keras dan melakukan warmup dengan shape (1, 28, 28, 1)."""
    model_path = os.getenv("MODEL_PATH", DEFAULT_MODEL)

    if not os.path.exists(model_path):
        candidates = [
            str(ROOT_DIR / "weights" / "model_4_mobilenetv2_best.keras"),
            str(ROOT_DIR / "weights" / "model_1_custom_cnn_best.keras"),
            str(ROOT_DIR / "weights" / "model_2_efficientnet_best.keras"),
            str(ROOT_DIR / "weights" / "model_5_resnet18_best.keras"),
        ]
        for cand in candidates:
            if os.path.exists(cand):
                model_path = cand
                break

    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model tidak ditemukan di lokasi: {model_path}")

    print(f"Loading model dari: {model_path}")
    model = tf.keras.models.load_model(model_path, safe_mode=False)

    # Warm-up menggunakan input shape (1, 28, 28, 1)
    dummy_input = np.zeros((1, 28, 28, 1), dtype=np.float32)
    model.predict(dummy_input, verbose=0)
    return model


def predict_from_drawing(drawing: dict) -> List[dict]:
    """Jalankan inferensi dari JSON drawing dan kembalikan top-3 hasil prediksi."""
    model = load_model()
    image = drawing_to_tensor(drawing)            # (28, 28, 1)
    image_batch = np.expand_dims(image, axis=0)    # (1, 28, 28, 1)

    probs = model.predict(image_batch, verbose=0)[0]
    top3_idx = np.argsort(probs)[::-1][:3]

    candidates = []
    for idx in top3_idx:
        label = CATEGORIES[int(idx)]
        candidates.append(
            {
                "label": label,
                "confidence": float(round(float(probs[idx]), 6)),
            }
        )
    return candidates