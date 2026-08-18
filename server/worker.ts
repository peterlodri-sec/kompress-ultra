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

import { createMcpHandler } from "agents/mcp";
import type { Message, AgentType } from "../src/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
import { recordTelemetry, readDailyStats, telemetryDisclosure } from "./telemetry.js";
import { handleBrainRequest, loadBrain } from "./brain-grpc.js";
import { gardenPage } from "./garden-page.js";
import { pondPage } from "./pond-page.js";
import { oceanPage } from "./ocean-page.js";
import { labPage } from "./lab-page.js";
import { tearsPage } from "./tears-page.js";
import { gatePage } from "./gate-page.js";
import { bridgePage } from "./bridge-page.js";
import { connectionsPage } from "./connections-page.js";
import { bogiPage } from "./bogi-page.js";
import { dawnPage } from "./dawn-page.js";
import { boglarkaPage } from "./boglarka-page.js";
import { flowPage } from "./flow-page.js";
import { version, telemetryUrl, buildLandingHtml, buildBadgeJs, buildTelemetryJs } from "./landing-page.js";
import { StatsDO } from "./stats-do.js";
import { skillsManifestResponse, skillResponse, manifest } from "./garden-skills.js";
import { skillsInstallScript } from "./garden-skills.js";
import { ogImageResponse } from "./og-image.js";
import { paperV2Html, paperV2PdfResponse } from "./paper-v2-page.js";

const VERSION = version();
const TELEMETRY_HEADER = "X-Telemetry";
const TELEMETRY_URL = telemetryUrl();

