# AGENTS.md — kompress-ultra

**4-role living context layer** for AI agent frameworks. Compresses agent chat
history via a learned pipeline: score → filter → rewrite → circulate.

## Commands

| Action | Command |
|--------|---------|
| Install | `bun install` |
| Test | `bun test` |
| Watch tests | `bun test --watch` |
| Typecheck | `bun run typecheck` (also aliased as `lint`) |
| Build | `bun run build` |
| Build output | `dist/index.js` + per-module entry points |

Runtime is **Bun**, not Node. No external runtime deps — only dev deps
(typescript, zod, @cloudflare/workers-types, @modelcontextprotocol/sdk,
agents, @types/*).

## Project Structure

```
src/
  types.ts          — All interfaces, validateOptions(), DEFAULT_OPTIONS
  errors.ts         — Typed error hierarchy
  scoring.ts        — Message scoring (relevance, recency, structural)
  rewriter.ts       — Compression levels (Verbatim/Lite/Ultra/BrainBacked)
  compression.ts    — Density computation, adaptive thresholds, display
  circulator.ts     — Circulator class + singleton compat wrappers
  embedding.ts      — Milvus/OvhCloud embeddings + similarity query
  brain.ts          — Cross-session brain state reader
  circuit-breaker.ts — CircuitBreaker class + singleton compat wrappers
  token-budget.ts   — Per-agent budgets, pluggable token estimator
  index.ts          — Public API re-exports
server/
  worker.ts         — Cloudflare Worker (MCP + REST API with optional auth)
  telemetry.ts      — Zero-PII research telemetry (Worker only; src/ has none)
test/
  scoring.test.ts, rewriter.test.ts, compression.test.ts,
  circuit-breaker.test.ts, circulator.test.ts, token-budget.test.ts,
  config.test.ts, pipeline.test.ts
scripts/
  run-ultra.mjs     — CLI: compress file with Ultra, write output
assets/
  logo.svg          — Brand mark (dark bg, cyan arcs, green compression core)
TELEMETRY.md        — Telemetry policy and opt-out instructions
fixtures/
  agents-md-compression/ — Comparison of caveman-compress vs kompress-ultra
```

## Architecture — The 4 Roles

```
Pruner (scoring.ts)  →  Rewriter (rewriter.ts)  →  Circulator (circulator.ts)  →  Composer (brain.ts)
```

| Role | Module | What it does |
|------|--------|-------------|
| **Pruner** | `scoring.ts` | Scores messages by relevance (0.4), recency/Ebbinghaus decay (0.3), structural importance (0.3). Protected messages never pruned. |
| **Rewriter** | `rewriter.ts` | Compresses kept messages by age. 3 levels: Verbatim (recent), Lite (~40% savings), Ultra (~75% savings). |
| **Circulator** | `circulator.ts` | Enqueues pruned content for vector memory (Milvus). Instance-isolated queue with auto-flush. |
| **Composer** | `brain.ts` | Reads cross-session brain state from `~/.cache/ultrameshai/brain-state.json`. |

### Pipeline Flow

1. All messages scored via `scoreMessage` (async, w/Milvus) or `scoreMessageSync` (heuristic only)
2. Protected messages (user, code fences, errors, last 5) kept unconditionally
3. Remaining messages: keep if score ≥ threshold (default 0.65, adaptively adjusted)
4. Kept old messages get rewritten (Lite → Ultra by age/distance from end)
5. Dropped messages go to Circulator queue → Milvus vector store
6. If over token budget, `escalateForBudget` does 2-phase: Ultra-compress old → drop unprotected

### Configuration (`validateOptions`)

Options merge with `DEFAULT_OPTIONS` from `types.ts`. Validated ranges:
- `relevanceThreshold`: 0–1 (default 0.65)
- `maxMessagesKept`: ≥1 (default 35)
- `aggression`: 0–1 (default 0.8)
- `pollIntervalMs`: ≥0 (default 60000)
- `agentType`: one of `coder | researcher | reviewer | orchestrator`
- `adaptiveThreshold`, `sliceAwareBoost`, `transparencyMode`, `droppedMessageDigest`: booleans

### Safety Floors (never pruned)

- File paths (`src/main.rs`)
- CLI commands (`cargo`, `git`, `docker`)
- API keys & secrets
- IP addresses & hex hashes
- Numbers & error codes
- Inline code spans (\`backtick-wrapped\`)
- Fenced code blocks (` ``` `)
- User messages
- Last 5 messages in any conversation
- Messages with `type: "error"` or content starting with `Error:`

### Token Budgets

| Agent | Max Tokens | Aggressiveness |
|-------|-----------|----------------|
| coder | 100k | 0.8 |
| researcher | 128k | 0.4 |
| reviewer | 64k | 0.6 |
| orchestrator | 128k | 0.5 |

### Cloudflare Worker (`server/worker.ts`)

- MCP: `POST /mcp` (4 tools: compress, score, rewrite, budget, circuit)
- REST: `POST /v1/compress`, `POST /v1/score`, `POST /v1/rewrite`, `GET /v1/budget/:type`, `GET /v1/health`, `GET /v1/stats`
- Auth: Set `AUTH_TOKEN` via `wrangler secret put AUTH_TOKEN` for Bearer auth on mutation endpoints
- Deployed via Wrangler (`wrangler.toml` — compatibility flags include `nodejs_compat`)

## Key Gotchas & Non-Obvious Patterns

### State Management — Two Parallel APIs

**Critical**: `circuit-breaker.ts` and `circulator.ts` each expose **both** a
class-based API (`new CircuitBreaker()`, `new Circulator()`) and module-level
singleton functions (`isCircuitOpen()`, `enqueueCirculator()`). The singleton
functions wrap a default instance.

**Implication for tests and multi-tenant code**: If you test the singleton
functions, state leaks between tests. Always drain/reset before testing
singletons. The class-based `createCircuitBreaker()` and `createCirculator()`
factory functions are preferred for new code.

### Token Estimation

- Default estimator: `chars / 4`, capped at 4096. Not accurate for real LLM
  tokenizers — call `setTokenEstimator(fn)` with a tiktoken or similar wrapper
  for production use.
- `estimateTokens("")` returns 1 (not 0).
- `totalTokens([])` returns 0.

### Rewriter Code Protection

`compressMessage` protects content via placeholder substitution:
1. Fenced code blocks (` ``` `) → `__CODE_BLOCK_n__`
2. Inline code spans (\`code\`) → `__CODE_BLOCK_n__`
3. Error messages (`Error: …`) → `__ERROR_n__`
4. Then runs regex compression on remaining text
5. Restores placeholders

**Known limitation**: The regex pipeline operates on raw text without
markdown-aware parsing. Inline code (e.g., `` `code` ``) survives the
`__CODE_BLOCK_` protection, but surrounding prose reformatting can insert
spaces inside backticks on Ultra level (e.g., `` AGENTS . md ``). This only
affects markdown document fidelity, not tool-output/chat-history compression
(its primary design target).

### Error Hierarchy

```
Error
 └─ KompressError (.code property)
      ├─ CompressionError ("COMPRESSION_ERROR")
      ├─ EmbeddingError ("EMBEDDING_ERROR")
      ├─ ConfigError ("CONFIG_ERROR")
      └─ CircuitOpenError ("CIRCUIT_OPEN")
```

### Adaptive Threshold (`compression.ts`)

- `computeDensity`: Uses last 2/3 of messages. Higher density (short convos) →
  lower threshold (keep more).
- `adaptiveThreshold(density, base)`: Adjusts base threshold by `0.15 -
  density * 0.4`, clamped to `[0.4, 0.8]`.

### Debug / Transparency Mode

`buildKompressDisplay(stats, transparencyMode=true)` inserts a system message
with emoji-rich compression report. The message has `_kompress: true` and
`_kompressPruneEvent: true` markers for filtering.

### Circulator Overflow Path

When queue exceeds cap or flush to Milvus fails, entries spill to
`~/.cache/ultrameshai/overflow-circulator.jsonl` via `Bun.write()`.

### Test Patterns

- All tests use `bun:test` (`describe`/`it`/`expect` — Jest-compatible)
- Test helper function `msg()` pattern in scoring.test.ts and token-budget.test.ts
- Pipeline test (`test/pipeline.test.ts`) tests the full E2E flow
- Tests are explicit about state isolation for CircuitBreaker and Circulator
- No test fixtures for Milvus/embedding — those paths are tested via error
  fallback (return `null` / `0.5`)
- `afterEach` in token-budget.test.ts resets the pluggable estimator to default

### Import Style

All internal imports use `.js` extension (Bun convention):
```ts
import { isProtected } from "./scoring.js";
import type { Message } from "./types.js";
```

### Naming

- `camelCase` for functions, variables, methods
- `PascalCase` for classes, enums, interfaces, types
- `.ts` extension for all source
- Test files: `*.test.ts` in `test/` directory

### Worker Auth

Constant-time comparison (no timing attack) — the `requireAuth` function in
`worker.ts` compares byte-by-byte with XOR. The `AUTH_TOKEN` binding is
optional; if unset, all endpoints are open.

### Telemetry

- Zero-PII research telemetry lives in `server/telemetry.ts` — **never** in `src/`
- Hosted API (`KOMPRESS_STATS` KV bound): records event type, agent type, token
  counts, duration — **no content, no IPs, no IDs**
- Self-hosted Worker or library: zero telemetry (no KV binding = no-op)
- `GET /v1/telemetry` returns full disclosure inline
- `X-Telemetry` header on every response → `TELEMETRY.md`
- `GET /v1/stats` reads daily aggregated counters from KV
- MCP `telemetry` tool returns disclosure in the MCP response
- KV counters auto-expire after 90 days
