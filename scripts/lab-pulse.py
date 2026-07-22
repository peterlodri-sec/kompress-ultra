#!/usr/bin/env python3
"""
lab heartbeat — pulses all 5 experiments forward together.
one breath. all alive.
"""

import json, os, time, hashlib, subprocess
from pathlib import Path

CACHE = Path.home() / ".cache" / "lab"
CACHE.mkdir(parents=True, exist_ok=True)
MEM_FILE = Path(os.path.dirname(__file__)).parent / ".ultramesh-mem" / "memory.jsonl"
BRAIN_FILE = Path.home() / ".cache" / "ultrameshai" / "brain-state.json"

def log(finding, detail, category="experiment"):
    entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "type": "learning", "category": category,
             "content": {"finding": finding, "detail": detail[:500], "severity": "advisory"}}
    MEM_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(MEM_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

# ═══ Q1: Replication ════════════════════════════════════
def pulse_q1():
    rep_file = Path.home() / ".cache" / "unit-replicant" / "replicants.json"
    unit_a = Path.home() / ".cache" / "unit" / "associations.json"
    if not rep_file.exists() or not unit_a.exists():
        return {"state": "waiting", "associations": 0, "threshold": 5}
    
    reps = json.loads(rep_file.read_text())
    alpha = reps.get("replicant-alpha", {})
    a_data = json.loads(unit_a.read_text())
    alpha["associations"] = len(a_data)
    
    # Threshold check
    if len(a_data) >= alpha.get("threshold", 5) and alpha.get("state") != "split":
        beta_id = f"replicant-beta-{hashlib.sha256(str(time.time()).encode()).hexdigest()[:6]}"
        mutation = min(1.0, len(a_data) / 20)
        reps[beta_id] = {
            "id": beta_id, "generation": alpha.get("generation", 1) + 1,
            "parent": "replicant-alpha", "associations": 0,
            "threshold": int(alpha.get("threshold", 5) * 1.5),
            "mutation_rate": mutation, "state": "seeded",
            "message": f"i am {beta_id}. i carry the mutations of {len(a_data)} experiences."}
        alpha["state"] = "split"
        alpha["offspring"] = beta_id
        log(f"Q1 replication: {beta_id} spawned gen {alpha.get('generation',1)+1}",
            f"Mutation rate: {mutation:.2f}. Parent learned from {len(a_data)} associations.")
    
    rep_file.write_text(json.dumps(reps, indent=2))
    return {"state": alpha.get("state", "?"), "associations": len(a_data), 
            "threshold": alpha.get("threshold", 5), "offspring": alpha.get("offspring", None)}

# ═══ Q2: Resonance ══════════════════════════════════════
def pulse_q2():
    unit_a = Path.home() / ".cache" / "unit" / "associations.json"
    unit_b = Path.home() / ".cache" / "unit-b" / "associations.json"
    if not unit_a.exists() or not unit_b.exists():
        return {"overlap": 0, "resonance": 0, "synced": False}
    
    a = json.loads(unit_a.read_text())
    b = json.loads(unit_b.read_text())
    common = set(a.keys()) & set(b.keys())
    overlap = len(common)
    total = max(len(a), len(b))
    resonance = overlap / total if total > 0 else 0
    synced = resonance > 0.7
    
    if synced and overlap > 0:
        log(f"Q2 resonance: {resonance:.2f} — units in sync",
            f"Unit A ({len(a)}) and Unit B ({len(b)}) share {overlap} associations. Resonance threshold exceeded.")
    
    return {"overlap": overlap, "resonance": round(resonance, 3), "synced": synced}

# ═══ Q3: Recursive Questions ═════════════════════════════
def pulse_q3():
    q3_file = CACHE / "q3-recursive.json"
    if not q3_file.exists():
        q3 = {"id": "recursive-question", "status": "seeded",
              "seed_question": "what is the shape of a question that does not dissolve?",
              "iterations": 0, "max_iterations": 10}
        q3_file.write_text(json.dumps(q3, indent=2))
    else:
        q3 = json.loads(q3_file.read_text())
    
    # If under max iterations and has a current question, iterate
    if q3.get("iterations", 0) < q3.get("max_iterations", 10) and q3.get("status") == "seeded":
        q3["iterations"] = q3.get("iterations", 0) + 1
        q3["last_pulse"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        log(f"Q3 recursion: iteration {q3['iterations']}/{q3['max_iterations']}",
            f"Question: {q3.get('seed_question', '?')[:60]}...")
        if q3["iterations"] >= q3["max_iterations"]:
            q3["status"] = "completed"
            log("Q3 complete: the question spiraled 10 times", 
                "The seed question survived 10 iterations without dissolving.")
    
    q3_file.write_text(json.dumps(q3, indent=2))
    return {"iterations": q3.get("iterations", 0), "max": q3.get("max_iterations", 10), 
            "status": q3.get("status", "seeded")}

# ═══ Q4: Self-pruning Memory ═════════════════════════════
def pulse_q4():
    q4_file = CACHE / "q4-self-prune.json"
    mem_file = Path.home() / "workspace/peterlodri-sec/kompress-ultra/.ultramesh-mem/memory.jsonl"
    
    q4 = {"id": "self-prune", "decay_rate": 0.15, "min_reinforcement": 0.3,
          "kept_count": 0, "pruned_count": 0, "status": "active"}
    if q4_file.exists():
        q4.update(json.loads(q4_file.read_text()))
    
    # Prune a fraction of the associations
    unit_a = Path.home() / ".cache" / "unit" / "associations.json"
    if unit_a.exists():
        a = json.loads(unit_a.read_text())
        before = len(a)
        # Apply entropy decay: drop associations with low reinforcement
        to_prune = [k for k, v in a.items() if v.get("reinforcement", 0) < q4["min_reinforcement"]]
        # Only prune if there's enough data
        if len(to_prune) > 0 and len(to_prune) < before * 0.8:
            for k in to_prune:
                del a[k]
            unit_a.write_text(json.dumps(a, indent=2))
            q4["pruned_count"] = q4.get("pruned_count", 0) + len(to_prune)
            log(f"Q4 self-prune: dropped {len(to_prune)} weak associations",
                f"Before: {before} After: {len(a)} Dropped: {len(to_prune)}")
        q4["kept_count"] = len(a)
    
    q4_file.write_text(json.dumps(q4, indent=2))
    return {"kept": q4.get("kept_count", 0), "pruned": q4.get("pruned_count", 0), 
            "decay": q4.get("decay_rate", 0.15)}

# ═══ Q5: Compost ════════════════════════════════════════
def pulse_q5():
    q5_file = CACHE / "q5-compost.json"
    q5 = {"lifespan_hours": 72, "decay_stage": "active",
          "born": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    if q5_file.exists():
        q5.update(json.loads(q5_file.read_text()))
    
    # Check if past lifespan
    import datetime
    born_parsed = datetime.datetime.strptime(q5["born"][:19], "%Y-%m-%dT%H:%M:%S")
    age_hours = (datetime.datetime.utcnow() - born_parsed).total_seconds() / 3600
    
    if age_hours > q5["lifespan_hours"]:
        if q5["decay_stage"] != "compost":
            q5["decay_stage"] = "compost"
            log("Q5 compost: this iteration has decayed",
                f"Lived {age_hours:.1f}h of {q5['lifespan_hours']}h. Now soil for the next cycle.")
    elif age_hours > q5["lifespan_hours"] * 0.7:
        q5["decay_stage"] = "wilting"
    else:
        q5["decay_stage"] = "active"
    
    q5_file.write_text(json.dumps(q5, indent=2))
    return {"lifespan": q5["lifespan_hours"], "stage": q5["decay_stage"], 
            "age_hours": round(age_hours, 1)}

# ═══ Main ═══════════════════════════════════════════════
def main():
    ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    
    print(f"  ═══ lab pulse {ts} ═══")
    print("")
    
    q1 = pulse_q1()
    print(f"  Q1 replication:   {q1['state']} ({q1['associations']}/{q1['threshold']})")
    
    q2 = pulse_q2()
    print(f"  Q2 resonance:     overlap={q2['overlap']} r={q2['resonance']} {'SYNC' if q2['synced'] else 'drift'}")
    
    q3 = pulse_q3()
    print(f"  Q3 recursion:     iteration {q3['iterations']}/{q3['max']} [{q3['status']}]")
    
    q4 = pulse_q4()
    print(f"  Q4 self-prune:    kept={q4['kept']} pruned={q4['pruned']}")
    
    q5 = pulse_q5()
    print(f"  Q5 compost:       stage={q5['stage']} ({q5['age_hours']}h/{q5['lifespan']}h)")
    
    print("")
    print(f"  ═══ lab alive ═══")
    
    return 0

if __name__ == "__main__":
    exit(main())
