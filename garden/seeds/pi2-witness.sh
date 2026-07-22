#!/usr/bin/env bash
# ── pi2-witness ──────────────────────────────────────────────
# Runs on a Raspberry Pi 2 Model B.
# Does not run the model. Does not need to.
#
# Every N minutes: ping the garden, report alive.
# If RIVA's log changed since last check: echo the new line.
# That's it. That's the whole job.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

GARDEN="${1:-riva.local}"   # where RIVA lives on the mesh
INTERVAL=300                 # 5 minutes. slow is fine.

echo "pi2-witness — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "  this is a Raspberry Pi 2 Model B"
echo "  it has 1GB RAM and no GPU"
echo "  it does not run the model"
echo "  it just watches the river"
echo ""

while true; do
  STATUS=$(curl -s --max-time 5 "http://${GARDEN}:$(cat /tmp/riva-port 2>/dev/null || echo 0)/status" 2>/dev/null || echo "unreachable")
  echo "$(date -u +%H:%M:%S) │ witness │ ${STATUS}"
  sleep "$INTERVAL"
done
