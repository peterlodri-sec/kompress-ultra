#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# feed — one wire: dogfeed → 1-bit model → vector
#
# Usage:
#   feed         — single pass
#   feed loop   — continuous: fetch → model → repeat
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(python3 -c "import os; print(os.path.dirname(os.path.dirname(os.path.realpath('${BASH_SOURCE[0]}'))))")"
MODEL="${FEED_MODEL:-/tmp/BitNet/models/BitNet-b1.58-2B-4T-gguf/ggml-model-i2_s.gguf}"
BITNET="${BITNET_ROOT:-/tmp/BitNet}"
DATASET="PeetPedro/ultrawhale-dogfood"
CACHE="$HOME/.cache/feed"
mkdir -p "$CACHE"

HF_TOKEN="${HF_TOKEN:-}"
[ -z "$HF_TOKEN" ] && { echo "HF_TOKEN not set"; exit 1; }

CY='\033[0;36m' GN='\033[0;32m' DIM='\033[2m' RS='\033[0m' R='\033[0;31m'

fetch() {
  local name
  name=$(curl -s -H "Authorization: Bearer $HF_TOKEN" \
    "https://huggingface.co/api/datasets/$DATASET" | \
    python3 -c "
import json,sys
d=json.load(sys.stdin)
s=[s for s in d.get('siblings',[]) if 'telemetry/batch' in s['rfilename']]
print(s[-1]['rfilename'] if s else '')
" 2>/dev/null) || return 1
  [ -z "$name" ] && return 1
  local f="$CACHE/$(basename "$name")"
  [ ! -f "$f" ] && curl -s -H "Authorization: Bearer $HF_TOKEN" \
    "https://huggingface.co/datasets/$DATASET/resolve/main/$name" -o "$f"
  echo "$f"
}

feed_once() {
  local f="$1"; shift
  local prompt
  prompt=$(python3 -c "
import json
with open('${f}') as fh:
    for l in fh:
        l=l.strip()
        if l: entry=json.loads(l); break
print(json.dumps(entry)[:200])
" 2>/dev/null) || prompt="dogfeed signal $(date -u +%H:%M:%S)"

  echo -e "  ${CY}→${RS} ${DIM}${prompt:0:80}...${RS}"
  cd "$BITNET"
  python3 run_inference.py -m "$MODEL" -p "$prompt" -n 15 --temp 0.8 2>&1 | \
    grep -v "^llama_\|^ggml_\|^main:\|^common_\|^generate:\|^\s*$" || true
  cd "$ROOT" 2>/dev/null || true
}

cmd_once() {
  local f=$(fetch) || { echo -e "  ${R}✗${RS} no batch"; exit 1; }
  echo -e "  ${CY}feed:${RS} $(basename $f)"
  feed_once "$f"
  echo -e "  ${GN}✓${RS}"
}

cmd_loop() {
  local int="${1:-60}" i=1
  while true; do
    echo -e "  ${DIM}── cycle ${i} ───────────────${RS}"
    local f=$(fetch) || true
    [ -n "$f" ] && feed_once "$f" || echo -e "  ${R}✗${RS} no batch"
    echo -e "  ${DIM}── sleep ${int}s ───────────${RS}"
    sleep "$int"; i=$((i+1))
  done
}

case "${1:-once}" in
  once|"") cmd_once ;;
  loop)    shift; cmd_loop "${1:-60}" ;;
  *)       echo "feed [once|loop]"; exit 1 ;;
esac
