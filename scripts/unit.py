#!/usr/bin/env python3
"""
unit — the minimal unit of intelligence.

a 1-bit model that learns while it breathes.
no separate training phase. no external loss.
the dogfeed IS the teacher. the runtime IS the training.
"""

import json, os, sys, time, hashlib, struct
from pathlib import Path

# ── paths ─────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
CACHE = Path.home() / ".cache" / "unit"
CACHE.mkdir(parents=True, exist_ok=True)

MODEL = os.getenv("UNIT_MODEL", "/tmp/BitNet/models/BitNet-b1.58-2B-4T-gguf/ggml-model-i2_s.gguf")
BITNET = os.getenv("BITNET_ROOT", "/tmp/BitNet")
DATASET = "PeetPedro/ultrawhale-dogfood"
HF_TOKEN = os.getenv("HF_TOKEN", "")

EXPERIENCE_LOG = CACHE / "experiences.jsonl"
ASSOCIATIVE_MEM = CACHE / "associations.json"
STATE_FILE = CACHE / "unit-state.json"

# ── tiny associative memory (the runtime learner) ────────────────────
class AssociativeMemory:
    """
    Hebbian associative memory. no backprop. just:
    what fires together, wires together.

    stores: input_hash → { output, count, last_seen, reinforcement }
    """
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

    def hash_input(self, text, depth=64):
        """hash the first N chars of input as a simple fingerprint"""
        h = hashlib.sha256(text[:depth].encode()).hexdigest()[:16]
        return h

    def recall(self, text):
        """retrieve learned association for similar input"""
        h = self.hash_input(text)
        if h in self.mem:
            entry = self.mem[h]
            entry["hits"] = entry.get("hits", 0) + 1
            return entry
        return None

    def learn(self, input_text, output_text, reinforcement=1.0):
        """store or reinforce an association"""
        h = self.hash_input(input_text)
        now = time.time()

        if h in self.mem:
            entry = self.mem[h]
            # reinforce: blend old and new
            alpha = 0.3  # learning rate
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
                "hits": 0,
            }

        self.save()

    def stats(self):
        if not self.mem:
            return {"associations": 0}
        n = len(self.mem)
        total_hits = sum(e.get("hits", 0) for e in self.mem.values())
        avg_reinf = sum(e.get("reinforcement", 0) for e in self.mem.values()) / n
        return {
            "associations": n,
            "total_hits": total_hits,
            "avg_reinforcement": round(avg_reinf, 3),
        }


