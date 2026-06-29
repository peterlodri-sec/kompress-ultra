# ─────────────────────────────────────────────────────────────────────────
# GCP Infrastructure — kompress-ultra (v7.0.0 terraform-sonata)
# ─────────────────────────────────────────────────────────────────────────
terraform {
  required_version = ">= 1.9"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.0, < 7.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ── Artifact Registry (npm) ─────────────────────────────────────────────
resource "google_artifact_registry_repository" "npm" {
  repository_id = "kompress-ultra-npm"
  description   = "kompress-ultra npm packages (v3.0.0+)"
  location      = var.region
  format        = "NPM"
  labels = {
    managed-by = "terraform"
    project    = "kompress-ultra"
  }
}

# ── Secret Manager secrets ──────────────────────────────────────────────
locals {
  secrets = {
    cloudflare-api-token = "Cloudflare API token for wrangler deploy"
    npm-auth-token       = "NPM auth token for Artifact Registry publish"
    worker-auth-token    = "Worker AUTH_TOKEN for production"
    openrouter-api-key   = "OpenRouter API key for CI fleet agents"
    github-pat           = "GitHub Personal Access Token for CI"
  }
}

resource "google_secret_manager_secret" "secrets" {
  for_each = local.secrets

  secret_id = each.key
  labels = {
    managed-by = "terraform"
    project    = "kompress-ultra"
  }

  replication {
    auto {}
  }
}

# ── Cloud Build trigger ─────────────────────────────────────────────────
resource "google_cloudbuild_trigger" "main" {
  name        = "kompress-ultra-main"
  description = "Cloud Build trigger for main branch"

  github {
    owner = "peterlodri-sec"
    name  = "kompress-ultra"
    push {
      branch = "^main$"
    }
  }

  filename = "cloudbuild.yaml"

  substitutions = {
    _REGION = var.region
  }

  include_logs_with_status = true
}

# ── Outputs ─────────────────────────────────────────────────────────────
output "artifact_registry_url" {
  value = "${var.region}-npm.pkg.dev/${var.project_id}/${google_artifact_registry_repository.npm.repository_id}"
}

output "secret_ids" {
  value = [for k, s in google_secret_manager_secret.secrets : s.id]
}
