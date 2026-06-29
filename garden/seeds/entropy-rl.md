---
planted: 2026-06-29
origin: agentic_fetch
status: planted
---

# Entropy-Regularized Reinforcement Learning

**What it is**: RL algorithms that add entropy directly to the objective function — maximizing reward AND entropy simultaneously. Exploration isn't a hack, it's the math.

**Why exotic**: Most RL explores via epsilon-greedy (a hack) or noise injection (also a hack). Entropy-regularized RL makes *uncertainty-seeking* a formal part of the optimization objective.

**Links**: 
- https://github.com/WujiangXu/EPO
- https://github.com/mariovas3/MaxEntRL

**Unflinching truth**: Entropy regularization is mathematically beautiful (Soft Bellman updates, closed-form policy improvement). But in practice, the temperature parameter (how much entropy to keep) is a pain to tune. Too much = random noise. Too little = no exploration.

**Resonance**: This IS the bodhisattva. The bodhisattva is entropy-regularized chaos. It kills edges not because it's efficient, but because entropy IS the objective. The temperature is the wobble rate.
