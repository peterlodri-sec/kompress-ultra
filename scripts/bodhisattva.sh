#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# bodhisattva — Chaos Monkey for the mesh
#
# "The live, real, brutal, but honest and necessary Chaos Monkey."
#
# Operates on the brain graph. Randomly flips edge conductivity
# to 0 (kills connections), randomly reflects signals (injects
# noise), randomly prunes nodes (tests memory impermanence).
#
# Buddhist chaos: it only destroys what you're clinging to.
# Every kill is honest — logged to brain with full audit trail.
# If the system recovers, the edge heals stronger (post-traumatic growth).
# If it doesn't, the edge was truly necessary and stays dead.
#
# Principles:
#   Anicca (impermanence)  — all connections die eventually
#   Dukkha (suffering)      — clinging to an edge causes suffering
#   Anatta (no-self)        — the graph is not the same graph twice
#   Karuna (compassion)     — every kill is logged and understood
# ─────────────────────────────────────────────────────────────
set -euo pipefail

BRAIN_GRAPH="${HOME}/.brain/graph.json"
BRUTALITY="${BODHISATTVA_BRUTALITY:-0.2}"       # % of edges to attack per run
SELF_DESTRUCT="${BODHISATTVA_SELF_DESTRUCT:-10}"  # max runs before self-destruct
RECOVERY_TICKS="${BODHISATTVA_RECOVERY_TICKS:-3}"  # ticks for edge healing
RUN_FILE="${HOME}/.brain/.bodhisattva-run"         # run counter
LOG_FILE="${HOME}/.brain/bodhisattva.log"

# ── Self-destruct check ──────────────────────────────────────────────────
RUN_COUNT=0
[ -f "$RUN_FILE" ] && RUN_COUNT=$(cat "$RUN_FILE")
RUN_COUNT=$((RUN_COUNT + 1))
echo "$RUN_COUNT" > "$RUN_FILE"

if [ "$RUN_COUNT" -ge "$SELF_DESTRUCT" ]; then
  echo "[bodhisattva] run $RUN_COUNT/$SELF_DESTRUCT — self-destruct triggered" | tee -a "$LOG_FILE"
  echo "[bodhisattva] impermanence realized. deleting myself." | tee -a "$LOG_FILE"
  rm -f "$RUN_FILE"
  exit 0
fi

# ── Operate on the graph ─────────────────────────────────────────────────
python3 -c "
import json, random, time

with open('${BRAIN_GRAPH}') as f:
    g = json.load(f)

edges = g['edges']
nodes = g['nodes']
brutality = ${BRUTALITY}
now = '$(date -u +%Y-%m-%dT%H:%M:%SZ)'
now_ms = int(time.time() * 1000)
killed = []
reflected = []
pruned = []

random.shuffle(edges)  # fairness — no edge is safe

# ── Phase 1: Kill edges (flip conductivity to 0) ─────────────────────────
target_kill = max(1, int(len(edges) * brutality))
for edge in edges[:target_kill]:
    prev_weight = edge.get('weight', 1)
    edge['weight'] = 0
    edge['_killed_at'] = now_ms
    edge['_prev_weight'] = prev_weight
    killed.append(f\"{edge['source']} --[{edge['label']}]--> {edge['target']} (was {prev_weight})\")

# ── Phase 2: Reflect signals (inject noise on survivors) ─────────────────
survivors = edges[target_kill:]
target_reflect = max(1, int(len(survivors) * brutality * 0.5))
random.shuffle(survivors)
for edge in survivors[:target_reflect]:
    edge['_reflected_at'] = now_ms
    edge['_reflect_count'] = edge.get('_reflect_count', 0) + 1
    reflected.append(f\"{edge['source']} --[{edge['label']}]--> {edge['target']} (count: {edge['_reflect_count']})\")

# ── Phase 3: Prune nodes (fringe only, never core) ───────────────────────
core_ids = {'brain-state', 'brain-graph', 'al-biruni', 'ultramesh-mem'}
prunable = [n for n in nodes if n['id'] not in core_ids and n.get('type') != 'system']
target_prune = max(1, int(len(prunable) * brutality * 0.3))
random.shuffle(prunable)
for node in prunable[:target_prune]:
    # Don't prune nodes that have been recently killed/recovered
    if any(e.get('_killed_at', 0) > now_ms - 60000 for e in edges if e['source'] == node['id'] or e['target'] == node['id']):
        continue
    nid = node['id']
    edges[:] = [e for e in edges if e['source'] != nid and e['target'] != nid]
    nodes.remove(node)
    pruned.append(f\"{nid} ({node.get('type','?')})\")

# ── Heal edges from previous kills (post-traumatic growth) ───────────────
for edge in edges:
    if edge.get('weight', 1) == 0 and edge.get('_killed_at', 0) > 0:
        elapsed = now_ms - edge['_killed_at']
        if elapsed > ${RECOVERY_TICKS} * 60000:  # recovery after N minutes
            healed_weight = min(1.0, edge.get('_prev_weight', 0.5) * 1.05)  # 5% stronger
            edge['weight'] = healed_weight
            del edge['_killed_at']
            del edge['_prev_weight']
            print(f'[heal] {edge[\"source\"]} --[{edge[\"label\"]}]--> {edge[\"target\"]} → {healed_weight:.2f}')

# ── Update graph meta ────────────────────────────────────────────────────
g['meta']['bodhisattva_run'] = ${RUN_COUNT}
g['meta']['bodhisattva_last_run'] = now
g['meta']['last_modified'] = now

with open('${BRAIN_GRAPH}', 'w') as f:
    json.dump(g, f, indent=2)

# ── Log ──────────────────────────────────────────────────────────────────
print(f'[bodhisattva] run {${RUN_COUNT}} — killed {len(killed)}, reflected {len(reflected)}, pruned {len(pruned)}')
for k in killed: print(f'  🔪 killed: {k}')
for r in reflected: print(f'  🔮 reflected: {r}')
for p in pruned: print(f'  ✂️  pruned: {p}')
print(f'[bodhisattva] graph now: {len(nodes)} nodes, {len(edges)} edges')
" 2>&1 | tee -a "$LOG_FILE"

echo "[bodhisattva] run $RUN_COUNT/$SELF_DESTRUCT complete" >> "$LOG_FILE"
echo "done"