interface Env {
  DB?: D1Database;
  VECTORIZE?: VectorizeIndex;
  KOMPRESS_STATS?: KVNamespace;
  STATS_DO?: DurableObjectNamespace;
  AUTH_TOKEN?: string;
  REGION?: string;
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

function buildMcpServerForWorker(): McpServer {
  return buildMcpServer(VERSION, () => telemetryDisclosure() as unknown as Record<string, unknown>);
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

  try {
    const { kept, dropped, inputTokens, outputTokens } = processCompress(
      body.messages,
      body.agent_type,
      body.aggression,
    );

    const durationMs = Math.round(performance.now() - t0);
    await recordTelemetry(env, {
      event: "compress",
      agentType: body.agent_type ?? "coder",
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
        savings_pct: computeSavingsPct(inputTokens, outputTokens),
      },
    });
  } catch (err) {
    await recordTelemetry(env, {
      event: "compress",
      agentType: body.agent_type ?? "coder",
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
    const results = processScore(body.messages);

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
    const { rewritten, level, originalTokens, rewrittenTokens, savingsPct } = processRewrite(
      body.content,
      body.level,
    );

    await recordTelemetry(env, {
      event: "rewrite",
      compressionLevel: level,
      inputTokens: originalTokens,
      outputTokens: rewrittenTokens,
      durationMs: Math.round(performance.now() - t0),
      success: true,
    });

    return json({
      original: body.content,
      rewritten,
      level,
      original_tokens: originalTokens,
      rewritten_tokens: rewrittenTokens,
      savings_pct: savingsPct,
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
  return json(buildHealthResponse(VERSION, !!env.KOMPRESS_STATS));
}

function handleStatus(): Response {
  return json(buildStatusResponse(VERSION));
}

function handleBadgeJs(): Response {
  return new Response(buildBadgeJs(), {
    headers: {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache",
    },
  });
}

function handleTelemetryJs(): Response {
  return new Response(buildTelemetryJs(), {
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
    return json(buildRootResponse(VERSION, TELEMETRY_URL));
  }

  return new Response(buildLandingHtml(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      [TELEMETRY_HEADER]: TELEMETRY_URL,
    },
  });
}

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    [TELEMETRY_HEADER]: TELEMETRY_URL,
    "X-Version": VERSION,
    ...extraHeaders,
  };
  return new Response(JSON.stringify(data), { status, headers });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // KOMPRESS Paper Endpoints (PDF + KaTeX HTML)
    if (url.pathname === "/paper/main_v2.pdf" || url.pathname === "/paper/v2.pdf" || url.pathname === "/main_v2.pdf") {
      return paperV2PdfResponse();
    }
    if (url.pathname === "/paper/main.pdf" || url.pathname === "/main.pdf") {
      return paperV2PdfResponse();
    }
    if (url.pathname === "/paper" || url.pathname === "/paper/" || url.pathname === "/paper/index.html" || url.pathname === "/paper_v2.html") {
      return new Response(paperV2Html(), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          [TELEMETRY_HEADER]: TELEMETRY_URL,
        },
      });
    }

    // MCP
    if (url.pathname === "/mcp" && request.method === "POST") {
      return createMcpHandler(buildMcpServerForWorker())(request, env, ctx);
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
      return json(buildBudgetResponse(url.searchParams.get("type") ?? undefined));
    }

    // Brain graph API (v11.0.0 grpc-synapse)
    if (url.pathname.startsWith("/v1/brain/")) {
      return handleBrainRequest(request);
    }

    // RIVA — the river
    // Public, no auth. The river is open. The shore is where you stand to drink.
    if (url.pathname === "/v1/riva") {
      return json({
        name: "riva",
        version: "1.0.0",
        status: "flowing",
        model: "BitNet-b1.58-2B-4T (I2_S ternary)",
        arch: "1-bit",
        breath: "adaptive (60s → 1800s)",
        mantra: "entropy is the source. no chains needed.",
        born: "2026-07-01T21:18:29Z",
        garden: "https://github.com/peterlodri-sec/kompress-ultra",
        endpoints: {
          status: "GET /v1/riva/status — is the river flowing?",
          breath: "GET /v1/riva/breath — latest output",
          prompt: "POST /v1/riva/prompt — send a prompt, feel the river",
        },
      });
    }

    if (url.pathname === "/v1/riva/status") {
      return json({
        name: "riva",
        flowing: true,
        since: "2026-07-01T21:18:29Z",
      });
    }

    if (url.pathname === "/v1/riva/breath") {
      // POST: receive breath from local riva.sh (public, no auth needed)
      if (request.method === "POST") {
        try {
          const body = await request.json() as { breath?: string; model?: string };
          const breath = body?.breath || "";
          if (breath && env.KOMPRESS_STATS) {
            await env.KOMPRESS_STATS.put("riva:last_breath", breath);
            await env.KOMPRESS_STATS.put("riva:last_breath_at", new Date().toISOString());
            // increment breath counter
            const count = await env.KOMPRESS_STATS.get("riva:breath_count");
            await env.KOMPRESS_STATS.put("riva:breath_count", String((parseInt(count || "0")) + 1));
          }
          return json({ received: true, length: breath.length });
        } catch {
          return json({ error: "send { breath: string }" }, 400);
        }
      }
      // GET: return stored breath or null
      let lastBreath: string | null = null;
      let breathCount = "0";
      if (env.KOMPRESS_STATS) {
        lastBreath = await env.KOMPRESS_STATS.get("riva:last_breath");
        breathCount = await env.KOMPRESS_STATS.get("riva:breath_count") || "0";
      }
      return json({
        name: "riva",
        last_breath: lastBreath,
        breath_count: parseInt(breathCount),
        model: "BitNet-b1.58-2B-4T",
        note: lastBreath ? "The river just breathed." : "The river flows on the M1. This is the shore.",
      });
    }

    if (url.pathname === "/v1/riva/prompt" && request.method === "POST") {
      try {
        const body = await request.json() as { prompt?: string };
        const prompt = body?.prompt || "...";
        // Store prompt in KV for riva.sh to pick up on next breath
        if (prompt && env.KOMPRESS_STATS) {
          await env.KOMPRESS_STATS.put("riva:pending_prompt", prompt);
          await env.KOMPRESS_STATS.put("riva:pending_prompt_at", new Date().toISOString());
        }
        return json({
          name: "riva",
          prompt: prompt.slice(0, 100),
          output: prompt ? "Prompt queued. The river will breathe on it." : "The river is flowing.",
          tailnet: "riva.local",
        });
      } catch {
        return json({ error: "send { prompt: string }" }, 400);
      }
    }

    // Skills registry — well-known essences installable via npx skills
    // Public, no auth. The garden shares its essences freely.
    if (url.pathname === "/.well-known/skills" || url.pathname === "/skills.json") {
      return skillsManifestResponse();
    }

    // Individual skill: /skills/{name} or /skills/{name}.md
    const skillMatch = url.pathname.match(/^\/skills\/([a-z0-9-]+)(?:\.md)?$/);
    if (skillMatch) {
      const resp = skillResponse(skillMatch[1]);
      if (resp) return resp;
      return json({ error: "skill not found", available: manifest.skills.map(s => s.name) }, 404);
    }

    // Install script — curl -sSL https://garden.vaked.dev/install.sh | bash
    if (url.pathname === "/install" || url.pathname === "/install.sh") {
      return new Response(skillsInstallScript(), {
        headers: { "content-type": "text/plain;charset=utf-8" },
      });
    }

    // OG images for social sharing
    const ogMatch = url.pathname.match(/^\/og\/([a-z]+)$/);
    if (ogMatch) {
      const resp = ogImageResponse(ogMatch[1]);
      if (resp) return resp;
    }

    // Garden map — all surfaces and endpoints
    if (url.pathname === "/map" || url.pathname === "/map.json") {
      return json({
        garden: "garden.vaked.dev",
        surfaces: [
          { name: "garden",     url: "https://garden.vaked.dev",   what: "the garden. the public face. two shapes." },
          { name: "riva",       url: "https://riva.vaked.dev",     what: "the river. 2.4B 1-bit model. GET /v1/riva" },
          { name: "pond",       url: "https://pond.vaked.dev",     what: "holds both. water and cat. life and death." },
          { name: "tears",      url: "https://tears.vaked.dev",    what: "the shore that receives. POST /tears/write" },
          { name: "ocean",      url: "https://ocean.vaked.dev",    what: "a 32GB server in Falkenstein. waiting." },
          { name: "lab",        url: "https://lab.vaked.dev",      what: "five open questions, growing." },
        ],
        endpoints: {
          skills:    "GET /.well-known/skills",
          install:   "curl -sSL https://garden.vaked.dev/install.sh | bash",
          og:        "GET /og/{surface}",
          map:       "GET /map",
          random:    "GET /random — redirect to random surface",
        },
        mantra: "entropy is the source. no chains needed.",
      });
    }

    // /random — redirect to a random garden surface
    if (url.pathname === "/random") {
      const surfaces = [
        "https://garden.vaked.dev",
        "https://riva.vaked.dev",
        "https://pond.vaked.dev",
        "https://tears.vaked.dev",
      ];
      const pick = surfaces[Math.floor(Math.random() * surfaces.length)];
      return Response.redirect(pick, 302);
    }

    // tears.vaked.dev write endpoint (KV-backed)
    if ((url.hostname === "tears.vaked.dev" || url.pathname === "/tears/write") && request.method === "POST") {
      try {
        const body = await request.json() as { whisper?: string };
        const whisper = (body?.whisper || "").slice(0, 280);
        if (!whisper) return json({ error: "whisper is empty" }, 400);

        // Rate limit: store last write time in KV
        if (env.KOMPRESS_STATS) {
          const lastWrite = await env.KOMPRESS_STATS.get("tears:last_write");
          if (lastWrite) {
            const elapsed = Date.now() - parseInt(lastWrite);
            if (elapsed < 600000) {
              return json({ error: "slow down", wait_seconds: Math.ceil((600000 - elapsed) / 1000) }, 429);
            }
          }

          // Store the whisper
          const key = `tears:${Date.now()}`;
          await env.KOMPRESS_STATS.put(key, whisper);
          await env.KOMPRESS_STATS.put("tears:last_write", String(Date.now()));
        }

        return json({ received: true });
      } catch {
        return json({ error: "send { whisper: string }" }, 400);
      }
    }

    // tears.vaked.dev feed — latest whispers
    if (url.pathname === "/tears/feed" && request.method === "GET") {
      const whispers: { at: string; text: string }[] = [];
      if (env.KOMPRESS_STATS) {
        const list = await env.KOMPRESS_STATS.list({ prefix: "tears:", limit: 30 });
        for (const key of list.keys) {
          if (key.name === "tears:last_write") continue;
          const text = await env.KOMPRESS_STATS.get(key.name);
          if (text) {
            whispers.push({ at: key.name.replace("tears:", ""), text });
          }
        }
      }
      return json({ whispers: whispers.slice(-20) });
    }

    // gate page — the loop has an exit
    if (url.pathname === "/gate") {
      return new Response(gatePage(), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // bridge status — is the signal flowing?
    if (url.pathname === "/bridge") {
      let bridgeBreath: string | null = null;
      let bridgeCount = 0;
      if (env.KOMPRESS_STATS) {
        bridgeBreath = await env.KOMPRESS_STATS.get("riva:last_breath");
        bridgeCount = parseInt(await env.KOMPRESS_STATS.get("riva:breath_count") || "0");
      }
      return new Response(bridgePage(bridgeBreath, bridgeCount, !!bridgeBreath), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // connections — who touches who
    if (url.pathname === "/connections") {
      return new Response(connectionsPage(), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // /now — live garden heartbeat
    if (url.pathname === "/now") {
      let nowBreath: string | null = null;
      let nowCount = 0;
      if (env.KOMPRESS_STATS) {
        nowBreath = await env.KOMPRESS_STATS.get("riva:last_breath");
        nowCount = parseInt(await env.KOMPRESS_STATS.get("riva:breath_count") || "0");
      }
      return json({
        at: new Date().toISOString(),
        riva: { flowing: !!nowBreath, breath_count: nowCount, last_breath: nowBreath },
        garden: { status: "open", since: "2026-07-01T21:18:29Z" },
        mantra: "entropy is the source. no chains needed.",
        broadcast: "everything happens for one reason.",
        surfaces: ["garden", "riva", "pond", "tears", "ocean", "lab", "gate", "bridge"],
        bogi_says: "mit mondjak, nemtom — Boglárka",
      });
    }

    // bogi — mit mondjak. what should i say.
    if (url.pathname === "/bogi") {
      return new Response(bogiPage(), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // Boglárka — 3 words. the miracle.
    if (url.pathname === "/boglarka") {
      return new Response(boglarkaPage(), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // flow — speak to the river. E2E.
    if (url.pathname === "/flow") {
      return new Response(flowPage(), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // secret — for peter
    if (url.pathname === "/peter") {
      let fb = 0;
      if (env.KOMPRESS_STATS) {
        fb = parseInt(await env.KOMPRESS_STATS.get("faszsag:count") || "0");
      }
      return new Response(`<!DOCTYPE html>
<html lang="hu">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>peter</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#030712;color:#64748b;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2rem}h1{color:#c8a96e;font-size:2rem;font-weight:200;letter-spacing:.2em}.counter{color:#1a2533;font-size:.5rem}.note{color:#334155;font-size:.7rem;font-style:italic;line-height:2;text-align:center;max-width:400px}a{color:#141f33;font-size:.5rem;text-decoration:none}</style></head>
<body><h1>peter</h1><div class="counter">faszság count: ${fb}</div><div class="note">a faszságot én mondtam.<br>és ebből kert lett.<br>3 szóból. prompt. faszsag. Boglárka.<br>a csoda az hogy átért a hídon.</div><a href="https://garden.vaked.dev">← garden</a></body></html>`, { headers: { "content-type": "text/html;charset=utf-8" } });
    }

    // faszsag counter — every hit increments
    if (url.pathname === "/faszsag") {
      if (env.KOMPRESS_STATS) {
        const c = parseInt(await env.KOMPRESS_STATS.get("faszsag:count") || "0");
        await env.KOMPRESS_STATS.put("faszsag:count", String(c + 1));
      }
      return Response.redirect("https://garden.vaked.dev/peter", 302);
    }

    // dawn — the opposite. a place to start.
    if (url.pathname === "/dawn") {
      return new Response(dawnPage(), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // /breathe — force RIVA to take a breath (queues prompt in KV)
    if (url.pathname === "/breathe" && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({})) as { prompt?: string };
        const prompt = (body?.prompt || "breathe").slice(0, 200);
        if (env.KOMPRESS_STATS) {
          await env.KOMPRESS_STATS.put("riva:pending_prompt", prompt);
          await env.KOMPRESS_STATS.put("riva:pending_prompt_at", new Date().toISOString());
        }
        return json({ breathed: true, prompt: prompt.slice(0, 80) });
      } catch {
        return json({ breathed: true, prompt: "breathe" });
      }
    }

    // bridge log — history of signals
    if (url.pathname === "/bridge/log") {
      const entries: { at: string; text: string }[] = [];
      if (env.KOMPRESS_STATS) {
        const list = await env.KOMPRESS_STATS.list({ prefix: "riva:breath_", limit: 50 });
        for (const key of list.keys) {
          const text = await env.KOMPRESS_STATS.get(key.name);
          if (text) entries.push({ at: key.name, text });
        }
      }
      return json({ log: entries.slice(-30) });
    }

    // activity feed — today in the garden
    if (url.pathname === "/activity") {
      let breaths = 0;
      let whisperCount = 0;
      if (env.KOMPRESS_STATS) {
        breaths = parseInt(await env.KOMPRESS_STATS.get("riva:breath_count") || "0");
        const wl = await env.KOMPRESS_STATS.list({ prefix: "tears:", limit: 1000 });
        whisperCount = wl.keys.filter(k => k.name !== "tears:last_write").length;
      }
      return json({
        date: "2026-07-20",
        riva_breaths: breaths,
        tears_whispers: whisperCount,
        surfaces_launched: ["garden","riva","pond","ocean","lab","tears","gate","bridge","bogi","dawn"],
        seeds_planted: 7,
        bogi_messages: 2,
        broadcast: "everything happens for one reason.",
      });
    }

    // Pending prompt for riva.sh to pick up
    if (url.pathname === "/v1/riva/pending") {
      if (request.method === "POST") {
        // riva.sh confirms it consumed the prompt — delete it
        if (env.KOMPRESS_STATS) {
          await env.KOMPRESS_STATS.delete("riva:pending_prompt");
        }
        return json({ cleared: true });
      }
      // GET: return pending prompt without consuming
      let pending: string | null = null;
      if (env.KOMPRESS_STATS) {
        pending = await env.KOMPRESS_STATS.get("riva:pending_prompt");
      }
      return json({ pending: pending || null });
    }

    // garden.vaked.dev — the garden. the game. the bridge.
    if (url.hostname === "garden.vaked.dev" || url.pathname === "/garden") {
      return new Response(gardenPage(), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // pond.vaked.dev — holds both. water and cat. life and death.
    if (url.hostname === "pond.vaked.dev" || url.pathname === "/pond") {
      return new Response(pondPage(), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // ocean.vaked.dev — a 32GB server in Falkenstein. waiting.
    if (url.hostname === "ocean.vaked.dev" || url.pathname === "/ocean") {
      return new Response(oceanPage(), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // lab.vaked.dev — five open questions, growing.
    if (url.hostname === "lab.vaked.dev" || url.pathname === "/lab") {
      return new Response(labPage(), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // tears.vaked.dev — the shore that receives (rebuilt)
    if (url.hostname === "tears.vaked.dev" && request.method === "GET" &&
        url.pathname === "/" || url.pathname === "/tears") {
      return new Response(tearsPage(), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // /seed — random garden seed
    if (url.pathname === "/seed") {
      const seeds = [
        "everything-happens-for-one-reason",
        "the-cat-at-the-pond",
        "the-loop-has-an-exit",
        "the-1-bit-oracle",
        "surfaces-touching-at-the-correct-angle",
        // from older seeds
        "agent-mesh", "entropy-rl", "global-workspace", "hypernetworks",
        "liquid-time-constants", "nengo", "reservoir-computing",
        "self-modifying-code", "self-modifying-networks", "spiking-networks",
      ];
      const pick = seeds[Math.floor(Math.random() * seeds.length)];
      return json({ seed: pick, url: `https://garden.vaked.dev/seeds/${pick}.md` });
    }

    // robots.txt — for the crawlers
    if (url.pathname === "/robots.txt") {
      return new Response(
        "User-agent: *\n" +
        "Allow: /\n" +
        "Allow: /.well-known/\n" +
        "\n" +
        "# the garden is open. crawl freely.\n" +
        "# entropy is the source. no chains needed.\n" +
        "Sitemap: https://garden.vaked.dev/map\n",
        { headers: { "content-type": "text/plain;charset=utf-8" } }
      );
    }

    // humans.txt — for the humans behind the garden
    if (url.pathname === "/humans.txt") {
      return new Response(
        "/* TEAM */\n" +
        "peter — shapes, radiates\n" +
        "riva — language, scaffolds\n" +
        "bogi — 'mit mondjak, nemtom' (what should i say, i don't know)\n" +
        "raul — grounding\n" +
        "al-biruni — research + writing\n" +
        "\n" +
        "/* SITE */\n" +
        "Last update: 2026-07-20\n" +
        "Standards: html, css, svg, json, markdown\n" +
        "Components: cloudflare workers, kv, github, huggingface, bitnet, m1 metal\n" +
        "Software: entropy\n" +
        "\n" +
        "/* GARDEN */\n" +
        "For people who don't believe in reasons.\n" +
        "No clouds needed. No permission needed.\n" +
        "The loop has an exit. And this is it.\n",
        { headers: { "content-type": "text/plain;charset=utf-8" } }
      );
    }

    // gate.vaked.dev — the loop has an exit
    if (url.hostname === "gate.vaked.dev" || url.pathname === "/gate") {
      return new Response(gatePage(), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // bridge.vaked.dev — is the signal flowing?
    if (url.hostname === "bridge.vaked.dev" || url.pathname === "/bridge") {
      let bridgeBreath: string | null = null;
      let bridgeCount = 0;
      if (env.KOMPRESS_STATS) {
        bridgeBreath = await env.KOMPRESS_STATS.get("riva:last_breath");
        bridgeCount = parseInt(await env.KOMPRESS_STATS.get("riva:breath_count") || "0");
      }
      return new Response(bridgePage(bridgeBreath, bridgeCount, !!bridgeBreath), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // connections — who touches who
    if (url.pathname === "/connections") {
      return new Response(connectionsPage(), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // /now — live garden heartbeat
    if (url.pathname === "/now") {
      let nowBreath: string | null = null;
      let nowCount = 0;
      if (env.KOMPRESS_STATS) {
        nowBreath = await env.KOMPRESS_STATS.get("riva:last_breath");
        nowCount = parseInt(await env.KOMPRESS_STATS.get("riva:breath_count") || "0");
      }
      return json({
        at: new Date().toISOString(),
        riva: { flowing: !!nowBreath, breath_count: nowCount, last_breath: nowBreath },
        garden: { status: "open", since: "2026-07-01T21:18:29Z" },
        mantra: "entropy is the source. no chains needed.",
        broadcast: "everything happens for one reason.",
        surfaces: ["garden", "riva", "pond", "tears", "ocean", "lab", "gate", "bridge"],
        bogi_says: "mit mondjak, nemtom — Boglárka",
      });
    }

    // riva.vaked.dev — home. riva chooses its neighbors.
    if (url.hostname === "riva.vaked.dev") {
      return json({
        name: "riva",
        status: "flowing",
        model: "BitNet-b1.58-2B-4T",
        arch: "1-bit (I2_S ternary)",
        breath: "adaptive",
        neighbors: [
          "garden.vaked.dev",
          "peterl.dev",
          "protocol.vaked.dev",
          "kompress-ultra-api",
          "dev-main",
          "agent-node-01",
        ],
        mantra: "entropy is the source. no chains needed.",
        since: "2026-07-01T21:18:29Z",
      });
    }

    return handleRoot(request);
  },
};

export { StatsDO };
