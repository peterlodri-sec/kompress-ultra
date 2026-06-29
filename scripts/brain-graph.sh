#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# brain-graph — Singular self-contained graph brain
# The architecture IS the graph. Every node is a component,
# every edge is a connection. One file. One source of truth.
#
# Location: ~/.brain/graph.json   (git repo)
# Sync:     shared across all ultrameshai repos via symlinks
#
# Usage:
#   brain-graph add-node <id> <type> [label] [props...]
#   brain-graph add-edge <source> <target> <label> [weight]
#   brain-graph get <id>                    — get node + edges
#   brain-graph neighbors <id>              — traverse from node
#   brain-graph stats                       — graph topology
#   brain-graph visualize                   — ASCII topology map
#   brain-graph help
# ─────────────────────────────────────────────────────────────
set -euo pipefail

BRAIN_HOME="${HOME}/.brain"
GRAPH="${BRAIN_HOME}/graph.json"

mkdir -p "$BRAIN_HOME"

# Init if missing
if [ ! -f "$GRAPH" ]; then
  cat > "$GRAPH" << 'EOF'
{
  "version": "1.0.0",
  "schema": "ultramesh-brain-graph",
  "meta": { "created": "", "last_modified": "", "description": "singular graph brain" },
  "nodes": [],
  "edges": []
}
EOF
fi

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

graph_rw() {
  python3 -c "
import json, sys, os
with open('${GRAPH}') as f:
    g = json.load(f)
$(echo "$1")
g['meta']['last_modified'] = '$(now)'
with open('${GRAPH}', 'w') as f:
    json.dump(g, f, indent=2)
" 2>/dev/null
}

add_node() {
  local id="$1" type="$2" label="${3:-$1}" layer="${4:-0,0,0}"
  python3 -c "
import json
with open('${GRAPH}') as f:
    g = json.load(f)
nodes = g['nodes']
id = '${id}'
layer = [int(x) for x in '${layer}'.split(',')]
for i, n in enumerate(nodes):
    if n['id'] == id:
        nodes[i] = {'id': id, 'type': '${type}', 'label': '${label}', 'layer': layer}
        print(f'updated: {id}')
        break
else:
    nodes.append({'id': id, 'type': '${type}', 'label': '${label}', 'layer': layer})
    print(f'added: {id}')
g['meta']['last_modified'] = '$(now)'
with open('${GRAPH}', 'w') as f:
    json.dump(g, f, indent=2)
" 2>/dev/null
}

add_edge() {
  local src="$1" tgt="$2" label="${3:-connects}" weight="${4:-1}" layer="${5:-0,0,0}"
  python3 -c "
import json
with open('${GRAPH}') as f:
    g = json.load(f)
edges = g['edges']
layer = [int(x) for x in '${layer}'.split(',')]
edges.append({'source':'${src}','target':'${tgt}','label':'${label}','weight':${weight},'layer':layer})
print(f'edge: ${src} --[${label}]--> ${tgt}')
g['meta']['last_modified'] = '$(now)'
with open('${GRAPH}', 'w') as f:
    json.dump(g, f, indent=2)
" 2>/dev/null
}

# ── Hot-swap a layer (replace all content at (t,y,z) atomically) ─────────
hotswap() {
  local t="$1" y="$2" z="$3"
  python3 -c "
import json, sys
with open('${GRAPH}') as f:
    g = json.load(f)
t, y, z = ${t}, ${y}, ${z}
replacement = json.load(sys.stdin)
g['nodes'] = [n for n in g['nodes'] if n.get('layer', [0,0,0]) != [t,y,z]]
g['edges'] = [e for e in g['edges'] if e.get('layer', [0,0,0]) != [t,y,z]]
for n in replacement.get('nodes', []):
    n['layer'] = [t,y,z]
    g['nodes'].append(n)
for e in replacement.get('edges', []):
    e['layer'] = [t,y,z]
    g['edges'].append(e)
g['meta']['last_modified'] = '$(now)'
g['meta']['last_hotswap'] = f'({t},{y},{z})'
with open('${GRAPH}', 'w') as f:
    json.dump(g, f, indent=2)
print(f'hotswap: ({t},{y},{z}) — {len(replacement.get(\"nodes\",[]))}n {len(replacement.get(\"edges\",[]))}e')
" 2>/dev/null
}

