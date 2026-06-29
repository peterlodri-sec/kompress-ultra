#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# milvus-init.sh — Create Milvus collections for kompress-ultra brain
#
# Creates all required collections with proper schemas, indexes, and
# alias mappings. Idempotent — skips existing collections.
#
# Usage: bash milvus-init.sh [milvus-http-url]
#   Default: http://localhost:9091
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

MILVUS_HTTP="${1:-http://localhost:9091}"
log() { echo "[$(date +%H:%M:%S)] $*"; }

# ── Collection definitions ─────────────────────────────────────────────
# Format: name,dimension,description
COLLECTIONS=(
  "research_findings,1024,Research findings and patterns from agent exploration"
  "learning_patterns,1024,Learning patterns with confidence scores"
  "pruned_context,1024,Pruned conversation context for future relevance"
  "brain_edges,768,Brain graph edge embeddings for semantic routing"
  "brain_nodes,768,Brain graph node embeddings"
  "agent_memory,1024,Long-term agent memory and reflections"
)

create_collection() {
  local name="$1" dim="$2" desc="$3"

  # Check if collection exists
  local exists
  exists=$(curl -sf "$MILVUS_HTTP/api/v1/collection/existence" \
    -X POST -H "Content-Type: application/json" \
    -d "{\"collection_name\": \"$name\"}" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('exist', False))" 2>/dev/null || echo "false")

  if [ "$exists" = "True" ]; then
    log "  ✓ collection exists: $name"
    return 0
  fi

  log "  creating: $name (dim=$dim, desc=$desc)"

  local schema
  schema=$(cat <<JSON
{
  "collection_name": "$name",
  "description": "$desc",
  "fields": [
    {"name": "id", "description": "int64 id", "type": 5, "auto_id": true, "is_primary": true},
    {"name": "embedding", "description": "vector", "type": 101, "params": {"dim": $dim}},
    {"name": "created_at", "description": "creation timestamp", "type": 3},
    {"name": "topic", "description": "topic or node label", "type": 21, "max_length": 256},
    {"name": "summary", "description": "text content", "type": 22, "max_length": 8192},
    {"name": "tags", "description": "classification tags", "type": 23, "max_length": 512},
    {"name": "confidence", "description": "confidence score 0-1", "type": 2}
  ],
  "enable_dynamic_field": true
}
JSON
  )

  local res
  res=$(curl -sf "$MILVUS_HTTP/api/v1/collection" \
    -X POST -H "Content-Type: application/json" \
    -d "$schema" 2>&1) || {
    log "  ✗ failed to create $name: $res"
    return 1
  }

  # Create index on embedding field
  curl -sf "$MILVUS_HTTP/api/v1/index" \
    -X POST -H "Content-Type: application/json" \
    -d "{\"collection_name\": \"$name\", \"field_name\": \"embedding\", \"index_name\": \"embedding_idx\", \"params\": {\"metric_type\": \"COSINE\", \"index_type\": \"IVF_FLAT\", \"nlist\": 1024}}" \
    > /dev/null 2>&1 && log "  index created: $name" || log "  index warning: $name"

  # Load collection
  curl -sf "$MILVUS_HTTP/api/v1/collection/load" \
    -X POST -H "Content-Type: application/json" \
    -d "{\"collection_name\": \"$name\"}" \
    > /dev/null 2>&1 && log "  loaded: $name" || log "  load warning: $name"

  log "  ✓ created: $name"
}

log "═══ milvus-init — v4.0.0 ═══"
log "  milvus: $MILVUS_HTTP"
echo ""

# Health check
if ! curl -sf "$MILVUS_HTTP/health" > /dev/null 2>&1; then
  log "  ✗ Milvus not reachable at $MILVUS_HTTP"
  log "  Deploy first: docker compose -f milvus/docker-compose.yaml up -d"
  exit 1
fi
log "  ✓ Milvus reachable"
echo ""

# Create all collections
for def in "${COLLECTIONS[@]}"; do
  IFS=',' read -r name dim desc <<< "$def"
  create_collection "$name" "$dim" "$desc"
done

echo ""
log "═══ milvus-init complete ═══"
log "  Collections: ${#COLLECTIONS[@]}"
log "  Ready for: research, learning, brain graph, agent memory"
