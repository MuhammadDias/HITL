# evaluate_legacy_models.py
"""Compare the early models trained on the OLD 20 categories (apple, banana, ...).

They must be tested on the old test split (data/processed_data.npz built with the
old categories, float32 in [0, 1]), each with the input size it was trained on:
  Custom CNN 28x28x1, EfficientNet-B0 96x96x3, ResNet-18 56x56x1, MobileNetV2 28x28x1
(resized/converted exactly like archive_unused/0*_train_*.py did via create_dataset).

Outputs (output/evaluation-legacy/): comparison.csv, comparison.md, metrics.json.

  PYTHONPATH=. venv/bin/python train/evaluate_legacy_models.py
"""
import json
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from config import DIR_DATA, DIR_OUTPUT, DIR_WEIGHTS, LEGACY_CATEGORIES  # noqa: E402

OUT = DIR_OUTPUT / "evaluation-legacy"
MODELS = [
    ("Custom CNN", "model_1_custom_cnn_best.keras"),
    ("EfficientNet-B0", "model_2_efficientnet_best.keras"),
    ("ResNet-18", "model_5_resnet18_best.keras"),
    ("MobileNetV2 (lama)", "model_4_mobilenetv2_best.keras"),
]
NOT_AVAILABLE = ["SqueezeNet", "SketchNN"]  # scripts exist in archive_unused/, no trained weights


def main():
    import tensorflow as tf
    from sklearn.metrics import f1_score

    data = np.load(DIR_DATA / "processed_data.npz")
    X, y = data["X_test"], data["y_test_raw"].astype(int)
    if X.dtype != np.float32 or len(LEGACY_CATEGORIES) != int(y.max()) + 1:
        raise SystemExit("data/processed_data.npz bukan data uji kategori lama (float32, 20 kelas lama).")
    print(f"Data uji kategori lama: {len(X):,} gambar")
    OUT.mkdir(parents=True, exist_ok=True)

    rows = []
    for name, filename in MODELS:
        path = DIR_WEIGHTS / filename
        if not path.exists():
            print(f"[lewati] {name}: {filename} tidak ada")
            continue
        model = tf.keras.models.load_model(path, safe_mode=False)
        _, h, w, c = model.input_shape

        def prep(batch):
            batch = tf.convert_to_tensor(batch)
            if (h, w) != (28, 28):
                batch = tf.image.resize(batch, (h, w))
            if c == 3:
                batch = tf.image.grayscale_to_rgb(batch)
            return batch

        ds = tf.data.Dataset.from_tensor_slices(X).batch(512).map(prep, num_parallel_calls=tf.data.AUTOTUNE)
        t0 = time.time()
        probs = model.predict(ds, verbose=0)
        seconds = time.time() - t0
        pred = probs.argmax(axis=1)
        top3 = np.argsort(probs, axis=1)[:, ::-1][:, :3]
        row = {
            "model": name,
            "file": filename,
            "input": f"{h}x{w}x{c}",
            "params": int(model.count_params()),
            "size_mb": round(path.stat().st_size / 1024**2, 1),
            "trained_on": time.strftime("%Y-%m-%d", time.localtime(path.stat().st_mtime)),
            "accuracy": round(float((pred == y).mean()), 4),
            "top3_accuracy": round(float((top3 == y[:, None]).any(axis=1).mean()), 4),
            "f1_macro": round(float(f1_score(y, pred, average="macro")), 4),
            "ms_per_image": round(seconds * 1000 / len(X), 3),
        }
        rows.append(row)
        print(f"{name:<20} acc {row['accuracy']*100:6.2f}%  top3 {row['top3_accuracy']*100:6.2f}%  "
              f"F1 {row['f1_macro']*100:6.2f}%  {row['size_mb']} MB  {row['params']:,} param")

    (OUT / "metrics.json").write_text(json.dumps({"test_images": int(len(X)), "categories": LEGACY_CATEGORIES,
                                                  "models": rows, "not_available": NOT_AVAILABLE}, indent=2))
    cols = ["model", "input", "params", "size_mb", "accuracy", "top3_accuracy", "f1_macro", "ms_per_image", "trained_on"]
    with open(OUT / "comparison.csv", "w") as f:
        f.write(",".join(cols) + "\n")
        for r in rows:
            f.write(",".join(str(r[k]) for k in cols) + "\n")
    md = ["| Model | Input | Parameter | Ukuran | Akurasi | Top-3 | F1 makro | Waktu/gambar (CPU) |",
          "|---|---|---|---|---|---|---|---|"]
    for r in rows:
        md.append(f"| {r['model']} | {r['input']} | {r['params']:,} | {r['size_mb']} MB | {r['accuracy']*100:.2f}% | "
                  f"{r['top3_accuracy']*100:.2f}% | {r['f1_macro']*100:.2f}% | {r['ms_per_image']} ms |")
    for name in NOT_AVAILABLE:
        md.append(f"| {name} | – | – | – | tidak ada model terlatih | – | – | – |")
    (OUT / "comparison.md").write_text("\n".join(md) + "\n")
    print(f"\nHasil: {OUT}")


if __name__ == "__main__":
    main()
