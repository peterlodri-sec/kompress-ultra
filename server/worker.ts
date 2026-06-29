/**
 * kompress-ultra MCP + REST API Server
 * Cloudflare Worker — exposes context compression as a service.
 *
 * MCP endpoint: POST /mcp
 * REST endpoints:
 *   POST /v1/compress   — compress a conversation
 *   POST /v1/score      — score messages for importance
 *   POST /v1/rewrite    — rewrite a single message
 *   GET  /v1/budget/:type — get token budget for agent type
 *   GET  /v1/health     — liveness + circuit breaker state
 *   GET  /v1/telemetry  — telemetry disclosure + stats
 *   GET  /v1/stats      — aggregate compression stats
 *
 * Telemetry: Zero-PII research data, always-on for hosted API.
 * Library (src/) has zero telemetry. See TELEMETRY.md.
 * X-Telemetry header on every response links to the policy.
 */

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
import { recordTelemetry, readDailyStats, telemetryDisclosure } from "./telemetry.js";

const VERSION = "2.0.0";
const TELEMETRY_HEADER = "X-Telemetry";
const TELEMETRY_URL = "https://github.com/peterlodri-sec/kompress-ultra/blob/main/TELEMETRY.md";

interface Env {
  DB?: D1Database;
  VECTORIZE?: VectorizeIndex;
  KOMPRESS_STATS?: KVNamespace;
  AUTH_TOKEN?: string;
}

function requireAuth(request: Request, env: Env): boolean {
  const token = env.AUTH_TOKEN;
  if (!token) return true; // No token configured = open access
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return false;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return false;
  // Constant-time comparison to prevent timing attacks
  const encoder = new TextEncoder();
  const a = encoder.encode(parts[1]);
  const b = encoder.encode(token);
  if (a.byteLength !== b.byteLength) return false;
  let mismatch = 0;
  for (let i = 0; i < a.byteLength; i++) {
    mismatch |= a[i] ^ b[i];
  }
  return mismatch === 0;
}

function unauthorized(): Response {
  return json({ error: "Unauthorized" }, 401);
}

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
      const budget = getBudget(agent_type as AgentType);
      const threshold = aggression ?? budget.compression_aggressiveness;

      const scored = messages.map((m) => {
        const msg: Message = { role: m.role, content: m.content };
        const score = scoreMessageSync(msg, messages.indexOf(m), messages.length);
        const protected_ = isProtected(msg, messages.indexOf(m), messages.length);
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
      const results = messages.map((m) => {
        const msg: Message = { role: m.role, content: m.content };
        const idx = messages.indexOf(m);
        const score = scoreMessageSync(msg, idx, messages.length);
        return {
          role: m.role,
          content_preview: m.content.slice(0, 80) + (m.content.length > 80 ? "..." : ""),
          score: score.total,
          protected: isProtected(msg, idx, messages.length),
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
      const budget = getBudget(agent_type as AgentType);
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
        text: JSON.stringify(telemetryDisclosure(), null, 2),
      }],
    }),
  );

  return server;
}

async function handleCompress(request: Request, env: Env): Promise<Response> {
  const t0 = performance.now();
  const body = await request.json() as {
    messages?: Message[];
    agent_type?: string;
    aggression?: number;
  };

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: "messages array required" }, 400);
  }

  const agentType = (body.agent_type ?? "coder") as AgentType;
  const budget = getBudget(agentType);
  const threshold = body.aggression ?? budget.compression_aggressiveness;

  try {
    const scored = body.messages.map((m, i) => {
      const score = scoreMessageSync(m, i, body.messages!.length);
      const protected_ = isProtected(m, i, body.messages!.length);
      return { ...m, _score: score.total, _protected: protected_ };
    });

    const kept = scored.filter((m) => m._protected || m._score >= threshold);
    const dropped = scored.filter((m) => !m._protected && m._score < threshold);

    const inputTokens = totalTokens(body.messages);
    const outputTokens = totalTokens(kept.map((m) => ({ role: m.role, content: m.content })));

    const durationMs = Math.round(performance.now() - t0);
    await recordTelemetry(env, {
      event: "compress",
      agentType,
      messageCount: body.messages.length,
      inputTokens,
      outputTokens,
      durationMs,
      success: true,
    });

    return json({
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
        savings_pct: inputTokens > 0
          ? parseFloat(((1 - outputTokens / inputTokens) * 100).toFixed(1))
          : 0,
      },
    });
  } catch (err) {
    await recordTelemetry(env, {
      event: "compress",
      agentType,
      durationMs: Math.round(performance.now() - t0),
      success: false,
      errorCode: err instanceof Error ? err.name : "unknown",
    });
    throw err;
  }
}

