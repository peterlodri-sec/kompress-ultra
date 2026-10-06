#!/usr/bin/env bash
# smoke.sh — the minimal local inference test (the eval criterion from issue #6):
# bridge up + engine up → one real prompt → "Paris".
#
#   bash bridge/smoke.sh
# env: BRIDGE_URL (default http://127.0.0.1:8088)
set -euo pipefail

BRIDGE_URL="${BRIDGE_URL:-http://127.0.0.1:8088}"

echo "== health"
curl -fsS "$BRIDGE_URL/health" | (command -v jq >/dev/null && jq '{engine, engine_status}' || cat)

echo "== generate"
RESP="$(curl -fsS -X POST "$BRIDGE_URL/generate" \
  -H 'content-type: application/json' \
  -d '{"prompt":"The capital of France is","max_tokens":16,"temperature":0}')"
echo "$RESP"

echo "== verdict"
if printf '%s' "$RESP" | grep -qi 'paris'; then
  echo "SMOKE PASS — the bridge speaks, the engine answers"
else
  echo "SMOKE FAIL — no 'Paris' in the response" >&2
  exit 1
fi
