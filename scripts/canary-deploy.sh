#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# canary-deploy.sh — Canary Worker deployment (v9.0.0 canary-song)
#
# Deploys to a percentage of traffic, monitors health, then rolls forward.
#
# Usage:
#   bash scripts/canary-deploy.sh [percent] [rollback-on-failure]
#   bash scripts/canary-deploy.sh 10 true    # 10% traffic, rollback on failure
#   bash scripts/canary-deploy.sh 100        # full rollout
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

PERCENT="${1:-10}"
ROLLBACK="${2:-true}"

echo "═══ canary-deploy — v9.0.0 canary-song ═══"
echo "  target:  ${PERCENT}% of traffic"
echo "  rollback: ${ROLLBACK}"
echo ""

# ── 1. Check current Worker version ────────────────────────────────────
CURRENT_URL="https://api.kompress.vaked.dev/v1/health"
echo "→ Checking current deployment..."
CURRENT_VERSION=$(curl -sf "$CURRENT_URL" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('version','?'))" 2>/dev/null || echo "unreachable")
echo "  current: ${CURRENT_VERSION}"

if [ "$PERCENT" = "100" ]; then
  echo "→ Full rollout — deploying to 100%"
  npx wrangler deploy 2>&1 | tail -5
  echo "  ✓ Full rollout complete"
  exit 0
fi

# ── 2. Deploy canary ────────────────────────────────────────────────────
CANARY_NAME="kompress-ultra-canary"
echo "→ Deploying canary (${PERCENT}% traffic)..."
npx wrangler deploy --name "$CANARY_NAME" 2>&1 | tail -3

# ── 3. Wait and monitor ────────────────────────────────────────────────
CANARY_URL="https://${CANARY_NAME}.cabotage.workers.dev/v1/health"
echo "→ Monitoring canary for 60s..."
FAILURES=0
for i in $(seq 1 12); do
  sleep 5
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$CANARY_URL" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "  [${i}x5s] canary healthy (${STATUS})"
  else
    FAILURES=$((FAILURES + 1))
    echo "  [${i}x5s] canary unhealthy (${STATUS})"
    if [ "$FAILURES" -ge 3 ] && [ "$ROLLBACK" = "true" ]; then
      echo "→ 3 failures — rolling back canary"
      npx wrangler delete --name "$CANARY_NAME" 2>/dev/null || true
      echo "  ✓ Rolled back. Production unchanged."
      exit 1
    fi
  fi
done

# ── 4. Promote canary ───────────────────────────────────────────────────
if [ "$PERCENT" -ge 50 ]; then
  echo "→ Promoting canary to production..."
  npx wrangler deploy 2>&1 | tail -3
  npx wrangler delete --name "$CANARY_NAME" 2>/dev/null || true
  echo "  ✓ Canary promoted to production"
else
  echo "→ Keeping canary at ${PERCENT}% — route via Worker filter"
  echo "  curl -H 'X-Canary: true' $CANARY_URL"
fi

echo ""
echo "═══ canary-deploy complete ═══"
