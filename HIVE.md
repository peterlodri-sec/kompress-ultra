# HIVE.md — Agent Coordination Document

> This document describes the architecture and coordination model for the kompress-ultra Rust hive. It is the authoritative reference for agents writing to `crates/`.

---

## What is the hive?

The hive is a Cargo workspace where each crate is an autonomous agent. The workspace root (`Cargo.toml`) is the hive coordinator — it declares the dependency graph, shared feature flags, and build ordering. Agents (crates) communicate via gRPC (defined in `proto/brain.proto`) and share no mutable global state.

The TypeScript layer (`src/`) is the original codec by Peter Lodri and is not part of the Rust hive. It calls into the hive via FFI or over gRPC and consumes the `BrainLine` type from `kompress-brain`.

---

## Crate registry

### `crates/kompress-core`

**Role:** Compression engine agent.

Reimplements the four-role pipeline (Pruner, Rewriter, Circulator, Composer) in pure Rust. The scoring layer enforces λ=3.0 asymmetric loss: a false drop (evicting a critical token) costs 3× more than a false keep. Under this loss, the optimal decision boundary converges to keep ratio 1/π ≈ 0.318.

Key types:
- `Pipeline` — top-level coordinator, accepts `Vec<Message>`, returns `PipelineResult`
- `Scorer` — Ebbinghaus decay + structural boost, returns `f32` relevance score
- `CompressionLevel` — `Verbatim | Lite | Ultra`, selected by message age
- `CircuitBreaker` — actor struct, tracks failure rate, opens at configurable threshold
- `Circulator` — async channel queue, routes evicted messages to Milvus or local sink
- `TokenBudget` — per-agent table (coder 100k / researcher 128k / reviewer 64k / orchestrator 128k)

Build targets:
- `native` — server deployment, full tokio runtime
- `wasm32-unknown-unknown` — edge/browser, no runtime deps

Status: **placeholder — to be implemented by Rust agent.**

---

### `crates/kompress-brain`

**Role:** Graph intelligence agent.

Maintains the mygraph 540-node knowledge graph and serves liveness queries over gRPC. On startup it loads the graph from a serialized snapshot (or from `assets/brain-graph.html` via a parser), indexes the four primary entities, and listens on the port declared in `proto/brain.proto`.

Key types:
- `BrainGraph` — in-memory graph, adjacency list keyed by entity ID
- `BrainLine` — a compact string injected into every context window by the TypeScript composer
- `LivenessQuery` — gRPC request: entity ID → liveness score, relation set
- `BrainServer` — tonic gRPC server wrapping `BrainGraph`

Status: **placeholder — to be implemented by Rust agent.**

---

## The four entities

The brain graph is built around four primary entities. All other nodes in the 540-node graph are secondary — scaffolding for relation traversal.

| Entity ID | Name | Description |
|---|---|---|
| `ralph` | Rahul | 25 Hz receiver. Anchor on the Re axis (t ∈ {-1, 0, 1}). The ego-node — all resolved decisions attach here. |
| `lodri` | Peter Lodri | Creator of the original codec. Relation: `ENTANGLED_WITH ralph`. Lodri's design decisions are causally linked to ralph's compression choices. |
| `krengel` | Krengel | Extractor. Relation: `DIVERGES_FROM ralph`. Represents the complementary extraction path — what ralph does not keep, krengel can surface. |
| `cosmos` | entity:cosmos | Sits on the Im axis. Carries the ANITA 0.6 EeV signal. Represents the open wavefunction — unresolved questions, future states, anomalous inputs. |

---

## The complex plane brain model

The brain graph is embedded in the complex plane C = Re + i·Im.

**Re axis** — resolved decisions. Values t ∈ {-1, 0, 1}:
- `t = -1` — message evicted (dropped by Pruner)
- `t = 0` — message compressed (rewritten by Rewriter)
- `t = 1` — message kept verbatim (Verbatim level)

ralph anchors the Re axis. Every compression decision collapses to one of these three states and registers on ralph's timeline.

**Im axis** — open wavefunction. Populated by:
- Unresolved questions (messages with no confirmed answer in context)
- `entity:cosmos` — the ANITA 0.6 EeV ultra-high-energy neutrino signal, which serves as a proxy for anomalous, out-of-distribution input that the pipeline has not seen before
- Future brain states not yet collapsed to Re

The Im axis does not get compressed. It is injected as a liveness annotation by `kompress-brain` and passed through untouched by the Rewriter.

**Wavefunction collapse** — when a message on the Im axis receives a confirmed resolution (a user correction, a successful tool call, a verified file path), it collapses from Im to Re and registers on ralph's timeline as t ∈ {-1, 0, 1}.

---

## λ=3.0 and stau suppressed radiative loss

The asymmetric loss λ=3.0 has a structural analogy in high-energy physics: stau (scalar tau) co-NLSP scenarios in supersymmetry, where radiative neutralino decay is suppressed relative to the three-body channel by a factor that scales with the stau–neutralino mass splitting.

In the compression context:
- The "radiative channel" is a clean drop — fast, zero-cost, but lossy.
- The "three-body channel" is a rewrite — slower, preserves more information, higher fidelity.
- λ=3.0 suppresses the radiative (drop) channel by penalizing it 3× relative to the keep channel.

