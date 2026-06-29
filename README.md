<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/license-Apache%202.0-green?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/built%20with-Bun-purple?style=for-the-badge&logo=bun" alt="Built with Bun">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge" alt="PRs Welcome">
</p>

<h1 align="center">kompress-ultra</h1>

<p align="center">
  <strong>4-role living context layer for AI agent frameworks</strong><br>
  <em>Composer · Pruner · Rewriter · Circulator</em>
</p>

<p align="center">
  <a href="https://kompress.vaked.dev/paper/main.pdf">Paper</a> ·
  <a href="https://proposal.vaked.dev">Proposal</a> ·
  <a href="https://huggingface.co/PeetPedro/kompress-v8">Model</a> ·
  <a href="https://huggingface.co/spaces/PeetPedro/kompress-playground">Playground</a>
</p>

---

## Why kompress-ultra?

LLM agent loops burn through context windows fast. Long chat histories, compiler logs, and tool outputs accumulate, causing **context bloat** — slower inference, higher costs, and degraded reasoning quality.

`kompress-ultra` solves this with a learned compression pipeline that achieves:

| Metric | Value | Source |
|--------|-------|--------|
| **Token Savings** | ~78% | [Paper p.14](https://kompress.vaked.dev/paper/main.pdf#page=14) |
| **Latency Reduction** | ~75% | [Paper p.14](https://kompress.vaked.dev/paper/main.pdf#page=14) |
| **Exact-Keep Rate** | 0.993 | [Paper p.16](https://kompress.vaked.dev/paper/main.pdf#page=16) |
| **Inference Latency** | 97ms | CPU, single-threaded |

The **exact-keep rate** measures how many critical reasoning tokens (file paths, error codes, API keys, numbers) survive compression. At 0.993, virtually nothing important is lost.

## Quick Start

```bash
# Install
git clone https://github.com/peterlodri-sec/kompress-ultra.git
cd kompress-ultra
bun install

# Run tests
bun test

# Type check
bun run typecheck
```

### As a Standalone Library

```typescript
import {
  scoreMessage,
  isProtected,
  compressMessage,
  CompressionLevel,
  adaptiveThreshold,
  computeDensity,
} from "kompress-ultra";

// Score a message for relevance
const score = await scoreMessage(msg, index, total, taskGoal);

// Check if a message is protected (user, code, error, last 5)
if (isProtected(msg, index, total)) {
  // Never prune protected messages
}

// Compress by age
const compressed = compressMessage(msg.content, CompressionLevel.Ultra);
```

### As an OpenCode Plugin

```typescript
// .opencode/plugin/kompress-ultra.ts
import kompressUltra from "kompress-ultra";

export default (input, options) => {
  return kompressUltra(input, {
    relevanceThreshold: 0.65,
    maxMessagesKept: 35,
    milvusUrl: "http://localhost:19530",
  });
};
```

## Architecture

The system operates as four coordinated roles in a pipeline:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Raw Chat History                             │
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ Pruner   │───▶│ Rewriter │───▶│Circulator│───▶│ Composer │  │
│  │ (score)  │    │(compress)│    │ (memory) │    │(patterns)│  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │                                              ▲          │
│       │         ┌──────────────┐                     │          │
│       └────────▶│ Milvus DB    │─────────────────────┘          │
│                 │ (vector mem) │                                 │
│                 └──────────────┘                                 │
│                                                                  │
│  Output: Dense Context (compressed, safe, pattern-enriched)     │
└─────────────────────────────────────────────────────────────────┘
```

### The 4 Roles

| Role | Module | Function |
|------|--------|----------|
| **Pruner** | `scoring.ts` | Scores messages by relevance, recency, and structural importance. Protected messages (user, code, error, last 5) are never pruned. |
| **Rewriter** | `rewriter.ts` | Compresses kept messages by age: Verbatim (recent) → Lite (mid) → Ultra (old). Preserves critical tokens via safety floor. |
| **Circulator** | `circulator.ts` | Enqueues pruned content to vector memory (Milvus) for future retrieval. Classifies messages by type for smart routing. |
| **Composer** | `composer.ts` | Injects learned patterns from memory into system prompts. Builds context from previously compressed turns. |

### Safety Floors

Critical tokens are **never** pruned, enforced by both regex patterns and the asymmetric loss penalty ($\lambda = 3.0$) during training:

- File paths (`src/main.rs`, `./build.sh`)
- CLI commands (`cargo`, `git`, `docker`)
- API keys & secrets (`env.TOKEN`, `SECRET_KEY`)
- IP addresses & hex hashes
- Numbers & error codes

### Circuit Breaker

If Milvus/embedding services fail 3 times consecutively, the circuit opens for 60 seconds. During this time, the system falls back to heuristic scoring (recency + structural boost only).

## Benchmarks

Evaluated on the **Heretic** adversarial benchmark:

| Method | Exact Keep % ($T_{\text{crit}}$) | Keep Ratio | Avg. Latency |
|--------|-----------------------------------|------------|--------------|
| **kompress-v8 (Ours)** | **0.993** | 0.936 | **97ms** |
| kompress-v8 (v4 SSL) | 0.967 | 0.823 | — |
| Random Eviction | 0.910 | 0.835 | 0ms |
| LLMLingua-2 | 0.867 | 1.550 ⚠️ | 238.9ms |
| TextRank | 0.599 | 0.543 | 23.1ms |

> ⚠️ LLMLingua-2's keep ratio > 100% means it **expands** context (adds tokens), causing bloat.

Source: [Paper Table 10, p.16](https://kompress.vaked.dev/paper/main.pdf#page=16)

## Configuration

```typescript
interface KompressUltraOptions {
  relevanceThreshold?: number;    // 0-1, default 0.65
  maxMessagesKept?: number;       // default 35
  milvusUrl?: string;             // default "http://localhost:19530"
  mempalaceDb?: string;           // default "mempalace.db"
  pollIntervalMs?: number;        // default 60000
  adaptiveThreshold?: boolean;    // default true
  droppedMessageDigest?: boolean; // default true
  sliceAwareBoost?: boolean;      // default true
  transparencyMode?: boolean;     // default true
}
```

### Token Budget Escalation

Per-agent token budgets control compression aggressiveness:

| Agent Role | Max Tokens | Aggressiveness |
|------------|-----------|----------------|
| coder | 100k | 0.8 (aggressive) |
| researcher | 128k | 0.4 (conservative) |
| reviewer | 64k | 0.6 (moderate) |
| orchestrator | 128k | 0.5 (balanced) |

## Project Structure

```
kompress-ultra/
├── src/
│   ├── index.ts              # Re-exports from all modules
│   ├── types.ts              # All interfaces (Message, Options, BrainState, etc.)
│   ├── scoring.ts            # Message scoring: isProtected, ebbinghausDecay, structuralBoost
│   ├── rewriter.ts           # CompressionLevel enum, compressMessage
│   ├── compression.ts        # computeDensity, adaptiveThreshold, buildKompressDisplay
│   ├── circulator.ts         # classifyMessage, enqueueCirculator, flushCirculatorAsync
│   ├── embedding.ts          # embedText, scoreMessageMilvus, queryMilvusSimilarity
│   ├── brain.ts              # readBrainState, buildBrainLine
│   ├── token-budget.ts       # estimateTokens, escalateForBudget, DEFAULT_BUDGETS
│   └── circuit-breaker.ts    # Circuit breaker with 3-failure threshold, 60s cooldown
├── package.json
├── tsconfig.json
└── README.md
```

## Research

This package implements the compression strategy described in:

- **Paper**: [Asymmetric Loss Modulation Resolves the Voting Ensemble Paradox](https://kompress.vaked.dev/paper/main.pdf) — Full mathematical proof of the Voting Ensemble Paradox and the asymmetric loss correction.
- **Proposal**: [kompress-ultra for Headroom](https://proposal.vaked.dev) — Interactive proposal with live playground, paradox simulator, and benchmarks.
- **Model**: [PeetPedro/kompress-v8](https://huggingface.co/PeetPedro/kompress-v8) — 149M-parameter ModernBERT model with LoRA fine-tuning.
- **Dataset**: [PeetPedro/ultrawhale-dogfood](https://huggingface.co/datasets/PeetPedro/ultrawhale-dogfood) — Token-level eviction labels from real agent sessions.

## Ecosystem

`kompress-ultra` is part of the [ultrameshai](https://github.com/peterlodri-sec/ultrameshai) ecosystem:

| Component | Description |
|-----------|-------------|
| [ultrameshai](https://github.com/peterlodri-sec/ultrameshai) | Decentralized agent lifecycle substrate |
| [loopkit](https://github.com/peterlodri-sec/loopkit) | 4-phase autonomous training orchestrator |
| [pocoo.vaked.dev](https://pocoo.vaked.dev) | Experiment log vault and telemetry registry |
| [proposal.vaked.dev](https://proposal.vaked.dev) | Interactive Headroom integration proposal |
| [kompress.vaked.dev](https://kompress.vaked.dev/paper/main.pdf) | Academic paper with full proofs |

## Provenance

This package was autonomously extracted from the [ultrameshai](https://github.com/peterlodri-sec/ultrameshai) monolith and split into focused modules. Every training run, evaluation metric, and code artifact is publicly verifiable at the links above.

**Built by**: Crush (mimo-v2.5-free) + OpenCode agent loops
**License**: Apache 2.0

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built by <a href="https://github.com/peterlodri-sec">peterlodri-sec</a> · Part of the <a href="https://github.com/peterlodri-sec/ultrameshai">ultrameshai</a> ecosystem
</p>
