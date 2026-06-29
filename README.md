<p align="center">
  <img src="./assets/logo.svg" width="120" height="120" alt="kompress-ultra logo">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-0a0a14?style=for-the-badge&labelColor=141420&color=00d4ff" alt="Version">
  <img src="https://img.shields.io/badge/license-Apache%202.0-0a0a14?style=for-the-badge&labelColor=141420&color=00e660" alt="License">
  <img src="https://img.shields.io/badge/built%20with-Bun-0a0a14?style=for-the-badge&labelColor=141420&color=white&logo=bun" alt="Built with Bun">
  <img src="https://img.shields.io/badge/PRs-welcome-0a0a14?style=for-the-badge&labelColor=141420&color=b480ff" alt="PRs Welcome">
  <img src="https://img.shields.io/github/actions/workflow/status/peterlodri-sec/kompress-ultra/ci.yml?style=for-the-badge&label=CI&labelColor=141420&color=00e660" alt="CI">
  <img src="https://img.shields.io/badge/API-live-0a0a14?style=for-the-badge&labelColor=141420&color=00d4ff" alt="API">
  <img src="https://img.shields.io/badge/MCP-live-0a0a14?style=for-the-badge&labelColor=141420&color=00e660" alt="MCP">
  <img src="https://img.shields.io/badge/free-public-0a0a14?style=for-the-badge&labelColor=141420&color=b480ff" alt="Free">
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

<div align="center">
  <a href="#quick-start" style="text-decoration: none;">
    <div style="
      display: inline-block;
      background: linear-gradient(135deg, #0a0a14 0%, #141420 100%);
      border: 1px solid #00d4ff;
      border-radius: 12px;
      padding: 18px 32px;
      margin: 8px 0;
      box-shadow: 0 0 24px rgba(0, 212, 255, 0.08), inset 0 0 24px rgba(0, 212, 255, 0.02);
      transition: box-shadow 0.2s, border-color 0.2s;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    " onmouseover="this.style.boxShadow='0 0 32px rgba(0,212,255,0.2)';this.style.borderColor='#00e660'" onmouseout="this.style.boxShadow='0 0 24px rgba(0,212,255,0.08)';this.style.borderColor='#00d4ff'">
      <span style="font-size: 15px; color: #8892b0; letter-spacing: 0.5px; text-transform: uppercase;">📢 recent news</span><br>
      <span style="font-size: 22px; font-weight: 700; color: #e6f1ff;">free &amp; public MCP + API is LIVE</span><br>
      <span style="font-size: 13px; color: #00e660;">→ jump to quick start ←</span>
    </div>
  </a>
</div>

## Table of Contents

- [Why kompress-ultra?](#why-kompress-ultra)
- [Quick Start](#quick-start)
  - [As a Library](#as-a-library)
  - [As an MCP Server](#as-an-mcp-server)
  - [Telemetry](#telemetry)
- [Architecture](#architecture)
  - [The 4 Roles](#the-4-roles)
  - [v2.0 Improvements](#v20-improvements)
  - [Safety Floors](#safety-floors)
  - [Circuit Breaker](#circuit-breaker)
  - [Token Budgets](#token-budgets)
- [Benchmarks](#benchmarks)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Research](#research)
- [Ecosystem](#ecosystem)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

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
POST /mcp           — MCP protocol (compress, score, rewrite, budget, circuit, telemetry tools)
POST /v1/compress   — REST: compress a conversation
POST /v1/score      — REST: score messages for importance
POST /v1/rewrite    — REST: rewrite a single message
GET  /v1/budget     — REST: get token budget for agent type
GET  /v1/health     — REST: liveness + circuit breaker + telemetry status
GET  /v1/status     — REST: lightweight live/offline badge endpoint (no auth)
GET  /v1/badge.js   — JS: self-injecting API status badge for proposal.vaked.dev
GET  /v1/telemetry.js — JS: self-injecting Ralph-Loop Telemetry for proposal.vaked.dev
GET  /v1/telemetry  — REST: telemetry disclosure (what's collected, how to opt out)
GET  /v1/stats      — REST: daily aggregate stats (research telemetry)
```
| Protocol | Description |
|----------|-------------|
| **Status** | `GET /v1/status` — lightweight live/offline check. No auth. Used by the JS badge. |
| **Badge JS** | `GET /v1/badge.js` — self-injecting script. Add `<script src=".../v1/badge.js"></script>` to any page for a live API badge. |
| **Telemetry JS** | `GET /v1/telemetry.js` — self-injecting script. Add `<script src=".../v1/telemetry.js"></script>` and a `<section id="telemetry">` to get live Ralph-Loop stats. |
| **API** | `POST /v1/compress`, `POST /v1/score`, `POST /v1/rewrite` — Bearer auth when configured. Returns JSON. |
| **MCP** | `POST /mcp` — Full MCP protocol with 6 tools: `compress`, `score`, `rewrite`, `budget`, `circuit`, `telemetry`. Use with any MCP client (Claude Desktop, VS Code, etc.). |

Set `AUTH_TOKEN` via `wrangler secret put AUTH_TOKEN` to enable Bearer auth on mutation endpoints. Health, telemetry, and root stay open.

### Telemetry

The hosted API has **always-on zero-PII research telemetry** — that's the "price"
of using the free service. Every response carries an `X-Telemetry` header linking
to the full disclosure.

| | |
|---|---|
| Library (`npm install kompress-ultra`) | **Zero telemetry**. Pure offline. |
| Self-hosted Worker | **Zero telemetry**. Omit `KOMPRESS_STATS` KV binding. |
| Hosted API (`kompress.vaked.dev`) | Research telemetry (no PII, no content, day granularity). |

See [TELEMETRY.md](./TELEMETRY.md) for the complete policy.

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
| [loopkit](https://github.com/peterlodri-sec/loopkit) | 4-phase autonomous training orchestrator |
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
