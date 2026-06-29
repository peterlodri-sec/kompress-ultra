#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# rem-mode — REM Sleep Review Agent for the Brain Graph
#
# Origin: Rahul's personal brain (idea:sleep-review-agent-for-mygraph)
# "REM mode" = background review process while the human is offline.
#
# Dreaming  = candidate-edge generation (plausible connections)
# Waking    = provenance review (approval before durability)
#
# This agent runs during "sleep" cycles and produces a morning review
# queue. It does NOT write to memory automatically. It suggests.
# The human approves, rejects, or revises from provenance.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

GRAPH="${HOME}/.brain/graph.json"
REVIEW_QUEUE="${HOME}/.brain/review-queue.json"
CACHE_DIR="${HOME}/.brain/rem-cache"
VERSION="1.0.0"

mkdir -p "$CACHE_DIR"

# ── 1. Generate candidate edges (dreaming) ──────────────────────────────
# Heuristics:
#   - Same-layer nodes that aren't connected → suggest edge
#   - Orphan nodes (no incoming) → suggest connection to brain-state
#   - High-degree nodes → suggest merger or abstraction
#   - Nodes with similar labels → suggest merge
dream() {
  echo "=== REM: Dreaming ==="
  local candidates=()

  python3 << 'PY' 2>/dev/null
import json, os, itertools
from collections import Counter

with open(os.environ.get('GRAPH', '${GRAPH}')) as f:
    g = json.load(f)

nodes = g['nodes']
edges = g['edges']
candidates = []
node_ids = {n['id'] for n in nodes}
edge_pairs = {(e['source'], e['target']) for e in edges}

# 1. Same-layer unconnected nodes → suggest connection
layers = {}
for n in nodes:
    l = tuple(n.get('layer', [0,0,0]))
    layers.setdefault(l, []).append(n['id'])

for layer, ids in layers.items():
    for a, b in itertools.combinations(ids, 2):
        if a == b: continue
        if (a, b) in edge_pairs or (b, a) in edge_pairs: continue
        candidates.append({
            'type': 'candidate_edge',
            'source': a,
            'target': b,
            'layer': list(layer),
            'rationale': f'same layer ({layer}) — unconnected peers',
            'confidence': 0.3,
            'provenance': 'rem:dream:same-layer'
        })

# 2. Orphan nodes (no incoming edges, not brain-state itself)
incoming = {e['target'] for e in edges}
for n in nodes:
    if n['id'] not in incoming and n['id'] not in ('brain-state', 'brain-graph'):
        candidates.append({
            'type': 'orphan_alert',
            'node': n['id'],
            'label': n.get('label', n['id']),
            'rationale': 'no incoming connections — may need reconnection',
            'confidence': 0.5,
            'provenance': 'rem:dream:orphan'
        })

# 3. Bridge alerts (nodes that connect otherwise disconnected clusters)
clusters = []
remaining = set(node_ids - {'brain-state', 'brain-graph'})
while remaining:
    cluster = set()
    stack = [next(iter(remaining))]
    while stack:
        nid = stack.pop()
        if nid not in remaining: continue
        remaining.discard(nid)
        cluster.add(nid)
        for e in edges:
            if e['source'] == nid and e['target'] in remaining:
                stack.append(e['target'])
            if e['target'] == nid and e['source'] in remaining:
                stack.append(e['source'])
    clusters.append(cluster)

if len(clusters) > 1:
    for cluster in clusters:
        for nid in cluster:
            candidates.append({
                'type': 'bridge_alert',
                'node': nid,
                'cluster_size': len(cluster),
                'rationale': f'cluster of {len(cluster)} nodes disconnected from main graph',
                'confidence': 0.4,
                'provenance': 'rem:dream:bridge'
            })

# 4. Weak-provenance warnings (edges with weight < 0.5)
for e in edges:
    if e.get('weight', 1) < 0.5:
        candidates.append({
            'type': 'weak_edge',
            'source': e['source'],
            'target': e['target'],
            'label': e.get('label', '?'),
            'weight': e['weight'],
            'rationale': f'low-weight edge ({e.get("weight",0):.1f}) — consider pruning or reinforcing',
            'confidence': 0.6,
            'provenance': 'rem:dream:weak-edge'
        })

# Write candidates
os.makedirs('${CACHE_DIR}', exist_ok=True)
with open('${CACHE_DIR}/candidates.json', 'w') as f:
    json.dump(candidates, f, indent=2)

print(f'  generated {len(candidates)} candidates/alert')
PY
}

