#!/usr/bin/env bash
# setup-project-zero.sh — build Project Zero from source and fetch a 1.58-bit model.
#
# The engine's release tarballs are x86_64-linux; on Apple Silicon (and any
# host) we build from source — pure C99, GCC/Clang + make, NEON supported.
# Run from anywhere:  bash bridge/setup-project-zero.sh
set -euo pipefail

PZ_DIR="${PZ_DIR:-$HOME/project-zero}"
MODEL_DIR="${MODEL_DIR:-$HOME/models}"
# default model per kompress-ultra#6 (Falcon3-3B-Instruct-1.58bit);
# alternative: microsoft/bitnet-b1.58-2B-4T (Project Zero's flagship demo)
MODEL_REPO="${MODEL_REPO:-tiiuae/Falcon3-3B-Instruct-1.58bit-gguf}"
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
  hf download "$MODEL_REPO" --local-dir "$MODEL_DIR"
elif command -v huggingface-cli >/dev/null 2>&1; then
  huggingface-cli download "$MODEL_REPO" --local-dir "$MODEL_DIR"
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
