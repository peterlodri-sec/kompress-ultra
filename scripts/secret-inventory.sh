#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# secret-inventory.sh — List all secrets and their status
#
# Usage: bash scripts/secret-inventory.sh
# Shows: GCP secrets, age-encrypted files, local env files, env refs in code
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT="${1:-datapy-spider}"

echo "═══ Secret Inventory — $(date -u +%Y-%m-%d) ═══"
echo ""

# ── 1. GCP Secret Manager ─────────────────────────────────────────────
echo "1. GCP Secret Manager (project: ${PROJECT})"
echo "   ───────────────────────────────────────"
gcloud secrets list --project="$PROJECT" \
  --format='table(name, createTime.date("%Y-%m-%d"):label=Created, labels)' \
  2>/dev/null || echo "   (none)"
echo ""

# ── 2. age-encrypted files ────────────────────────────────────────────
echo "2. age-encrypted files"
echo "   ───────────────────────"
AGE_FILES=$(find . -name "*.age" -type f 2>/dev/null | head -10)
if [ -n "$AGE_FILES" ]; then
  for f in $AGE_FILES; do
    SIZE=$(stat -f%z "$f" 2>/dev/null || echo "?")
    echo "   ${f}"
    echo "    size=${SIZE}B  decrypt: age --decrypt -i ~/.config/sops/age/keys.txt ${f}"
  done
else
  echo "   (none)"
fi
echo ""

# ── 3. Local env files ────────────────────────────────────────────────
echo "3. Local environment files"
echo "   ─────────────────────────"
ENV_FILES=$(find ~ -maxdepth 4 -name ".env" -o -name "*.env" -o -name "*.env.local" 2>/dev/null | grep -v node_modules | grep -v '.cache' | grep -v '.nix' | head -10)
if [ -n "$ENV_FILES" ]; then
  for f in $ENV_FILES; do
    echo "   ${f/#${HOME}\/\~/.}"
  done
else
  echo "   (none found in standard locations)"
fi
echo ""

# ── 4. process.env references in code ─────────────────────────────────
echo "4. process.env / env var references in code"
echo "   ─────────────────────────────────────────"
ENV_REFS=$(grep -roPh 'process\.env\.\w+' src/ server/ --include="*.ts" 2>/dev/null | sort -u)
if [ -n "$ENV_REFS" ]; then
  for ref in $ENV_REFS; do
    var=${ref#process.env.}
    echo "   ${var}"
  done
else
  echo "   (none)"
fi
echo ""

# ── 5. Cloud Build secret references ──────────────────────────────────
echo "5. Cloud Build secret references"
echo "   ───────────────────────────────"
if [ -f "cloudbuild.yaml" ]; then
  grep -A 2 'secretEnv:\|secretManager:' cloudbuild.yaml 2>/dev/null | head -20
else
  echo "   (no cloudbuild.yaml)"
fi
echo ""

# ── 6. CI workflow secret references ──────────────────────────────────
echo "6. GitHub Actions secret references"
echo "   ──────────────────────────────────"
GH_SECRETS=$(grep -roPh 'secrets\.\w+' .github/workflows/ --include="*.yml" 2>/dev/null | sort -u)
if [ -n "$GH_SECRETS" ]; then
  for s in $GH_SECRETS; do
    echo "   ${s#secrets.}"
  done
else
  echo "   (none)"
fi

echo ""
echo "═══ End of inventory ═══"
