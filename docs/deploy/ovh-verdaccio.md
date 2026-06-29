# Deploy: OVH Warsaw — Private npm Registry (Verdaccio)

## Overview

| Item | Value |
|------|-------|
| Provider | OVHcloud (WAW1) |
| IP | `145.239.135.16` |
| OS | Ubuntu 26.04 |
| CPU | 4 vCore |
| RAM | 16 GB |
| SSH user | `ubuntu` |
| SSH key | `new-cloud-peter` (`~/.ssh/id_ed25519_ovhcloud0627`) |

**Purpose**: Self-hosted npm registry for `kompress-ultra` and ecosystem packages,
plus future services (Milvus, model serving, etc.).

---

## Architecture

```
┌─────────────────────────────┐
│       Internet              │
│  npm.peterl.dev:443         │
└──────────┬──────────────────┘
           │ HTTPS (Let's Encrypt)
┌──────────▼──────────────────┐
│  nginx (reverse proxy)      │
│  / → verdaccio :4873        │
│  /health → health check     │
└──────────┬──────────────────┘
           │ localhost
┌──────────▼──────────────────┐
│  Verdaccio (npm registry)   │
│  auth: htpasswd (bcrypt)    │
│  storage: ./storage         │
│  uplink: npmjs.org          │
└─────────────────────────────┘
```

---

## Secrets

All secrets are encrypted with `age` and stored in this repo:

**File**: `docs/deploy/ovh-secrets.json.age`

**Decrypt**:
```bash
age --decrypt -i ~/.config/sops/age/keys.txt docs/deploy/ovh-secrets.json.age
```

**Contents**:

| Secret | Purpose |
|--------|---------|
| `ovh.ip` | Server IP |
| `ovh.user` | SSH user |
| `verdaccio.user` | npm registry login username |
| `verdaccio.password` | npm registry login password |
| `verdaccio.port` | Registry listen port |
| `verdaccio.domain` | Registry domain |
| `worker.auth_token` | AUTH_TOKEN for the Worker |

---

## Provisioning

### 1. SSH

```bash
ssh ubuntu@145.239.135.16 -i ~/.ssh/id_ed25519_ovhcloud0627
```

### 2. Install Dependencies

```bash
sudo apt update && sudo apt upgrade -y

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu

# Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# nginx
sudo apt install -y nginx certbot python3-certbot-nginx

# Verify
docker --version && bun --version && nginx -v
```

### 3. Clone Repo

```bash
git clone https://github.com/peterlodri-sec/kompress-ultra.git /opt/kompress-ultra
cd /opt/kompress-ultra
bun install
```

### 4. Configure Verdaccio

Edit `verdaccio/config.yaml` for production:

```yaml
#
# Production config — OVH Warsaw
#
storage: ./storage
auth:
  htpasswd:
    file: ./htpasswd
    algorithm: bcrypt
    rounds: 10
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
    max_fails: 40
    maxage: 30m
    timeout: 60s
packages:
  'kompress-ultra':
    access: $all
    publish: $authenticated
    unpublish: $authenticated
    proxy: npmjs
  '**':
    access: $all
    publish: $authenticated
    proxy: npmjs
listen: 0.0.0.0:4873
web:
  enable: false
log:
  - { type: stdout, format: pretty, level: http }
```

### 5. Create Auth

```bash
# Use htpasswd to create user (requires apache2-utils)
sudo apt install -y apache2-utils
htpasswd -cB verdaccio/htpasswd kompress
# Enter the password from the encrypted secrets file
```

Or use Docker to generate the bcrypt hash:

```bash
docker run --rm -it xmartlabs/htpasswd kompress
```

### 6. systemd Service

Create `/etc/systemd/system/verdaccio.service`:

```ini
[Unit]
Description=Verdaccio npm registry
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/kompress-ultra
ExecStart=/usr/local/bin/bun x verdaccio -c verdaccio/config.yaml
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now verdaccio
sudo systemctl status verdaccio
```

### 7. nginx Reverse Proxy

Create `/etc/nginx/sites-available/npm.peterl.dev`:

```nginx
server {
    listen 80;
    server_name npm.peterl.dev;

    location / {
        proxy_pass http://127.0.0.1:4873;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /-/health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

Enable and get TLS:

```bash
sudo ln -s /etc/nginx/sites-available/npm.peterl.dev /etc/nginx/sites-enabled/
sudo nginx -t
sudo certbot --nginx -d npm.peterl.dev
sudo systemctl reload nginx
```

### 8. Publish Package

```bash
cd /opt/kompress-ultra
npm set registry https://npm.peterl.dev
npm set //npm.peterl.dev/:_authToken=$(node -e "
  const http = require('http');
  const d = JSON.stringify({name:'kompress',password:'VERDACCIO_PASSWORD'});
  const r = http.request({hostname:'localhost',port:4873,path:'/-/user/org.couchdb.user:kompress',method:'PUT',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(d)}}, res => {
    let b=''; res.on('data',c=>b+=c); res.on('end',() => console.log(JSON.parse(b).token));
  });
  r.write(d); r.end();
")
npm publish
```

### 9. Firewall

```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP (certbot)
sudo ufw allow 443/tcp     # HTTPS
sudo ufw default deny incoming
sudo ufw --force enable
```

### 10. Smoke Test

```bash
# From local machine:
npm ping --registry https://npm.peterl.dev
npm view kompress-ultra --registry https://npm.peterl.dev
npm install kompress-ultra --registry https://npm.peterl.dev --dry-run
```

---

## Maintenance

### Start / Stop / Restart

```bash
sudo systemctl {start,stop,restart,status} verdaccio
```

### Logs

```bash
sudo journalctl -u verdaccio -f
```

### Upgrade

```bash
cd /opt/kompress-ultra
git pull
bun install
bun run build
npm publish
```

### Backup

```bash
# Backup storage + config
tar -czf /tmp/verdaccio-backup-$(date +%Y%m%d).tar.gz \
  /opt/kompress-ultra/verdaccio/storage \
  /opt/kompress-ultra/verdaccio/htpasswd \
  /opt/kompress-ultra/verdaccio/config.yaml
```

---

## Registry Usage

### Publish a Package

```bash
# Configure auth
npm set //npm.peterl.dev/:_authToken=YOUR_TOKEN

# Publish
npm publish --registry https://npm.peterl.dev
```

### Install from Registry

```bash
# Per command
npm install kompress-ultra --registry https://npm.peterl.dev

# Or permanently
npm set registry https://npm.peterl.dev
```

### For bun

```bash
bun install kompress-ultra --registry https://npm.peterl.dev
```

---

## Related Docs

- [README.md](../../README.md) — Main project docs
- [TELEMETRY.md](../../TELEMETRY.md) — Telemetry policy
- [AGENTS.md](../../AGENTS.md) — Agent guide
- [server/worker.ts](../../server/worker.ts) — Worker source
- [verdaccio/config.yaml](../../verdaccio/config.yaml) — Registry config

---

## Secrets Recovery

The encrypted secrets file `docs/deploy/ovh-secrets.json.age` can only be
decrypted with the age private key at `~/.config/sops/age/keys.txt`.

```bash
age --decrypt -i ~/.config/sops/age/keys.txt docs/deploy/ovh-secrets.json.age
```

If that key is lost, the secrets are unrecoverable. Keep a backup of the
age key in a secure location.
