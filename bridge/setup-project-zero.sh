#!/usr/bin/env bash
# setup-project-zero.sh — build Project Zero from source and fetch a model it loads.
#
# The engine's release tarballs are x86_64-linux; on Apple Silicon (and any
# host) we build from source — pure C99, GCC/Clang + make, NEON supported.
# Run from anywhere:  bash bridge/setup-project-zero.sh
set -euo pipefail

PZ_DIR="${PZ_DIR:-$HOME/project-zero}"
MODEL_DIR="${MODEL_DIR:-$HOME/models}"
# Default: a model Project Zero loads today (verified live: the bridge's
# smoke passes with it). Supported families: dense GGUF (F16/BF16/Q4_K/
# Q5_K/Q6_K/Q8_0/IQ4_NL…) and Bonsai-style group-128 Q2_0.
# NOT loadable: the bitnet i2_s ternaries (Falcon3-1.58bit, ms-bitnet gguf) —
# the loader rejects quant type 36. For BitNet b1.58 itself, convert the BF16
# master weights to a BF16 GGUF (the model behind PZ's own "PZ BF16"
# benchmark), or use the Bonsai Q2_0 file named in the PZ README.
# MODEL_FILE='' downloads the whole repo.
MODEL_REPO="${MODEL_REPO:-bartowski/SmolLM2-1.7B-Instruct-GGUF}"
MODEL_FILE="${MODEL_FILE:-SmolLM2-1.7B-Instruct-Q4_K_M.gguf}"
PZ_PORT="${PZ_PORT:-8090}"   # NOTE: 8080 is taken on this Mac (litellm caddy)

echo "== 1/3 engine: $PZ_DIR"
if [ ! -d "$PZ_DIR/.git" ]; then
  git clone https://github.com/shifulegend/project-zero "$PZ_DIR"
fi
cd "$PZ_DIR"
git pull --ff-only || true
echo "== 2/3 build (make release)"
make release

echo "== 3/3 model: $MODEL_REPO"
mkdir -p "$MODEL_DIR"
if command -v hf >/dev/null 2>&1; then
  hf download "$MODEL_REPO" ${MODEL_FILE} --local-dir "$MODEL_DIR"
elif command -v huggingface-cli >/dev/null 2>&1; then
  huggingface-cli download "$MODEL_REPO" ${MODEL_FILE} --local-dir "$MODEL_DIR"
else
  echo "!! no huggingface client found — install one (pip install -U huggingface_hub) and re-run," >&2
  echo "   or download the .gguf manually into $MODEL_DIR" >&2
  exit 1
fi

GGUF="$(find "$MODEL_DIR" -name '*.gguf' | head -n1 || true)"
if [ -z "$GGUF" ]; then
  echo "!! no .gguf found under $MODEL_DIR" >&2
  exit 1
fi

echo
echo "engine: $PZ_DIR/adaptive_ai_engine"
echo "model:  $GGUF"
echo
echo "run the engine:"
echo "  $PZ_DIR/adaptive_ai_engine --model \"$GGUF\" --server --port $PZ_PORT"
echo
echo "then the bridge:"
echo "  PZ_URL=http://127.0.0.1:$PZ_PORT bun run bridge/pz-bridge.ts"
