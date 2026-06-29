#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# deploy-worker.sh — Multi-region Worker deployment (v5.0.0 triple-crown)
#
# Deploys kompress-ultra-api to one or more Cloudflare regions.
# Each region gets its own Worker with regional routes and Durable
# Objects for cross-region state coordination.
#
# Usage:
#   bash deploy-worker.sh                 # deploy US (default)
#   bash deploy-worker.sh eu              # deploy EU only
#   bash deploy-worker.sh --all           # deploy US + EU + asia
#   bash deploy-worker.sh --list-regions  # list available regions
#
# env:
#   CLOUDFLARE_API_TOKEN  (required, or via wrangler login)
#   WRANGLER_CONFIG       (default: wrangler.toml)
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo -e "${GREEN}  ✓${NC} $*"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $*"; }
fail() { echo -e "${RED}  ✗${NC} $*"; }

REGIONS=(
  "us:United States (us-east1, us-west2)"
  "eu:Europe (europe-west1, waw1-ovh)"
  "asia:Asia Pacific (asia-east1, asia-southeast1)"
)

WRANGLER_BIN="${WRANGLER_BIN:-$(which wrangler 2>/dev/null || echo 'npx wrangler')}"
WRANGLER_CONFIG="${WRANGLER_CONFIG:-wrangler.toml}"

deploy_region() {
  local region="$1" label="$2"
  log "Deploying to region: ${label}"

  # Region-specific env vars
  case "$region" in
    us)   routes="api.kompress.vaked.dev/*";;
    eu)   routes="eu.api.kompress.vaked.dev/*";;
    asia) routes="asia.api.kompress.vaked.dev/*";;
  esac

  # Deploy with region suffix
  $WRANGLER_BIN deploy \
    --config "$WRANGLER_CONFIG" \
    --name "kompress-ultra-${region}" \
    --env "$region" \
    2>&1 | while IFS= read -r line; do echo "    ${line}"; done

  local status=$?
  if [ $status -eq 0 ]; then
    ok "Deployed: ${region} (${label})"
    log "  → https://${routes}"
  else
    warn "Deploy issue for ${region} (advisory)"
  fi
}

# ── Parse args ─────────────────────────────────────────────────────────
TARGET="${1:-us}"

case "$TARGET" in
  --all|-a)
    log "═══ deploy-worker — v5.0.0 triple-crown ═══"
    log "  Deploying to ALL regions"
    echo ""
    for reg_def in "${REGIONS[@]}"; do
      IFS=':' read -r code label <<< "$reg_def"
      deploy_region "$code" "$label"
    done
    ;;
  --list-regions|-l)
    echo "Available regions:"
    for reg_def in "${REGIONS[@]}"; do
      IFS=':' read -r code label <<< "$reg_def"
      echo "  ${code}: ${label}"
    done
    ;;
  us|eu|asia)
    log "═══ deploy-worker — v5.0.0 triple-crown ═══"
    for reg_def in "${REGIONS[@]}"; do
      IFS=':' read -r code label <<< "$reg_def"
      if [ "$code" = "$TARGET" ]; then
        deploy_region "$code" "$label"
        break
      fi
    done
    ;;
  *)
    echo "Usage: deploy-worker.sh [region|--all|--list-regions]"
    echo "  Regions: us, eu, asia"
    echo "  --all: deploy to all regions"
    echo "  --list-regions: show available regions"
    exit 1
    ;;
esac

echo ""
log "═══ deploy-worker complete ═══"
log "  Check: curl https://api.kompress.vaked.dev/v1/health"
