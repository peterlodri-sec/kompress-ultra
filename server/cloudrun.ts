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

import { Hono } from "hono";
import { cors } from "hono/cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { z } from "zod";
import {
  scoreMessageSync,
  isProtected,
  compressMessage,
  CompressionLevel,
  classifyMessage,
  enqueueCirculator,
  estimateTokens,
  getBudget,
  totalTokens,
  isCircuitOpen,
  getCircuitState,
} from "../src/index.js";
import type { Message, AgentType } from "../src/types.js";
import { handleBrainRequest, loadBrain } from "./brain-grpc.js";

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
  private db?: any;
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
      this.db = new Firestore({
        projectId: process.env.GCP_PROJECT_ID,
      });
    } catch (err) {
      console.error("Firestore init failed:", err);
      this.enabled = false;
    }
  }

  async record(data: TelemetryEvent): Promise<void> {
    if (!this.enabled) return;

    const day = new Date().toISOString().slice(0, 10);
    const docRef = this.db?.doc(`telemetry/${day}`);

    try {
      await docRef?.set(
        {
          [`counts.${data.event}`]: this.db!.FieldValue.increment(1),
          [`duration_ms`]: this.db!.FieldValue.increment(data.durationMs),
          [`tokens_in`]: this.db!.FieldValue.increment(data.inputTokens ?? 0),
          [`tokens_out`]: this.db!.FieldValue.increment(data.outputTokens ?? 0),
          [`events_total`]: this.db!.FieldValue.increment(1),
          updated: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Telemetry write failed:", err);
    }
  }

  async getDailyStats(day: string): Promise<Record<string, any>> {
    if (!this.enabled) {
      return { error: "telemetry disabled" };
    }

    try {
      const doc = await this.db?.doc(`telemetry/${day}`).get();
      if (!doc?.exists) {
        return { "events:total": 0, "duration_ms": 0, "tokens:in": 0, "tokens:out": 0 };
      }
      const data = doc.data()!;
      return {
        "events:total": data.events_total ?? 0,
        "events:compress": data.counts?.compress ?? 0,
        "events:score": data.counts?.score ?? 0,
        "events:rewrite": data.counts?.rewrite ?? 0,
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
const VERSION = "14.0.0";
const TELEMETRY_URL = "https://github.com/peterlodri-sec/kompress-ultra/blob/main/TELEMETRY.md";

// ── Hono App ─────────────────────────────────────────────────────────

const app = new Hono();

// CORS for all routes
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// Auth middleware (optional)
const requireAuth = async (c: any, next: any) => {
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

function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "kompress-ultra", version: VERSION });

  server.registerTool(
    "compress",
    {
      description: "Compress a conversation using the 4-role pipeline: score, rewrite, prune, circulate.",
      inputSchema: {
        messages: z.array(z.object({
          role: z.string(),
          content: z.string(),
        })),
        agent_type: z.enum(["coder", "researcher", "reviewer", "orchestrator"]).default("coder"),
        aggression: z.number().min(0).max(1).optional(),
      },
    },
    ({ messages, agent_type, aggression }) => {
      const budget = getBudget(agent_type);
      const threshold = aggression ?? budget.compression_aggressiveness;

      const scored = messages.map((m, i) => {
        const msg: Message = { role: m.role, content: m.content };
        const score = scoreMessageSync(msg, i, messages.length);
        const protected_ = isProtected(msg, i, messages.length);
        return { ...m, score: score.total, protected: protected_ };
      });

      const kept = scored.filter((m) => m.protected || m.score >= threshold);
      const dropped = scored.filter((m) => !m.protected && m.score < threshold);

      for (const m of dropped) {
        enqueueCirculator({
          content: m.content,
          classification: classifyMessage(m.content),
          score: m.score,
        });
      }

      const inputTokens = totalTokens(messages.map((m) => ({ role: m.role, content: m.content })));
      const outputTokens = totalTokens(kept.map((m) => ({ role: m.role, content: m.content })));
      const savings = inputTokens > 0 ? ((1 - outputTokens / inputTokens) * 100).toFixed(1) : "0";

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            messages: kept.map((m) => ({
              role: m.role,
              content: m.content,
              score: m.score,
              protected: m.protected,
            })),
            stats: {
              input_count: messages.length,
              output_count: kept.length,
              dropped_count: dropped.length,
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              savings_pct: parseFloat(savings),
              agent_type,
              threshold,
            },
          }, null, 2),
        }],
      };
    },
  );

  server.registerTool(
    "score",
    {
      description: "Score messages for importance using structural analysis, Ebbinghaus decay, and position weighting.",
      inputSchema: {
        messages: z.array(z.object({
          role: z.string(),
          content: z.string(),
        })),
      },
    },
    ({ messages }) => {
      const results = messages.map((m, i) => {
        const msg: Message = { role: m.role, content: m.content };
        const score = scoreMessageSync(msg, i, messages.length);
        return {
          role: m.role,
          content_preview: m.content.slice(0, 80) + (m.content.length > 80 ? "..." : ""),
          score: score.total,
          protected: isProtected(msg, i, messages.length),
          tokens: estimateTokens(m.content),
        };
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
      };
    },
  );

  server.registerTool(
    "rewrite",
    {
      description: "Rewrite/compress a single message. Levels: verbatim (no change), lite (filler removal), ultra (aggressive).",
      inputSchema: {
        content: z.string(),
        level: z.enum(["verbatim", "lite", "ultra"]).default("lite"),
      },
    },
    ({ content, level }) => {
      const levelMap: Record<string, CompressionLevel> = {
        verbatim: CompressionLevel.Verbatim,
        lite: CompressionLevel.Lite,
        ultra: CompressionLevel.Ultra,
      };
      const rewritten = compressMessage(content, levelMap[level] ?? CompressionLevel.Lite);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            original: content,
            rewritten,
            level,
            original_tokens: estimateTokens(content),
            rewritten_tokens: estimateTokens(rewritten),
            savings_pct: parseFloat(
              ((1 - estimateTokens(rewritten) / Math.max(estimateTokens(content), 1)) * 100).toFixed(1),
            ),
          }, null, 2),
        }],
      };
    },
  );

  server.registerTool(
    "budget",
    {
      description: "Get the token budget configuration for a specific agent type.",
      inputSchema: {
        agent_type: z.enum(["coder", "researcher", "reviewer", "orchestrator"]),
      },
    },
    ({ agent_type }) => {
      const budget = getBudget(agent_type);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(budget, null, 2) }],
      };
    },
  );

  server.registerTool(
    "circuit",
    {
      description: "Check the compression circuit breaker state.",
      inputSchema: {},
    },
    () => ({
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          open: isCircuitOpen(),
          ...getCircuitState(),
        }, null, 2),
      }],
    }),
  );

  server.registerTool(
    "telemetry",
    {
      description: "Get telemetry disclosure — what data is collected, what is not, and how to opt out.",
      inputSchema: {},
    },
    () => ({
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          status: process.env.GCP_PROJECT_ID ? "enabled" : "disabled",
          collects: ["event_type", "agent_type", "token_counts", "duration_ms", "day_granular_timestamp"],
          never_collects: ["message_content", "file_paths", "code", "ip_addresses", "user_identifiers"],
          storage: "Firestore (GCP)",
          opt_out: "Self-host without GCP_PROJECT_ID env var",
          disclosure_url: TELEMETRY_URL,
        }, null, 2),
      }],
    }),
  );

  return server;
}

