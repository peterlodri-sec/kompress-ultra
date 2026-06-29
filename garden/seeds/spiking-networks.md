---
planted: 2026-06-29
origin: agentic_fetch
status: planted
---

# Spiking Neural Networks (SpikingJelly)

**What it is**: Neural networks where neurons communicate via discrete spikes (binary events over time) instead of continuous activations. Event-based computation.

**Why exotic**: It's how biological brains actually work. Spikes are energy-efficient (event-driven), naturally temporal, and process information in the *timing* of spikes, not just their magnitude.

**Link**: https://github.com/fangwei123456/spikingjelly

**Unflinching truth**: Spiking networks are power-efficient on neuromorphic hardware (Intel Loihi, etc.) and great for temporal processing. But they're harder to train (surrogate gradients, temporal credit assignment) and don't beat transformers on text.

**Resonance**: Edges in the brain graph could be spiking — events (traversals) not continuous flows. Conductivity = firing rate. Timing of traversal = temporal coding. And SNNs process events as they happen, like the SSE edge stream.
