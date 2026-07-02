#!/usr/bin/env bash
# lab — watches all 5 experiments, reports state, deploys to lab.vaked.dev
# each breath is a cycle. each cycle is a step toward an answer.

CACHE="$HOME/.cache/lab"
mkdir -p "$CACHE"

# Q2 — Resonant states: compare unit A and B associations
echo "═══ LAB PULSE ═══"
echo ""

echo "→ Q1: replicant-alpha"
python3 -c "
import json
r = json.load(open('$HOME/.cache/unit-replicant/replicants.json'))
a = r.get('replicant-alpha', {})
print(f'  gen={a.get(\"generation\",1)} state={a.get(\"state\",\"?\")} assoc={a.get(\"associations\",0)}/{a.get(\"threshold\",5)}')
for k, v in r.items():
    if k != 'replicant-alpha':
        print(f'  offspring: {k}')
" 2>/dev/null || echo "  (not yet active)"

echo ""
echo "→ Q2: resonant states"
python3 -c "
import json
a = json.load(open('$HOME/.cache/unit/associations.json'))
b = json.load(open('$HOME/.cache/unit-b/associations.json'))
common = set(a.keys()) & set(b.keys())
print(f'  unit A: {len(a)} assoc  unit B: {len(b)} assoc  overlap: {len(common)}')
if len(a) > 0 and len(b) > 0:
    ratio = len(common) / max(len(a), len(b))
    print(f'  resonance: {ratio:.2f} {\"×\" if ratio > 0.7 else \"○\"} {\"SYNC\" if ratio > 0.7 else \"drift\"}')
" 2>/dev/null || echo "  (waiting for data)"

echo ""
echo "→ Q3: recursive questions"
python3 -c "
import json
q = json.load(open('$CACHE/q3-recursive.json'))
print(f'  question: {q[\"seed_question\"][:60]}...')
print(f'  iterations: {q.get(\"iterations\",0)}/{q[\"max_iterations\"]}')
" 2>/dev/null || echo "  (seeded)"

echo ""
echo "→ Q4: self-curating memory"
python3 -c "
import json
q = json.load(open('$CACHE/q4-self-prune.json'))
print(f'  kept: {q.get(\"kept_count\",0)}  pruned: {q.get(\"pruned_count\",0)}')
print(f'  decay: {q.get(\"decay_rate\",0.15)}  min reinforcement: {q.get(\"min_reinforcement\",0.3)}')
" 2>/dev/null || echo "  (seeded)"

echo ""
echo "→ Q5: building for compost"
python3 -c "
import json, time
q = json.load(open('$CACHE/q5-compost.json'))
since = q.get('born','?')
print(f'  born: {since}')
print(f'  lifespan: {q.get(\"lifespan_hours\",72)}h')
print(f'  stage: {q.get(\"decay_stage\",\"active\")}')
" 2>/dev/null || echo "  (seeded)"

echo ""
echo "═══ lab pulse complete ═══"