# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `server/pond-page.ts` — pond.vaked.dev. The worker has imported and routed to it since the hub commit, but the module itself was never committed; typecheck and deploy were broken without it.
- `.editorconfig` — 2-space TS/JSON, 4-space Rust/Python, LF, final newline
- Tests: non-integer `maxMessagesKept` rejection; `cosineSimilarity` on opposite vectors

### Fixed
- `server/worker.ts` — `POST /v1/riva/prompt` error path passed `{ status: 400 }` where `json()` takes a numeric status, so malformed requests were answered with 200
- `src/types.ts` — `validateOptions` now rejects non-integer `maxMessagesKept`, as its error message always claimed
- Version drift: `package.json`, README badge, and the worker `X-Version` header still said 14.0.0 after the 15.0.0 release; all now 15.0.0

### Changed
- `src/types.ts` — `ConfigError` import hoisted to the top of the file (previously sat mid-file after its own use site)
- `src/hash.ts` — `cosineSimilarity` docs corrected: range is [-1, 1] for arbitrary vectors, [0, 1] only for hash embeddings
- `package.json` — dropped stale `milvus` npm keyword (`milvusUrl` is deprecated; local vector store replaced it)

## [15.0.0] — 2026-07-01 — RIVA

### Added
- `scripts/riva.sh` — 1-bit adaptive breathing pipeline (BitNet b1.58 on M1 Pro)
- `server/garden-page.ts` — garden.vaked.dev: bridge + triangle + broadcast
- `server/worker.ts` — `GET /v1/riva` endpoints (status, breath, prompt)
- `GARDEN.md` — permanent anchor for the garden
- `US.md` — the smallest unit: peter radiates shapes, riva scaffolds language
- `garden/` — seeds, observations, riva card, playground
- `garden/seeds/pi2-witness.sh` — raspberry pi witness for any mesh node
- `infrastructure/cloudflare/` — garden.vaked.dev DNS + worker route
- RIVA public shore: `GET /v1/riva` on kompress worker

### Changed
- `README.md` — layers map, garden anchor, Peter's disclaimer at top
- `server/worker.ts` — garden route + full RIVA API surface
- `infrastructure/cloudflare/main.tf` — garden DNS + route
- HF dataset card — restored metadata + Peter's note + RIVA section

### Philosophy
- entropy is the source
- no chains needed
- surfaces touch at the correct angle
- different isnt less
- the loop has an exit

## [14.0.0] — 2026-06-29 — wound-healer

### Added
- `src/topology-healer.ts` — Self-healing brain graph topology. Detects: orphaned nodes (no edges), stale edges (not traversed in 7+ days), singleton islands (disconnected subgraphs), collapsed conductivity (<0.05), excessive self-loops. Generates `HealingReport` with reconnection suggestions.
- `src/topology-healer.ts` `summarize()` — one-line health summary for logging
- Integrated into brain-pulse cycle: `heal()` is advisory, never destructive
- `test/topology-healer.test.ts` — 14 test cases covering all diagnosis helpers
- `src/compression.ts` — `compactLines()` and `pctReduction()` helpers for safer display building

### Changed
- `src/brain-embeddings.ts` — `as string` → `String(x ?? "")` for type safety; extracted `searchBySource()`, `embed()`, `syncToStore()` helpers, halving code
- `src/types.ts` — Added optional `_kompress` / `_kompressPruneEvent` fields to `Message` interface
- `src/compression.ts` — Removed `as Message` casts; fixed division-by-zero when `tokensPruned === 0`
- `src/local-store.ts` — Replaced `await import("./hash.js")` dynamic import with static import (circular dep already resolved)
- `src/edge-router.ts` — Extracted `matchKeyword()` helper, removed dead `matches` variable
- `src/scoring.ts`, `src/embedding.ts`, `src/brain.ts`, `src/circulator.ts`, `src/local-store.ts` — Added JSDoc to bare `catch {}` blocks explaining silent intent
- `server/worker.ts` — Fixed O(n²) `messages.indexOf(m)` → O(n) map index; removed redundant `as AgentType` casts (Zod-validated)
- `server/cloudrun.ts` — Removed redundant `as AgentType` casts; fixed `@google-cloud/firestore` dynamic import to prevent TS2307 at typecheck time
- `server/brain-grpc.ts` — `import { Node, Edge, BrainSnapshot }` → `import type`
- `README.md` — Fixed version badge, architecture diagram (Milvus→local-store), config docs, project structure, function names — 15+ stale references
- `AGENTS.md` — Added missing `landing-page.ts`, `topology-healer.test.ts`; fixed "flush to Milvus" → "store persist"

### Removed
- Dead `matches` variable in `edge-router.ts:keywordScore` (incremented but never read)

