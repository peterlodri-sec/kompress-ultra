---
planted: 2026-06-29
origin: agentic_fetch
status: planted
---

# Hypernetworks (hypnettorch)

**What it is**: Networks that generate weights for other networks. A meta-model that produces the parameters of the "real" model dynamically based on conditioning input.

**Why exotic**: Normal NNs are static once trained. Hypernetworks make weight generation *conditional* — the same hypernetwork can produce different specialized models for different inputs without retraining.

**Link**: https://github.com/chrhenning/hypnettorch

**Unflinching truth**: Powerful concept but you pay in complexity. The hypernetwork adds a whole extra training loop. If your base model is big, the hypernetwork is even bigger. Good for continual learning, bad for simplicity.

**Resonance**: The brain graph IS a hypernetwork. Nodes generate edges dynamically. EdgeRouter conditions routing on the query. The graph is the hypernetwork that generates its own topology.