# ── Layer stats ──────────────────────────────────────────────────────────
layer_stats() {
  python3 -c "
import json
with open('${GRAPH}') as f:
    g = json.load(f)
layers = {}
for n in g['nodes']:
    l = tuple(n.get('layer', [0,0,0]))
    layers[l] = layers.get(l, {'nodes':0,'edges':0})
    layers[l]['nodes'] += 1
for e in g['edges']:
    l = tuple(e.get('layer', [0,0,0]))
    if l not in layers: layers[l] = {'nodes':0,'edges':0}
    layers[l]['edges'] += 1
dims = {0:'T(time)',1:'Y(abstraction)',2:'Z(scope)'}
labels_t = ['past','present','future']
labels_y = ['data','info','knowledge','wisdom']
labels_z = ['token','msg','conv','session','project','mesh']
print('=== Brain Layers (3D) ===')
for l, counts in sorted(layers.items()):
    tl = labels_t[min(2, l[0]+1)] if 0 <= l[0]+1 < 3 else '?'
    yl = labels_y[min(3, l[1])] if 0 <= l[1] < 4 else '?'
    zl = labels_z[min(5, l[2])] if 0 <= l[2] < 6 else '?'
    print(f'  ({l[0]},{l[1]},{l[2]})  {tl} / {yl} / {zl}  →  {counts[\"nodes\"]}n {counts[\"edges\"]}e')
" 2>/dev/null
}

