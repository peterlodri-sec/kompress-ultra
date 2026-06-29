#!/usr/bin/env bash
set -euo pipefail
G="${HOME}/.brain/graph.json"; D="${1:-60}"
[ -f "$G" ]||{ echo "no brain graph at ${G}";exit 1;}
[ "${MEDITATION_AUTO:-}" = "1" ]&&{ echo "meditation: user-triggered only";exit 1;}
trap 'echo -e "\n\n🧘 meditation ended. nothing was changed.";exit 0' INT TERM
export G_PATH="$G" DUR="$D"; python3 << 'PY' 2>&1
import json,time,os,sys
g=json.load(open(os.environ['G_PATH']));n,e=g['nodes'],g['edges']
by_t={};[by_t.update({x.get('type','?'):by_t.get(x.get('type','?'),0)+1}) for x in n]
et={};[et.update({x.get('label','?'):et.get(x.get('label','?'),0)+1}) for x in e]
tw=sum(x.get('weight',1) for x in e);ly=len(set(tuple(x.get('layer',[0,0,0])) for x in n))
hub=max(n,key=lambda x:len([y for y in e if y['source']==x['id'] or y['target']==x['id']]))
act=[x for x in e if x.get('weight',1)>0];dd=[x for x in e if x.get('weight',0)==0]
dur=int(os.environ['DUR']);itv=5;el=0;br=0
print('\n╔══════════════════════════════════════════════════════╗')
print('║  🧘  MEDITATION MODE                                ║')
print('║  observing the brain graph without intervention     ║')
print('╚══════════════════════════════════════════════════════╝')
print(f'  still point: {hub.get("label",hub["id"])} ({hub.get("type","?")})')
print(f'  layers: {ly}  nodes: {len(n)} ({len(by_t)}t)  edges: {len(e)} ({len(et)}t)')
print(f'  active: {len(act)}  dead: {len(dd)}  flow: {tw:.1f}')
print(f'  chaos: paused  repair: paused  rem: paused  observer: present\n')
while el<dur:
    time.sleep(itv);el+=itv;br+=1
    re=len([x for x in e if x.get('_reflected_at',0)>time.time()*1000-300000])
    ki=len([x for x in e if x.get('_killed_at',0)>time.time()*1000-300000])
    print(f'  breath {br:3d}  {el:3d}s/{dur}s  {re} reflected  {ki} killed  {len(act)} conducting',flush=True)
print(f'\n  {br} breaths. stillness achieved. no changes were made.')
PY