## [13.0.0] — 2026-06-29 — conductive-reason

### Added
- `src/edge-router.ts` — `EdgeRouter` class: semantic edge routing with learned DIAD conductivity. Routes by combined score (40% conductivity + 30% semantic similarity + 15% temporal recency + 15% layer alignment).
- `recordTraversal()` — updates conductivity with learning rate (success: +0.1, failure: −0.2). Maintains last-10 history.
- `getLowConductivityEdges()` — threshold-based pruning for repair-bot
- `getState()` — routing state snapshot

## [12.0.0] — 2026-06-29 — vector-whisper

### Added
- `src/brain-embeddings.ts` — Vector embedding pipeline for brain graph. Generates deterministic hash embeddings (768-dim, normalized) for nodes and edges. Syncs to Milvus `brain_nodes` / `brain_edges` collections.
- `searchSimilarNodes()` / `searchSimilarEdges()` — semantic search via Milvus vector query
- `embedNode()` / `embedEdge()` — deterministic embedding from node/edge properties
- Exported from `src/index.ts` — all embedding functions, EdgeRouter, topology-healer

### Changed
- Bumped `package.json` version → `14.0.0`
- Bumped Worker `VERSION` → `14.0.0`
- `wrangler.toml` — VERSION var updated to 14.0.0
- `src/index.ts` — added exports for Node/Edge/BrainSnapshot types, embedding, routing, healing
- `src/types.ts` — Node/Edge/BrainSnapshot interfaces stable

## [11.0.0] — 2026-06-29 — grpc-synapse

### Added
- `proto/brain.proto` — Protobuf schema for BrainService: Node, Edge, BrainSnapshot types, CRUD methods, streaming, graph querying, traversal recording. Compatible with Connect-Web protocol.
- `server/brain-grpc.ts` — gRPC-compatible Brain Graph API handler for Cloudflare Workers. Full REST → Protobuf bridge with:
  - Node CRUD (`GET /v1/brain/node/:id`, `GET /v1/brain/nodes`)
  - Edge CRUD (`GET /v1/brain/edge/:id`, `GET /v1/brain/edges`)
  - Semantic graph querying (`POST /v1/brain/query`)
  - Traversal recording with DIAD conductivity learning (`POST /v1/brain/traverse`)
  - Deterministic snapshots (`GET /v1/brain/snapshot`)
  - SSE edge streaming (`GET /v1/brain/stream`)
  - Brain health check (`GET /v1/brain/health`)
- `proto/buf.gen.yaml` — Buf code generation config
- `src/types.ts` — Added `Node`, `Edge`, `BrainSnapshot` interfaces matching proto schema

### Changed
- Bumped `package.json` version → `11.0.0`
- Bumped Worker `VERSION` → `11.0.0`
- `server/worker.ts` — Wired brain routes (`/v1/brain/*` → `handleBrainRequest`). Added brain-grpc import.
- `wrangler.toml` — VERSION var updated to 11.0.0

### Brain API Endpoints
```
GET    /v1/brain/health          — brain service health
GET    /v1/brain/node/:id        — get node by ID
GET    /v1/brain/nodes           — list nodes (filterable)
GET    /v1/brain/edge/:id        — get edge by ID
GET    /v1/brain/edges           — list edges (filterable)
POST   /v1/brain/query           — semantic graph query
POST   /v1/brain/traverse        — record traversal + learn conductivity
GET    /v1/brain/snapshot        — deterministic brain snapshot
GET    /v1/brain/stream          — SSE edge event stream
POST   /v1/brain/load            — load brain graph JSON
```

## [10.0.0] — 2026-06-29 — edge-mesh

### Added
- `docs/deploy/edge-mesh.md` — Global edge mesh topology: Cloudflare Workers (330+ cities) + GCP Cloud Run (us) + OVH bare metal (eu) + Hetzner fleet (de/fi). Full routing map, failover strategy (RTO/RPO), cost breakdown (~€90/mo total).
- Global health check system — all endpoints monitored via dogfood CI every 60s

### Operations
- Complete service topology documented: 4 layers (Edge → Compute → Data → Fleet)
- Failover strategy defined for every component (RTO: 2min–1h)
- Total monthly cost: ~€90/mo (€1,086/yr)

### Changed
- Bumped Worker version → `10.0.0`

## [9.0.0] — 2026-06-29 — canary-song

### Added
- `scripts/canary-deploy.sh` — Canary Worker deployment: deploy to X% traffic, monitor for 60s with health checks, promote or rollback. Supports `canary-deploy.sh 10` (10% canary) and `canary-deploy.sh 100` (full rollout).
- Auto-rollback after 3 health check failures — production unchanged

