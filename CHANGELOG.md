# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-06-29

### Added
- **`CircuitBreaker` class** — instance-isolated circuit breaker with configurable `failureThreshold` and `cooldownMs`. Factory: `createCircuitBreaker()`.
- **`Circulator` class** — instance-isolated message queue with configurable `cap`, `batchSize`, `milvusUrl`. Factory: `createCirculator()`.
- **Pluggable token estimation** — `setTokenEstimator()` lets you swap in real tokenizers (e.g., tiktoken). Default `chars/4` heuristic preserved.
- **Config validation** — `validateOptions()` merges partial config with defaults, validates ranges, rejects invalid agent types.
- **Typed error hierarchy** — `KompressError`, `CompressionError`, `EmbeddingError`, `ConfigError`, `CircuitOpenError` with error codes.
- **Worker auth** — `AUTH_TOKEN` env var enables Bearer token auth on mutation endpoints (`/v1/compress`, `/v1/score`, `/v1/rewrite`). Health and root stay open.
- **Inline code protection** — `compressMessage()` now protects `` `inline code` `` spans alongside fenced code blocks.
- **Full pipeline integration test** — `test/pipeline.test.ts` covers score → filter → rewrite → token accounting E2E.
- **Config validation tests** — `test/config.test.ts` covers all validation paths.
- **CI workflow** — GitHub Actions: `bun test` + `bun run typecheck` on push and PR.
- **Security policy** — `SECURITY.md` with vulnerability reporting process.

### Changed
- **BREAKING**: `circuit-breaker.ts` — module-level mutable state replaced with `CircuitBreaker` class. Singleton functions (`isCircuitOpen`, `recordSuccess`, `recordFailure`, `getCircuitState`) preserved as backward-compatible wrappers around a default instance.
- **BREAKING**: `circulator.ts` — module-level queue replaced with `Circulator` class. Singleton functions (`enqueueCirculator`, `drainCirculatorQueue`, `getCirculatorQueueLength`, `flushCirculatorAsync`) preserved as backward-compatible wrappers.
- `compression.ts` — `writeCompactionStats` no longer shells out to `mempalace` CLI via `execSync`. Now writes JSON directly via `Bun.write()`.
- `package.json` version bumped to 2.0.0.
- README overhauled with v2.0 features, architecture table, ecosystem links, CI badge.
- CONTRIBUTING.md updated to reflect new file structure.

### Fixed
- **Inline code mangling** — `AGENTS.md` compression no longer corrupts `` `backtick-wrapped` `` identifiers (root cause of the `AGENTS. md`, `. gitignore` spacing issue documented in the v1.0 test fixture).
- **Shell-out fragility** — `writeCompactionStats` no longer depends on external `mempalace` binary.
- **No worker auth** — API endpoints are now optionally auth-protected when `AUTH_TOKEN` is configured.
- **Singleton state leak** — multi-tenant deployments can now create isolated `CircuitBreaker` and `Circulator` instances.

## [1.0.0] - 2026-06-29

### Changed
- **BREAKING**: `scoreMessage` now requires `(Message, index, total)` instead of `(content, role, total)`
- **BREAKING**: `enqueueCirculator` now accepts `CirculatorInput` (simplified shape) instead of full `CirculatorEntry`
- `token-budget.ts` filter now correctly drops unprotected messages when over budget

### Added
- `scoreMessageSync` — synchronous scoring without Milvus dependency
- `getBudget` — typed budget lookup by `AgentType`
- `totalTokens` — sum token estimates across messages
- `getCirculatorQueueLength`, `drainCirculatorQueue` — queue inspection
- `CompressInput`, `CompressResult`, `RewriteResult`, `ScoredMessage` types
- `AgentType`, `CompressionLevelName` type aliases
- REST endpoints: `POST /v1/rewrite`, `GET /v1/health`
- 52 tests across 6 modules
- `.gitignore` with Wrangler and build artifacts

### Fixed
- Worker used `any` types throughout — now fully typed
- Worker `scoreMessage` calls used wrong signature
- Worker `isProtected` calls passed raw content instead of `Message`
- Worker `enqueueCirculator` calls used wrong shape

## [0.1.0] - 2026-06-29

### Added
- Initial release as standalone package
- **Pruner**: Message scoring with relevance, recency (Ebbinghaus decay), and structural boost
- **Rewriter**: Three compression levels (Verbatim, Lite, Ultra) with critical token safety floor
- **Circulator**: Vector memory integration via Milvus with circuit breaker fallback
- **Composer**: Pattern injection from memory into system prompts
- Adaptive threshold based on conversation density
- Per-agent token budgets (coder, researcher, reviewer, orchestrator)
- Circuit breaker with 3-failure threshold and 60s cooldown
- Brain state management for cross-session learning
- TypeScript types for all interfaces
- Comprehensive test suite
- SOTA README with architecture, benchmarks, and provenance

### Research
- Implements asymmetric loss modulation from [Paper](https://kompress.vaked.dev/paper/main.pdf)
- 0.993 exact-keep rate on Heretic adversarial benchmark
- ~78% token savings, ~75% latency reduction
