# Backend: FastAPI + TensorFlow model + SQLite dashboard API.
# Build context is the repo root (needs config.py and weights/), see docker-compose.yml.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TF_CPP_MIN_LOG_LEVEL=2

WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r backend/requirements.txt

COPY config.py ./
COPY weights/ weights/
COPY backend/ backend/

# SQLite database lives here; mounted as a volume so it survives rebuilds.
RUN mkdir -p backend/data
VOLUME ["/app/backend/data"]

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"

# One worker: each worker would load its own copy of the model into memory.
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
