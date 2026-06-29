# Infrastructure-as-Code — kompress-ultra

This directory contains Terraform configs to manage all infrastructure:
- **GCP**: Cloud Build triggers, Artifact Registry, Secret Manager
- **Cloudflare**: Workers, DNS records, KV namespaces

## Structure

```
infrastructure/
├── gcp/           # Google Cloud Platform resources
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── cloudflare/    # Cloudflare resources
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
└── modules/       # Reusable Terraform modules
    ├── worker-deploy/
    ├── brain-graph/
    └── ci-state/
```

## Prerequisites

```bash
# GCP auth
gcloud auth application-default login

# Cloudflare API token
export CLOUDFLARE_API_TOKEN="your-token"

# Terraform init
terraform -chdir=infrastructure/gcp init
terraform -chdir=infrastructure/cloudflare init
```

## Usage

```bash
# Plan
terraform -chdir=infrastructure/gcp plan

# Apply
terraform -chdir=infrastructure/gcp apply -auto-approve

# Destroy
terraform -chdir=infrastructure/gcp destroy
```

## Resources Managed

### GCP
- `google_cloudbuild_trigger` — Cloud Build trigger for main branch
- `google_artifact_registry_repository` — npm package registry
- `google_secret_manager_secret` — Cloudflare API token, npm auth, etc.
- `google_service_account` — Cloud Build service account
- `google_project_iam_member` — IAM bindings

### Cloudflare
- `cloudflare_worker_script` — kompress-ultra-api Worker
- `cloudflare_worker_route` — API routes
- `cloudflare_record` — DNS records (api.kompress.vaked.dev)
- `cloudflare_kv_namespace` — KOMPRESS_STATS KV

## State

Terraform state is stored locally by default.
For team use, configure a GCS backend:

```hcl
terraform {
  backend "gcs" {
    bucket = "kompress-ultra-tfstate"
    prefix = "terraform/state"
  }
}
```
