#!/usr/bin/env bash
# Black-box tests against a temporary backend with its own throwaway database, plus a
# /predict benchmark against the running app (local port and, optionally, the public URL).
# The real database is never touched.
#
#   bash backend/tests/run_tests_in_docker.sh                                  # local only
#   bash backend/tests/run_tests_in_docker.sh https://xxxx.trycloudflare.com   # + via tunnel
#
# Report: output/pengujian/laporan-pengujian-<timestamp>.md
set -euo pipefail
cd "$(dirname "$0")/../.."

PUBLIC_URL="${1:-}"
APP_PORT="$(grep -E '^HTTP_PORT=' .env 2>/dev/null | cut -d= -f2 || true)"
APP_PORT="${APP_PORT:-80}"
TEST_PORT=8090
EMAIL=tester@uji.local
PASSWORD=ujicoba12345

cleanup() { docker rm -f hitl-test >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

echo "Menyalakan backend uji (database sementara) di port $TEST_PORT ..."
docker run -d --name hitl-test -p "127.0.0.1:$TEST_PORT:8000" \
  -e MOMO_DB_PATH=/tmp/uji.sqlite -v "$PWD/weights:/app/weights:ro" hitl-backend >/dev/null
for _ in $(seq 1 90); do
  curl -sf "http://127.0.0.1:$TEST_PORT/health" >/dev/null 2>&1 && break
  sleep 2
done
docker exec hitl-test python backend/create_superadmin.py --email "$EMAIL" --name Penguji --password "$PASSWORD" >/dev/null

BENCH=(--bench "http://localhost:$APP_PORT")
[ -n "$PUBLIC_URL" ] && BENCH+=(--bench "$PUBLIC_URL")

python3 backend/tests/blackbox.py --base "http://127.0.0.1:$TEST_PORT" --email "$EMAIL" --password "$PASSWORD" \
  "${BENCH[@]}" --runs "${RUNS:-50}"
