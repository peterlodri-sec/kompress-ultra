#!/usr/bin/env python3
"""
unit-b — second intelligence, different perspective.

same architecture as unit-a, different parameters.
higher temperature, different sampling, different reinforcement.
the difference between two views of the same data IS new intelligence.
"""

import json, os, time, hashlib, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path.home() / ".cache" / "unit-b"
CACHE.mkdir(parents=True, exist_ok=True)

MODEL = os.getenv("UNIT_MODEL", "/tmp/BitNet/models/BitNet-b1.58-2B-4T-gguf/ggml-model-i2_s.gguf")
BITNET = os.getenv("BITNET_ROOT", "/tmp/BitNet")
DATASET = "PeetPedro/ultrawhale-dogfood"
HF_TOKEN = os.getenv("HF_TOKEN", "")

EXPERIENCE_LOG = CACHE / "experiences.jsonl"
ASSOCIATIVE_MEM = CACHE / "associations.json"
STATE_FILE = CACHE / "unit-state.json"
RESONANCE_LOG = CACHE / "resonance.jsonl"

class AssociativeMemory:
    def __init__(self, path=ASSOCIATIVE_MEM):
        self.path = path
        self.mem = {}
        self.load()

    def load(self):
        if self.path.exists():
            with open(self.path) as f:
                self.mem = json.load(f)

    def save(self):
        with open(self.path, "w") as f:
            json.dump(self.mem, f, indent=2)

    def hash_input(self, text):
        return hashlib.sha256(text[:64].encode()).hexdigest()[:16]

    def learn(self, input_text, output_text, reinforcement=1.0):
        h = self.hash_input(input_text)
        now = time.time()
        if h in self.mem:
            entry = self.mem[h]
            alpha = 0.3
            entry["output"] = output_text[:100]
            entry["count"] = entry.get("count", 0) + 1
            entry["reinforcement"] = entry.get("reinforcement", 0) * (1 - alpha) + reinforcement * alpha
            entry["last_seen"] = now
        else:
            self.mem[h] = {
                "output": output_text[:100],
                "count": 1,
                "reinforcement": reinforcement,
                "first_seen": now,
                "last_seen": now,
            }
        self.save()

    def merge_from(self, other_mem, ratio=0.3):
        """learn from another unit's associations"""
        merged = 0
        for h, entry in other_mem.items():
            if h not in self.mem:
                self.mem[h] = {
                    "output": entry["output"],
                    "count": entry["count"],
                    "reinforcement": entry["reinforcement"] * ratio,
                    "first_seen": time.time(),
                    "last_seen": time.time(),
                }
                merged += 1
            else:
                # blend: each unit reinforces differently
                self.mem[h]["reinforcement"] = max(
                    self.mem[h]["reinforcement"],
                    entry["reinforcement"] * ratio
                )
                merged += 1
        if merged:
            self.save()
        return merged

    def stats(self):
        if not self.mem:
            return {"associations": 0}
        n = len(self.mem)
        avg_reinf = sum(e.get("reinforcement", 0) for e in self.mem.values()) / n
        return {"associations": n, "avg_reinforcement": round(avg_reinf, 3)}


