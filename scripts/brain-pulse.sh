#!/usr/bin/env bash
# brain-pulse — heartbeat for the brain graph
# Runs the full cycle: chaos → repair → sync → commit
# Call from cron every 30 minutes.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "[pulse] $(date -u +%H:%M:%S) — beat"
bash scripts/bodhisattva.sh 2>/dev/null || true
bash scripts/repair-bot.sh 2>/dev/null || true
bash scripts/ultramesh-mem.sh status 2>/dev/null || true
bash scripts/brain-graph.sh sync 2>/dev/null || true
bash scripts/brain-graph.sh commit 2>/dev/null || true
echo "[pulse] $(date -u +%H:%M:%S) — done"
