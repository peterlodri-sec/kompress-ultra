#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# secret-migrate.sh — Migrate secrets to GCP Secret Manager (v6.0.0)
#
# Usage: bash scripts/secret-migrate.sh [--apply]
#   Without --apply: dry-run (list what needs migration)
#   With --apply:  create missing secrets
#
# This migrates from:
#   - age-encrypted files (docs/deploy/ovh-secrets.json.age)
#   - Local env files (~/.brain/*.env)
#   - Unencrypted references in code/docs
# To:
#   - GCP Secret Manager (projects/datapy-spider)
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo -e "${GREEN}  ✓${NC} $*"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $*"; }
fail() { echo -e "${RED}  ✗${NC} $*"; }
action() { echo -e "${YELLOW}  ▶${NC} $*"; }

APPLY="${1:-}"
MODE="dry-run"
[ "$APPLY" = "--apply" ] && MODE="apply"

PROJECT="datapy-spider"
log "═══ secret-migrate — v6.0.0 secret-garden [${MODE}] ═══"
echo ""

# ── 1. Check existing GCP secrets ─────────────────────────────────────
log "1. Existing GCP secrets..."
EXISTING=$(gcloud secrets list --project="$PROJECT" --format='value(name)' 2>/dev/null)
EXISTING_COUNT=$(echo "$EXISTING" | wc -l | tr -d ' ')
echo "  ${EXISTING_COUNT} secrets in Secret Manager"

# ── 2. Required kompress-ultra secrets ────────────────────────────────
REQUIRED_SECRETS=(
  "cloudflare-api-token:Cloudflare API token for wrangler deploy"
  "npm-auth-token:NPM auth token for Artifact Registry publish"
  "ovh-ssh-key:OVH SSH private key (145.239.135.16)"
  "ovh-verdaccio-password:Verdaccio htpasswd password"
  "worker-auth-token:Worker AUTH_TOKEN for production"
  "openrouter-api-key:OpenRouter API key for CI fleet agents"
  "github-pat:GitHub Personal Access Token for CI"
)

MISSING=0
log "2. Required secrets audit..."
for entry in "${REQUIRED_SECRETS[@]}"; do
  IFS=':' read -r name desc <<< "$entry"
  if echo "$EXISTING" | grep -q "^${name}$"; then
    ok "${name} — exists"
  else
    warn "${name} — MISSING (${desc})"
    MISSING=$((MISSING + 1))
    
    if [ "$MODE" = "apply" ]; then
      # Create placeholder — actual value must be injected via --data-file
      action "Creating placeholder for ${name}..."
      cat <<PLACEHOLDER | gcloud secrets create "${name}" \
        --project="$PROJECT" \
        --data-file=- \
        --labels="purpose=kompress-ultra,managed-by=crush" \
        2>&1 | head -1 || warn "Failed to create ${name}"
set-me-manually-via: echo -n 'actual-value' | gcloud secrets versions add ${name} --data-file=-
PLACEHOLDER
      ok "${name} created (placeholder)"
    fi
  fi
done

echo ""

# ── 3. age-encrypted secrets file ─────────────────────────────────────
log "3. age-encrypted secrets..."
AGE_FILE="docs/deploy/ovh-secrets.json.age"
if [ -f "$AGE_FILE" ]; then
  AGE_CHECK=$(head -c 30 "$AGE_FILE")
  if echo "$AGE_CHECK" | grep -q "age-encryption"; then
    ok "${AGE_FILE} — valid age-encrypted file"
    echo "  Decrypt with: age --decrypt -i ~/.config/sops/age/keys.txt ${AGE_FILE}"
    echo "  Then migrate each field to Secret Manager."
  else
    warn "${AGE_FILE} — invalid format"
  fi
else
  warn "${AGE_FILE} — not found"
fi

echo ""

# ── 4. Secret references in code ──────────────────────────────────────
log "4. Hardcoded secret references in code..."
SECRET_REFS=$(grep -rn 'password\|secret\|token\|api.key' \
  --include="*.ts" --include="*.json" --include="*.toml" --include="*.yaml" --include="*.yml" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
  src/ server/ .github/ 2>/dev/null | \
  grep -iv 'node_modules\|\.git\|type\|interface\|schema\|example\|default\|environment\|env\.\|process\.env' | \
  grep -i '=\s*['\''\"]' | grep -iv 'localhost\|example\|placeholder\|http://\|https://' | head -10)

if [ -n "$SECRET_REFS" ]; then
  warn "Potential hardcoded secrets:"
  echo "$SECRET_REFS" | while IFS= read -r line; do
    echo "    $line"
  done
else
  ok "No obvious hardcoded secrets"
fi

echo ""

# ── 5. Cloud Build secret references ──────────────────────────────────
log "5. Cloud Build secret references..."
CB_SECRETS=$(grep -oP 'secretEnv:\s*\[[^\]]+\]|secretManager:' cloudbuild.yaml 2>/dev/null | head -5)
if [ -n "$CB_SECRETS" ]; then
  ok "Cloud Build references secrets:"
  echo "    $CB_SECRETS" | while IFS= read -r line; do
    echo "    $line"
  done
else
  warn "Cloud Build has no secret references"
fi

# ── 6. Summary ─────────────────────────────────────────────────────────
echo ""
log "═══ secret-migrate summary [${MODE}] ═══"
echo ""
echo "  Existing:       ${EXISTING_COUNT} secrets in GCP"
echo "  Missing:        ${MISSING} kompress-ultra secrets"
echo "  Age files:      ${AGE_FILE}"
echo "  Cloud Build:    references ${CB_SECRETS:+present}${CB_SECRETS:-absent}"
echo ""
if [ $MISSING -gt 0 ] && [ "$MODE" = "dry-run" ]; then
  echo "  Run with --apply to create missing secrets:"
  echo "    bash scripts/secret-migrate.sh --apply"
  echo "  Then inject real values:"
  echo "    echo -n 'real-value' | gcloud secrets versions add <name> --data-file=-"
fi
