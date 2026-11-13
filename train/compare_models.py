# compare_models.py
"""Compare every trained architecture on the same test split (the game's 20 categories).

For each model in MODELS whose weights exist (and were trained on the current
categories, i.e. have a .labels.json), compute accuracy, top-3, macro F1, size,
parameters, CPU/GPU time per image, training time and epochs. Also plot the
per-epoch accuracy/loss curves from output/training/<model>_history.csv.

Outputs (output/comparison/):
  comparison.md / comparison.csv   one row per model
  curves_<model>.png               accuracy & loss per epoch (when a history CSV exists)
  val_accuracy_all.png             validation accuracy of every model in one chart

  PYTHONPATH=. python train/compare_models.py     (run by train/train_all_models.sh)
"""
import importlib.util
import json
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from config import DIR_DATA, DIR_OUTPUT, DIR_WEIGHTS  # noqa: E402
from utils import DIR_TRAINING_LOG, create_dataset  # noqa: E402

# name, model file prefix, create_dataset() options used when it was trained
MODELS = [
    ("Custom CNN", "model_1_custom_cnn", {}),
    ("EfficientNet-B0", "model_2_efficientnet", {"target_size": (96, 96), "num_channels": 3}),
    ("SqueezeNet", "model_3_squeezenet", {"target_size": (64, 64), "num_channels": 3}),
    ("MobileNetV2", "model_4_mobilenetv2", {}),
    ("ResNet-18", "model_5_resnet18", {"target_size": (56, 56)}),
    ("SketchNN", "model_6_sketchnn", {"sobel_edge": True}),
]
OUT = DIR_OUTPUT / "comparison"


def _register_custom_layers():
    """SketchNN uses a custom layer that must be registered before loading."""
    path = Path(__file__).with_name("08_train_sketchnn.py")
    spec = importlib.util.spec_from_file_location("train_sketchnn", path)
    spec.loader.exec_module(importlib.util.module_from_spec(spec))


def _plot_history(name, prefix, plt):
    csv = DIR_TRAINING_LOG / f"{prefix}_history.csv"
    if not csv.exists():
        return None
    hist = np.genfromtxt(csv, delimiter=",", names=True)
    hist = np.atleast_1d(hist)
    epochs = np.arange(1, len(hist) + 1)
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 4.2))
    a1.plot(epochs, hist["accuracy"] * 100, label="train")
    a1.plot(epochs, hist["val_accuracy"] * 100, label="validasi")
    a1.set_title(f"{name}: akurasi per epoch")
    a1.set_xlabel("epoch")
    a1.set_ylabel("akurasi (%)")
    a1.grid(alpha=0.3)
    a1.legend()
    a2.plot(epochs, hist["loss"], label="train")
    a2.plot(epochs, hist["val_loss"], label="validasi")
    a2.set_title(f"{name}: loss per epoch")
    a2.set_xlabel("epoch")
    a2.set_ylabel("loss")
    a2.grid(alpha=0.3)
    a2.legend()
    fig.tight_layout()
    fig.savefig(OUT / f"curves_{prefix}.png", dpi=150)
    plt.close(fig)
    return epochs, hist["val_accuracy"] * 100


def main():
    import tensorflow as tf
    from sklearn.metrics import f1_score
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    _register_custom_layers()
    OUT.mkdir(parents=True, exist_ok=True)
    data = np.load(DIR_DATA / "processed_data.npz")
    X, y_onehot, y = data["X_test"], data["y_test"], data["y_test_raw"].astype(int)
    print(f"Data uji: {len(X):,} gambar")

    rows, curves = [], []
    for name, prefix, opts in MODELS:
        path = DIR_WEIGHTS / f"{prefix}_best.keras"
        if not path.exists() or not (DIR_WEIGHTS / f"{prefix}.labels.json").exists():
            print(f"[lewati] {name}: belum ada model dengan kategori game")
            continue
        model = tf.keras.models.load_model(path, safe_mode=False)
        ds = create_dataset(X, y_onehot, 256, is_training=False, **opts)
        t0 = time.time()
        probs = model.predict(ds, verbose=0)
        seconds = time.time() - t0
        pred = probs.argmax(axis=1)
        top3 = np.argsort(probs, axis=1)[:, ::-1][:, :3]
        result_file = DIR_TRAINING_LOG / f"{prefix}_result.json"
        trained = json.loads(result_file.read_text()) if result_file.exists() else {}
        row = {
            "model": name,
            "input": "x".join(str(d) for d in model.input_shape[1:]),
            "params": int(model.count_params()),
            "size_mb": round(path.stat().st_size / 1024**2, 1),
            "accuracy": round(float((pred == y).mean()), 4),
            "top3_accuracy": round(float((top3 == y[:, None]).any(axis=1).mean()), 4),
            "f1_macro": round(float(f1_score(y, pred, average="macro")), 4),
            "ms_per_image": round(seconds * 1000 / len(X), 3),
            "train_minutes": trained.get("minutes"),
            "epochs": trained.get("epochs_run"),
        }
        rows.append(row)
        curve = _plot_history(name, prefix, plt)
        if curve:
            curves.append((name, *curve))
        print(f"{name:<16} acc {row['accuracy']*100:6.2f}%  top3 {row['top3_accuracy']*100:6.2f}%  "
              f"F1 {row['f1_macro']*100:6.2f}%  {row['size_mb']} MB")

    if curves:
        fig, ax = plt.subplots(figsize=(9, 5))
        for name, epochs, val in curves:
            ax.plot(epochs, val, label=name)
        ax.set_title("Akurasi validasi per epoch")
        ax.set_xlabel("epoch")
        ax.set_ylabel("akurasi validasi (%)")
        ax.grid(alpha=0.3)
        ax.legend()
        fig.tight_layout()
        fig.savefig(OUT / "val_accuracy_all.png", dpi=150)

    cols = ["model", "input", "params", "size_mb", "accuracy", "top3_accuracy", "f1_macro",
            "ms_per_image", "train_minutes", "epochs"]
    with open(OUT / "comparison.csv", "w") as f:
        f.write(",".join(cols) + "\n")
        for r in rows:
            f.write(",".join("" if r[k] is None else str(r[k]) for k in cols) + "\n")
    fmt = lambda v, s="": "–" if v is None else f"{v}{s}"  # noqa: E731
    md = [f"Data uji: {len(X):,} gambar, 20 kategori game (6.000 per kategori).", "",
          "| Model | Input | Parameter | Ukuran | Akurasi | Top-3 | F1 makro | Inferensi/gambar | Lama training | Epoch |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    for r in sorted(rows, key=lambda r: r["accuracy"], reverse=True):
        md.append(f"| {r['model']} | {r['input']} | {r['params']:,} | {r['size_mb']} MB | {r['accuracy']*100:.2f}% | "
                  f"{r['top3_accuracy']*100:.2f}% | {r['f1_macro']*100:.2f}% | {r['ms_per_image']} ms | "
                  f"{fmt(r['train_minutes'], ' menit')} | {fmt(r['epochs'])} |")
    (OUT / "comparison.md").write_text("\n".join(md) + "\n")
    print(f"\nHasil: {OUT}")
    print("PERBANDINGAN SELESAI")


if __name__ == "__main__":
    main()