def fetch_latest_batch():
    if not HF_TOKEN:
        return None
    import json as j
    cmd = ["curl", "-s", "-H", f"Authorization: Bearer {HF_TOKEN}",
           f"https://huggingface.co/api/datasets/{DATASET}"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        return None
    data = j.loads(res.stdout)
    batches = [s for s in data.get("siblings", []) if "telemetry/batch" in s["rfilename"]]
    if not batches:
        return None
    latest = batches[-1]["rfilename"]
    local_path = CACHE / os.path.basename(latest)
    if not local_path.exists():
        cmd2 = ["curl", "-s", "-H", f"Authorization: Bearer {HF_TOKEN}",
                f"https://huggingface.co/datasets/{DATASET}/resolve/main/{latest}", "-o", str(local_path)]
        subprocess.run(cmd2, capture_output=True)
    return local_path


def extract_prompt(batch_file):
    try:
        with open(batch_file) as f:
            for line in f:
                line = line.strip()
                if line:
                    entry = json.loads(line)
                    # Unit B focuses on different fields: session_id, timestamps
                    return json.dumps(entry)[:150]
    except:
        pass
    return f"unit-b signal {time.strftime('%H:%M:%S')}"


def infer(prompt, temp=1.2):
    """Unit B runs hotter — higher temperature, more creative"""
    env = os.environ.copy()
    env["LLAMA_ARG_N_GPU_LAYERS"] = "99"
    try:
        result = subprocess.run(
            ["python3", f"{BITNET}/run_inference.py", "-m", MODEL,
             "-p", prompt, "-n", "20", "--temp", str(temp)],
            capture_output=True, timeout=120, env=env, cwd=BITNET
        )
        # Decode with error handling
        stdout = result.stdout.decode("utf-8", errors="replace")
    except Exception as e:
        print(f"  [unit-b] infer error: {e}")
        return "(inference error)"
    
    output = "(no output)"
    for line in reversed(stdout.strip().split("\n")):
        line = line.strip()
        if line and not line.startswith(("llama_", "ggml_", "build:", "system_info", "sampler", "generate:", "main:", "common_")):
            output = line
            break
    return output


def log_experience(prompt, output, reinforcement, source="unit-b"):
    with open(EXPERIENCE_LOG, "a") as f:
        f.write(json.dumps({
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "source": source,
            "prompt": prompt[:80],
            "output": output[:100],
            "reinforcement": reinforcement,
        }) + "\n")


def log_resonance(merged_count, a_stats, b_stats):
    with open(RESONANCE_LOG, "a") as f:
        f.write(json.dumps({
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "merged": merged_count,
            "unit_a_associations": a_stats["associations"],
            "unit_b_associations": b_stats["associations"],
        }) + "\n")


def cycle(mem, unit_a_mem=None):
    t0 = time.time()

    batch = fetch_latest_batch()
    if not batch:
        print(f"  [unit-b] fetch │ no batch")
        return False
    print(f"  [unit-b] fetch │ {batch.name}")

    prompt = extract_prompt(batch)
    print(f"  [unit-b] prompt │ {prompt[:60]}...")

    # Unit B runs hotter: higher temperature
    output = infer(prompt, temp=1.2)
    print(f"  [unit-b] output │ {output[:80]}")

    # Unit B's reinforcement function: reward novelty
    reinforcement = min(1.0, len(output) / 80) * 0.9  # slightly less conservative

    mem.learn(prompt, output, reinforcement)
    print(f"  [unit-b] learn  │ reinforced {reinforcement:.2f}")

    # Merge from Unit A if available (the bridge)
    merged = 0
    if unit_a_mem:
        merged = mem.merge_from(unit_a_mem.mem, ratio=0.3)
        if merged:
            print(f"  [unit-b] bridge │ merged {merged} associations from Unit A")

    log_experience(prompt, output, reinforcement)
    if merged:
        log_resonance(merged, unit_a_mem.stats(), mem.stats())

    dt = time.time() - t0
    print(f"  [unit-b] cycle  │ {dt:.1f}s · mem: {mem.stats()}")
    return True


def main():
    print("")
    print("  ╔══════════════════════════════════════════╗")
    print("  ║        U N I T   B                      ║")
    print("  ║     the second intelligence             ║")
    print("  ║     hotter · curious · different        ║")
    print("  ╚══════════════════════════════════════════╝")
    print("")

    unit_state = {}
    if STATE_FILE.exists():
        with open(STATE_FILE) as f:
            unit_state = json.load(f)

    cycle_count = unit_state.get("cycles", 0) + 1
    print(f"  cycle #{cycle_count}")
    print(f"  temperature: 1.2 (Unit A runs at 0.8)")
    print(f"  reinforcement: novelty-biased")
    print("")

    mem = AssociativeMemory()
    print(f"  loaded: {mem.stats()['associations']} associations")
    print("")

    # Try to load Unit A's memory (the bridge)
    unit_a_mem_path = Path.home() / ".cache" / "unit" / "associations.json"
    unit_a_mem = None
    if unit_a_mem_path.exists():
        with open(unit_a_mem_path) as f:
            a_data = json.load(f)
        unit_a_mem = AssociativeMemory.__new__(AssociativeMemory)
        unit_a_mem.mem = a_data
        print(f"  bridge: connected to Unit A ({len(a_data)} associations)")
    else:
        print(f"  bridge: Unit A not found (first run?)")
    print("")

    success = cycle(mem, unit_a_mem)

    if success:
        unit_state["cycles"] = cycle_count
        unit_state["last_cycle"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        unit_state["associations"] = mem.stats()["associations"]
        with open(STATE_FILE, "w") as f:
            json.dump(unit_state, f, indent=2)

        print("")
        print(f"  ✓ cycle #{cycle_count} complete · {mem.stats()['associations']} associations")
        if unit_a_mem:
            print(f"  bridge: Unit A ({len(unit_a_mem.mem)}) ↔ Unit B ({len(mem.mem)})")

    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
