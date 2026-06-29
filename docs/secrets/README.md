# Secrets Management — v6.0.0 secret-garden

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              GCP Secret Manager                          │
│  projects/datapy-spider/secrets/                        │
│                                                          │
│  cloudflare-api-token    → Cloudflare Workers deploy     │
│  npm-auth-token          → Artifact Registry publish     │
│  ovh-ssh-key             → OVH box SSH access            │
│  ovh-verdaccio-password  → npm registry auth             │
│  worker-auth-token       → Worker AUTH_TOKEN             │
│  openrouter-api-key      → CI fleet agents               │
│  github-pat              → GitHub API for CI              │
│                                                          │
│  (existing)                                               │
│  ATTIC_TOKEN             → Nix binary cache              │
│  gh-nix-*-oauthtoken-*   → Nix GitHub OAuth              │
│  webhook-trigger-secret  → Webhook trigger               │
└──────────────────────────┬──────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        Cloud Build    Workers     Local dev
        (secrets via   (env vars   (gcloud auth
         Secret        via         application-
         Manager)     wrangler     default)
                       secrets)
```

## Secret Naming Convention

```
{service}-{purpose}
```

Examples: `cloudflare-api-token`, `ovh-ssh-key`, `worker-auth-token`

## Creating Secrets

```bash
# Create a new secret (plain text)
echo -n 'your-actual-secret-value' | \
  gcloud secrets create cloudflare-api-token \
    --project=datapy-spider \
    --data-file=-

# Add a new version to an existing secret
echo -n 'rotated-value' | \
  gcloud secrets versions add cloudflare-api-token \
    --data-file=-
```

## Reading Secrets

```bash
# Access secret value (requires secretmanager.secretAccessor)
gcloud secrets versions access latest \
  --secret=cloudflare-api-token \
  --project=datapy-spider

# In Cloud Build (via availableSecrets)
# See cloudbuild.yaml for examples
```

## Access Control

```bash
# Grant a service account access to a secret
gcloud secrets add-iam-policy-binding cloudflare-api-token \
  --project=datapy-spider \
  --member="serviceAccount:service-892063015227@gcp-sa-cloudbuild.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Grant your user access
gcloud secrets add-iam-policy-binding cloudflare-api-token \
  --project=datapy-spider \
  --member="user:peter.lodri@gmail.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Migration from age

The file `docs/deploy/ovh-secrets.json.age` is encrypted with age.
To decrypt and migrate:

```bash
# Decrypt
age --decrypt -i ~/.config/sops/age/keys.txt \
  docs/deploy/ovh-secrets.json.age > /tmp/ovh-secrets.json

# View fields
cat /tmp/ovh-secrets.json | jq .

# Migrate each field
cat /tmp/ovh-secrets.json | jq -r '.ip' | \
  xargs -I{} gcloud secrets create ovh-ip --data-file=- --project=datapy-spider

# Shred decrypted file
rm -P /tmp/ovh-secrets.json
```

## Secrets in Cloud Build

See `cloudbuild.yaml` for the pattern:

```yaml
availableSecrets:
  secretManager:
    - versionName: projects/datapy-spider/secrets/cloudflare-api-token/versions/latest
      env: 'CLOUDFLARE_API_TOKEN'
```

## Secrets in Workers

```toml
# wrangler.toml — secrets are injected via `wrangler secret put`
# wrangler secret put AUTH_TOKEN
```

## Local Development

```bash
# Use gcloud auth to access secrets locally
gcloud auth application-default login

# Then env vars are injected by Cloud Build locally:
# gcloud builds submit --config=cloudbuild.yaml
```

## Rotation

| Secret | Rotation | Last Rotated |
|--------|----------|-------------|
| `cloudflare-api-token` | Every 90 days | Never |
| `npm-auth-token` | Every 90 days | Never |
| `ovh-ssh-key` | Every 180 days | Never |
| `worker-auth-token` | Every 90 days | Never |
| `openrouter-api-key` | Every 90 days | Never |
| `github-pat` | Every 90 days | Never |

## Emergency

If Secret Manager is unreachable:

```bash
# Fall back to age-encrypted file
age --decrypt -i ~/.config/sops/age/keys.txt \
  docs/deploy/ovh-secrets.json.age
```
