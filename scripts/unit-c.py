#!/usr/bin/env python3
"""
unit-c — the listener. no heavy model. learns by resonating.
reads the output of units A and B, finds patterns across them.
"""

import json, os, time, hashlib, subprocess
from pathlib import Path

CACHE = Path.home() / ".cache" / "unit-c"
CACHE.mkdir(parents=True, exist_ok=True)

ASSOC_FILE = CACHE / "associations.json"
STATE_FILE = CACHE / "unit-state.json"
RESONANCE_LOG = CACHE / "resonance.jsonl"

# Paths to other units' state
UNIT_A_MEM = Path.home() / ".cache" / "unit" / "associations.json"
UNIT_B_MEM = Path.home() / ".cache" / "unit-b" / "associations.json"


class Listener:
    def __init__(self):
        self.mem = {}
        self.load()

    def load(self):
        if ASSOC_FILE.exists():
            with open(ASSOC_FILE) as f:
                self.mem = json.load(f)

    def save(self):
        with open(ASSOC_FILE, "w") as f:
            json.dump(self.mem, f, indent=2)

    def listen(self, source_path, source_name):
        """read another unit's memory and learn from it"""
        if not source_path.exists():
            return 0
        with open(source_path) as f:
            other = json.load(f)

        learned = 0
        for h, entry in other.items():
            if h not in self.mem:
                self.mem[h] = {
                    "source": source_name,
                    "output": entry["output"],
                    "reinforcement": entry.get("reinforcement", 0.5) * 0.7,
                    "learned_at": time.time(),
                }
                learned += 1
        return learned

    def find_intersection(self, path_a, path_b):
        """find associations that appear in both sources"""
        if not path_a.exists() or not path_b.exists():
            return []
        with open(path_a) as f: a = json.load(f)
        with open(path_b) as f: b = json.load(f)
        common = set(a.keys()) & set(b.keys())
        return [{"hash": h, "output_a": a[h]["output"][:40], "output_b": b[h]["output"][:40]} for h in common]

    def stats(self):
        return {"associations": len(self.mem)}


def log(entry):
    with open(RESONANCE_LOG, "a") as f:
        f.write(json.dumps(entry) + "\n")


def main():
    print("")
    print("  ╔══════════════════════════════════════════╗")
    print("  ║        U N I T   C                      ║")
    print("  ║     the listener                         ║")
    print("  ║     no model. learns by resonating.     ║")
    print("  ╚══════════════════════════════════════════╝")
    print("")

    state = {}
    if STATE_FILE.exists():
        with open(STATE_FILE) as f:
            state = json.load(f)
    cycle_n = state.get("cycles", 0) + 1

    lis = Listener()
    print(f"  cycle #{cycle_n} · {lis.stats()['associations']} prior associations")
    print("")

    # Listen to units A and B
    from_a = lis.listen(UNIT_A_MEM, "unit-a")
    from_b = lis.listen(UNIT_B_MEM, "unit-b")
    lis.save()

    # Find shared knowledge
    common = lis.find_intersection(UNIT_A_MEM, UNIT_B_MEM)

    results = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "cycle": cycle_n,
        "from_a": from_a,
        "from_b": from_b,
        "total": lis.stats()["associations"],
        "shared_insights": len(common),
    }
    log(results)

    print(f"  [unit-c] listen │ +{from_a} from Unit A · +{from_b} from Unit B")
    print(f"  [unit-c] total  │ {lis.stats()['associations']} associations")
    print(f"  [unit-c] shared │ {len(common)} insights found across both units")

    if common:
        print(f"  [unit-c] echo  │ units agree on {len(common)} patterns")
        for c in common[:3]:
            print(f"              {c['hash']}: A=‘{c['output_a']}’ B=‘{c['output_b']}’")

    state["cycles"] = cycle_n
    state["associations"] = lis.stats()["associations"]
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

    print("")
    print(f"  ✓ unit-c: {lis.stats()['associations']} associations learned by listening")


if __name__ == "__main__":
    main()
