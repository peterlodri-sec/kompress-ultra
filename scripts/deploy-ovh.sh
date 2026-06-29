#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# OVH Warsaw — Verdaccio + kompress-ultra deploy script
# ─────────────────────────────────────────────────────────────
# Run ONCE on the OVH box (Ubuntu 26.04) after initial SSH.
# Usage:
#   scp scripts/deploy-ovh.sh ubuntu@145.239.135.16:
#   ssh ubuntu@145.239.135.16
#   chmod +x deploy-ovh.sh && sudo ./deploy-ovh.sh
#
# Idempotent — safe to re-run.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo -e "${GREEN}  ✓${NC} $*"; }
fail() { echo -e "${RED}  ✗${NC} $*"; }

log "=== OVH Warsaw — Verdaccio + kompress-ultra deploy ==="

# ── 0. Config ──────────────────────────────────────────────────────────
REGISTRY_DOMAIN="${REGISTRY_DOMAIN:-npm.peterl.dev}"
VERDACCIO_PORT=4873
REPO_URL="https://github.com/peterlodri-sec/kompress-ultra.git"
INSTALL_DIR="/opt/kompress-ultra"
VERDACCIO_USER="${VERDACCIO_USER:-kompress}"

# ── 1. System update + deps ────────────────────────────────────────────
log "Installing system dependencies..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl nginx certbot python3-certbot-nginx apache2-utils ufw

# Docker
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker ubuntu
  ok "Docker installed"
else
  ok "Docker already installed ($(docker --version))"
fi

# Bun
if ! command -v bun &>/dev/null; then
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="/root/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  echo 'export BUN_INSTALL="/root/.bun"' >> ~/.bashrc
  echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc
  ok "Bun installed"
else
  ok "Bun already installed ($(bun --version))"
fi

# ── 3. Clone repo ──────────────────────────────────────────────────────
log "Cloning kompress-ultra..."
if [ -d "$INSTALL_DIR" ]; then
  cd "$INSTALL_DIR" && git pull
  ok "Repo updated"
else
  git clone "$REPO_URL" "$INSTALL_DIR"
  ok "Repo cloned"
fi
cd "$INSTALL_DIR"
bun install --frozen-lockfile 2>/dev/null || bun install
ok "Dependencies installed"

# ── 4. Create verdaccio auth ───────────────────────────────────────────
log "Setting up Verdaccio auth..."
if [ ! -f "verdaccio/htpasswd" ]; then
  # Prompt for password (or set VERDACCIO_PASSWORD env var)
  if [ -z "${VERDACCIO_PASSWORD:-}" ]; then
    echo ""
    echo "Enter password for npm registry user '${VERDACCIO_USER}':"
    read -s VERDACCIO_PASSWORD
    echo ""
  fi
  htpasswd -cB "verdaccio/htpasswd" "$VERDACCIO_USER" <<< "$VERDACCIO_PASSWORD" 2>/dev/null || \
    echo "${VERDACCIO_USER}:$(openssl passwd -6 -salt $(openssl rand -base64 12) ${VERDACCIO_PASSWORD})" > "verdaccio/htpasswd"
  ok "Auth file created"
else
  ok "Auth file exists"
fi

# ── 5. systemd service ─────────────────────────────────────────────────
log "Creating systemd service..."
cat > /etc/systemd/system/verdaccio.service << 'SERVICEEOF'
[Unit]
Description=Verdaccio npm registry
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/kompress-ultra
ExecStart=/root/.bun/bin/bun x verdaccio -c verdaccio/config.yaml
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable --now verdaccio
sleep 3
systemctl is-active --quiet verdaccio && ok "Verdaccio running" || fail "Verdaccio failed to start"
systemctl status verdaccio --no-pager | head -5

# ── 6. nginx proxy ─────────────────────────────────────────────────────
log "Configuring nginx..."
cat > /etc/nginx/sites-available/${REGISTRY_DOMAIN} << NGINXEOF
server {
    listen 80;
    server_name ${REGISTRY_DOMAIN};
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:${VERDACCIO_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /-/health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
NGINXEOF

# Disable default site, enable ours
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/${REGISTRY_DOMAIN} /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx && ok "nginx configured" || fail "nginx config error"

# ── 7. Let's Encrypt (only if domain resolves) ─────────────────────────
if host "${REGISTRY_DOMAIN}" >/dev/null 2>&1; then
  log "Setting up Let's Encrypt for ${REGISTRY_DOMAIN}..."
  certbot --nginx -d "${REGISTRY_DOMAIN}" --non-interactive --agree-tos --email peter@peterl.dev || \
    echo "certbot failed — run manually later"
  ok "TLS configured"
else
  log "Domain ${REGISTRY_DOMAIN} not resolving — skipping TLS (run certbot manually)"
fi

# ── 8. Firewall ────────────────────────────────────────────────────────
log "Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
ok "Firewall active: $(ufw status verbose | head -5)"

# ── 9. Smoke test ──────────────────────────────────────────────────────
log "Running smoke tests..."
sleep 2
curl -sf http://localhost:${VERDACCIO_PORT}/-/ping >/dev/null && ok "Verdaccio responds on :${VERDACCIO_PORT}" || fail "Verdaccio not responding"
curl -sf http://localhost/-/health >/dev/null && ok "nginx health endpoint OK" || fail "nginx health failing"

# ── 10. Summary ────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ OVH Warsaw — Deploy Complete"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  Registry:     https://${REGISTRY_DOMAIN}"
echo "  Health:       https://${REGISTRY_DOMAIN}/-/health"
echo "  Internal:     http://localhost:${VERDACCIO_PORT}"
echo ""
echo "  Next steps:"
echo "    1. Configure DNS: ${REGISTRY_DOMAIN} → ${REGISTRY_DOMAIN}"
echo "    2. Run TLS if skipped: sudo certbot --nginx -d ${REGISTRY_DOMAIN}"
echo "    3. Publish package: cd ${INSTALL_DIR} && npm publish"
echo ""
echo "  Secrets saved in repo: docs/deploy/ovh-secrets.json.age"
echo "  Decrypt: age --decrypt -i ~/.config/sops/age/keys.txt docs/deploy/ovh-secrets.json.age"
echo ""
echo "═══════════════════════════════════════════════════"
