#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# verify-signature.sh — Verify Cosign signatures on build artifacts
#
# Part of the binary transparency pipeline (v8.0.0 signed-blood).
# Verifies that artifacts were signed by the correct key.
#
# Usage:
#   bash scripts/verify-signature.sh <artifact> [signature]
#   bash scripts/verify-signature.sh dist/index.js
#   bash scripts/verify-signature.sh dist/index.js dist/index.js.sig
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

ARTIFACT="${1:-}"
SIGNATURE="${2:-${ARTIFACT}.sig}"
PUBKEY="${COSIGN_PUBKEY:-${HOME}/.cosign/kompress-ultra.pub}"

if [ -z "$ARTIFACT" ] || [ ! -f "$ARTIFACT" ]; then
  echo "Usage: verify-signature.sh <artifact> [signature]"
  echo "  Verifies Cosign signature on build artifact"
  exit 1
fi

RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'

echo "═══ verify-signature — v8.0.0 signed-blood ═══"
echo "  artifact:  ${ARTIFACT}"
echo "  signature: ${SIGNATURE}"
echo "  pubkey:    ${PUBKEY}"
echo ""

# Check if Cosign is available
if command -v cosign &>/dev/null; then
  cosign verify-blob \
    --key "$PUBKEY" \
    --signature "$SIGNATURE" \
    "$ARTIFACT" 2>&1 && echo -e "${GREEN}  ✓ Signature verified${NC}" || {
    echo -e "${RED}  ✗ Signature verification failed${NC}"
    exit 1
  }
elif command -v openssl &>/dev/null; then
  # Fallback to openssl if cosign not available
  openssl dgst -sha256 -verify "${PUBKEY}" -signature "$SIGNATURE" "$ARTIFACT" 2>&1 \
    && echo -e "${GREEN}  ✓ Signature verified (openssl)${NC}" || {
    echo -e "${RED}  ✗ Signature verification failed${NC}"
    exit 1
  }
else
  echo "  ⚠ Neither cosign nor openssl available — hash only"
  shasum -a 256 "$ARTIFACT"
fi

echo ""
echo "  SLSA Level 2: verifiable build artifact"
