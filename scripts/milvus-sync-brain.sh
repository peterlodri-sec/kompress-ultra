#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# milvus-sync-brain.sh — Sync brain graph edges to Milvus vectors
#
# Reads ~/.brain/graph.json, generates embeddings for each edge,
# and inserts them into the brain_edges collection.
#
# Each edge becomes a vector with:
#   - embedding: text embedding of source→target:type:label
#   - topic: edge type
#   - summary: "source → target (label)"
#   - tags: ["brain-edge", "<type>", "<layer>"]
#   - confidence: conductivity normalized to 0-1
#
# Usage: bash milvus-sync-brain.sh [milvus-http-url]
#   env: MILVUS_HTTP (default: http://localhost:9091)
#        BRAIN_FILE  (default: ~/.brain/graph.json)
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

MILVUS_HTTP="${MILVUS_HTTP:-${1:-http://localhost:9091}}"
BRAIN_FILE="${BRAIN_FILE:-${HOME}/.brain/graph.json}"

log()  { echo "[$(date +%H:%M:%S)] $*"; }
json() { python3 -c "$1" 2>/dev/null || echo "null"; }

log "═══ milvus-sync-brain — v4.0.0 ═══"
log "  milvus:  $MILVUS_HTTP"
log "  brain:   $BRAIN_FILE"

if [ ! -f "$BRAIN_FILE" ]; then
  log "  ✗ brain graph not found: $BRAIN_FILE"
  exit 1
fi

# ── 1. Check Milvus reachability ─────────────────────────────────────
if ! curl -sf "$MILVUS_HTTP/health" > /dev/null 2>&1; then
  log "  ✗ Milvus not reachable. Run deploy-milvus.sh first."
  exit 1
fi
log "  ✓ Milvus reachable"

# ── 2. Extract edges from brain graph ─────────────────────────────────
log "Parsing brain graph..."
EDGE_COUNT=$(python3 -c "
import json
with open('${BRAIN_FILE}') as f:
    g = json.load(f)
edges = g.get('edges', g.get('graph', {}).get('edges', []))
print(len(edges))
")

if [ "$EDGE_COUNT" -eq 0 ]; then
  log "  ✗ no edges found in brain graph"
  exit 1
fi
log "  edges found: $EDGE_COUNT"

# ── 3. Generate embeddings and insert ─────────────────────────────────
# Use the existing embedText endpoint (OVH or fallback)
EMBED_URL="${OVHCLOUD_EMBEDDING_URL:-https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions}"
EMBED_KEY="${OVHCLOUD_API_KEY:-}"

log "Embedding edges..."

INSERTED=0
FAILED=0

python3 -c "
import json, sys, time, os

MILVUS_HTTP = '${MILVUS_HTTP}'
EMBED_URL = '${EMBED_URL}'
EMBED_KEY = '${EMBED_KEY}'

with open('${BRAIN_FILE}') as f:
    g = json.load(f)

edges = g.get('edges', g.get('graph', {}).get('edges', []))
nodes = {}
for n in g.get('nodes', g.get('graph', {}).get('nodes', [])):
    nodes[n.get('id', n.get('name', ''))] = n.get('label', n.get('name', ''))

def get_embedding(text):
    try:
        r = __import__('urllib.request', fromlist=['Request']).Request(
            EMBED_URL,
            data=json.dumps({'model': 'bge-m3', 'input': text}).encode(),
            headers={
                'Authorization': f'Bearer {EMBED_KEY}',
                'Content-Type': 'application/json'
            },
            method='POST'
        )
        resp = __import__('urllib.request', fromlist=['urlopen']).urlopen(r, timeout=5)
        data = json.loads(resp.read())
        return data.get('data', [{}])[0].get('embedding', None)
    except Exception as e:
        return None

inserted = 0
failed = 0

for edge in edges:
    source = edge.get('source', '')
    target = edge.get('target', '')
    etype = edge.get('type', 'unknown')
    label = edge.get('label', '')
    layer = edge.get('layer', '0')
    conductivity = edge.get('conductivity', edge.get('weight', 0.5))

    if isinstance(conductivity, (int, float)):
        confidence = min(1.0, max(0.0, float(conductivity)))
    else:
        confidence = 0.5

    source_label = nodes.get(source, source)
    target_label = nodes.get(target, target)
    text_for_embedding = f'{source_label} → {target_label} : {etype} : {label}'
    summary = f'{source_label} → {target_label} ({label})'

    embedding = get_embedding(text_for_embedding)
    if embedding is None:
        failed += 1
        continue

    payload = {
        'collection_name': 'brain_edges',
        'fields': {
            'embedding': embedding,
            'topic': etype,
            'summary': summary[:8192],
            'tags': json.dumps(['brain-edge', etype, f'layer-{layer}']),
            'confidence': confidence,
            'created_at': int(time.time() * 1000),
        }
    }

    try:
        r = __import__('urllib.request', fromlist=['Request']).Request(
            f'{MILVUS_HTTP}/api/v1/insert',
            data=json.dumps(payload).encode(),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        resp = __import__('urllib.request', fromlist=['urlopen']).urlopen(r, timeout=3)
        inserted += 1
    except Exception:
        failed += 1

    if (inserted + failed) % 10 == 0:
        print(f'  progress: {inserted + failed}/{len(edges)}')

print(f'inserted={inserted} failed={failed}')
" 2>&1

log "  sync complete: inserted=${INSERTED} failed=${FAILED}"

# ── 4. Verify ─────────────────────────────────────────────────────────
COUNT=$(curl -sf "$MILVUS_HTTP/api/v1/collection/row_count" \
  -X POST -H "Content-Type: application/json" \
  -d '{"collection_name": "brain_edges"}' 2>/dev/null | \
  python3 -c "import json,sys; print(json.load(sys.stdin).get('row_count', 0))" 2>/dev/null || echo "?")
log "  brain_edges rows: $COUNT"

echo ""
log "═══ milvus-sync-brain complete ═══"
log "  Edge-based semantic routing is now live"
log "  Query: curl -X POST $MILVUS_HTTP/api/v1/query -H 'Content-Type: application/json' -d '{\"collection_name\": \"brain_edges\", \"topK\": 5, \"output_fields\": [\"summary\", \"topic\", \"confidence\"]}'"
