#!/usr/bin/env bash
set -euo pipefail
LIVE="${HOME}/.brain/graph.json"; D="${HOME}/.brain/snapshots"; Dt=$(date -u +%Y-%m-%d); T=$(date -u +%Y-%m-%dT%H:%M:%SZ); mkdir -p "$D"
python3 -c "
import json; g=json.load(open('$LIVE'))
for e in g['edges']:
    for k in list(e.keys()):
        if k.startswith('_'): del e[k]
for n in g['nodes']:
    for k in list(n.keys()):
        if k.startswith('_'): del n[k]
g['meta']={'snapshot':'$Dt','schema':g.get('schema','?'),'version':g.get('version','?'),'notice':'Read-only fossil. No write path. Updated ≤ monthly.','node_count':len(g['nodes']),'edge_count':len(g['edges']),'layer_count':len(set(tuple(n.get('layer',[0,0,0])) for n in g['nodes'])),'provenance':{'source':'~/.brain/graph.json','tool':'scripts/brain-snapshot.sh','license':'Apache 2.0','can_write':False}}
json.dump(g,open('${D}/brain-${Dt}.json','w'),indent=2)
print(f'{len(g[\"nodes\"])}n {len(g[\"edges\"])}e {g[\"meta\"][\"layer_count\"]}layers → brain-${Dt}.json')
" 2>/dev/null && echo "done" || echo "failed"
