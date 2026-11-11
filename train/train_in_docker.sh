#!/usr/bin/env bash
# Train the model inside a GPU Docker container (no sudo, venv or tmux needed).
# The container runs in the background, so it keeps going after SSH disconnects.
#
#   bash train/train_in_docker.sh          # start
#   docker logs -f hitl-train              # follow progress (Ctrl+C only stops watching)
#   docker stop hitl-train                 # cancel
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE="${TRAIN_IMAGE:-tensorflow/tensorflow:2.21.0-gpu}"   # same TF version as the backend

docker rm -f hitl-train >/dev/null 2>&1 || true
docker run -d --name hitl-train --gpus all \
  --user "$(id -u):$(id -g)" \
  -e HOME=/work/.train-home -e PYTHONPATH=/work -e PYTHONUNBUFFERED=1 \
  -v "$PWD":/work -w /work \
  "$IMAGE" bash -c '
    set -e
    mkdir -p "$HOME"
    pip install --no-cache-dir --user --quiet scikit-learn
    python -c "import tensorflow as tf; g=tf.config.list_physical_devices(\"GPU\"); print(\"GPU:\", g); assert g, \"GPU tidak terdeteksi\""
    python train/01_download_dataset.py
    python train/02_preprocess_data.py
    python train/06_train_mobilenetv2.py
    echo "TRAINING SELESAI"
  '
echo "Training berjalan di container hitl-train. Pantau dengan: docker logs -f hitl-train"
