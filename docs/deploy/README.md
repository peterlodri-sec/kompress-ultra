# Deploy Guides

## OVH Warsaw — Private npm Registry

**[ovh-verdaccio.md](./ovh-verdaccio.md)**

Full E2E deployment guide for the OVHcloud server at `145.239.135.16`:
Verdaccio npm registry behind nginx + Let's Encrypt, systemd service,
firewall, smoke tests.

| File | Purpose |
|------|---------|
| `ovh-verdaccio.md` | Full provisioning guide (every command) |
| `ovh-secrets.json.age` | Encrypted secrets (age recipient key in doc) |
| `../../scripts/deploy-ovh.sh` | One-shot deploy script (idempotent) |

### Prerequisites

1. SSH access to `ubuntu@145.239.135.16` with key `new-cloud-peter`
2. DNS record for `npm.peterl.dev` → `145.239.135.16`
3. Age key at `~/.config/sops/age/keys.txt` (for secrets decryption)

### Quick Start

```bash
# Copy deploy script to OVH box
scp scripts/deploy-ovh.sh ubuntu@145.239.135.16:

# SSH and run
ssh ubuntu@145.239.135.16
chmod +x deploy-ovh.sh
sudo ./deploy-ovh.sh
```

## Cloudflare Worker

The kompress-ultra API Worker is deployed via `wrangler deploy`:

| Property | Value |
|----------|-------|
| URL | `https://kompress-ultra-api.cabotage.workers.dev` |
| KV | `KOMPRESS_STATS` (`id: 8dbcbdc2d5574e399abfebd7f31b7bb5`) |
| Auth | `AUTH_TOKEN` secret set |
| Config | `wrangler.toml` in repo root |

```bash
# Deploy
cd /path/to/kompress-ultra
wrangler deploy

# Set secrets
wrangler secret put AUTH_TOKEN
```