# ── 2. Build review queue (waking) ──────────────────────────────────────
# Read candidates, deduplicate, rank by confidence, produce queue.
wake() {
  echo "=== REM: Waking ==="
  local queue_file="${CACHE_DIR}/queue.json"
  local review_file="${REVIEW_QUEUE}"

  python3 << 'PY' 2>/dev/null
import json, os
from collections import defaultdict

candidates = []
try:
    with open('${CACHE_DIR}/candidates.json') as f:
        candidates = json.load(f)
except: pass

# Deduplicate
seen = set()
unique = []
for c in candidates:
    key = json.dumps(c, sort_keys=True)
    if key not in seen:
        seen.add(key)
        unique.append(c)

# Sort by confidence descending
unique.sort(key=lambda c: c.get('confidence', 0), reverse=True)

# Build review queue
queue = {
    'version': '${VERSION}',
    'generated_at': '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
    'total_candidates': len(unique),
    'by_type': dict(defaultdict(int)),
    'reviews': []
}

for c in unique:
    t = c.get('type', 'unknown')
    queue['by_type'][t] = queue['by_type'].get(t, 0) + 1

# Only high-confidence items go to morning review
for c in unique:
    if c.get('confidence', 0) >= 0.5:
        queue['reviews'].append({
            'type': c['type'],
            'summary': c.get('rationale', ''),
            'details': c,
            'decision': 'pending',
            'reviewed_at': None
        })

with open('${REVIEW_QUEUE}', 'w') as f:
    json.dump(queue, f, indent=2)

types_summary = ', '.join(f'{k}:{v}' for k, v in queue['by_type'].items())
print(f'  review queue: {queue["total_candidates"]} candidates → {len(queue["reviews"])} reviews')
print(f'  types: {types_summary}')
PY
}

# ── 3. Show morning review ─────────────────────────────────────────────
review() {
  if [ ! -f "$REVIEW_QUEUE" ]; then
    echo "  no review queue — run 'dream' and 'wake' first"
    exit 1
  fi
  python3 << 'PY' 2>/dev/null
import json
with open('${REVIEW_QUEUE}') as f:
    q = json.load(f)
print('╔══════════════════════════════════════════════════════╗')
print('║  REM — Morning Review                                ║')
print('╠══════════════════════════════════════════════════════╣')
print(f'  Generated: {q.get("generated_at", "?")[:19]}')
print(f'  Candidates: {q["total_candidates"]}')
print(f'  Reviews:    {len(q["reviews"])}')
print('╠══════════════════════════════════════════════════════╣')
for r in q.get('reviews', [])[:10]:
    d = r.get('details', {})
    icon = '🔗' if r['type'] == 'candidate_edge' else '⚠️' if r['type'] == 'weak_edge' else '👻' if r['type'] == 'orphan_alert' else '🌉'
    summary = r['summary'][:60]
    conf = d.get('confidence', 0)
    print(f'  {icon}  [{conf:.1f}] {summary}')
if len(q['reviews']) > 10: print(f'  ... and {len(q["reviews"])-10} more')
print('╚══════════════════════════════════════════════════════╝')
PY
}

# ── Full REM cycle ──────────────────────────────────────────────────────
cmd_cycle() {
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║  REM CYCLE                                           ║"
  echo "║  Sleep is sync. Dream is async. Wake is review.      ║"
  echo "╚══════════════════════════════════════════════════════╝"
  dream
  wake
  review
  echo ""
  echo "  REM cycle complete. Review queue at: ${REVIEW_QUEUE}"
  echo "  Nothing is committed. Every change needs provenance review."
  echo "  Rahul's rule: REM mode suggests. Humans decide."
}

# ── Main ────────────────────────────────────────────────────────────────
case "${1:-help}" in
  dream)   dream ;;
  wake)    wake ;;
  review)  review ;;
  cycle)   cmd_cycle ;;
  help|*)
    echo "rem-mode v${VERSION} — REM Sleep Review Agent"
    echo "Origin: Rahul's personal brain (idea:sleep-review-agent-for-mygraph)"
    echo ""
    echo "  dream   Generate candidate edges + alerts (async)"
    echo "  wake    Build morning review queue (sync)"
    echo "  review  Display pending reviews"
    echo "  cycle   Full REM cycle: dream → wake → review"
    echo ""
    echo "  REM mode suggests. Humans decide. Nothing is automatic."
    ;;
esac
