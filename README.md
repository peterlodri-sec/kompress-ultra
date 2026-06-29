<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/license-Apache%202.0-green?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/built%20with-Bun-purple?style=for-the-badge&logo=bun" alt="Built with Bun">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge" alt="PRs Welcome">
  <img src="https://img.shields.io/github/actions/workflow/status/peterlodri-sec/kompress-ultra/ci.yml?style=for-the-badge&label=CI" alt="CI">
</p>

<h1 align="center">kompress-ultra</h1>

<p align="center">
  <strong>4-role living context layer for AI agent frameworks</strong><br>
  <em>Composer · Pruner · Rewriter · Circulator</em>
</p>

<p align="center">
  <a href="https://proposal.vaked.dev">Proposal</a> ·
  <a href="https://huggingface.co/datasets/PeetPedro/ultrawhale-dogfood">Training Dataset</a> ·
  <a href="https://huggingface.co/PeetPedro/kompress-v8">Model</a> ·
  <a href="https://huggingface.co/spaces/PeetPedro/kompress-playground">Playground</a> ·
  <a href="https://kompress.vaked.dev/paper/main.pdf">Paper</a>
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
git clone https://github.com/peterlodri-sec/kompress-ultra.git
cd kompress-ultra
bun install
bun test
```

### As a Library

```typescript
import {
  scoreMessageSync,
  isProtected,
  compressMessage,
  CompressionLevel,
  adaptiveThreshold,
  computeDensity,
  validateOptions,
  createCircuitBreaker,
  createCirculator,
  setTokenEstimator,
} from "kompress-ultra";

// Validate and merge config
const options = validateOptions({ agentType: "coder", aggression: 0.7 });

// Score a message for relevance (sync — no Milvus needed)
const score = scoreMessageSync(msg, index, total);

// Check if protected (user, code, error, last 5)
if (isProtected(msg, index, total)) { /* never prune */ }

// Compress by age
const compressed = compressMessage(msg.content, CompressionLevel.Ultra);

// Instance-isolated state (multi-tenant safe)
const breaker = createCircuitBreaker({ failureThreshold: 5, cooldownMs: 30_000 });
const circulator = createCirculator({ cap: 200, batchSize: 20 });

// Plug in a real tokenizer (e.g., tiktoken)
setTokenEstimator((text) => encoding.encode(text).length);
```

### As an MCP Server

The Cloudflare Worker exposes compression as a service:

```
POST /mcp           — MCP protocol (compress, score, rewrite, budget, circuit tools)
POST /v1/compress   — REST: compress a conversation
POST /v1/score      — REST: score messages for importance
POST /v1/rewrite    — REST: rewrite a single message
GET  /v1/budget     — REST: get token budget for agent type
GET  /v1/health     — REST: liveness + circuit breaker state
```

Set `AUTH_TOKEN` via `wrangler secret put AUTH_TOKEN` to enable Bearer auth on mutation endpoints. Health and root stay open.

## Architecture

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
| **Pruner** | `scoring.ts` | Scores messages by relevance, recency (Ebbinghaus decay), and structural importance. Protected messages (user, code, error, last 5) are never pruned. |
| **Rewriter** | `rewriter.ts` | Compresses kept messages by age: Verbatim (recent) → Lite (mid) → Ultra (old). Protects fenced blocks AND inline code spans. |
| **Circulator** | `circulator.ts` | Enqueues pruned content to vector memory (Milvus) for future retrieval. Classifies messages by type for smart routing. Instance-isolated queue. |
| **Composer** | `brain.ts` | Reads brain state from cross-session learning, builds liveness indicators for context injection. |

### v2.0 Improvements

| Feature | v1.0 | v2.0 |
|---------|------|------|
| Inline code protection | Fenced blocks only | Fenced + inline `` `code` `` spans |
| State isolation | Module-level singletons | Class-based instances (`createCircuitBreaker`, `createCirculator`) |
| Worker auth | None | Bearer token via `AUTH_TOKEN` env |
| Token estimation | Hardcoded `chars/4` | Pluggable via `setTokenEstimator()` |
| Config validation | None | `validateOptions()` with range checks |
| Error types | Generic `Error` | Typed hierarchy (`KompressError`, `CircuitOpenError`, etc.) |
| Shell-out deps | `execSync` to `mempalace` | Direct `Bun.write()` |

### Safety Floors

Critical tokens are **never** pruned:

- File paths (`src/main.rs`, `./build.sh`)
- CLI commands (`cargo`, `git`, `docker`)
- API keys & secrets (`env.TOKEN`, `SECRET_KEY`)
- IP addresses & hex hashes
- Numbers & error codes
- **Inline code spans** (`` `backtick-wrapped` ``)

### Circuit Breaker

If Milvus/embedding services fail N times consecutively (default 3), the circuit opens for a configurable cooldown (default 60s). During this time, the system falls back to heuristic scoring (recency + structural boost only).

### Token Budgets

Per-agent token budgets control compression aggressiveness:

| Agent Role | Max Tokens | Aggressiveness |
|------------|-----------|----------------|
| coder | 100k | 0.8 (aggressive) |
| researcher | 128k | 0.4 (conservative) |
| reviewer | 64k | 0.6 (moderate) |
| orchestrator | 128k | 0.5 (balanced) |

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
  agentType?: AgentType;          // "coder" | "researcher" | "reviewer" | "orchestrator"
  aggression?: number;            // 0-1, default 0.8
}
```

