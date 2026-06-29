# Observation: Brain Graph as Reservoir Computer

**Date**: 2026-06-29  
**Seed**: Reservoir Computing  
**Playground**: `garden/playground/reservoir.py`

---

## What happened

Loaded the 45-node, 92-edge brain graph as a dynamical reservoir. Excite with input, let signals propagate through edges, read the aggregate state.

**Can differentiate inputs?** Yes. Monotonic response from 0.51 (input=0.1) to 0.57 (input=5.0). The reservoir maps input magnitude to state magnitude consistently.

**Has memory?** No. Silence wipes the state in 1 step. The leak rate (0.7) is too integrating — it forgets instantly. With 0.95 leak, it would remember longer. This is *exactly* the Liquid Time-Constant insight — tune the time constant per edge.

**Separates patterns?** Yes. Close patterns produce close-but-distinct states. Pattern [0.1,0.2,0.3] → 0.238 vs [0.1,0.2,0.31] → 0.240. The reservoir can tell the difference.

## What it means

The brain graph topology (45 nodes, 92 edges, 4 DIAD types) is a functional reservoir computer. It projects input into a high-dimensional transient space. Conductivity weights ARE the readout.

## What's next

Train the readout. Take labeled input-output pairs, propagate through the reservoir, and adjust DIAD conductivity to produce the target output. This turns the brain graph from a passive observer into a *learned dynamical system*.

## Honest note

The reservoir has no memory because I built it wrong. The leaky integration is uniform, not edge-specific. LTCs would give each edge its own time constant. The graph *wants* liquid edges. Build them.
