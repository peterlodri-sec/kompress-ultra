# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
