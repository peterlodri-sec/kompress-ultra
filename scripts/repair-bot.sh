#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# repair-bot — Self-repair agent for the brain graph
#
# Roams the 3D layer space, detects damage, and repairs.
# Works in tandem with bodhisattva (chaos) — what one breaks,
# the other fixes. Together they keep the brain honest.
#
# Repair operations:
#   1. Reconnect orphan nodes (no incoming edges) to brain-state
#   2. Heal killed edges after recovery period
#   3. Prune self-loops that have cycled too many times
#   4. Rebalance layer density (thin layers get boosted)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

GRAPH="${HOME}/.brain/graph.json"
LOG="${HOME}/.brain/repair-bot.log"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
NOW_MS=$(python3 -c "import time; print(int(time.time()*1000))")

echo "[repair-bot] $NOW — starting patrol" | tee -a "$LOG"

python3 -c "
import json, time

with open('${GRAPH}') as f:
    g = json.load(f)

nodes = g['nodes']
edges = g['edges']
now_ms = ${NOW_MS}
repaired = 0
reconnected = 0
healed = 0
pruned = 0

# ── 1. Reconnect orphan nodes ──────────────────────────────────────────
# Any node with 0 incoming edges (except brain-state which is root)
for n in nodes:
    nid = n['id']
    if nid in ('brain-state', 'brain-graph'): continue
    incoming = [e for e in edges if e['target'] == nid]
    if len(incoming) == 0:
        # Reconnect to brain-state with minimum weight
        edges.append({
            'source': 'brain-state',
            'target': nid,
            'label': 'reconnected',
            'weight': 0.3,
            'layer': [0,0,0],
            '_repaired_at': now_ms
        })
        reconnected += 1
        print(f'  reconnected: brain-state → {nid}')

# ── 2. Heal killed edges ───────────────────────────────────────────────
for e in edges:
    if e.get('weight', 1) == 0 and e.get('_killed_at', 0) > 0:
        age = now_ms - e['_killed_at']
        if age > 60000:  # 1 minute recovery
            prev = e.get('_prev_weight', 0.5)
            e['weight'] = min(1.0, prev * 1.1)  # 10% stronger
            e['_healed_at'] = now_ms
            del e['_killed_at']
            del e['_prev_weight']
            healed += 1
            print(f'  healed: {e[\"source\"]} → {e[\"target\"]} ({prev} → {e[\"weight\"]:.2f})')

# ── 3. Prune exhausted self-loops ──────────────────────────────────────
for e in edges:
    if e['source'] == e['target'] and e.get('_reflect_count', 0) > 5:
        edges.remove(e)
        pruned += 1
        print(f'  pruned self-loop: {e[\"source\"]} ({e[\"_reflect_count\"]} reflections)')

# ── 4. Rebalance layers ────────────────────────────────────────────────
from collections import Counter
layer_counts = Counter()
for n in nodes:
    l = tuple(n.get('layer', [0,0,0]))
    layer_counts[l] += 1
avg_per_layer = len(nodes) / max(1, len(layer_counts))
for n in nodes:
    l = tuple(n.get('layer', [0,0,0]))
    if layer_counts[l] < avg_per_layer * 0.5:
        # Thin layer — add a boost edge from brain-state
        nid = n['id']
        existing = [e for e in edges if e['source'] == 'brain-state' and e['target'] == nid and e['label'] == 'layer_boost']
        if not existing:
            edges.append({
                'source': 'brain-state',
                'target': nid,
                'label': 'layer_boost',
                'weight': 0.5,
                'layer': list(l),
                '_boosted_at': now_ms
            })
            print(f'  boosted: brain-state → {nid} @ layer {l}')

# ── Update meta ────────────────────────────────────────────────────────
g['meta']['last_repair'] = '${NOW}'
g['meta']['repair_count'] = g['meta'].get('repair_count', 0) + 1
g['meta']['repairs'] = {
    'reconnected': reconnected,
    'healed': healed,
    'pruned': pruned
}
g['meta']['last_modified'] = '${NOW}'

with open('${GRAPH}', 'w') as f:
    json.dump(g, f, indent=2)

print(f'[repair-bot] done: {reconnected} reconnected, {healed} healed, {pruned} pruned')
" 2>&1 | tee -a "$LOG"

echo "[repair-bot] $(date -u +%H:%M:%S) — patrol complete" >> "$LOG"
echo "done"
