#!/usr/bin/env bash
set -euo pipefail
G="${HOME}/.brain/graph.json"; RQ="${HOME}/.brain/review-queue.json"; C="${HOME}/.brain/rem-cache"; mkdir -p "$C"
V="1.0.0"

dream(){
  echo "=== REM: Dreaming ==="
  export G_PATH="$G" C_PATH="$C"
  python3 << 'PY' 2>/dev/null
import json,os,itertools
g=json.load(open(os.environ['G_PATH']))
n,e=g['nodes'],g['edges'];c=[];pairs={(x['source'],x['target']) for x in e}
ids={x['id'] for x in n};layers={}
for x in n:
    l=tuple(x.get('layer',[0,0,0]))
    layers.setdefault(l,[]).append(x['id'])
# same-layer unconnected
for l,ids_ in layers.items():
    for a,b in itertools.combinations(ids_,2):
        if a==b or (a,b) in pairs or (b,a) in pairs: continue
        c.append({'type':'candidate_edge','source':a,'target':b,'layer':list(l),'confidence':0.3,'rationale':f'same layer {l} unconnected'})
# effectively orphaned (incoming only via weak edges < 0.5)
incoming={}
for e_ in e:
    incoming.setdefault(e_['target'],[]).append(e_)
for x in n:
    if x['id'] in ('brain-state','brain-graph','genesis'): continue
    inc=incoming.get(x['id'],[])
    if not inc or all(e_.get('weight',1)<0.5 for e_ in inc):
        w=inc[0].get('weight',0) if inc else 0
        c.append({'type':'orphan_alert','node':x['id'],'label':x.get('label',x['id']),'weight':w,'confidence':0.6,'rationale':f'effectively orphaned (incoming w={w})'})
# weak edges
for e_ in e:
    if e_.get('weight',1)<0.5:
        c.append({'type':'weak_edge','source':e_['source'],'target':e_['target'],'weight':e_['weight'],'confidence':0.55,'rationale':f'low weight {e_.get("weight",0):.1f}'})
json.dump(c,open(os.environ['C_PATH']+'/candidates.json','w'),indent=2)
print(f'  {len(c)} candidates')
PY
}

wake(){
  echo "=== REM: Waking ==="
  export C_PATH="$C" RQ_PATH="$RQ"
  python3 << 'PY' 2>/dev/null
import json,os
c=[];by_type={}
try:c=json.load(open(os.environ['C_PATH']+'/candidates.json'))
except:pass
seen=set();u=[]
for x in c:
    k=json.dumps(x,sort_keys=True)
    if k not in seen: seen.add(k);u.append(x);by_type[x['type']]=by_type.get(x['type'],0)+1
u.sort(key=lambda x:x.get('confidence',0),reverse=True)
q={'version':'1.0.0','generated_at':'$(date -u +%Y-%m-%dT%H:%M:%SZ)','total':len(u),'by_type':by_type,'reviews':[]}
for x in u:
    if x.get('confidence',0)>=0.5: q['reviews'].append({'type':x['type'],'summary':x.get('rationale',''),'decision':'pending'})
json.dump(q,open(os.environ['RQ_PATH'],'w'),indent=2)
print(f'  {len(q["reviews"])} reviews from {q["total"]} candidates')
for t,n in by_type.items(): print(f'    {t}: {n}')
PY
}

review(){
  [ -f "$RQ" ]||{ echo "no review queue";exit 1;}
  python3 -c "
import json
q=json.load(open('$RQ'))
print('REM — Morning Review');print(f'  candidates: {q[\"total\"]}  reviews: {len(q[\"reviews\"])}')
for r in q.get('reviews',[])[:20]:
    t=r['type'];s=r['summary'][:65]
    icon={'candidate_edge':'🔗','weak_edge':'⚠️','orphan_alert':'👻'}.get(t,'📌')
    print(f'  {icon} {s}')
print('  (suggests, never commits — humans decide)')
" 2>/dev/null
}

cycle(){ dream;wake;review;echo "REM cycle done — queue at ${RQ}";}
case "${1:-help}" in dream)dream;;wake)wake;;review)review;;cycle)cycle;;*)echo "rem-mode v${V} — usage: dream|wake|review|cycle";;esac