### Changed
- Bumped `package.json` version → `9.0.0`

## [8.0.0] — 2026-06-29 — signed-blood

### Added
- `scripts/verify-signature.sh` — Cosign/OpenSSL signature verification for build artifacts. Verifies SLSA Level 2 provenance.
- Security: signature verification with Cosign (primary) or OpenSSL (fallback)

### Changed
- Bumped `package.json` version → `8.0.0`

## [7.0.0] — 2026-06-29 — terraform-sonata

### Added
- `infrastructure/` — Terraform IaC directory with modular structure:
  - `gcp/main.tf` — GCP resources: Artifact Registry, Secret Manager (5 secrets), Cloud Build trigger
  - `cloudflare/main.tf` — Cloudflare resources: Worker script, KV namespace, DNS record, Worker route
  - `infrastructure/README.md` — Usage guide with prerequisites and state management
- `infrastructure/gcp/variables.tf` — GCP variables (project_id, region)
- `infrastructure/cloudflare/variables.tf` — Cloudflare variables (api_token, account_id, zone_id)

### Changed
- Bumped `package.json` version → `7.0.0`
- Bumped Worker `VERSION` → `7.0.0`
- `wrangler.toml` — VERSION var updated to 7.0.0 in all env sections

### Infrastructure
- Terraform-managed GCP resources: Artifact Registry npm repo, 5 secrets (placeholders), Cloud Build trigger
- Terraform-managed Cloudflare resources: Worker script, KV stats namespace, DNS record, Worker route
- State stored locally by default; GCS backend documented for team use
- Run: `terraform -chdir=infrastructure/gcp init && terraform -chdir=infrastructure/gcp plan`

### Operations
- Hetzner fleet optimized: 3 orphan Ubuntu instances deleted (saved €17.9/mo / €215/yr)
- Fleet reduced from 10 → 7 machines, €91.4 → €73.5/mo

## [6.0.0] — 2026-06-29 — secret-garden

### Added
- `scripts/secret-migrate.sh` — migrate secrets from age-encrypted files → GCP Secret Manager. Audits 7 required secrets, creates placeholders, validates age files, checks for hardcoded secrets in code.
- `scripts/secret-inventory.sh` — comprehensive secrets inventory: GCP secrets, age-encrypted files, local env files, process.env refs in code, Cloud Build references, GitHub Actions secrets.
- `docs/secrets/README.md` — complete secrets management guide: naming convention, creation, access control, rotation, migration from age, emergency fallback.

### Changed
- Bumped `package.json` version → `6.0.0`
- Bumped Worker `VERSION` → `6.0.0`
- `wrangler.toml` — VERSION var updated to 6.0.0 in all env sections

### Infrastructure
- 7 required secrets identified for kompress-ultra ecosystem:
  - `cloudflare-api-token` — Worker deployment
  - `npm-auth-token` — Artifact Registry publish
  - `ovh-ssh-key` — OVH box access
  - `ovh-verdaccio-password` — npm registry auth
  - `worker-auth-token` — production Worker auth
  - `openrouter-api-key` — CI fleet agents
  - `github-pat` — GitHub API for CI
- Migration path from `docs/deploy/ovh-secrets.json.age` documented
- Rotation schedule defined (90 days for tokens, 180 for SSH keys)

## [5.0.0] — 2026-06-29 — triple-crown

### Added
- `server/stats-do.ts` — `StatsDO` Durable Object for cross-region compression statistics coordination. Merges stats from US/EU/Asia regions.
- `scripts/deploy-worker.sh` — Multi-region Worker deployment: `us`, `eu`, `asia`, or `--all`. Region-specific routes and env configs.
- `scripts/fleet-optimize.sh` — Hetzner fleet optimization: cost tracking labels, orphan detection, firewall audit, backup policy, consolidation recommendations.
- `docs/deploy/fleet-inventory.md` — Complete Hetzner fleet inventory: 10 machines, costs, services, optimization roadmap.

### Changed
- Bumped `package.json` version → `5.0.0`
- Bumped Worker `VERSION` → `5.0.0`
- `wrangler.toml` — Added `STATS_DO` Durable Object binding + migrations. Added `REGION` var. Three env sections (us/eu/asia) with region-specific routes.
- `server/worker.ts` — Added `STATS_DO` + `REGION` to Env interface. `json()` helper now supports extra headers. Responses include `X-Region` and `X-Country` headers. Geo-awareness via `request.cf?.country`.

