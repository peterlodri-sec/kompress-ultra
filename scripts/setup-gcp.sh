#!/usr/bin/env bash
# =============================================================================
# setup-gcp.sh — One-time GCP Cloud Build + Artifact Registry setup for v3.0.0
# Usage: bash scripts/setup-gcp.sh [project-id]
#   - Creates Artifact Registry npm repo
#   - Creates Cloud Build trigger (GitHub push)
#   - Enables required APIs if missing
#   - Stores Cloudflare API token in Secret Manager
# =============================================================================
set -euo pipefail

PROJECT="${1:-datapy-spider}"
REPO_NAME="kompress-ultra-npm"
REGION="us-east1"
SERVICE_ACCOUNT="$(gcloud projects get-iam-policy "$PROJECT" --format='value(bindings.members)' --filter='bindings.role=roles/cloudbuild.builds.builder' | head -1)"

echo "═══ setup-gcp.sh — v3.0.0 gilded-pipeline ═══"
echo "  project:      $PROJECT"
echo "  region:       $REGION"
echo "  npm repo:     $REPO_NAME"
echo ""

# ── 1. Ensure required APIs are enabled ────────────────────────────
echo "→ Enabling APIs..."
gcloud services enable \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudkms.googleapis.com \
  --project="$PROJECT"

# ── 2. Create Artifact Registry npm repository ────────────────────
echo "→ Creating Artifact Registry npm repo..."
gcloud artifacts repositories create "$REPO_NAME" \
  --project="$PROJECT" \
  --location="$REGION" \
  --repository-format=npm \
  --description="kompress-ultra npm packages (v3.0.0+)" \
  --async

echo "  → npm registry URL: https://${REGION}-npm.pkg.dev/${PROJECT}/${REPO_NAME}/"

# ── 3. Grant Cloud Build SA permission to push to AR ───────────────
echo "→ Granting Cloud Build SA artifact push permissions..."
gcloud artifacts repositories add-iam-policy-binding "$REPO_NAME" \
  --project="$PROJECT" \
  --location="$REGION" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/artifactregistry.writer" 2>/dev/null || true

# ── 4. Store Cloudflare API token in Secret Manager ──────────────
echo "→ Checking Cloudflare API token in Secret Manager..."
if ! gcloud secrets describe cloudflare-api-token --project="$PROJECT" &>/dev/null; then
  echo "  ⚠️  cloudflare-api-token not found."
  echo "  Create it with:"
  echo "    echo -n 'YOUR_CLOUDFLARE_API_TOKEN' | gcloud secrets create cloudflare-api-token --project=$PROJECT --data-file=-"
  echo "  Then grant access:"
  echo "    gcloud secrets add-iam-policy-binding cloudflare-api-token --project=$PROJECT --member=serviceAccount:${SERVICE_ACCOUNT} --role=roles/secretmanager.secretAccessor"
else
  echo "  ✓ cloudflare-api-token exists"
fi

# ── 5. Create Cloud Build trigger ──────────────────────────────────
echo "→ Creating Cloud Build trigger (push to main)..."
TRIGGER_EXISTS=$(gcloud builds triggers list --project="$PROJECT" --format='value(id)' --filter='name=kompress-ultra-main' 2>/dev/null | head -1)
if [ -z "$TRIGGER_EXISTS" ]; then
  gcloud builds triggers create github \
    --project="$PROJECT" \
    --name="kompress-ultra-main" \
    --region="$REGION" \
    --repo-owner="peterlodri-sec" \
    --repo-name="kompress-ultra" \
    --branch-pattern="^main$" \
    --build-config="cloudbuild.yaml" \
    --substitutions="_REGION=$REGION" \
    --include-logs-with-status
  echo "  ✓ Trigger created"
else
  echo "  ✓ Trigger already exists: $TRIGGER_EXISTS"
fi

# ── 6. Create GitHub Actions OIDC workload identity pool ───────────
echo "→ Checking workload identity federation for GitHub Actions..."
POOL_EXISTS=$(gcloud iam workload-identity-pools list --project="$PROJECT" --location=global --format='value(name)' --filter='display_name=github-actions-pool' 2>/dev/null | head -1)
if [ -z "$POOL_EXISTS" ]; then
  echo "  Skipping — create manually if GH Actions → GCP auth is needed later."
else
  echo "  ✓ Workload identity pool exists"
fi

echo ""
echo "═══ setup complete ═══"
echo "Next: push to main → triggers Cloud Build"
echo "Check: gcloud builds list --project=$PROJECT --limit=5"
