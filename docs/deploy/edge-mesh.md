# Edge Mesh — Global Service Topology

**Version**: v10.0.0 — edge-mesh  
**Date**: 2026-06-29

## Architecture

```
                          ┌──────────────────────┐
                          │   Cloudflare Global   │
                          │   Edge (330+ cities)  │
                          └──────┬───────┬───────┘
                                 │       │
              ┌──────────────────┘       └──────────────────┐
              ▼                                               ▼
┌─────────────────────────┐            ┌─────────────────────────┐
│   GCP Cloud Run (us)    │            │   OVH Bare Metal (eu)   │
│   kompress-ultra-api    │            │   milvus.peterl.dev     │
│   us-east1              │            │   npm.peterl.dev        │
│   auto-scale            │            │   Warsaw, Poland         │
│   Cloud Build trigger   │            │   16GB RAM, 4 vCore     │
└─────────────────────────┘            └─────────────────────────┘
         │                                        │
         │         ┌──────────────────┐            │
         └────────►│   Hetzner Fleet  │◄───────────┘
                   │   (7 machines)   │
                   │   €73.5/mo       │
                   │   DE + FI        │
                   └──────────────────┘
```

## Topology

| Layer | Provider | Region | Services | Cost |
|-------|----------|--------|----------|------|
| **Edge** | Cloudflare Workers | 330+ cities | API, MCP, badge, telemetry | ~$0 (free tier) |
| **Compute** | GCP (us-east1) | US | Cloud Build, Secret Manager, Artifact Registry | ~$5/mo |
| **Data** | OVH (WAW1) | Warsaw, EU | Milvus, Verdaccio, future models | ~€12/mo |
| **Fleet** | Hetzner | Nuremberg, Falkenstein, Helsinki | Runners, agents, CDN, benchmarks, services | €73.5/mo |

## Routing

```
User → Cloudflare Edge (closest PoP)
  ├── API:  api.kompress.vaked.dev       → Worker (global)
  ├── MCP:  api.kompress.vaked.dev/mcp   → Worker (global)
  ├── DB:   milvus.peterl.dev            → OVH Warsaw (EU)
  └── NPM:  npm.peterl.dev               → OVH Warsaw (EU)
```

## Health Check System

Every 60s, the dogfood CI workflow verifies all endpoints:

```bash
# Edge
curl -s https://api.kompress.vaked.dev/v1/health

# OVH
curl -s https://milvus.peterl.dev/health
curl -s https://npm.peterl.dev/-/ping

# Cloud Build
gcloud builds list --project=datapy-spider --limit=1

# Hetzner
hcloud server list
```

## Failover Strategy

| Failure | Fallback | RTO | RPO |
|---------|----------|-----|-----|
| OVH box down | Restore from age-encrypted secrets + Terraform | 30min | 24h |
| Cloudflare edge down | Direct to GCP Cloud Run | 5min | 0 |
| Hetzner runner down | GCP Cloud Build (direct) | 2min | 0 |
| GCP project down | Local builds + manual deploy | 1h | 24h |

## Cost Summary

| Component | Monthly | Annual |
|-----------|---------|--------|
| Hetzner fleet (7) | €73.50 | €882 |
| OVH (Warsaw) | ~€12.00 | ~€144 |
| GCP (datapy-spider) | ~$5.00 | ~$60 |
| Cloudflare Workers | Free | Free |
| DNS (vaked.dev) | Free | Free |
| **Total** | **~€90/mo** | **~€1,086/yr** |
