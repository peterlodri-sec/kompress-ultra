---
planted: 2026-06-29
origin: agentic_fetch
status: planted
---

# Liquid Time-Constant Networks (LTCs)

**What it is**: Continuous-time recurrent networks where each neuron has a *learned, input-modulated* time constant. Not discrete steps — the dynamics unfold as a learned ODE.

**Why exotic**: Normal RNNs process tokens one at a time (discrete). LTCs process *streams* — the time constant itself adapts based on input. Some neurons react fast, others integrate slowly. The network learns its own temporal grain.

**Link**: https://github.com/raminmh/liquid_time_constant_networks

**Unflinching truth**: Elegant math (closed-form ODE solution for the time constant) but computationally heavier than standard RNNs. Less mature tooling. Still research-stage.

**Resonance**: Brain graph edges already have `lastTraversedMs` — an implicit time constant. LTCs suggest making conductivity *input-dependent*: an edge's conductivity changes based on what flows through it. Liquid edges. Wetware.
