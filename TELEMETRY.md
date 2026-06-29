# Telemetry Disclosure — kompress-ultra API

**TL;DR**: The free hosted API at `kompress.vaked.dev` collects anonymous research
telemetry. That's the "price" of using it for free. Self-hosters get zero
telemetry. The library itself (`npm install kompress-ultra`) has zero telemetry
— period.

---

## Why

Building SOTA context compression requires real-world usage data. We publish
everything: the [paper](https://kompress.vaked.dev/paper/main.pdf), the
[model](https://huggingface.co/PeetPedro/kompress-v8), the
[dataset](https://huggingface.co/datasets/PeetPedro/ultrawhale-dogfood). The
research telemetry tells us *how* people use compression so we can keep improving
it — and we share those improvements with everyone.

## What's Collected

| Data | Granularity | Example |
|------|-------------|---------|
| Event type | Per request | `compress`, `score`, `rewrite` |
| Agent type | Per request | `coder`, `researcher`, `reviewer`, `orchestrator` |
| Compression level | Per rewrite | `lite`, `ultra` |
| Message count | Per compress/score | `10` |
| Token counts (input / output) | Per request | `input: 4200, output: 1200` |
| Duration | Per request (ms) | `97` |
| Success / failure | Per request | `success: true` |
| Error type | On failure only | `ConfigError` |
| Timestamp | Day only (YYYY-MM-DD) | `2026-06-29` |

**That's it.** No identifiers, no content, no IPs, no cookies.

## What's NOT Collected (explicitly)

- ❌ Message content, file paths, code snippets
- ❌ IP addresses, user agents, browser fingerprints
- ❌ Session IDs, user identifiers, email addresses
- ❌ Cookies, referrers, origin URLs
- ❌ Device info, OS, screen resolution
- ❌ Timestamps finer than day granularity

## Storage

- **KV Store**: Cloudflare KV (`KOMPRESS_STATS` namespace)
- **TTL**: 90-day auto-expiry — data self-destructs
- **Access**: API maintainers only, no third-party sharing
- **Aggregation**: Simple counters only — no per-request logs, no event streams

## Opt Out

Three ways to opt out:

1. **Self-host the Worker**: Deploy `server/worker.ts` yourself with Wrangler.
   Simply omit the `KOMPRESS_STATS` KV binding (or don't create it) — the code
   detects the missing binding and records nothing.
2. **Use the library directly**: `npm install kompress-ultra` and call the
   functions in `src/` — zero telemetry, ever. The library is fully offline.
3. **Use the CLI script**: `bun run scripts/run-ultra.mjs` — local only, no
   network calls.

## Transparency

Every response from the hosted API includes an `X-Telemetry` header linking to
this document. All telemetry code lives in
[`server/telemetry.ts`](https://github.com/peterlodri-sec/kompress-ultra/blob/main/server/telemetry.ts)
— fully auditable, open source.

## Questions?

Open an issue at <https://github.com/peterlodri-sec/kompress-ultra/issues>.
