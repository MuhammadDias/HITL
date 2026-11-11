#!/usr/bin/env bash
# Train the model inside a GPU Docker container (no sudo, venv or tmux needed).
# The container runs in the background, so it keeps going after SSH disconnects.
#
#   bash train/train_in_docker.sh          # start
#   docker logs -f hitl-train              # follow progress (Ctrl+C only stops watching)
#   docker stop hitl-train                 # cancel
#
# Reuses the backend image (already has TensorFlow 2.21) and adds only the NVIDIA
# CUDA pip libraries (~3 GB, kept in .train-home/ so they install once). The
# official tensorflow:*-gpu image is ~8 GB, too big for a small server disk.
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE="${TRAIN_IMAGE:-hitl-backend}"

docker rm -f hitl-train >/dev/null 2>&1 || true
docker run -d --name hitl-train --gpus all \
  --user "$(id -u):$(id -g)" \
  -e HOME=/work/.train-home -e PYTHONPATH=/work -e PYTHONUNBUFFERED=1 \
  -e NVIDIA_DRIVER_CAPABILITIES=compute,utility \
  -v "$PWD":/work -w /work \
  --entrypoint bash \
  "$IMAGE" -c '
    set -e
    mkdir -p "$HOME"
    pip install --no-cache-dir --user --quiet "tensorflow[and-cuda]==2.21.0" scikit-learn
    # TensorFlow does not look in the user site for the pip CUDA libs: point the loader at them.
    export LD_LIBRARY_PATH="$(python -c "import glob, os, site; print(\":\".join(glob.glob(os.path.join(site.getusersitepackages(), \"nvidia\", \"*\", \"lib\"))))")${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
    python -c "import tensorflow as tf; g=tf.config.list_physical_devices(\"GPU\"); print(\"GPU:\", g); assert g, \"GPU tidak terdeteksi\""
    python train/01_download_dataset.py
    python train/02_preprocess_data.py
    python train/06_train_mobilenetv2.py
    echo "TRAINING SELESAI"
  '
echo "Training berjalan di container hitl-train. Pantau dengan: docker logs -f hitl-train"
