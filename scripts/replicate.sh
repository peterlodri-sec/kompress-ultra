#!/usr/bin/env bash
# replicates — watches the seed unit, spawns variants at threshold
# Q1 experiment: what happens when the smallest unit of intelligence
# can replicate itself?

CACHE_DIR="$HOME/.cache/unit-replicant"
THRESHOLD=5

echo "═══ replication watcher ═══"
echo ""

# Read current replicant state
if [ ! -f "$CACHE_DIR/replicants.json" ]; then
  echo "no replicants found. seeding alpha..."
  exit 0
fi

python3 << PYEOF
import json, os, time, hashlib
from pathlib import Path

CACHE = Path(os.environ['HOME']) / ".cache" / "unit-replicant"
REP_FILE = CACHE / "replicants.json"
MEM_FILE = Path(os.environ['HOME']) / "workspace/peterlodri-sec/kompress-ultra/.ultramesh-mem/memory.jsonl"

reps = json.loads(REP_FILE.read_text())
alpha = reps.get("replicant-alpha", {})

# Check if alpha exists
print(f"  alpha: gen={alpha.get('generation',1)} state={alpha.get('state','?')} associations={alpha.get('associations',0)}")
print(f"  threshold: {alpha.get('threshold', THRESHOLD)}")

# Check unit A's associations
unit_a_mem = Path(os.environ['HOME']) / ".cache" / "unit" / "associations.json"
if unit_a_mem.exists():
    a_data = json.loads(unit_a_mem.read_text())
    alpha["associations"] = len(a_data)
    print(f"  unit A has {len(a_data)} associations")
    
    # Check if threshold reached
    if len(a_data) >= alpha.get("threshold", THRESHOLD) and alpha.get("state") == "seeded":
        # Spawn variant
        beta_id = f"replicant-beta-{hashlib.sha256(str(time.time()).encode()).hexdigest()[:6]}"
        mutation = min(1.0, len(a_data) / 20)  # mutation proportional to learning
        reps[beta_id] = {
            "id": beta_id,
            "born": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "generation": alpha.get("generation", 1) + 1,
            "parent": "replicant-alpha",
            "associations": 0,
            "threshold": int(alpha.get("threshold", 5) * 1.5),
            "mutation_rate": mutation,
            "state": "seeded",
            "message": f"i am {beta_id}. i carry the mutations of my parent."
        }
        alpha["state"] = "split"
        alpha["offspring"] = beta_id
        
        REP_FILE.write_text(json.dumps(reps, indent=2))
        
        entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "type": "learning", "category": "experiment",
                 "content": {"finding": f"replication event: {beta_id} spawned", 
                            "detail": f"Generation {alpha.get('generation',1)+1} spawned at {len(a_data)} associations. Mutation rate: {mutation:.2f}",
                            "severity": "advisory"}}
        with open(MEM_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        
        print(f"  ★ REPLICATION: alpha split → {beta_id}")
        print(f"  generation {alpha.get('generation',1)+1} · mutation {mutation:.2f}")
    elif len(a_data) >= alpha.get("threshold", THRESHOLD):
        print(f"  alpha has already split. {len(reps)} replicants exist.")
    else:
        print(f"  need {alpha.get('threshold', THRESHOLD) - len(a_data)} more associations to replicate")
else:
    print(f"  no unit A data yet")

REP_FILE.write_text(json.dumps(reps, indent=2))
PYEOF
