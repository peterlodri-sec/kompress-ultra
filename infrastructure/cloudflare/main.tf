terraform {
  required_version = ">= 1.9"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# ── KV Namespace ────────────────────────────────────────────────────────
resource "cloudflare_workers_kv_namespace" "stats" {
  account_id = var.cloudflare_account_id
  title      = "KOMPRESS_STATS"
}

# ── Worker script ───────────────────────────────────────────────────────
resource "cloudflare_worker_script" "api" {
  account_id = var.cloudflare_account_id
  name       = "kompress-ultra-api"
  content    = file("../../server/worker.ts")
  module     = true

  # KV binding
  kv_namespace_binding {
    name       = "KOMPRESS_STATS"
    namespace_id = cloudflare_workers_kv_namespace.stats.id
  }

  # Environment variables
  plain_text_binding {
    name = "VERSION"
    text = "7.0.0"
  }
  plain_text_binding {
    name = "REGION"
    text = "us"
  }
}

# ── Worker route ────────────────────────────────────────────────────────
resource "cloudflare_worker_route" "api" {
  zone_id = var.cloudflare_zone_id
  pattern = "api.kompress.vaked.dev/*"
  script  = cloudflare_worker_script.api.name
}

resource "cloudflare_worker_route" "garden" {
  zone_id = var.cloudflare_zone_id
  pattern = "garden.vaked.dev/*"
  script  = cloudflare_worker_script.api.name
}

# ── DNS records ─────────────────────────────────────────────────────────
resource "cloudflare_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = "api.kompress"
  type    = "CNAME"
  value   = "kompress-ultra-api.cabotage.workers.dev"
  proxied = true
}

resource "cloudflare_record" "garden" {
  zone_id = var.cloudflare_zone_id
  name    = "garden"
  type    = "CNAME"
  value   = "kompress-ultra-api.cabotage.workers.dev"
  proxied = true
}

# ── Outputs ─────────────────────────────────────────────────────────────
output "worker_url" {
  value = "https://api.kompress.vaked.dev"
}

output "kv_namespace_id" {
  value = cloudflare_workers_kv_namespace.stats.id
}
