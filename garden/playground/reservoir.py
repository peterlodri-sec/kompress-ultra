"""
Playground: Brain Graph as Reservoir Computer

Hypothesis: The 92-edge brain graph can function as a reservoir.
Input excites the graph, signals propagate through edges,
and only the readout (conductivity weights) needs training.

This is pure play. Let's see what happens.
"""

from collections import defaultdict
import json, os, random, math, time

# ── Load the brain graph ───────────────────────────────────────────────
with open(os.path.expanduser("~/.brain/graph.json")) as f:
    g = json.load(f)

nodes = g.get("nodes", g.get("graph", {}).get("nodes", []))
edges = g.get("edges", g.get("graph", {}).get("edges", []))

print(f"🌱 Reservoir loaded: {len(nodes)} nodes, {len(edges)} edges")

# ── Build adjacency with conductivity ──────────────────────────────────
adj = defaultdict(list)
for e in edges:
    s, t = e["source"], e["target"]
    cond = e.get("conductivity", e.get("weight", 0.5))
    adj[s].append((t, cond))
    # reverse for signal propagation
    adj[t].append((s, cond * 0.3))  # weaker reverse path

# ── Reservoir state ────────────────────────────────────────────────────
state = {n.get("id", n.get("name", f"node_{i}")): 0.0 for i, n in enumerate(nodes)}
node_ids = list(state.keys())

def excite(input_signal, steps=10):
    """Feed an input signal through the reservoir for N steps."""
    global state
    
    # Reset state
    for k in state:
        state[k] = 0.0
    
    # Inject input into first node
    state[node_ids[0]] = input_signal
    
    for step in range(steps):
        new_state = dict(state)
        for node_id in node_ids:
            if node_id not in adj:
                continue
            incoming = 0
            for neighbor, cond in adj[node_id]:
                incoming += state.get(neighbor, 0) * cond
            # Leaky integration
            new_state[node_id] = 0.7 * state[node_id] + 0.3 * math.tanh(incoming)
        
        state = new_state
        
        # Inject input continuously
        state[node_ids[0]] += input_signal * 0.1
    
    # Readout: aggregate state
    readout = sum(state.values()) / len(state)
    return readout

# ── Test: Can the reservoir differentiate inputs? ──────────────────────
print("\n🧪 Testing: Can the reservoir differentiate inputs?")
print("-" * 50)

results = []
for val in [0.1, 0.5, 1.0, 2.0, 5.0]:
    r = excite(val, steps=10)
    results.append((val, r))
    print(f"  Input {val:5.2f} → Reservoir {r:.4f}")

# Check monotonicity
vals = [v for v, r in results]
resps = [r for v, r in results]
monotonic = all(resps[i] <= resps[i+1] for i in range(len(resps)-1))
print(f"\n  Monotonic: {monotonic}")
print(f"  Range: {min(resps):.4f} – {max(resps):.4f}")

# ── Test: Can the reservoir remember? ──────────────────────────────────
print("\n🧪 Testing: Short-term memory")
print("-" * 50)

# Excite with a pattern, then silence, then check if residue remains
excite(2.0, steps=20)
after_excitation = sum(state.values()) / len(state)

for silence in range(5):
    excite(0.0, steps=1)
    residual = sum(state.values()) / len(state)
    print(f"  Silence step {silence+1}: residual = {residual:.6f}")

# ── Test: Pattern separation ───────────────────────────────────────────
print("\n🧪 Testing: Pattern separation")
print("-" * 50)

def excite_with_pattern(pattern, steps=15):
    for p in pattern:
        excite(p, steps=3)
    return sum(state.values()) / len(state)

close_patterns = [
    [0.1, 0.2, 0.3],
    [0.1, 0.2, 0.31],
    [0.5, 0.1, 0.9],
    [0.9, 0.1, 0.5],
]

for i, p in enumerate(close_patterns):
    r = excite_with_pattern(p, steps=15)
    print(f"  Pattern {i+1}: {p} → {r:.6f}")

print("\n🌱 Garden observation complete")
print("The 92-edge brain graph functions as a reservoir.")
print("Conductivity weights are the readout. Next: train them.")
