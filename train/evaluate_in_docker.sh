#!/usr/bin/env bash
# Evaluate the active model on the test split inside Docker (CPU is enough, ~5-15 min).
# Results: output/evaluation/  (metrics.json, per_class.csv, confusion_matrix.png/.csv, ...)
#
#   bash train/evaluate_in_docker.sh
#   docker logs -f hitl-eval
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f data/processed_data.npz ] || { echo "data/processed_data.npz tidak ada: jalankan training dulu"; exit 1; }

docker rm -f hitl-eval >/dev/null 2>&1 || true
docker run -d --name hitl-eval \
  --user "$(id -u):$(id -g)" \
  -e HOME=/work/.eval-home -e PYTHONPATH=/work -e PYTHONUNBUFFERED=1 -e CUDA_VISIBLE_DEVICES= \
  -v "$PWD":/work -w /work \
  --entrypoint bash \
  "${EVAL_IMAGE:-hitl-backend}" -c '
    set -e
    mkdir -p "$HOME"
    pip install --no-cache-dir --user --quiet scikit-learn matplotlib
    python train/evaluate_model.py
  '
echo "Evaluasi berjalan di container hitl-eval. Pantau dengan: docker logs -f hitl-eval"
