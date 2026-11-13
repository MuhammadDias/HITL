# evaluate_model.py
"""Evaluate the active model on the test split and save report files.

Outputs (output/evaluation/):
  metrics.json             accuracy, top-3, macro/weighted F1, per-class precision/recall/F1
  per_class.csv            the same per-class numbers as a table
  confusion_matrix.csv     counts, rows = true label, columns = predicted label
  confusion_matrix.png     row-normalized heatmap (percent of each true class)
  top_confusions.csv       most frequent true -> predicted mistakes
  lookalike_pairs.csv      error rates for the look-alike pairs used in the game design

Run on the server with: bash train/evaluate_in_docker.sh
"""
import json
import os
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from config import DIR_DATA, DIR_OUTPUT  # noqa: E402

MODEL_PATH = Path(os.getenv("MODEL_PATH", ROOT / "weights" / "model_4_mobilenetv2_best.keras"))
LABELS_PATH = Path(str(MODEL_PATH).replace("_best.keras", "").replace(".keras", "") + ".labels.json")
OUT = DIR_OUTPUT / "evaluation"

# Pairs the game treats as look-alikes (docs/USULAN-LABEL-LEVEL.md).
LOOKALIKE_PAIRS = [
    ("tangga", "pagar"), ("tangga", "anak tangga"), ("gergaji", "zigzag"), ("petir", "zigzag"),
    ("ular", "garis"), ("pisau", "pedang"), ("jembatan", "bangku"), ("bangku", "meja"),
]


def main():
    import tensorflow as tf
    from sklearn.metrics import confusion_matrix, f1_score, precision_recall_fscore_support

    OUT.mkdir(parents=True, exist_ok=True)
    labels_file = json.loads(LABELS_PATH.read_text())
    labels = [labels_file["labels_id"].get(c, c) for c in labels_file["categories"]]

    print(f"Model : {MODEL_PATH}")
    print(f"Labels: {LABELS_PATH}")
    data = np.load(DIR_DATA / "processed_data.npz")
    X_test, y_test = data["X_test"], data["y_test_raw"].astype(int)
    print(f"Data uji: {len(X_test):,} gambar")

    model = tf.keras.models.load_model(MODEL_PATH, safe_mode=False)
    t0 = time.time()
    probs = model.predict(X_test.astype("float32") / 255.0, batch_size=512, verbose=1)
    seconds = time.time() - t0

    pred = probs.argmax(axis=1)
    top3 = np.argsort(probs, axis=1)[:, ::-1][:, :3]
    n = len(labels)
    acc = float((pred == y_test).mean())
    top3_acc = float((top3 == y_test[:, None]).any(axis=1).mean())
    f1_macro = float(f1_score(y_test, pred, average="macro"))
    f1_weighted = float(f1_score(y_test, pred, average="weighted"))
    prec, rec, f1, support = precision_recall_fscore_support(y_test, pred, labels=range(n), zero_division=0)
    cm = confusion_matrix(y_test, pred, labels=range(n))

    per_class = [
        {"label": labels[i], "precision": round(float(prec[i]), 4), "recall": round(float(rec[i]), 4),
         "f1": round(float(f1[i]), 4), "support": int(support[i])}
        for i in range(n)
    ]
    metrics = {
        "model": MODEL_PATH.name,
        "model_size_mb": round(MODEL_PATH.stat().st_size / 1024**2, 2),
        "test_images": int(len(X_test)),
        "accuracy": round(acc, 4),
        "top3_accuracy": round(top3_acc, 4),
        "f1_macro": round(f1_macro, 4),
        "f1_weighted": round(f1_weighted, 4),
        "inference_seconds_total": round(seconds, 1),
        "per_class": per_class,
    }
    (OUT / "metrics.json").write_text(json.dumps(metrics, ensure_ascii=False, indent=2))

    with open(OUT / "per_class.csv", "w", encoding="utf-8") as f:
        f.write("label,precision,recall,f1,support\n")
        for r in sorted(per_class, key=lambda r: r["f1"]):
            f.write(f'{r["label"]},{r["precision"]},{r["recall"]},{r["f1"]},{r["support"]}\n')

    with open(OUT / "confusion_matrix.csv", "w", encoding="utf-8") as f:
        f.write("true\\pred," + ",".join(labels) + "\n")
        for i in range(n):
            f.write(labels[i] + "," + ",".join(str(int(v)) for v in cm[i]) + "\n")

    totals = cm.sum(axis=1)
    mistakes = [(labels[i], labels[j], int(cm[i, j]), cm[i, j] / totals[i]) for i in range(n) for j in range(n) if i != j and cm[i, j]]
    mistakes.sort(key=lambda m: m[2], reverse=True)
    with open(OUT / "top_confusions.csv", "w", encoding="utf-8") as f:
        f.write("true,predicted,count,percent_of_true_class\n")
        for t, p, c, r in mistakes[:30]:
            f.write(f"{t},{p},{c},{r*100:.2f}\n")

    idx = {l: i for i, l in enumerate(labels)}
    with open(OUT / "lookalike_pairs.csv", "w", encoding="utf-8") as f:
        f.write("a,b,a_predicted_as_b_percent,b_predicted_as_a_percent,rank_among_all_mistakes\n")
        ranks = {(t, p): k + 1 for k, (t, p, _, _) in enumerate(mistakes)}
        for a, b in LOOKALIKE_PAIRS:
            if a not in idx or b not in idx:
                continue
            i, j = idx[a], idx[b]
            ab, ba = cm[i, j] / totals[i] * 100, cm[j, i] / totals[j] * 100
            rank = min(ranks.get((a, b), 10**6), ranks.get((b, a), 10**6))
            f.write(f"{a},{b},{ab:.2f},{ba:.2f},{rank if rank < 10**6 else '-'}\n")

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    norm = cm / np.maximum(totals[:, None], 1) * 100
    fig, ax = plt.subplots(figsize=(13, 11))
    im = ax.imshow(norm, cmap="Blues", vmin=0, vmax=100)
    ax.set_xticks(range(n), labels, rotation=60, ha="right")
    ax.set_yticks(range(n), labels)
    ax.set_xlabel("Prediksi model")
    ax.set_ylabel("Label sebenarnya")
    ax.set_title(f"Confusion matrix MobileNetV2 (data uji {len(X_test):,} gambar, % per baris)")
    for i in range(n):
        for j in range(n):
            if norm[i, j] >= 0.5:
                ax.text(j, i, f"{norm[i, j]:.0f}" if norm[i, j] >= 10 else f"{norm[i, j]:.1f}",
                        ha="center", va="center", fontsize=7, color="white" if norm[i, j] > 50 else "black")
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04, label="%")
    fig.tight_layout()
    fig.savefig(OUT / "confusion_matrix.png", dpi=160)

    print(f"\nAkurasi        : {acc*100:.2f}%")
    print(f"Top-3          : {top3_acc*100:.2f}%")
    print(f"F1 macro       : {f1_macro*100:.2f}%")
    print(f"F1 weighted    : {f1_weighted*100:.2f}%")
    print("\n5 pasangan paling sering tertukar:")
    for t, p, c, r in mistakes[:5]:
        print(f"  {t:>12} -> {p:<12} {c:>5} gambar ({r*100:.2f}% dari {t})")
    print(f"\nHasil tersimpan di: {OUT}")
    print("EVALUASI SELESAI")


if __name__ == "__main__":
    main()