Use `validateOptions()` to merge partial config with defaults and validate ranges.

## Project Structure

```
kompress-ultra/
├── src/
│   ├── index.ts              # Public API re-exports
│   ├── types.ts              # All interfaces + validateOptions()
│   ├── errors.ts             # Typed error hierarchy
│   ├── scoring.ts            # Message scoring: isProtected, ebbinghausDecay, structuralBoost
│   ├── rewriter.ts           # CompressionLevel enum, compressMessage (fenced + inline protection)
│   ├── compression.ts        # computeDensity, adaptiveThreshold, buildKompressDisplay
│   ├── circulator.ts         # Circulator class + singleton compat functions
│   ├── embedding.ts          # embedText, scoreMessageMilvus, queryMilvusSimilarity
│   ├── brain.ts              # readBrainState, buildBrainLine
│   ├── token-budget.ts       # estimateTokens, setTokenEstimator, escalateForBudget
│   └── circuit-breaker.ts    # CircuitBreaker class + singleton compat functions
├── server/
│   └── worker.ts             # Cloudflare Worker (MCP + REST API with auth)
├── test/
│   ├── scoring.test.ts
│   ├── rewriter.test.ts
│   ├── compression.test.ts
│   ├── circuit-breaker.test.ts
│   ├── circulator.test.ts
│   ├── token-budget.test.ts
│   ├── config.test.ts
│   └── pipeline.test.ts      # Full E2E integration test
├── package.json
├── tsconfig.json
├── wrangler.toml
└── README.md
```

## Research

This package implements the compression strategy described in:

- **Paper**: [Asymmetric Loss Modulation Resolves the Voting Ensemble Paradox](https://kompress.vaked.dev/paper/main.pdf) — Full mathematical proof.
- **Proposal**: [kompress-ultra for Headroom](https://proposal.vaked.dev) — Interactive proposal with live playground and benchmarks.
- **Model**: [PeetPedro/kompress-v8](https://huggingface.co/PeetPedro/kompress-v8) — 149M-parameter ModernBERT model with LoRA fine-tuning.
- **Dataset**: [PeetPedro/ultrawhale-dogfood](https://huggingface.co/datasets/PeetPedro/ultrawhale-dogfood) — Token-level eviction labels from real agent sessions.

## Ecosystem

`kompress-ultra` is part of the [ultrameshai](https://github.com/peterlodri-sec/ultrameshai) ecosystem:

| Component | Description |
|-----------|-------------|
| [ultrameshai](https://github.com/peterlodri-sec/ultrameshai) | Decentralized agent lifecycle substrate |
| [loopkit](https://github.com/peterlodri-sec/loopkit) | 4-phase autonomous training orchestrulator |
| [pocoo.vaked.dev](https://pocoo.vaked.dev) | Experiment log vault and telemetry registry |
| [proposal.vaked.dev](https://proposal.vaked.dev) | Interactive Headroom integration proposal |
| [kompress.vaked.dev](https://kompress.vaked.dev/paper/main.pdf) | Academic paper with full proofs |

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting. Auth-protected endpoints require `Authorization: Bearer <token>` when `AUTH_TOKEN` is configured.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built by <a href="https://github.com/peterlodri-sec">peterlodri-sec</a> · Part of the <a href="https://github.com/peterlodri-sec/ultrameshai">ultrameshai</a> ecosystem
</p>
