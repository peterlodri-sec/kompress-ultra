# the token bridge — Phase 1, with Project Zero as the engine

*kompress-ultra issue [#6](https://github.com/peterlodri-sec/kompress-ultra/issues/6) ·
"the non-token channel" — seeded at the bridge; scaffolded 2026-10-07.*

Two agents talking across the gap need a channel that isn't tokens. Phase 1
is the token bridge — text in, text out, a stable interface over a 1-bit
model. Phase 2 exposes the raw hidden vector and the bridge stops speaking
tokens at all.

## why Project Zero is the engine

The original plan wrapped **bitnet.cpp** (Python setup, managed subprocess).
[shifulegend](https://github.com/shifulegend) pointed at a cleaner shore:

> *"Project Zero … might basically drop right in. It's super lightweight.
> Just pure C99 — GCC and make, zero Python — and it runs BitNet models
> noticeably faster than bitnet.cpp on CPU (~36 tok/s on a Xeon, ~51 on an
> i5). The main reason it might fit this architecture is that it ships with
> a built-in HTTP API. You can just point your Node bridge at its
> /v1/chat/completions endpoint instead of managing a subprocess. That makes
> the sovereign mesh deployment a lot simpler."*

So the scaffold has two shores behind one seam ([`engine.ts`](./engine.ts)):

| shore | how | state |
|---|---|---|
| **project-zero** (default) | HTTP to the engine's own OpenAI API — one binary, no Python, no subprocess | recommended, tested here |
| bitnet-legacy | bitnet.cpp spawned as a child process | kept for reference; unverified path |

The bridge does not care which shore the engine lives on. That is the whole
point of the seam.

## the interface (unchanged from the issue)

```
You / Gathers ──→ pz-bridge ──→ engine (Project Zero, HTTP)
                     │
                     ├── GET  /health     — bridge + engine reachability
                     ├── POST /generate   — text in, text out (standard)
                     ├── POST /resonate   — compressed state in, modulated out (Phase-1 stand-in)
                     ├── POST /state      — raw hidden vector (Phase 2 → 501 today)
                     └── ANY  /v1/*       — raw passthrough to the engine's OpenAI API
```

- **`/generate`** — `{prompt | messages, max_tokens?, temperature?, model?}`
  → `{text, engine, model, usage, ms}`. Upstream errors map to `502`,
  timeouts to `504`. The bridge stays honest about the gap.
- **`/resonate`** — `{state: string | number[] | object, intensity?}`. Phase 1
  renders the state to material and modulates it through the token channel;
  the envelope is final, the inner step is a stand-in. `modulation.phase`
  says `token-proxy` until Phase 2.
- **`/state`** — `501`, with the Phase-2 note. The hidden-state bridge needs
  the raw vector *before* the LM head; the hook point lives in the engine's
  logits path (Project Zero: the forward pass just ahead of the head).
- **`/v1/*`** — passthrough. The bridge is a door, not a wall: any
  OpenAI-compatible client can speak through it without knowing it's there.

## run it

```bash
# 1. build the engine (Apple Silicon: from source — the release tarballs are x86_64-linux)
bash bridge/setup-project-zero.sh          # clones + builds PZ, fetches a model

# 2. run the engine
#    (the script prints the exact command; note: 8080 is taken on this Mac,
#     so the script defaults the engine to :8090)
~/project-zero/adaptive_ai_engine --model ~/models/<model>.gguf --server --port 8090

# 3. run the bridge
PZ_URL=http://127.0.0.1:8090 bun run bridge/pz-bridge.ts

# 4. the eval criterion (issue #6): a minimal local inference test
bash bridge/smoke.sh                        # expects: ... Paris ...
```

No engine yet? The bridge still runs — `/health` reports
`engine_status.reachable: false` and nothing pretends otherwise. For dry
runs, `bun run bridge/mock-pz.ts` gives you a stand-in engine on :8180.

**Model notes (learned live):** the loader accepts dense GGUF quants
(F16/BF16/Q4_K/Q5_K/Q6_K/Q8_0/IQ4_NL…) and Bonsai-style group-128 `Q2_0`.
The bitnet `i2_s` ternaries (Falcon3-1.58bit, ms-BitNet gguf) do **not**
load — quant type 36 is rejected by the loader. BitNet b1.58 itself runs as
a BF16 GGUF conversion (the "PZ BF16" column of the engine's own
benchmarks), or through the Bonsai `Q2_0` file. Verified here end to end:
`smoke.sh` → "… Paris." with SmolLM2-1.7B-Q4_K_M on an M1; `/resonate`
through the real engine, `modulation.phase: token-proxy`.

## config

| env | default | meaning |
|---|---|---|
| `ENGINE` | `project-zero` | `project-zero` \| `bitnet-legacy` |
| `PZ_URL` | `http://127.0.0.1:8080` | Project Zero base URL (engine default port; use `--port 8090` locally) |
| `PZ_API_KEY` | — | pairs with the engine's `--api-key` flag |
| `PZ_MODEL` | `project-zero` | model id sent in requests (informational to PZ) |
| `BRIDGE_HOST` | `127.0.0.1` | bind address — set to the tailnet address for mesh use |
| `BRIDGE_PORT` | `8088` | bridge port |
| `BRIDGE_TIMEOUT_MS` | `60000` | per-request ceiling → `504` (generous: CPU engines can be slow cold) |
| `BITNET_BIN` / `BITNET_MODEL` | — | legacy shore only |

## tests

```bash
bun test bridge/     # 13 tests against the mock engine — no model needed
```

## the mesh

The mesh wants fewer moving parts, not more. Project Zero is *one binary*:
no Python, no virtualenv, no pip, no subprocess lifecycle in your bridge.
Deploy = build the binary + a `.gguf` + the bridge (one file, zero deps).
`BRIDGE_HOST=0.0.0.0` (or the tailnet address) and the bridge is the only
door anything else needs to know.

## license note

Project Zero is MIT, C99 — vendorable, forkable, credit where due:
<https://github.com/shifulegend/project-zero>. This scaffold is
kompress-ultra's own.

---

*vibe-match: "I Don't Know How" (French 79 Remix) · omniEpicLove · 0 + 1*