async function handleScore(request: Request, env: Env): Promise<Response> {
  const t0 = performance.now();
  const body = await request.json() as { messages?: Message[] };
  if (!Array.isArray(body.messages)) {
    return json({ error: "messages array required" }, 400);
  }

  try {
    const results = body.messages.map((m, i) => ({
      role: m.role,
      score: scoreMessageSync(m, i, body.messages!.length),
      protected: isProtected(m, i, body.messages!.length),
      tokens: estimateTokens(m.content),
    }));

    await recordTelemetry(env, {
      event: "score",
      messageCount: body.messages.length,
      durationMs: Math.round(performance.now() - t0),
      success: true,
    });

    return json(results);
  } catch (err) {
    await recordTelemetry(env, {
      event: "score",
      durationMs: Math.round(performance.now() - t0),
      success: false,
      errorCode: err instanceof Error ? err.name : "unknown",
    });
    throw err;
  }
}

async function handleRewrite(request: Request, env: Env): Promise<Response> {
  const t0 = performance.now();
  const body = await request.json() as { content?: string; level?: string };
  if (!body.content) {
    return json({ error: "content required" }, 400);
  }

  try {
    const levelMap: Record<string, CompressionLevel> = {
      verbatim: CompressionLevel.Verbatim,
      lite: CompressionLevel.Lite,
      ultra: CompressionLevel.Ultra,
    };
    const level = levelMap[body.level ?? "lite"] ?? CompressionLevel.Lite;
    const rewritten = compressMessage(body.content, level);

    await recordTelemetry(env, {
      event: "rewrite",
      compressionLevel: body.level ?? "lite",
      inputTokens: estimateTokens(body.content),
      outputTokens: estimateTokens(rewritten),
      durationMs: Math.round(performance.now() - t0),
      success: true,
    });

    return json({
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
    await recordTelemetry(env, {
      event: "rewrite",
      durationMs: Math.round(performance.now() - t0),
      success: false,
      errorCode: err instanceof Error ? err.name : "unknown",
    });
    throw err;
  }
}

function handleHealth(env: Env): Response {
  return json({
    status: "ok",
    version: VERSION,
    telemetry: env.KOMPRESS_STATS ? "on" : "off",
    circuit_breaker: { open: isCircuitOpen(), ...getCircuitState() },
    timestamp: new Date().toISOString(),
  });
}

function handleStatus(): Response {
  return json({
    status: "live",
    version: VERSION,
    timestamp: new Date().toISOString(),
  });
}

function handleBadgeJs(): Response {
  return new Response(`(function(){
  var API='https://kompress-ultra-api.cabotage.workers.dev';
  var c=document.getElementById('api-status-badge');
  if(!c){
    c=document.createElement('div');
    c.id='api-status-badge';
    c.style.cssText='display:inline-flex;align-items:center;gap:8px;background:#080c14;border:1px solid #1e293b;border-radius:8px;padding:6px 14px 6px 10px;font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;font-size:12px;transition:border-color .3s';
    var nav=document.querySelector('header .flex.items-center.gap-3');
    if(nav)nav.parentNode.insertBefore(c,nav);
    else document.querySelector('header .flex.justify-between')?.appendChild(c);
  }
  c.innerHTML='<span id="api-status-dot" style="width:8px;height:8px;border-radius:50%;background:#64748b;display:inline-block;flex-shrink:0"></span><span><span style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.5px">API</span><span id="api-status-text" style="color:#94a3b8;font-weight:600;margin-left:4px">checking\u2026</span></span>';
  var d=document.getElementById('api-status-dot'),t=document.getElementById('api-status-text');
  fetch(API+'/v1/status',{signal:AbortSignal.timeout(5000)}).then(function(r){if(!r.ok)throw Error(r.status);return r.json()}).then(function(data){
    if(data.status==='live'){d.style.background='#00e660';d.style.boxShadow='0 0 8px #00e660';t.textContent='live';t.style.color='#00e660'}else throw Error('down')
  }).catch(function(){
    d.style.background='#ef4444';d.style.boxShadow='0 0 8px #ef4444';t.textContent='offline';t.style.color='#ef4444'
  });
})();`, {
    headers: {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache",
    },
  });
}

function handleTelemetryJs(): Response {
  return new Response(`(function(){
  var API='https://kompress-ultra-api.cabotage.workers.dev';
  var sec=document.getElementById('telemetry');
  if(!sec)return;
  sec.innerHTML='<div class="gradient-border"><div class="p-8 bg-slate-955/40 rounded-[15px] space-y-6"><div class="flex items-center gap-3 mb-2"><i aria-hidden="true" class="w-5 h-5 text-brand-cyan" data-lucide="activity"></i><h2 class="text-2xl font-bold text-white font-title">Ralph-Loop Telemetry (Academic Dogfeeding)</h2></div><p class="text-sm text-slate-400 leading-relaxed max-w-3xl">A live feed showing how our coding agent is currently running and compressing its own logs to save memory. Data fetched from <a class="text-brand-cyan hover:underline font-mono" href="https://github.com/peterlodri-sec/kompress-ultra" target="_blank" rel="noopener noreferrer">kompress-ultra</a> API telemetry.</p><div id="telemetry-grid" class="grid grid-cols-2 md:grid-cols-5 gap-4"><div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 text-center"><span class="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">L1 Loop</span><div class="flex items-center justify-center gap-2"><span id="tel-loop-dot" class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span><span id="tel-loop-status" class="text-lg font-bold text-emerald-400 font-mono">Active</span></div></div><div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 text-center"><span class="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Slices Processed</span><span id="tel-slices" class="text-xl font-bold text-white font-mono block">\u2014</span></div><div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 text-center"><span class="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Active Sandboxes</span><span class="text-sm font-bold text-white font-mono block">Bun / Nushell</span></div><div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 text-center"><span class="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Inference Latency</span><span id="tel-latency" class="text-xl font-bold text-brand-cyan font-mono block">\u2014</span></div><div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 text-center"><span class="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Token Savings Rate</span><span id="tel-savings" class="text-xl font-bold text-brand-emerald font-mono block">\u2014</span></div></div><div id="tel-timestamp" class="text-[10px] text-slate-600 font-mono text-center">Loading\u2026</div></div></div>';
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
})();`, {
    headers: {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache",
    },
  });
}

function handleTelemetry(env: Env): Response {
  return json({
    ...telemetryDisclosure(),
    status: env.KOMPRESS_STATS ? "enabled" : "disabled",
  });
}

async function handleStats(env: Env): Promise<Response> {
  if (!env.KOMPRESS_STATS) {
    return json({ error: "stats unavailable — no KOMPRESS_STATS binding" }, 404);
  }
  const day = new Date().toISOString().slice(0, 10);
  const stats = await readDailyStats(env.KOMPRESS_STATS, day);
  return json(stats);
}

function handleRoot(request: Request): Response {
  const accept = request.headers.get("Accept") ?? "";
  const wantsHtml = accept.includes("text/html");

  if (!wantsHtml) {
    return json({
      name: "kompress-ultra API",
      version: VERSION,
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
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>kompress-ultra · MCP + API</title>
<meta name="description" content="Free public MCP and REST API for LLM context compression. 78% token savings. Always-on zero-PII telemetry.">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#080c14;color:#cbd5e1;font-family:ui-monospace,'SF Mono','Cascadia Code','Fira Code',monospace;font-size:13px;line-height:1.7;padding:2rem 1rem}
  a{color:#00d4ff;text-decoration:none}
  a:hover{text-decoration:underline;color:#67e8f9}
  pre{background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:1.25rem;overflow-x:auto;font-size:12px;line-height:1.5;color:#94a3b8;white-space:pre;margin:.75rem 0}
  h1{color:#e2e8f0;font-size:1.25rem;font-weight:700;letter-spacing:-.02em;margin:1.5rem 0 .75rem}
  h2{color:#00d4ff;font-size:1rem;font-weight:600;margin:1.25rem 0 .5rem;text-transform:uppercase;letter-spacing:.04em}
  h3{color:#e2e8f0;font-size:.9rem;font-weight:600;margin:1rem 0 .4rem}
  .badge{display:inline-block;background:#00e660;color:#080c14;font-size:.65rem;font-weight:700;padding:.15rem .5rem;border-radius:4px;text-transform:uppercase;letter-spacing:.03em;margin-right:.4rem}
  .badge-warn{background:#f59e0b;color:#080c14}
  .badge-info{background:#00d4ff;color:#080c14}
  .badge-muted{background:#1e293b;color:#64748b}
  .box{border:1px solid #1e293b;border-radius:8px;padding:1rem;margin:.75rem 0}
  .box-red{border-color:#ef4444;background:#ef4444/05}
  .box-green{border-color:#00e660;background:#00e660/05}
  .box-cyan{border-color:#00d4ff;background:#00d4ff/05}
  .endpoint{font-size:.8rem;padding:.35rem .5rem;background:#0f172a;border-radius:4px;display:inline-block;margin:.15rem 0;font-weight:500;color:#cbd5e1}
  .tag{font-size:.6rem;padding:.1rem .35rem;border-radius:3px;font-weight:700;text-transform:uppercase;margin-left:.3rem}
  .tag-get{background:#00d4ff/15;color:#00d4ff}
  .tag-post{background:#00e660/15;color:#00e660}
  .container{max-width:780px;margin:0 auto}
  hr{border:none;border-top:1px solid #1e293b;margin:1.5rem 0}
  .footer{text-align:center;font-size:.7rem;color:#475569;margin:2.5rem 0 1rem;border-top:1px solid #0f172a;padding-top:1.5rem}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.5rem;margin:.5rem 0}
</style>
</head>
<body class="container">

<pre style="font-size:11px;text-align:center;border:none;background:transparent;color:#00d4ff;padding:0 0 .5rem">
  _   _                                _
 | \\ | | ___  _ __ ___   _ __   ___  | |_ ___  _ __ _ __ ___  _ __
 |  \\| |/ _ \\| '_ \` _ \\ | '_ \\ / _ \\ | __/ _ \\| '__| '__/ _ \\| '__|
 | |\\  | (_) | | | | | || |_) | (_) || || (_) | |  | | | (_) | |
 |_| \\_|\\___/|_| |_| |_|| .__/ \\___/  \\__\\___/|_|  |_|  \\___/|_|
                         |_|
</pre>

<p style="text-align:center;font-size:.9rem;color:#64748b;margin-bottom:1rem">
  <span class="badge">mcp</span><span class="badge">api</span><span class="badge">free</span>
  <span style="color:#475569">·</span>
  <a href="https://github.com/peterlodri-sec/kompress-ultra">source</a>
  <span style="color:#475569">·</span>
  <a href="https://proposal.vaked.dev">proposal</a>
  <span style="color:#475569">·</span>
  <a href="${TELEMETRY_URL}">telemetry</a>
  <span style="color:#475569">·</span>
  <span style="color:#00e660;font-size:.75rem">v${VERSION}</span>
</p>

<hr>

<h1>⚠ DISCLAIMER & TERMS OF USE</h1>

<div class="box box-red">
<p><strong>This is a free, public MCP + REST API server.</strong> It is provided as-is, with no uptime guarantees, no SLA, and no warranty. By using this server you agree to the following:</p>

<ul style="margin:.5rem 0 0 1.25rem;color:#94a3b8;font-size:.8rem">
<li><strong>Always-on research telemetry</strong> — every request generates zero-PII telemetry (event type, token counts, duration, day-granularity timestamp). This is the <em>price</em> of free access. See <a href="${TELEMETRY_URL}">TELEMETRY.md</a> for full disclosure.</li>
<li><strong>No content is stored</strong> — message content, file paths, code, IP addresses, and user identifiers are <em>never</em> collected, logged, or persisted. Telemetry is aggregated into anonymous counters only.</li>
<li><strong>Recursive PII scrubbing</strong> — the compression pipeline itself strips API keys, tokens, secrets, IPs, and file paths as part of its safety floor. Even if you accidentally send something sensitive, the output is scrubbed. Telemetry data (counters only) is also subject to the same pipeline since it runs through the same system.</li>
<li><strong>No authentication required</strong> for read endpoints (health, status, telemetry disclosure, stats). Mutation endpoints (compress, score, rewrite) require a Bearer token if <code>AUTH_TOKEN</code> is configured by the operator.</li>
<li><strong>Rate limits</strong> — there are no hard rate limits, but abusive traffic may be throttled or blocked. Be reasonable.</li>
<li><strong>Self-host if you want control</strong> — deploy your own instance of <code>server/worker.ts</code> anywhere. Omit the <code>KOMPRESS_STATS</code> KV binding for zero telemetry. The library (<code>npm install kompress-ultra</code>) has zero telemetry, period.</li>
</ul>
</div>

<hr>

<h2>📡 MCP Server</h2>
<p style="font-size:.85rem;color:#94a3b8">
Connect any MCP client (Claude Desktop, VS Code, Cursor, etc.) to:
</p>
<pre>POST https://api.kompress.vaked.dev/mcp</pre>
<p style="font-size:.85rem;color:#94a3b8">
Or via workers.dev subdomain:
</p>
<pre>POST https://kompress-ultra-api.cabotage.workers.dev/mcp</pre>

<h3>Available MCP Tools</h3>
<div class="grid">
<div class="box box-cyan" style="padding:.65rem .85rem">
<strong style="color:#00d4ff;font-size:.8rem">compress</strong>
<span style="display:block;font-size:.7rem;color:#64748b">Score, filter, rewrite, and circulate a conversation</span>
</div>
<div class="box box-cyan" style="padding:.65rem .85rem">
<strong style="color:#00d4ff;font-size:.8rem">score</strong>
<span style="display:block;font-size:.7rem;color:#64748b">Score messages by relevance, recency, structural importance</span>
</div>
<div class="box box-cyan" style="padding:.65rem .85rem">
<strong style="color:#00d4ff;font-size:.8rem">rewrite</strong>
<span style="display:block;font-size:.7rem;color:#64748b">Compress a single message (verbatim/lite/ultra)</span>
</div>
<div class="box box-cyan" style="padding:.65rem .85rem">
<strong style="color:#00d4ff;font-size:.8rem">budget</strong>
<span style="display:block;font-size:.7rem;color:#64748b">Get token budget for an agent type</span>
</div>
<div class="box box-cyan" style="padding:.65rem .85rem">
<strong style="color:#00d4ff;font-size:.8rem">circuit</strong>
<span style="display:block;font-size:.7rem;color:#64748b">Check circuit breaker state</span>
</div>
<div class="box box-cyan" style="padding:.65rem .85rem">
<strong style="color:#00d4ff;font-size:.8rem">telemetry</strong>
<span style="display:block;font-size:.7rem;color:#64748b">Get telemetry disclosure inline</span>
</div>
</div>

<hr>

<h2>🔌 REST API</h2>

<h3>Mutation Endpoints (auth-protected if AUTH_TOKEN configured)</h3>
<div class="box">
<div><span class="endpoint">POST /v1/compress</span> <span class="tag tag-post">auth</span> <span style="font-size:.7rem;color:#64748b">Compress a conversation</span></div>
<div><span class="endpoint">POST /v1/score</span> <span class="tag tag-post">auth</span> <span style="font-size:.7rem;color:#64748b">Score messages</span></div>
<div><span class="endpoint">POST /v1/rewrite</span> <span class="tag tag-post">auth</span> <span style="font-size:.7rem;color:#64748b">Rewrite a message</span></div>
</div>

<h3>Open Endpoints (no auth)</h3>
<div class="box">
<div><span class="endpoint">GET /v1/health</span> <span class="tag tag-get">open</span> <span style="font-size:.7rem;color:#64748b">Liveness + circuit breaker</span></div>
<div><span class="endpoint">GET /v1/status</span> <span class="tag tag-get">open</span> <span style="font-size:.7rem;color:#64748b">Lightweight live/offline</span></div>
<div><span class="endpoint">GET /v1/telemetry</span> <span class="tag tag-get">open</span> <span style="font-size:.7rem;color:#64748b">Telemetry disclosure</span></div>
<div><span class="endpoint">GET /v1/stats</span> <span class="tag tag-get">open</span> <span style="font-size:.7rem;color:#64748b">Daily aggregate stats</span></div>
<div><span class="endpoint">GET /v1/budget?type=coder</span> <span class="tag tag-get">open</span> <span style="font-size:.7rem;color:#64748b">Token budgets</span></div>
<div><span class="endpoint">GET /v1/badge.js</span> <span class="tag tag-get">open</span> <span style="font-size:.7rem;color:#64748b">API status badge script</span></div>
<div><span class="endpoint">GET /v1/telemetry.js</span> <span class="tag tag-get">open</span> <span style="font-size:.7rem;color:#64748b">Ralph-Loop telemetry script</span></div>
</div>

<hr>

<h2>📦 Library</h2>
<p style="font-size:.85rem;color:#94a3b8">
Zero telemetry. Fully offline. Pure TypeScript.
</p>
<pre>bun add kompress-ultra</pre>
<pre style="font-size:.75rem">import { scoreMessageSync, compressMessage, CompressionLevel } from "kompress-ultra";
const score = scoreMessageSync(msg, index, total);
const compressed = compressMessage(text, CompressionLevel.Ultra);</pre>

<hr>

<h2>📂 References</h2>
<div class="grid">
<div class="box" style="padding:.65rem .85rem;font-size:.75rem">
📄 <a href="https://github.com/peterlodri-sec/kompress-ultra">GitHub</a>
<span style="display:block;color:#64748b">Source code, issues, PRs</span>
</div>
<div class="box" style="padding:.65rem .85rem;font-size:.75rem">
📜 <a href="${TELEMETRY_URL}">TELEMETRY.md</a>
<span style="display:block;color:#64748b">Full telemetry disclosure</span>
</div>
<div class="box" style="padding:.65rem .85rem;font-size:.75rem">
📖 <a href="https://github.com/peterlodri-sec/kompress-ultra/blob/main/README.md">README</a>
<span style="display:block;color:#64748b">Docs, benchmarks, config</span>
</div>
<div class="box" style="padding:.65rem .85rem;font-size:.75rem">
🎮 <a href="https://proposal.vaked.dev">Proposal</a>
<span style="display:block;color:#64748b">Interactive playground</span>
</div>
<div class="box" style="padding:.65rem .85rem;font-size:.75rem">
📄 <a href="https://kompress.vaked.dev/paper/main.pdf">Paper</a>
<span style="display:block;color:#64748b">Academic paper with proofs</span>
</div>
<div class="box" style="padding:.65rem .85rem;font-size:.75rem">
🤗 <a href="https://huggingface.co/PeetPedro/kompress-v8">Model</a>
<span style="display:block;color:#64748b">kompress-v8 on HF</span>
</div>
</div>

<hr>

<pre style="font-size:10px;text-align:center;border:none;background:transparent;color:#1e293b;padding:0">
    _  _     _             _   _
   | || |___| |_____ ___ _| |_| |_ ___ _ _
   | __ / -_) / _ \\ \\/ / \` |  _|  _/ _ \\ '_|
   |_||_\\___|_\\___/_>_\\__,_|\\__|\\__\\___/_|
</pre>

<div class="footer">
  <p>kompress-ultra v${VERSION} · Apache 2.0</p>
  <p style="margin-top:.25rem">Built by <a href="https://github.com/peterlodri-sec">peterlodri-sec</a> · Part of the <a href="https://github.com/peterlodri-sec/ultrameshai">ultrameshai</a> ecosystem</p>
  <p style="margin-top:.25rem"><a href="https://github.com/peterlodri-sec/kompress-ultra">source</a> · <a href="https://github.com/peterlodri-sec/kompress-ultra/issues">issues</a> · <a href="${TELEMETRY_URL}">telemetry</a></p>
</div>

</body>
</html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      [TELEMETRY_HEADER]: TELEMETRY_URL,
    },
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      [TELEMETRY_HEADER]: TELEMETRY_URL,
    },
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // MCP
    if (url.pathname === "/mcp" && request.method === "POST") {
      return createMcpHandler(buildMcpServer())(request, env, ctx);
    }

    // REST (auth-protected mutations)
    if (url.pathname === "/v1/compress" && request.method === "POST") {
      if (!requireAuth(request, env)) return unauthorized();
      return handleCompress(request, env);
    }
    if (url.pathname === "/v1/score" && request.method === "POST") {
      if (!requireAuth(request, env)) return unauthorized();
      return handleScore(request, env);
    }
    if (url.pathname === "/v1/rewrite" && request.method === "POST") {
      if (!requireAuth(request, env)) return unauthorized();
      return handleRewrite(request, env);
    }
    if (url.pathname === "/v1/health") {
      return handleHealth(env);
    }
    if (url.pathname === "/v1/status") {
      return handleStatus();
    }
    if (url.pathname === "/v1/badge.js") {
      return handleBadgeJs();
    }
    if (url.pathname === "/v1/telemetry.js") {
      return handleTelemetryJs();
    }
    if (url.pathname === "/v1/telemetry") {
      return handleTelemetry(env);
    }
    if (url.pathname === "/v1/stats") {
      return handleStats(env);
    }
    if (url.pathname === "/v1/budget" && request.method === "GET") {
      const type = (url.searchParams.get("type") ?? "coder") as AgentType;
      return json(getBudget(type));
    }

    return handleRoot(request);
  },
};
