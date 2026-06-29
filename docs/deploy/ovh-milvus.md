# Deploy: OVH Warsaw — Milvus Vector Database

## Overview

| Item | Value |
|------|-------|
| Provider | OVHcloud (WAW1) |
| IP | `145.239.135.16` |
| Ports | `19530` (gRPC), `9091` (HTTP API), `8000` (Attu UI) |
| DNS | `milvus.peterl.dev` → `145.239.135.16` (Cloudflare proxy) |
| Data | `/opt/milvus/data/` (etcd + minio + milvus persisted) |

**Purpose**: Self-hosted vector database for brain graph semantic routing,
agent memory, and similarity search across the kompress-ultra ecosystem.

---

## Architecture

```
┌─────────────────────────────┐
│       Internet              │
│  milvus.peterl.dev:443     │
└──────────┬──────────────────┘
           │ HTTPS (Cloudflare → origin)
┌──────────▼──────────────────┐
│  nginx (reverse proxy)      │
│  :80 → milvus :9091         │
│  :80 → attu   :8000         │
└──────────┬──────────────────┘
           │
┌──────────▼──────────────────┐
│  Docker Compose Stack       │
│  ┌──────┐ ┌──────┐ ┌────┐  │
│  │ etcd │ │minio│ │attu│  │
│  └──┬───┘ └──┬───┘ └────┘  │
│     └───┬────┘              │
│     ┌───▼────┐              │
│     │ Milvus  │             │
│     │ :19530  │             │
│     │ :9091   │             │
│     └────────┘              │
└─────────────────────────────┘
```

---

## Deployment

```bash
# 1. Copy files to OVH box
scp -r milvus/ scripts/deploy-milvus.sh scripts/milvus-init.sh ubuntu@145.239.135.16:
scp scripts/milvus-sync-brain.sh ubuntu@145.239.135.16:

# 2. SSH into OVH
ssh ubuntu@145.239.135.16

# 3. Run deploy (idempotent)
sudo bash deploy-milvus.sh

# 4. Sync brain graph edges to Milvus
bash milvus-sync-brain.sh
```

---

## Collections

| Collection | Dim | Purpose |
|-----------|-----|---------|
| `research_findings` | 1024 | Research findings from agent exploration |
| `learning_patterns` | 1024 | Learning patterns with confidence scores |
| `pruned_context` | 1024 | Pruned conversation context |
| `brain_edges` | 768 | Brain graph edge embeddings for semantic routing |
| `brain_nodes` | 768 | Brain graph node embeddings |
| `agent_memory` | 1024 | Long-term agent memory |

---

## DNS Setup (Cloudflare)

```bash
# DNS records (A records, proxied/cloudflare):
milvus.peterl.dev     → 145.239.135.16
attu.milvus.peterl.dev → 145.239.135.16

# SSL: Cloudflare Full (strict) — origin cert via certbot
sudo certbot --nginx -d milvus.peterl.dev -d attu.milvus.peterl.dev
```

---

## Usage

### Insert a vector
```bash
curl -X POST http://localhost:9091/api/v1/insert \
  -H "Content-Type: application/json" \
  -d '{
    "collection_name": "brain_edges",
    "fields": {
      "embedding": [0.1, 0.2, ...],
      "topic": "feeds",
      "summary": "node-a → node-b (data flow)",
      "tags": "[\"brain-edge\",\"feeds\",\"layer-2\"]",
      "confidence": 0.92,
      "created_at": 1751234567890
    }
  }'
```

### Query by similarity
```bash
curl -X POST http://localhost:9091/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{
    "collection_name": "brain_edges",
    "topK": 5,
    "output_fields": ["summary", "topic", "confidence"],
    "vector": [0.1, 0.2, ...]
  }'
```

### Health check
```bash
curl http://localhost:9091/health
```

---

## Sync Brain Graph to Milvus

```bash
# One-time full sync
bash scripts/milvus-sync-brain.sh

# The script:
# 1. Reads ~/.brain/graph.json
# 2. Generates embeddings via OVH endpoint (bge-m3)
# 3. Inserts each edge as a vector in brain_edges collection
# 4. Reports progress and final counts
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `connection refused` on :9091 | Milvus not started | `docker compose -f /opt/milvus/docker-compose.yaml ps` |
| `502 Bad Gateway` from milvus.peterl.dev | nginx not configured | Check `/etc/nginx/sites-enabled/milvus` |
| `row_count` returns 0 | Collections empty | Run `milvus-sync-brain.sh` |
| OVH embedding endpoint fails | Missing `OVHCLOUD_API_KEY` | Set env var or use local embedding |
| Milvus OOM | Memory too low | Reduce `nlist` in index params, or add swap |

---

## References

- [Milvus v2.5 docs](https://milvus.io/docs/v2.5.x)
- [Attu web UI](https://github.com/zilliztech/attu)
- [kompress-ultra embedding.ts](../src/embedding.ts)
- [OVH deploy base](./ovh-verdaccio.md)
