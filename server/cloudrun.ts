/**
 * kompress-ultra API Server — GCP Cloud Run
 *
 * Adapts the Cloudflare Worker for standard Node.js/Bun runtime.
 * Uses Hono for lightweight HTTP routing (compatible with Bun).
 *
 * Endpoints:
 *   POST /mcp          — MCP server
 *   POST /v1/compress  — compress conversation
 *   POST /v1/score     — score messages
 *   POST /v1/rewrite   — rewrite message
 *   GET  /v1/health    — liveness + circuit breaker
 *   GET  /v1/status    — lightweight live/offline
 *   GET  /v1/telemetry — telemetry disclosure
 *   GET  /v1/stats     — daily aggregate stats
 *   GET  /v1/budget    — token budgets
 *   GET  /v1/badge.js  — status badge script
 *   GET  /v1/telemetry.js — telemetry widget script
 *
 * Telemetry: Zero-PII, stored in Firestore or Redis (configurable).
 * See TELEMETRY.md for disclosure.
 */

import { Hono, Context, MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { createMcpHandler } from "agents/mcp";
import type { Message, AgentType } from "../src/types.js";
import { buildMcpServer } from "./shared-mcp.js";
import {
  processCompress,
  processScore,
  processRewrite,
  computeSavingsPct,
  buildHealthResponse,
  buildStatusResponse,
  buildBudgetResponse,
  buildRootResponse,
} from "./shared-routes.js";
import { handleBrainRequest, loadBrain } from "./brain-grpc.js";
import { version, telemetryUrl, buildBadgeJs, buildTelemetryJs } from "./landing-page.js";

// ── GCP Telemetry Adapter ────────────────────────────────────────────
// Uses Firestore for persistent storage, falls back to memory if unconfigured

interface TelemetryEvent {
  event: "compress" | "score" | "rewrite";
  agentType?: string;
  messageCount?: number;
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
  success: boolean;
  errorCode?: string;
  compressionLevel?: string;
  timestamp?: string;
}

class GcpTelemetry {
  private db?: unknown;
  private enabled: boolean;

  constructor() {
    this.enabled = !!process.env.GCP_PROJECT_ID;
    if (this.enabled) {
      this.initFirestore();
    }
  }

  private async initFirestore() {
    try {
      const firestorePkg = "@google-cloud/firestore";
      const { Firestore } = await import(firestorePkg);
      this.db = Firestore as unknown;
      this.enabled = true;
    } catch (err) {
      console.error("Firestore init failed:", err);
      this.enabled = false;
    }
  }

  async record(data: TelemetryEvent): Promise<void> {
    if (!this.enabled) return;

    const day = new Date().toISOString().slice(0, 10);
    const db = this.db as { doc: (path: string) => { set: (data: Record<string, unknown>, opts: { merge: boolean }) => Promise<void> } };
    const docRef = db?.doc(`telemetry/${day}`);

    try {
      await docRef?.set(
        {
          [`counts.${data.event}`]: (db as any).FieldValue.increment(1),
          [`duration_ms`]: (db as any).FieldValue.increment(data.durationMs),
          [`tokens_in`]: (db as any).FieldValue.increment(data.inputTokens ?? 0),
          [`tokens_out`]: (db as any).FieldValue.increment(data.outputTokens ?? 0),
          [`events_total`]: (db as any).FieldValue.increment(1),
          updated: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Telemetry write failed:", err);
    }
  }

  async getDailyStats(day: string): Promise<Record<string, unknown>> {
    if (!this.enabled) {
      return { error: "telemetry disabled" };
    }

    try {
      const db = this.db as { doc: (path: string) => { get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> }> } };
      const doc = await db?.doc(`telemetry/${day}`).get();
      if (!doc?.exists) {
        return { "events:total": 0, "duration_ms": 0, "tokens:in": 0, "tokens:out": 0 };
      }
      const data = doc.data();
      const counts = data.counts as Record<string, number> | undefined;
      return {
        "events:total": data.events_total ?? 0,
        "events:compress": counts?.compress ?? 0,
        "events:score": counts?.score ?? 0,
        "events:rewrite": counts?.rewrite ?? 0,
        "duration_ms": data.duration_ms ?? 0,
        "tokens:in": data.tokens_in ?? 0,
        "tokens:out": data.tokens_out ?? 0,
        updated: data.updated,
      };
    } catch (err) {
      console.error("Telemetry read failed:", err);
      return { error: "read failed" };
    }
  }
}

const telemetry = new GcpTelemetry();
const VERSION = version();
const TELEMETRY_URL = telemetryUrl();

// ── Hono App ─────────────────────────────────────────────────────────

const app = new Hono();

// CORS for all routes
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// Auth middleware (optional)
const requireAuth: MiddlewareHandler = async (c, next) => {
  const token = process.env.AUTH_TOKEN;
  if (!token) return next(); // No token = open access

  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const provided = authHeader.slice(7);
  // Constant-time comparison
  if (provided.length !== token.length) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  let mismatch = 0;
  for (let i = 0; i < provided.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ token.charCodeAt(i);
  }
  if (mismatch !== 0) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
};

// ── MCP Handler ──────────────────────────────────────────────────────

function buildMcpServerForCR(): ReturnType<typeof buildMcpServer> {
  return buildMcpServer(VERSION, () => ({
    status: process.env.GCP_PROJECT_ID ? "enabled" : "disabled",
    collects: ["event_type", "agent_type", "token_counts", "duration_ms", "day_granular_timestamp"],
    never_collects: ["message_content", "file_paths", "code", "ip_addresses", "user_identifiers"],
    storage: "Firestore (GCP)",
    opt_out: "Self-host without GCP_PROJECT_ID env var",
    disclosure_url: TELEMETRY_URL,
  }));
}

// ── REST Endpoints ───────────────────────────────────────────────────

app.post("/v1/compress", requireAuth, async (c) => {
  const t0 = performance.now();
  let body;
  try {
    body = await c.req.json();
  } catch {
    /* invalid JSON body */
    return c.json({ error: "invalid JSON" }, 400);
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return c.json({ error: "messages array required" }, 400);
  }

  try {
    const { kept, dropped, inputTokens, outputTokens } = processCompress(
      body.messages,
      body.agent_type,
      body.aggression,
    );
    const durationMs = Math.round(performance.now() - t0);

    await telemetry.record({
      event: "compress",
      agentType: body.agent_type ?? "coder",
      messageCount: body.messages.length,
      inputTokens,
      outputTokens,
      durationMs,
      success: true,
    });

    return c.json({
      messages: kept.map((m) => ({
        role: m.role,
        content: m.content,
        score: m._score,
        protected: m._protected,
      })),
      dropped_count: dropped.length,
      stats: {
        input_count: body.messages.length,
        output_count: kept.length,
        dropped_count: dropped.length,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        savings_pct: computeSavingsPct(inputTokens, outputTokens),
      },
    });
  } catch (err) {
    /* compression failed — record telemetry and return 500 */
    await telemetry.record({
      event: "compress",
      agentType: body.agent_type ?? "coder",
      durationMs: Math.round(performance.now() - t0),
      success: false,
      errorCode: err instanceof Error ? err.name : "unknown",
    });
    return c.json({ error: "compression failed", details: String(err) }, 500);
  }
});

app.post("/v1/score", requireAuth, async (c) => {
  const t0 = performance.now();
  let body;
  try {
    body = await c.req.json();
  } catch {
    /* invalid JSON body */
    return c.json({ error: "invalid JSON" }, 400);
  }

  if (!Array.isArray(body.messages)) {
    return c.json({ error: "messages array required" }, 400);
  }

  try {
    const results = processScore(body.messages);
    const durationMs = Math.round(performance.now() - t0);

    await telemetry.record({
      event: "score",
      messageCount: body.messages.length,
      durationMs,
      success: true,
    });

    return c.json(results);
  } catch (err) {
    /* scoring failed — record telemetry and return 500 */
    await telemetry.record({
      event: "score",
      durationMs: Math.round(performance.now() - t0),
      success: false,
      errorCode: err instanceof Error ? err.name : "unknown",
    });
    return c.json({ error: "scoring failed" }, 500);
  }
});

app.post("/v1/rewrite", requireAuth, async (c) => {
  const t0 = performance.now();
  let body;
  try {
    body = await c.req.json();
  } catch {
    /* invalid JSON body */
    return c.json({ error: "invalid JSON" }, 400);
  }

  if (!body.content) {
    return c.json({ error: "content required" }, 400);
  }

  try {
    const { rewritten, level, originalTokens, rewrittenTokens, savingsPct } = processRewrite(
      body.content,
      body.level,
    );
    const durationMs = Math.round(performance.now() - t0);

    await telemetry.record({
      event: "rewrite",
      compressionLevel: level,
      inputTokens: originalTokens,
      outputTokens: rewrittenTokens,
      durationMs,
      success: true,
    });

    return c.json({
      original: body.content,
      rewritten,
      level,
      original_tokens: originalTokens,
      rewritten_tokens: rewrittenTokens,
      savings_pct: savingsPct,
    });
  } catch (err) {
    /* rewrite failed — record telemetry and return 500 */
    await telemetry.record({
      event: "rewrite",
      durationMs: Math.round(performance.now() - t0),
      success: false,
      errorCode: err instanceof Error ? err.name : "unknown",
    });
    return c.json({ error: "rewrite failed" }, 500);
  }
});

app.get("/v1/health", (c) => {
  return c.json(buildHealthResponse(VERSION, !!process.env.GCP_PROJECT_ID));
});

app.get("/v1/status", (c) => {
  return c.json(buildStatusResponse(VERSION));
});

app.get("/v1/telemetry", (c) => {
  return c.json({
    status: process.env.GCP_PROJECT_ID ? "enabled" : "disabled",
    collects: ["event_type", "agent_type", "token_counts", "duration_ms", "day_granular_timestamp"],
    never_collects: ["message_content", "file_paths", "code", "ip_addresses", "user_identifiers"],
    storage: "Firestore (GCP)",
    opt_out: "Self-host without GCP_PROJECT_ID env var",
    disclosure_url: TELEMETRY_URL,
  });
});

app.get("/v1/stats", async (c) => {
  const day = c.req.query("day") ?? new Date().toISOString().slice(0, 10);
  const stats = await telemetry.getDailyStats(day);
  return c.json(stats);
});

app.get("/v1/budget", (c) => {
  return c.json(buildBudgetResponse(c.req.query("type") ?? undefined));
});

app.get("/v1/badge.js", (c) => {
  c.header("Content-Type", "application/javascript");
  c.header("Cache-Control", "no-cache");
  return c.body(buildBadgeJs());
});

app.get("/v1/telemetry.js", (c) => {
  c.header("Content-Type", "application/javascript");
  c.header("Cache-Control", "no-cache");
  return c.body(buildTelemetryJs());
});

// MCP endpoint
app.post("/mcp", async (c) => {
  const mcpHandler = createMcpHandler(buildMcpServerForCR());
  // MCP SDK expects Cloudflare Env — cast to satisfy type
  return mcpHandler(c.req.raw as Request, { GCP_PROJECT_ID: process.env.GCP_PROJECT_ID } as unknown as Record<string, unknown>, {} as unknown as ExecutionContext);
});

// Brain gRPC API
app.get("/v1/brain/*", async (c) => {
  return handleBrainRequest(c.req.raw as Request);
});

// Root
app.get("/", (c) => {
  return c.json(buildRootResponse(VERSION, TELEMETRY_URL, "Cloud Run (GCP)"));
});

// ── Server ───────────────────────────────────────────────────────────

export default {
  port: process.env.PORT ?? 8080,
  fetch: app.fetch,
};

console.log(`kompress-ultra API v${VERSION} starting on port ${process.env.PORT ?? 8080}...`);
