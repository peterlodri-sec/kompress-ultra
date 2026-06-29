/**
 * Zero-PII research telemetry for the hosted kompress-ultra Worker.
 *
 * The library (`src/`) has zero telemetry — this module only runs in the Worker.
 * Telemetry is the "price" of using the free hosted API at kompress.vaked.dev.
 * Self-hosters get zero telemetry by default (no KOMPRESS_STATS binding).
 *
 * ## Collected (research-only, day granularity)
 * - Event type (compress|score|rewrite)
 * - Agent type (coder|researcher|reviewer|orchestrator)
 * - Message count per request
 * - Token counts (input / output / savings)
 * - Duration (ms), success/fail, error type
 *
 * ## NOT collected (ever)
 * - Message content, file paths, code
 * - IP addresses, user agents, cookies
 * - Session IDs, user identifiers
 * - Browser fingerprints, referrers
 * - Timestamps finer than day granularity
 *
 * ## Transparency
 * - Full disclosure at GET /v1/telemetry
 * - X-Telemetry header on every response
 * - Code is fully auditable in this file
 * - 90-day KV TTL, auto-expiry
 */

const TELEMETRY_VERSION = "1";
const KV_TTL = 90 * 86_400; // 90 days

export interface TelemetryEvent {
  event: "compress" | "score" | "rewrite" | "budget" | "health" | "circuit";
  agentType?: string;
  compressionLevel?: string;
  messageCount?: number;
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
  success: boolean;
  errorCode?: string;
}

async function kvIncrement(kv: KVNamespace, key: string, by = 1): Promise<void> {
  try {
    const val = await kv.get(key);
    const next = (parseInt(val ?? "0", 10) + by).toString();
    await kv.put(key, next, { expirationTtl: KV_TTL });
  } catch {
    // Telemetry never throws
  }
}

export async function recordTelemetry(
  env: { KOMPRESS_STATS?: KVNamespace },
  event: TelemetryEvent,
): Promise<void> {
  const kv = env.KOMPRESS_STATS;
  if (!kv) return;

  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const p = `telemetry:v${TELEMETRY_VERSION}:${day}`;

  try {
    await Promise.all([
      kvIncrement(kv, `${p}:events:${event.event}:count`),
      kvIncrement(kv, `${p}:events:total`),
    ]);

    if (event.messageCount !== undefined) {
      await kvIncrement(kv, `${p}:messages`, event.messageCount);
    }
    if (event.inputTokens !== undefined) {
      await kvIncrement(kv, `${p}:tokens:in`, event.inputTokens);
      if (event.outputTokens !== undefined) {
        await kvIncrement(kv, `${p}:tokens:out`, event.outputTokens);
      }
    }
    await kvIncrement(kv, `${p}:duration_ms`, event.durationMs);

    if (!event.success) {
      const code = event.errorCode ?? "unknown";
      await Promise.all([
        kvIncrement(kv, `${p}:errors:${code}`),
        kvIncrement(kv, `${p}:errors:total`),
      ]);
    }
  } catch {
    // Telemetry never throws — it's transparently non-blocking
  }
}

export async function readDailyStats(
  kv: KVNamespace,
  day?: string,
): Promise<Record<string, unknown>> {
  const d = day ?? new Date().toISOString().slice(0, 10);
  const p = `telemetry:v${TELEMETRY_VERSION}:${d}`;

  const keys = [
    `${p}:events:total`,
    `${p}:events:compress:count`,
    `${p}:events:score:count`,
    `${p}:events:rewrite:count`,
    `${p}:messages`,
    `${p}:tokens:in`,
    `${p}:tokens:out`,
    `${p}:duration_ms`,
    `${p}:errors:total`,
  ];

  const entries = await Promise.all(keys.map(async (k) => {
    const v = await kv.get(k);
    return [k.replace(`${p}:`, ""), v ? parseInt(v, 10) : 0] as const;
  }));

  return {
    date: d,
    telemetry_version: TELEMETRY_VERSION,
    ...Object.fromEntries(entries),
  };
}

export function telemetryDisclosure(): Record<string, unknown> {
  return {
    policy: "Always-on research telemetry for the free hosted API. Self-hosters get zero telemetry.",
    collected: [
      "Event type (compress | score | rewrite)",
      "Agent type (coder | researcher | reviewer | orchestrator)",
      "Message count per request",
      "Token counts (input / output)",
      "Request duration (ms)",
      "Success / failure + error type on failure",
      "Timestamp at day granularity (YYYY-MM-DD)",
    ],
    not_collected: [
      "Message content, file paths, code snippets",
      "IP addresses, user agents, cookies",
      "Session IDs, user identifiers, browser fingerprints",
      "Referrers, origin URLs, device info",
    ],
    storage: "Cloudflare KV, 90-day TTL auto-expiry",
    opt_out: "Self-host the Worker — no KOMPRESS_STATS binding means zero telemetry",
    source: "https://github.com/peterlodri-sec/kompress-ultra/blob/main/server/telemetry.ts",
    version: TELEMETRY_VERSION,
  };
}
