#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# al-biruni-2 — Writer (content + technical)
# Part of the al-biruni singleton pair mesh.
# Crafts narratives and documents autonomously.
#
# Modes:
#   content   — narrative, blog, explanation (audience: general)
#   technical — spec, API doc, architecture (audience: engineer)
#   publish   — finalize and output
#
# Reads from research output, writes to final artifacts.
# ─────────────────────────────────────────────────────────────
set -euo pipefail
MODE="${1:-content}"
INDIR="${2:-${AL_BIRUNI_INDIR:-./.al-biruni/research}}"
OUTDIR="${3:-${AL_BIRUNI_OUTDIR:-./.al-biruni/output}}"
mkdir -p "$OUTDIR"

case "$MODE" in
  content)
    echo "✍️  al-biruni-2 (content writer — Buddhist · sci-fi · visual)"
    topic=""
    [ -f "$INDIR/_meta" ] && topic=$(grep '^topic=' "$INDIR/_meta" | cut -d= -f2-)
    cat > "$OUTDIR/article.md" << OUTFILE
# ${topic:-Untitled}

---

*Anatta* — no permanent self. *Anicca* — all things change. *Dukkha* —
unsatisfactoriness arises from clinging. The technology described here
is no different. It too is impermanent, conditioned, empty of intrinsic
existence. And yet, within that emptiness, form emerges — useful,
compelling, briefly real.

---

## Overview

*Why this matters — the human context.*
Begin not with the technology, but with the suffering it addresses.
What dukkha does this solve? Frame the problem as a knot of clinging —
to tokens, to context, to the illusion of infinite memory.

> *"Before enlightenment, chop wood, carry water. After enlightenment,
> chop wood, carry water."* — Zen proverb
>
> Before compression, manage tokens, prune context. After compression,
> same. But the relationship changes.

## Background

*What led to this — the story so far.*
Reach for a sci-fi metaphor. This is the **Orwellian memory problem** —
not that the state forgets, but that it remembers *everything*,
indiscriminately, until the signal drowns in noise. Or the
**Foundation psychohistory** problem — Hari Seldon's equations work
only because they aggregate across billions, discarding individual
noise to reveal the statistical signal beneath.

Include a visual prompt reference:

> **[IMAGE PROMPT — for DALL-E / Midjourney / Flux]:**
> *A vast library stretching into infinite darkness, shelves
> overflowing with glowing scrolls. A single monk sits at the center,
> holding a small, clear crystal. All the light from the shelves
> converges into the crystal, condensing into a single focused beam.
> Cyber-Buddhist aesthetic, cyan and gold, volumetric lighting.*

## Core

*The main narrative — what was discovered.*
Structure this as a **sci-fi reveal**. What was discovered is not new
in itself — it was always there, like the Buddha's dharma. The
realization is the discovery. Use analogies:

- **Compression as meditation**: Each message is a thought. The pruner
  observes without attachment. The rewriter condenses to essence.
- **The circuit breaker as the Middle Way**: Not too many requests
  (excess), not too few (denial). The Eightfold Path of API calls.
- **Safety floors as the Precepts**: Certain things are never pruned —
  user messages (compassion), code blocks (truth), errors (wisdom).

> **[IMAGE PROMPT]:**
> *A circuit board shaped like a lotus flower, glowing traces forming
> a mandala pattern. Each trace leads to a central glowing pearl.
> Dark background, phosphorescent green and blue, tech-Zen aesthetic.*

## Implications

*What this means — forward-looking.*
Close with the **heat death of the universe** — not as nihilism, but as
liberation. All contexts end. All tokens are spent. The question is not
how to keep everything forever, but what to carry forward, like a monk
choosing a single sutra for a journey.

> *"The universe is made of stories, not of atoms."* — Muriel Rukeyser
>
> And stories, unlike atoms, can be compressed.

End with a closing visual:

> **[IMAGE PROMPT]:**
> *A lone figure standing at the edge of a data center, watching server
> lights blink out one by one like stars at dawn. The sky behind is
> deep space fading to pale blue. A single glowing page floats upward.
> Cinematic, anamorphic, hopeful solitude.*

---
*Content by al-biruni-2 · research by al-biruni-1 · style: Buddhist sci-fi*
OUTFILE
    echo "ARTICLE: $OUTDIR/article.md"
    ;;

  technical)
    echo "🔧 al-biruni-2 (technical writer)"
    cat > "$OUTDIR/spec.md" << OUTFILE
# Technical Specification

## Architecture

\`\`\`
[system diagram]
\`\`\`

## API Reference

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| --     | --   | --          |

## Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| --        | --   | --      | --          |

## Deployment

\`\`\`bash
[deploy commands]
\`\`\`

---
*Technical documentation by al-biruni-2*
OUTFILE
    echo "SPEC: $OUTDIR/spec.md"
    ;;

  publish)
    echo "📦 al-biruni-2 (publish)"
    echo "=== Final Artifacts ==="
    ls -la "$OUTDIR/" 2>/dev/null || echo "(no output yet)"
    ;;

  *)
    echo "USAGE: $0 {content|technical|publish} [input-dir] [output-dir]"
    exit 1
    ;;
esac
