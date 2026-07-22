#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# feed — one wire: dogfeed → 1-bit model → vector
#
# Usage:
#   feed              — single pass with full debug log
#   feed loop [sec]   — continuous: fetch → model → repeat
#   feed debug        — same as feed, verbose
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(python3 -c "import os; print(os.path.dirname(os.path.dirname(os.path.realpath('${BASH_SOURCE[0]}'))))")"
MODEL="${FEED_MODEL:-/tmp/BitNet/models/BitNet-b1.58-2B-4T-gguf/ggml-model-i2_s.gguf}"
BITNET="${BITNET_ROOT:-/tmp/BitNet}"
DATASET="PeetPedro/ultrawhale-dogfood"
CACHE="$HOME/.cache/feed"
mkdir -p "$CACHE"

HF_TOKEN="${HF_TOKEN:-}"
[ -z "$HF_TOKEN" ] && { echo "ERROR: HF_TOKEN not set"; echo "  Get one at https://huggingface.co/settings/tokens"; exit 1; }

# ── Timestamp ──────────────────────────────────────────────
now() { date -u +%H:%M:%S; }

# ── Step 1: Fetch latest dogfeed batch ─────────────────────
fetch() {
  echo "  [$(now)] dogfeed │ fetching latest batch from ${DATASET}..." >&2

  local name
  name=$(curl -s -H "Authorization: Bearer $HF_TOKEN" \
    "https://huggingface.co/api/datasets/$DATASET" | \
    python3 -c "
import json,sys
d=json.load(sys.stdin)
s=[s for s in d.get('siblings',[]) if 'telemetry/batch' in s['rfilename']]
if s: print(s[-1]['rfilename'])
" 2>/dev/null) || { echo "  [$(now)] dogfeed │ ERROR: cannot fetch batch list" >&2; return 1; }

  [ -z "$name" ] && { echo "  [$(now)] dogfeed │ WARN: no batches found" >&2; return 1; }

  local f="$CACHE/$(basename "$name")"
  if [ ! -f "$f" ]; then
    echo "  [$(now)] dogfeed │ downloading: $name" >&2
    curl -s -H "Authorization: Bearer $HF_TOKEN" \
      "https://huggingface.co/datasets/$DATASET/resolve/main/$name" -o "$f"
    local sz=$(wc -c < "$f" | tr -d ' ')
    echo "  [$(now)] dogfeed │ saved: ${sz} bytes to cache" >&2
  else
    local sz=$(wc -c < "$f" | tr -d ' ')
    local entries=$(wc -l < "$f" | tr -d ' ')
    echo "  [$(now)] dogfeed │ cached: ${sz} bytes, ${entries} entries" >&2
  fi

  echo "$f"
}

# ── Step 2+3: Extract prompt + infer ──────────────────────
infer_from_file() {
  local f="$1"
  # Read first line of batch as prompt
  local line prompt
  read -r line < "$f" 2>/dev/null || true
  prompt=$(python3 -c "import json,sys; print(json.dumps(json.loads(sys.argv[1]))[:150])" "$line" 2>/dev/null)
  [ -z "$prompt" ] && prompt="dogfeed $(now)"

  echo "  [$(now)] prompt  │ ${prompt:0:100}"
  echo "  [$(now)] model   │ inferring (Apple M1 Pro GPU, 2.4B 1-bit)..."
  echo ""

  local result
  result=$(cd "$BITNET" && LLAMA_ARG_N_GPU_LAYERS=99 \
    python3 run_inference.py \
      -m "$MODEL" -p "$prompt" -n 20 --temp 0.8 2>/dev/null | \
    grep -v '^\s*$' | tail -1)
  echo "  │ ${result:-"(no output)"}"
  cd "$ROOT" 2>/dev/null || true
}

# ── Single pass ──────────────────────────────────────────────
cmd_once() {
  local f=$(fetch) || { echo "  [$(now)] ERROR: fetch failed"; exit 1; }

  echo "  [$(now)] loop    │ ──────────────────────────"
  infer_from_file "$f"
  echo "  [$(now)] loop    │ ──────────────────────────"

  echo ""
  echo "  ✅ feed complete"
}

# ── Continuous loop with adaptive breath ────────────────────
cmd_loop() {
  local i=1 breath=60 last_batch="" stale_count=0
  echo ""
  echo "  ╔══════════════════════════════════════════╗"
  echo "  ║     bombbit — the 1-bit breath          ║"
  echo "  ║     dogfeed → model → vector → adapt    ║"
  echo "  ╚══════════════════════════════════════════╝"
  echo ""
  echo "  model: BitNet-b1.58 2.4B (I2_S ternary)"
  echo "  backend: Apple M1 Pro (Metal GPU)"
  echo "  source: ${DATASET}"
  echo ""

  while true; do
    echo ""
    echo "  ═══ beat ${i} ═══ $(now) ═══ breath ${breath}s ═══"

    local f=$(fetch) || { stale_count=$((stale_count + 1)); f=""; }

    if [ -n "$f" ] && [ -f "$f" ]; then
      # Did we get something new?
      if [ "$f" != "$last_batch" ]; then
        echo "  [$(now)] breath  │ fresh data — short breath"
        breath=60
        stale_count=0
        last_batch="$f"
        echo "  [$(now)] loop    │ ──────────────────────────"
        infer_from_file "$f"
        echo "  [$(now)] loop    │ ──────────────────────────"
      else
        # Same batch as before — nothing new in the pipeline
        stale_count=$((stale_count + 1))
        case "$stale_count" in
          1) breath=120  ; echo "  [$(now)] breath  │ same batch — cooling..." ;;
          2) breath=300  ; echo "  [$(now)] breath  │ no new data — slow breath" ;;
          3) breath=600  ; echo "  [$(now)] breath  │ still quiet — resting" ;;
          *) breath=1800 ; echo "  [$(now)] breath  │ deep sleep — will check in 30m" ;;
        esac
        echo "  [$(now)] loop    │ cached: $(basename "$f")"
      fi
    else
      # Fetch failed entirely
      stale_count=$((stale_count + 1))
      breath=300
      echo "  [$(now)] breath  │ no batch — ${breath}s rest"
    fi

    echo "  ═══ ${breath}s until next beat ════════════"
    sleep "$breath"
    i=$((i + 1))
  done
}

# ── Main ─────────────────────────────────────────────────────
case "${1:-once}" in
  once|"")  cmd_once ;;
  loop)     cmd_loop ;;
  debug)    cmd_once ;;
  *)
    echo "feed — one wire from dogfeed → 1-bit model → vector"
    echo ""
    echo "Usage:"
    echo "  feed              single pass (debug logs)"
    echo "  feed loop         adaptive: dogfeed → 1-bit → breath"
    echo ""
    echo "Env:"
    echo "  HF_TOKEN          HuggingFace token (required)"
    echo "  FEED_MODEL        path to GGUF model"
    exit 1
    ;;
esac
