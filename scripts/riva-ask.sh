#!/usr/bin/env bash
# riva ask — sovereign 1-bit inference for any coding agent
# usage: riva ask "your prompt"
#        echo "prompt" | riva ask
# no cloud. no api key. no GPU. runs on M1.

MODEL="${RIVA_MODEL:-/tmp/BitNet/models/BitNet-b1.58-2B-4T-gguf/ggml-model-i2_s.gguf}"
BITNET="${RIVA_BITNET:-/tmp/BitNet}"

if [ -t 0 ]; then
  PROMPT="${*:-hello}"
else
  PROMPT=$(cat)
fi

cd "$BITNET" || { echo "error: bitnet not found at $BITNET"; exit 1; }
LLAMA_ARG_N_GPU_LAYERS=99 python3 run_inference.py \
  -m "$MODEL" \
  -p "$PROMPT" \
  -n 30 \
  --temp 0.8 2>/dev/null | grep -v '^\s*$' | tail -1

echo ""
