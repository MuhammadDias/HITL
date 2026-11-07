#!/usr/bin/env bash
# Interactive test fixture for partner API contract (DRAFT)
# Usage: ./test_partner_api.sh [endpoint_url]

set -euo pipefail

ENDPOINT="${1:-http://localhost:8080/predict}"

echo "=== Partner API Test Fixture (DRAFT) ==="
echo "Endpoint: $ENDPOINT"
echo ""

REQUEST='{"drawing":{"strokes":[[{"x":0.1,"y":0.2},{"x":0.3,"y":0.4},{"x":0.5,"y":0.6}],[{"x":0.7,"y":0.8},{"x":0.9,"y":0.9}]],"hasInk":true,"aspectRatio":1.333}}'

echo "Request payload:"
echo "$REQUEST" | jq .
echo ""

echo "Sending request..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" -H "Content-Type: application/json" -d "$REQUEST")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "HTTP Status: $HTTP_CODE"
echo ""
echo "Response body:"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
echo ""

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "OK Request succeeded"
else
  echo "FAIL Request failed with status $HTTP_CODE"
  exit 1
fi
