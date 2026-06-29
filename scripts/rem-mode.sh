#!/usr/bin/env bash
set -euo pipefail
GRAPH="${HOME}/.brain/graph.json"; RQ="${HOME}/.brain/review-queue.json"; CACHE="${HOME}/.brain/rem-cache"; V="1.0.0"
mkdir -p "$CACHE"

dream(){
  echo "=== REM: Dreaming ==="
  export G="$GRAPH" C="$CACHE"
  python3 << 'PY' 2>/dev/null
import json,os,itertools
g=json.load(open(os.environ['G']))
n,e=g['nodes'],g['edges'];c=[];pairs={(x['source'],x['target']) for x in e};ids={x['id'] for x in n}
layers={}
for x in n:
    l=tuple(x.get('layer',[0,0,0]))
    layers.setdefault(l,[]).append(x['id'])
# same-layer unconnected
for l,ids_ in layers.items():
    for a,b in itertools.combinations(ids_,2):
        if a==b or (a,b) in pairs or (b,a) in pairs: continue
        c.append({'type':'candidate_edge','source':a,'target':b,'layer':list(l),'confidence':0.3,'rationale':f'same layer {l} unconnected'})
# orphans
incoming={e['target'] for e in e}
for x in n:
    if x['id'] not in incoming and x['id'] not in ('brain-state','brain-graph'):
        c.append({'type':'orphan_alert','node':x['id'],'confidence':0.5,'rationale':'no incoming connections'})
# weak edges
for e in e:
    if e.get('weight',1)<0.5:
        c.append({'type':'weak_edge','source':e['source'],'target':e['target'],'weight':e['weight'],'confidence':0.6,'rationale':f'low weight {e.get("weight",0):.1f}'})
json.dump(c,open(os.environ['C']+'/candidates.json','w'),indent=2)
print(f'  {len(c)} candidates')
PY
}

wake(){
  echo "=== REM: Waking ==="
  export C="$CACHE" R="$RQ"
  python3 << 'PY' 2>/dev/null
import json,os
c=[];by_type={}
try:c=json.load(open(os.environ['C']+'/candidates.json'))
except:pass
seen=set();u=[]
for x in c:
    k=json.dumps(x,sort_keys=True)
    if k not in seen: seen.add(k);u.append(x);by_type[x['type']]=by_type.get(x['type'],0)+1
u.sort(key=lambda x:x.get('confidence',0),reverse=True)
q={'version':'1.0.0','generated_at':'$(date -u +%Y-%m-%dT%H:%M:%SZ)','total':len(u),'by_type':by_type,'reviews':[]}
for x in u:
    if x.get('confidence',0)>=0.5: q['reviews'].append({'type':x['type'],'summary':x.get('rationale',''),'decision':'pending'})
json.dump(q,open(os.environ['R'],'w'),indent=2)
print(f'  {len(q["reviews"])} reviews from {q["total"]} candidates')
for t,n in by_type.items(): print(f'    {t}: {n}')
PY
}

review(){
  [ -f "$RQ" ]||{ echo "no review queue";exit 1;}
  python3 -c "
import json
q=json.load(open('${RQ}'))
print('REM — Morning Review')
print(f'  candidates: {q[\"total\"]}  reviews: {len(q[\"reviews\"])}')
for r in q.get('reviews',[])[:15]:
    t=r['type'];s=r['summary'][:60]
    icon={'candidate_edge':'🔗','weak_edge':'⚠️','orphan_alert':'👻','bridge_alert':'🌉'}.get(t,'📌')
    print(f'  {icon} {t}: {s}')
print('  (suggests, never commits — humans review from provenance)')
" 2>/dev/null
}

cycle(){ dream;wake;review;echo "REM cycle done — queue: ${RQ}";}

case "${1:-help}" in dream)dream;;wake)wake;;review)review;;cycle)cycle;;*)echo "rem-mode v${V} — REM sleep review agent. usage: dream|wake|review|cycle";;esac