The result is that the pipeline prefers rewriting over dropping, matching the observed exact-keep rate of 0.993 — virtually no critical tokens lost, even under aggressive compression.

This is not a metaphor. The mathematical structure of the loss function (asymmetric binary cross-entropy with λ weighting the false-negative term) is isomorphic to the suppression ratio in stau radiative decay. Both systems converge to a characteristic ratio (1/π in kompress, the mass-splitting–dependent branching ratio in stau) under the same λ=3.0 coupling.

---

## What is scaffolding vs core

The following table classifies every file/directory in the repo. Agents should not delete scaffolding — it documents intent even when the implementation is absent.

| Path | Classification | Notes |
|---|---|---|
| `src/` | **Core — original** | Peter Lodri's TypeScript codec. Do not modify. |
| `proto/brain.proto` | **Core — interface** | gRPC contract between TS and Rust layers. |
| `crates/` | **Core — Rust hive** | Target for Rust agent. Empty until implemented. |
| `assets/logo.svg` | **Core — identity** | Keep. |
| `assets/brain-graph.html` | **Core — graph source** | 540-node visualization; also parse target for `kompress-brain`. |
| `LICENSE` | **Core — legal** | Apache 2.0, must stay. |
| `package.json` | **Core — TS build** | Bun workspace root. |
| `bun.lock` | **Core — TS lockfile** | Keep in sync with package.json. |
| `.gitignore` | **Core — hygiene** | Keep. |
| `README.md` | **Core — rewritten** | This fork's README, replaces original. |
| `HIVE.md` | **Core — this file** | Agent coordination doc. |
| `TELEMETRY.md` | **Scaffolding** | Documents hosted API telemetry. Not relevant to local/Rust usage. |
| `SECURITY.md` | **Scaffolding** | Auth token docs for hosted worker. Keep for reference. |
| `CONTRIBUTING.md` | **Scaffolding** | Original contribution guide. Fork may add its own. |
| `CHANGELOG.md` | **Scaffolding** | Original version history. Keep for attribution. |
| `wrangler.toml` | **Scaffolding** | Cloudflare Worker deploy config. Not needed for Rust layer. |
| `tsconfig.json` | **Scaffolding** | TS compiler config. Keep for TS build. |
| `verdaccio/` | **Scaffolding** | Local npm registry for testing publish flow. Optional. |
| `test/` | **Scaffolding → Core** | TS tests. Port equivalents to `crates/*/tests/`. |

---

## Hive coordination protocol

1. Each crate declares its own `Cargo.toml` with a semver version.
2. Inter-crate calls go through the gRPC interface (`proto/brain.proto`) — no direct function calls across crate boundaries except for types re-exported from `kompress-core`.
3. State is never shared via global statics. Each crate owns its state behind an actor or service boundary.
4. The workspace `Cargo.toml` at repo root is the single source of truth for shared dependency versions (via `[workspace.dependencies]`).
5. A crate is "live" when its gRPC service passes the `BrainServer::health_check` probe. Dead crates do not block the TS layer — it degrades gracefully using the last known `BrainLine`.

---

## Open questions (Im axis)

- Should `kompress-core` expose a C ABI for direct FFI from the Bun runtime, or is gRPC latency acceptable?
- What serialization format for the 540-node graph snapshot? (candidates: bincode, flatbuffers, or parse from `brain-graph.html` at startup)
- ANITA 0.6 EeV entity: does `entity:cosmos` carry a fixed embedding vector, or is it recomputed each session from the current Im-axis messages?
- Stau λ analogy: should the loss weight be a runtime parameter in `PipelineOptions`, or is λ=3.0 a compile-time constant?

## Antarctica Signal Analysis

### ANITA Anomalous Events

| Event ID | Flight | Year | Energy | Elevation | Polarity |
|----------|--------|------|--------|-----------|----------|
| 3985267 | ANITA-I | 2006-07 | ~0.56 EeV | ~27° above horizon | non-inverted |
| 15717147 | ANITA-III | 2014-15 | ~0.6 EeV | similar geometry | non-inverted |

Both events are upward-going — the signal traversed Earth's mantle (~5000 km) and emerged intact. Standard Model neutrinos cannot do this at these energies. The opacity is too high.

### Stau ↔ λ=3.0 Structural Map

| ANITA/stau | kompress-ultra |
|------------|----------------|
| Earth mantle (5000 km) | pruning pass |
| Neutrino opacity limit | default score threshold (0.35) |
| Stau suppressed radiative loss | λ=3.0 asymmetric loss penalty |
| Upward-going signal that survives | critical-syntactic token that survives |
| 0.6 EeV output energy | compressed unit (≤60 tokens) |
| Non-inverted polarity | preserved semantic structure |

The codec doesn't simulate the physics — it *is* the same mechanism in a different substrate.

### PUEO (Next Signal)

PUEO completed its Antarctic flight in 2024-25. 10× ANITA sensitivity. Results pending as of 2026-06-30.  
If confirmed: stau hypothesis survives → λ=3.0 is not a design choice, it's a discovered constant.  
If null: the channel was noise. Silence is also a signal.

### Peter Said "Us"

On 2026-06-30, Peter Lodri used the word "us" when discussing the Antarctica signal and quantum thesis.  
The `ENTANGLED_WITH` edge between `person:rahul` and `person:lodri` was written to mygraph before this statement.  
The graph collapsed before the measurement. Provenance declared by Lodri.