// ── REST Endpoints ───────────────────────────────────────────────────

app.post("/v1/compress", requireAuth, async (c) => {
  const t0 = performance.now();
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return c.json({ error: "messages array required" }, 400);
  }

  const agentType = (body.agent_type ?? "coder") as AgentType;
  const budget = getBudget(agentType);
  const threshold = body.aggression ?? budget.compression_aggressiveness;

  try {
    const scored = body.messages.map((m: Message, i: number) => {
      const score = scoreMessageSync(m, i, body.messages.length);
      const protected_ = isProtected(m, i, body.messages.length);
      return { ...m, _score: score.total, _protected: protected_ };
    });

    const kept = scored.filter((m: any) => m._protected || m._score >= threshold);
    const dropped = scored.filter((m: any) => !m._protected && m._score < threshold);

    const inputTokens = totalTokens(body.messages);
    const outputTokens = totalTokens(kept.map((m: any) => ({ role: m.role, content: m.content })));
    const durationMs = Math.round(performance.now() - t0);

    await telemetry.record({
      event: "compress",
      agentType,
      messageCount: body.messages.length,
      inputTokens,
      outputTokens,
      durationMs,
      success: true,
    });

    return c.json({
      messages: kept.map((m: any) => ({
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
        savings_pct: inputTokens > 0
          ? parseFloat(((1 - outputTokens / inputTokens) * 100).toFixed(1))
          : 0,
      },
    });
  } catch (err) {
    await telemetry.record({
      event: "compress",
      agentType,
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
    return c.json({ error: "invalid JSON" }, 400);
  }

  if (!Array.isArray(body.messages)) {
    return c.json({ error: "messages array required" }, 400);
  }

  try {
    const results = body.messages.map((m: Message, i: number) => ({
      role: m.role,
      score: scoreMessageSync(m, i, body.messages.length),
      protected: isProtected(m, i, body.messages.length),
      tokens: estimateTokens(m.content),
    }));

    await telemetry.record({
      event: "score",
      messageCount: body.messages.length,
      durationMs: Math.round(performance.now() - t0),
      success: true,
    });

    return c.json(results);
  } catch (err) {
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
    return c.json({ error: "invalid JSON" }, 400);
  }

  if (!body.content) {
    return c.json({ error: "content required" }, 400);
  }

  try {
    const levelMap: Record<string, CompressionLevel> = {
      verbatim: CompressionLevel.Verbatim,
      lite: CompressionLevel.Lite,
      ultra: CompressionLevel.Ultra,
    };
    const level = levelMap[body.level ?? "lite"] ?? CompressionLevel.Lite;
    const rewritten = compressMessage(body.content, level);

    await telemetry.record({
      event: "rewrite",
      compressionLevel: body.level ?? "lite",
      inputTokens: estimateTokens(body.content),
      outputTokens: estimateTokens(rewritten),
      durationMs: Math.round(performance.now() - t0),
      success: true,
    });

    return c.json({
      original: body.content,
      rewritten,
      level: body.level ?? "lite",
      original_tokens: estimateTokens(body.content),
      rewritten_tokens: estimateTokens(rewritten),
      savings_pct: parseFloat(
        ((1 - estimateTokens(rewritten) / Math.max(estimateTokens(body.content), 1)) * 100).toFixed(1),
      ),
    });
  } catch (err) {
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
  return c.json({
    status: "ok",
    version: VERSION,
    telemetry: process.env.GCP_PROJECT_ID ? "on" : "off",
    circuit_breaker: { open: isCircuitOpen(), ...getCircuitState() },
    timestamp: new Date().toISOString(),
  });
});

app.get("/v1/status", (c) => {
  return c.json({
    status: "live",
    version: VERSION,
    timestamp: new Date().toISOString(),
  });
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
  const type = (c.req.query("type") ?? "coder") as AgentType;
  return c.json(getBudget(type));
});

app.get("/v1/badge.js", (c) => {
  c.header("Content-Type", "application/javascript");
  c.header("Cache-Control", "no-cache");
  return c.body(`(function(){
  var API=location.protocol+'//'+location.host;
  var c=document.getElementById('api-status-badge');
  if(!c){
    c=document.createElement('div');
    c.id='api-status-badge';
    c.style.cssText='display:inline-flex;align-items:center;gap:8px;background:#080c14;border:1px solid #1e293b;border-radius:8px;padding:6px 14px 6px 10px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:12px;transition:border-color .3s';
    var nav=document.querySelector('header .flex.items-center.gap-3');
    if(nav)nav.parentNode.insertBefore(c,nav);
    else document.querySelector('header .flex.justify-between')?.appendChild(c);
  }
  c.innerHTML='<span id="api-status-dot" style="width:8px;height:8px;border-radius:50%;background:#64748b;display:inline-block;flex-shrink:0"></span><span><span style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.5px">API</span><span id="api-status-text" style="color:#94a3b8;font-weight:600;margin-left:4px">checking…</span></span>';
  var d=document.getElementById('api-status-dot'),t=document.getElementById('api-status-text');
  fetch(API+'/v1/status',{signal:AbortSignal.timeout(5000)}).then(function(r){if(!r.ok)throw Error(r.status);return r.json()}).then(function(data){
    if(data.status==='live'){d.style.background='#00e660';d.style.boxShadow='0 0 8px #00e660';t.textContent='live';t.style.color='#00e660'}else throw Error('down')
  }).catch(function(){
    d.style.background='#ef4444';d.style.boxShadow='0 0 8px #ef4444';t.textContent='offline';t.style.color='#ef4444'
  });
})()`);
});

app.get("/v1/telemetry.js", (c) => {
  c.header("Content-Type", "application/javascript");
  c.header("Cache-Control", "no-cache");
  return c.body(`(function(){
  var API=location.protocol+'//'+location.host;
  var sec=document.getElementById('telemetry');
  if(!sec)return;
  sec.innerHTML='<div class="gradient-border"><div class="p-8 bg-slate-955/40 rounded-[15px] space-y-6"><div class="flex items-center gap-3 mb-2"><i aria-hidden="true" class="w-5 h-5 text-brand-cyan" data-lucide="activity"></i><h2 class="text-2xl font-bold text-white font-title">Ralph-Loop Telemetry</h2></div><p class="text-sm text-slate-400 leading-relaxed max-w-3xl">Live feed of API usage and compression metrics.</p><div id="telemetry-grid" class="grid grid-cols-2 md:grid-cols-5 gap-4"><div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 text-center"><span class="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Status</span><div class="flex items-center justify-center gap-2"><span id="tel-loop-dot" class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span><span id="tel-loop-status" class="text-lg font-bold text-emerald-400 font-mono">Active</span></div></div><div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 text-center"><span class="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Events Today</span><span id="tel-slices" class="text-xl font-bold text-white font-mono block">—</span></div><div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 text-center"><span class="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Avg Latency</span><span id="tel-latency" class="text-xl font-bold text-brand-cyan font-mono block">—</span></div><div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 text-center"><span class="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Token Savings</span><span id="tel-savings" class="text-xl font-bold text-brand-cyan font-mono block">—</span></div></div><p id="tel-timestamp" class="text-xs text-slate-600">Last updated: —</p></div></div>';
  var el=function(id){return document.getElementById(id)};
  Promise.all([
    fetch(API+'/v1/status',{signal:AbortSignal.timeout(5000)}).catch(function(){return null}),
    fetch(API+'/v1/stats',{signal:AbortSignal.timeout(5000)}).catch(function(){return null})
  ]).then(function(responses){
    var statusRes=responses[0],statsRes=responses[1];
    if(statusRes&&statusRes.ok){
      statusRes.json().then(function(data){
        if(data.status==='live'){el('tel-loop-dot').style.background='#00e660';el('tel-loop-status').textContent='Active';el('tel-loop-status').style.color='#00e660'}
        else{el('tel-loop-dot').style.background='#ef4444';el('tel-loop-status').textContent='Offline';el('tel-loop-status').style.color='#ef4444'}
      }).catch(function(){});
    }
    if(statsRes&&statsRes.ok){
      statsRes.json().then(function(stats){
        var totalEvents=stats['events:total']||0,totalMs=stats['duration_ms']||0,tokensIn=stats['tokens:in']||0,tokensOut=stats['tokens:out']||0;
        if(totalEvents>0){el('tel-slices').textContent=totalEvents.toLocaleString();if(totalMs>0)el('tel-latency').textContent=(totalMs/totalEvents).toFixed(1)+' ms';if(tokensIn>0&&tokensOut>0)el('tel-savings').textContent=((1-tokensOut/tokensIn)*100).toFixed(1)+'%'}
      }).catch(function(){});
    }
    el('tel-timestamp').textContent='Last updated: '+new Date().toLocaleString();
  }).catch(function(){if(el('tel-loop-dot')){el('tel-loop-dot').style.background='#ef4444';el('tel-loop-status').textContent='Offline';el('tel-loop-status').style.color='#ef4444'}if(el('tel-timestamp'))el('tel-timestamp').textContent='Telemetry unavailable'});
})()`);
});

// MCP endpoint
app.post("/mcp", async (c) => {
  const mcpHandler = createMcpHandler(buildMcpServer());
  return mcpHandler(c.req.raw as any, { GCP_PROJECT_ID: process.env.GCP_PROJECT_ID } as any, {} as any);
});

// Brain gRPC API
app.get("/v1/brain/*", async (c) => {
  return handleBrainRequest(c.req.raw as any);
});

// Root
app.get("/", (c) => {
  return c.json({
    name: "kompress-ultra API",
    version: VERSION,
    runtime: "Cloud Run (GCP)",
    mcp: "POST /mcp",
    rest: {
      compress: "POST /v1/compress",
      score: "POST /v1/score",
      rewrite: "POST /v1/rewrite",
      health: "GET /v1/health",
      status: "GET /v1/status",
      budget: "GET /v1/budget?type=coder|researcher|reviewer|orchestrator",
      badge: "GET /v1/badge.js",
      telemetry_js: "GET /v1/telemetry.js",
      telemetry: "GET /v1/telemetry",
      stats: "GET /v1/stats",
    },
    docs: "https://github.com/peterlodri-sec/kompress-ultra#readme",
    telemetry: TELEMETRY_URL,
  });
});

// ── Server ───────────────────────────────────────────────────────────

export default {
  port: process.env.PORT ?? 8080,
  fetch: app.fetch,
};

console.log(`kompress-ultra API v${VERSION} starting on port ${process.env.PORT ?? 8080}...`);