# ── dogfeed fetcher ─────────────────────────────────────────────────
def fetch_latest_batch():
    """fetch the latest telemetry batch from HF"""
    import subprocess, json as j

    if not HF_TOKEN:
        print("  [unit] ✗ HF_TOKEN not set")
        return None

    # get latest batch name
    cmd = [
        "curl", "-s", "-H", f"Authorization: Bearer {HF_TOKEN}",
        f"https://huggingface.co/api/datasets/{DATASET}"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        return None

    data = j.loads(res.stdout)
    siblings = data.get("siblings", [])
    batches = [s for s in siblings if "telemetry/batch" in s["rfilename"]]
    if not batches:
        return None

    latest = batches[-1]["rfilename"]
    local_path = CACHE / os.path.basename(latest)

    if not local_path.exists():
        cmd2 = [
            "curl", "-s", "-H", f"Authorization: Bearer {HF_TOKEN}",
            f"https://huggingface.co/datasets/{DATASET}/resolve/main/{latest}",
            "-o", str(local_path)
        ]
        subprocess.run(cmd2, capture_output=True)

    return local_path


def extract_prompt(batch_file):
    """extract the first JSON entry as a prompt"""
    try:
        with open(batch_file) as f:
            for line in f:
                line = line.strip()
                if line:
                    entry = json.loads(line)
                    return json.dumps(entry)[:150]
    except:
        pass
    return f"dogfeed signal {time.strftime('%H:%M:%S')}"


# ── inference wrapper ───────────────────────────────────────────────
def infer(prompt, mem=None):
    """run inference through the 1-bit model, optionally modulate with memory"""
    import subprocess

    # optionally modulate prompt with learned associations
    if mem:
        recall = mem.recall(prompt)
        if recall and recall.get("reinforcement", 0) > 0.5:
            # prepend a hint from memory (the model's own past successful output)
            hint = recall["output"][:50]
            modulated = f"{prompt} [{hint}]"
        else:
            modulated = prompt
    else:
        modulated = prompt

    cmd = [
        "python3", f"{BITNET}/run_inference.py",
        "-m", MODEL,
        "-p", modulated,
        "-n", "15",
        "--temp", "0.8",
    ]
    env = os.environ.copy()
    env["LLAMA_ARG_N_GPU_LAYERS"] = "99"

    try:
        result = subprocess.run(cmd, capture_output=True, timeout=120, env=env, cwd=BITNET)
        stdout = result.stdout.decode("utf-8", errors="replace")
    except Exception as e:
        print(f"  [unit] infer error: {e}")
        return "(no output)", modulated

    # Extract output: the last stdout line that is the actual generated text
    output = "(no output)"
    for line in reversed(stdout.strip().split("\n")):
        line = line.strip()
        if line and not line.startswith(("llama_", "ggml_", "build:", "system_info", "sampler", "generate:", "main:", "common_")):
            output = line
            break

    return output, modulated


# ── log experience ──────────────────────────────────────────────────
def log_experience(prompt, output, modulated, reinforcement):
    with open(EXPERIENCE_LOG, "a") as f:
        f.write(json.dumps({
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "prompt": prompt[:80],
            "modulated": modulated[:80] if modulated != prompt else "",
            "output": output[:100],
            "reinforcement": reinforcement,
        }) + "\n")


# ── single cycle ────────────────────────────────────────────────────
def cycle(mem):
    t0 = time.time()

    # step 1: fetch
    print(f"  [unit] fetch │ latest dogfeed...", end=" ")
    batch = fetch_latest_batch()
    if not batch:
        print("✗ no batch")
        return False
    print(f"✓ {batch.name}")

    # step 2: extract
    prompt = extract_prompt(batch)
    print(f"  [unit] prompt │ {prompt[:60]}...")

    # step 3: infer (with memory modulation)
    output, modulated = infer(prompt, mem)
    print(f"  [unit] output │ {output[:80]}")

    # step 4: reinforcement signal
    # the dogfeed itself IS the reinforcement.
    # if the model produced output (any output), that's success.
    # longer output = more reinforcement
    reinforcement = min(1.0, len(output) / 100)

    # step 5: learn
    mem.learn(prompt, output, reinforcement)
    print(f"  [unit] learn  │ reinforced {reinforcement:.2f}")

    # step 6: log
    log_experience(prompt, output, modulated, reinforcement)

    dt = time.time() - t0
    print(f"  [unit] cycle  │ {dt:.1f}s · mem: {mem.stats()['associations']} associations")
    return True


# ── main ────────────────────────────────────────────────────────────
def main():
    print("")
    print("  ╔══════════════════════════════════════════╗")
    print("  ║           U N I T                        ║")
    print("  ║     the minimal intelligence unit        ║")
    print("  ║     learns while it breathes             ║")
    print("  ╚══════════════════════════════════════════╝")
    print("")

    unit_state = {}
    if STATE_FILE.exists():
        with open(STATE_FILE) as f:
            unit_state = json.load(f)

    cycle_count = unit_state.get("cycles", 0) + 1
    print(f"  cycle #{cycle_count}")
    print(f"  model: BitNet-b1.58 2.4B (1.1 GiB, I2_S ternary)")
    print(f"  memory: associative (Hebbian, runtime-learned)")
    print(f"  teacher: the dogfeed pipeline itself")
    print("")

    mem = AssociativeMemory()
    print(f"  loaded: {mem.stats()['associations']} associations from previous cycles")
    print("")

    success = cycle(mem)

    if success:
        unit_state["cycles"] = cycle_count
        unit_state["last_cycle"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        unit_state["associations"] = mem.stats()["associations"]
        with open(STATE_FILE, "w") as f:
            json.dump(unit_state, f, indent=2)

        print("")
        print(f"  ✓ cycle #{cycle_count} complete · {mem.stats()['associations']} associations")
        print(f"  experience log: {EXPERIENCE_LOG}")
    else:
        print("  ✗ cycle failed")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
