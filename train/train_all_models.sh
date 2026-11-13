#!/usr/bin/env bash
# Retrain the other five architectures on the game's 20 categories (same data and split
# as the final MobileNetV2), one after another on one GPU, then compare all six.
#
#   bash train/train_all_models.sh
#   docker logs -f hitl-train            # progress; "PERBANDINGAN SELESAI" at the end
#
# The active MobileNetV2 is not retrained or touched. Older models in weights/ that were
# trained on the old categories (no .labels.json) are moved to weights/backup/legacy/
# first, otherwise training would resume from them instead of starting fresh.
# Results: output/training/ (history + result per model), output/comparison/ (table, charts).
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p weights/backup/legacy
for prefix in model_1_custom_cnn model_2_efficientnet model_3_squeezenet model_5_resnet18 model_6_sketchnn; do
  if [ ! -f "weights/$prefix.labels.json" ]; then
    for f in weights/${prefix}_best.keras weights/${prefix}_latest.keras weights/${prefix}.weights.h5; do
      [ -f "$f" ] && mv "$f" weights/backup/legacy/ && echo "dipindah ke backup/legacy: $f"
    done
  fi
done

TRAIN_SCRIPTS="train/03_train_custom_cnn.py train/08_train_sketchnn.py train/05_train_squeezenet.py train/07_train_resnet18.py train/04_train_efficientnet.py" \
AFTER_SCRIPT=train/compare_models.py \
  bash train/train_in_docker.sh