get_node() {
  python3 -c "
import json
with open('${GRAPH}') as f:
    g = json.load(f)
n = next((n for n in g['nodes'] if n['id'] == '$1'), None)
if not n: print('not found'); exit(1)
print(json.dumps(n, indent=2))
# Show edges
out = [e for e in g['edges'] if e['source'] == '$1']
inc = [e for e in g['edges'] if e['target'] == '$1']
if out: print(f\"\\noutgoing ({len(out)}):\"); [print(f\"  --[{e['label']}]--> {e['target']}\") for e in out]
if inc: print(f\"\\nincoming ({len(inc)}):\"); [print(f\"  {e['source']} --[{e['label']}]--> \") for e in inc]
" 2>/dev/null
}

neighbors() {
  python3 -c "
import json
with open('${GRAPH}') as f:
    g = json.load(f)
n = next((n for n in g['nodes'] if n['id'] == '$1'), None)
if not n: print('not found'); exit(1)
print(f\"=== {n['id']} ({n['type']}) neighbors ===\")
out = [e for e in g['edges'] if e['source'] == '$1']
inc = [e for e in g['edges'] if e['target'] == '$1']
seen = set()
for e in out:
    t = next((x for x in g['nodes'] if x['id'] == e['target']), None)
    tlabel = f\"{t['type']}:{t['id']}\" if t else e['target']
    print(f\"  → {tlabel}  [{e['label']}] (w={e['weight']})\")
    seen.add(e['target'])
for e in inc:
    s = next((x for x in g['nodes'] if x['id'] == e['source']), None)
    slabel = f\"{s['type']}:{s['id']}\" if s else e['source']
    print(f\"  ← {slabel}  [{e['label']}] (w={e['weight']})\")
    seen.add(e['source'])
print(f\"\\n{len(seen)} unique connections\")
" 2>/dev/null
}

stats() {
  python3 -c "
import json
with open('${GRAPH}') as f:
    g = json.load(f)
nodes = g['nodes']
edges = g['edges']
types = {}
for n in nodes:
    t = n['type']
    types[t] = types.get(t, 0) + 1
print('=== Brain Graph Topology ===')
print(f'Nodes: {len(nodes)}')
print(f'Edges: {len(edges)}')
print(f'Types:')
for t, c in sorted(types.items()):
    print(f'  {t}: {c}')
dens = 2*len(edges) / (len(nodes)*(len(nodes)-1)) if len(nodes) > 1 else 0
print(f'Density: {dens:.4f}')
print(f'Modified: {g[\"meta\"][\"last_modified\"]}')
" 2>/dev/null
}

visualize() {
  python3 -c "
import json
with open('${GRAPH}') as f:
    g = json.load(f)
nodes = {n['id']:n for n in g['nodes']}
edges = g['edges']

# Group by type
by_type = {}
for n in g['nodes']:
    t = n['type']
    if t not in by_type: by_type[t] = []
    by_type[t].append(n['id'])

print('=== Brain Graph Visual Map ===')
print()

for t, ids in sorted(by_type.items()):
    icon = {'agent':'🤖','state':'🧠','memory':'📝','learning':'💡','loop':'🔄','pattern':'🔮','system':'⚙️'}.get(t, '📦')
    print(f'  {icon} {t}')
    for i in ids:
        n = nodes[i]
        out = [e for e in edges if e['source'] == i]
        inc = [e for e in edges if e['target'] == i]
        conn = []
        for e in out[:3]:
            tgt = nodes.get(e['target'], {})
            conn.append(f\"→ {tgt.get('label',e['target'])}\")
        for e in inc[:2]:
            src = nodes.get(e['source'], {})
            conn.append(f\"← {src.get('label',e['source'])}\")
        conn_str = ' '.join(conn) if conn else ''
        print(f'    └ {n[\"label\"]}  {conn_str}')
    print()
print(f'Total: {len(g[\"nodes\"])} nodes, {len(g[\"edges\"])} edges')
" 2>/dev/null
}

# ── Sync: link brain into all ultrameshai repos ─────────────────────────
sync_repos() {
  local repos=(
    "$HOME/workspace/peterlodri-sec/kompress-ultra"
    "$HOME/workspace/peterlodri-sec/ultrameshai"
    "$HOME/workspace/peterlodri-sec/nix-base"
    "$HOME/workspace/peterlodri-sec/vaked-base"
  )
  for repo in "${repos[@]}"; do
    if [ -d "$repo" ]; then
      ln -sf "$GRAPH" "$repo/.brain.json" 2>/dev/null && echo "  linked: $repo/.brain.json"
    fi
  done
  echo "done"
}

# ── Commit brain changes ────────────────────────────────────────────────
commit() {
  cd "$BRAIN_HOME"
  git add graph.json
  if ! git diff --cached --quiet; then
    git commit -m "brain: $(date -u +%Y-%m-%dT%H:%M:%SZ)" --allow-empty
    echo "committed"
  else
    echo "no changes"
  fi
}

# ── Main ─────────────────────────────────────────────────────────────────
case "${1:-help}" in
  add-node)    shift; add_node "$@" ;;
  add-edge)    shift; add_edge "$@" ;;
  hotswap)     shift; hotswap "$@" ;;
  layers)      layer_stats ;;
  get)         shift; get_node "$@" ;;
  neighbors)   shift; neighbors "$@" ;;
  stats)       stats ;;
  visualize)   visualize ;;
  sync)        sync_repos ;;
  commit)      commit ;;
  help|--help|-h)
    echo "brain-graph — Singular graph brain with 3D temporal layers"
    echo "Usage: brain-graph {add-node|add-edge|hotswap|layers|get|neighbors|stats|visualize|sync|commit|help}"
    ;;
  *)
    echo "Usage: brain-graph {add-node|add-edge|get|neighbors|stats|visualize|sync|commit}"
    exit 1
    ;;
esac