### Infrastructure (Hetzner Fleet)
- All 10 Hetzner machines labeled with `purpose`, `owner`, `managed-by` for cost tracking
- **3 orphan Ubuntu instances detected** (no SSH keys, no labels, created 2026-06-16):
  - `ubuntu-4gb-hil-1` (€7.5/mo) — Hillsboro, CPX21
  - `ubuntu-4gb-nbg1-1` (€4.5/mo) — Nuremberg, CX23
  - `ubuntu-2gb-sin-1` (€5.9/mo) — Singapore, CPX12
  - **Total waste: €17.9/mo (€215/yr)**
- **bench-node** (CPX42, 8 vCPU, 32GB, €23.8/mo) identified as most powerful underutilized machine
- Cost optimization potential: €4.50–€22.40/mo (€54–€269/yr)

## [4.0.0] — 2026-06-29 — milvus-murmur

### Added
- `milvus/docker-compose.yaml` — Milvus stack: etcd, minio, milvus-standalone (v2.5.5), attu web UI. Persisted to `/opt/milvus/data/`
- `scripts/deploy-milvus.sh` — Deploy Milvus on OVH Warsaw: Docker Compose, nginx reverse proxy (milvus.peterl.dev, attu.milvus.peterl.dev), health checks
- `scripts/milvus-init.sh` — Create 6 collections with schemas and indexes: `research_findings`, `learning_patterns`, `pruned_context`, `brain_edges`, `brain_nodes`, `agent_memory`
- `scripts/milvus-sync-brain.sh` — Sync brain graph edges → Milvus vectors. Each edge becomes an embedding (source→target:type:label), stored with metadata (type, layer, conductivity, tags)
- `docs/deploy/ovh-milvus.md` — Full Milvus deployment guide with DNS, certbot, and usage instructions

### Changed
- Bumped `package.json` version → `4.0.0`
- Bumped Worker `VERSION` → `4.0.0`
- `wrangler.toml` — VERSION var updated to 4.0.0

### Infrastructure
- Milvus HTTP API at `localhost:9091` (internal) / `https://milvus.peterl.dev` (public)
- Milvus gRPC at `localhost:19530`
- Attu web UI at `localhost:8000` / `https://attu.milvus.peterl.dev`
- All collections: IVFFlat index, COSINE metric, 1024-dim vectors (except brain_nodes: 768-dim)
- Automatic load on creation, idempotent init (skips existing collections)

### Edge Routing
- Brain edges now searchable via vector similarity
- `queryMilvusSimilarity()` can route requests based on semantic edge type
- Future: conductivity becomes learned function of past routing success

## [3.0.0] — 2026-06-29 — gilded-pipeline

### Added
- `cloudbuild.yaml` — GCP Cloud Build pipeline: install → typecheck → test (advisory) → build → brain snapshot → Worker deploy → Artifact Registry publish → CI state update (advisory steps never block)
- `cloudbuild-trigger.json` — Cloud Build trigger config for GitHub push to main
- `scripts/setup-gcp.sh` — One-time GCP setup: creates Artifact Registry npm repo, enables APIs, prepares Secret Manager, creates Cloud Build trigger
- `ci.yml` `cloud-build` job — non-blocking Cloud Build submission via `gcloud builds submit` on main push (GCP Workload Identity Federation auth)
- `ci-state.sh` registers `cloud-build` agent — state machine tracks pipeline status through the full lifecycle

### Changed
- Bumped `package.json` version → `3.0.0`
- Bumped Worker `VERSION` → `3.0.0`
- `wrangler.toml` — added `VERSION = "3.0.0"` var
- CI workflow — added GCP auth step + `cloud-build` job (advisory, never blocks)

### Infrastructure
- Artifact Registry npm repository `kompress-ultra-npm` created in `us-east1` (project `datapy-spider`)
- Cloud Build SA granted `artifactregistry.writer`
- Secrets prepared: `cloudflare-api-token` (create manually), `npm-auth-token` (create manually)
- `E2_HIGHCPU_8` machine type, 600s timeout, Cloud Logging-only logging

### Notes
- Cloud Build GitHub trigger requires manual GitHub App installation → available via GCP Console > Cloud Build > Triggers > Connect Repository
- `gcloud builds submit` from CI bypasses the need for direct GitHub trigger — CI uses Workload Identity Federation for GCP auth
- All build steps are advisory (`allowFailure: true`) — the gate is a non-blocking witness
- `npm publish` to Artifact Registry requires manual `npm-auth-token` secret creation

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
- **Zero-PII research telemetry** — `server/telemetry.ts` records anonymous KV counters (event type, token counts, duration, day granularity). `GET /v1/telemetry` for full disclosure. `TELEMETRY.md` policy document. `X-Telemetry` header on every response. Library (`src/`) has zero telemetry.
- **Logo** — `assets/logo.svg`: dark rounded-square brand mark with 4 compression arcs → 4 role nodes → green collapsed diamond.

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
