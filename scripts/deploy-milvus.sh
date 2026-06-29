#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# deploy-milvus.sh — Deploy Milvus standalone on OVH Warsaw box
#
# Part of the kompress-ultra ecosystem (v4.0.0 milvus-murmur).
# Deploys: etcd, minio, milvus-standalone, attu (web UI)
#
# Usage:
#   scp -r milvus/ scripts/deploy-milvus.sh scripts/milvus-init.sh ubuntu@145.239.135.16:
#   ssh ubuntu@145.239.135.16
#   sudo bash deploy-milvus.sh
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo -e "${GREEN}  ✓${NC} $*"; }
fail() { echo -e "${RED}  ✗${NC} $*"; }

log "═══ deploy-milvus — v4.0.0 milvus-murmur ═══"

# ── 0. Config ──────────────────────────────────────────────────────────
MILVUS_DIR="/opt/milvus"
DATA_DIR="${MILVUS_DIR}/data"
COMPOSE_FILE="docker-compose.yaml"

# ── 1. Prerequisites ───────────────────────────────────────────────────
log "Checking prerequisites..."
if ! command -v docker &>/dev/null; then
  fail "Docker not installed. Run deploy-ovh.sh first."
  exit 1
fi

if ! command -v docker compose &>/dev/null; then
  log "Installing docker compose plugin..."
  apt-get install -y -qq docker-compose-plugin || {
    fail "Cannot install docker compose"
    exit 1
  }
fi

# ── 2. Create data directories ─────────────────────────────────────────
log "Creating data directories..."
mkdir -p "${DATA_DIR}"/{etcd,minio,milvus}
ok "Data directories created"

# ── 3. Copy compose file ───────────────────────────────────────────────
if [ -f "${COMPOSE_FILE}" ]; then
  cp "${COMPOSE_FILE}" "${MILVUS_DIR}/docker-compose.yaml"
  ok "Compose file copied"
elif [ -f "milvus/${COMPOSE_FILE}" ]; then
  cp "milvus/${COMPOSE_FILE}" "${MILVUS_DIR}/docker-compose.yaml"
  ok "Compose file copied from milvus/"
else
  fail "docker-compose.yaml not found. Copy it to current dir first."
  exit 1
fi

# ── 4. Start Milvus stack ──────────────────────────────────────────────
log "Starting Milvus stack..."
cd "${MILVUS_DIR}"
docker compose pull -q 2>/dev/null || true
docker compose up -d

# ── 5. Wait for Milvus to be healthy ───────────────────────────────────
log "Waiting for Milvus to be ready..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:9091/health > /dev/null 2>&1; then
    ok "Milvus ready after ${i}s"
    break
  fi
  if [ "$i" -eq 30 ]; then
    fail "Milvus did not become ready"
    docker compose logs milvus --tail=20
    exit 1
  fi
  sleep 2
done

# ── 6. Initialize collections ──────────────────────────────────────────
log "Initializing collections..."
if [ -f "milvus-init.sh" ]; then
  bash milvus-init.sh http://localhost:9091
elif [ -f "scripts/milvus-init.sh" ]; then
  bash scripts/milvus-init.sh http://localhost:9091
else
  log "  milvus-init.sh not found, run manually later"
fi

# ── 7. Configure nginx reverse proxy (optional) ────────────────────────
if command -v nginx &>/dev/null && [ ! -f /etc/nginx/sites-enabled/milvus ]; then
  log "Configuring nginx reverse proxy for Milvus HTTP API..."
  cat > /etc/nginx/sites-available/milvus <<'NGINX'
server {
    listen 80;
    server_name milvus.peterl.dev;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:9091;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name attu.milvus.peterl.dev;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX
  ln -sf /etc/nginx/sites-available/milvus /etc/nginx/sites-enabled/
  nginx -t && systemctl reload nginx
  ok "Nginx configured for milvus.peterl.dev + attu.milvus.peterl.dev"
  log "  Run certbot for HTTPS: certbot --nginx -d milvus.peterl.dev -d attu.milvus.peterl.dev"
fi

# ── 8. Status ──────────────────────────────────────────────────────────
echo ""
log "═══ deploy-milvus complete ═══"
docker compose ps
echo ""
log "Milvus HTTP:  http://localhost:9091"
log "Milvus gRPC:  localhost:19530"
log "Attu Web UI:  http://localhost:8000"
log "Public API:   https://milvus.peterl.dev (if DNS + certbot configured)"
log ""
log "Next: sync brain graph to Milvus:"
log "  bash scripts/milvus-sync-brain.sh"
