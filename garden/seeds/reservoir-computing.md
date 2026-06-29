---
planted: 2026-06-29
origin: agentic_fetch
status: planted
---

# Reservoir Computing / Echo State Networks

**What it is**: Uses a large fixed random dynamical system ("reservoir") and only trains the readout. The reservoir projects input into a high-dimensional transient space.

**Why exotic**: Completely opposite of end-to-end gradient culture. The reservoir is *born random and stays random*. You only learn how to read what it already does.

**Link**: https://github.com/reservoirpy/reservoirpy

**Unflinching truth**: Great for chaotic time-series experiments in 50 lines. But the reservoir is a black box you can't really steer. You get what the dynamics give you.

**Why it matters here**: This IS the brain graph. The graph is a reservoir. Edges are the random-ish dynamical system. We only learn conductivity (readout). The DIAD types are the readout weights.
