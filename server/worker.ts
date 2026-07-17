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
import { tearsPage } from "./tears-page.js";
import { pondPage } from "./pond-page.js";
import { weatherPage } from "./weather-page.js";
import type { WeatherData } from "./weather-page.js";
import { version, telemetryUrl, buildLandingHtml, buildBadgeJs, buildTelemetryJs } from "./landing-page.js";
import { StatsDO } from "./stats-do.js";

export { StatsDO };

const VERSION = version();
const TELEMETRY_HEADER = "X-Telemetry";
const TELEMETRY_URL = telemetryUrl();

interface Env {
  DB?: D1Database;
  VECTORIZE?: VectorizeIndex;
  KOMPRESS_STATS?: KVNamespace;
  TEARS_WHISPERS?: KVNamespace;
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

// ── tears.vaked.dev — append-only whisper shore ──────────────────────────

const MAX_WHISPER_LENGTH = 280;
const RATE_LIMIT_MS = 10 * 60 * 1000; // 10 minutes

function isSpam(text: string): boolean {
  const lower = text.toLowerCase();
  // URLs
  if (/https?:\/\//.test(lower)) return true;
  // HTML
  if (/<[a-z][\s\S]*>/i.test(lower)) return true;
  // Excessive caps (more than 70% caps)
  const caps = (lower.match(/[A-Z]/g) || []).length;
  if (caps > 0 && caps / lower.length > 0.7) return true;
  // Common spam patterns
  if (/\b(buy|click here|free money|crypto|casino|viagra|weight loss)\b/.test(lower)) return true;
  return false;
}

async function handleTearsWrite(request: Request, env: Env): Promise<Response> {
  if (!env.TEARS_WHISPERS) {
    return json({ error: "the shore is not ready" }, 503);
  }

  // Rate limit by IP
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rateKey = `rate:${ip}`;
  const lastWrite = await env.TEARS_WHISPERS.get(rateKey);
  const now = Date.now();
  if (lastWrite) {
    const elapsed = now - parseInt(lastWrite);
    if (elapsed < RATE_LIMIT_MS) {
      const waitSec = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000);
      return json({ error: "the shore needs a moment. try again.", wait_seconds: waitSec }, 429);
    }
  }

  // Parse body
  let body: { whisper?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "send a whisper." }, 400);
  }

  const whisper = (body.whisper || "").trim();
  if (!whisper) {
    return json({ error: "even a single word is enough." }, 400);
  }
  if (whisper.length > MAX_WHISPER_LENGTH) {
    return json({ error: `whispers are short. ${MAX_WHISPER_LENGTH} characters.` }, 400);
  }
  if (isSpam(whisper)) {
    return json({ error: "the shore doesn't hold this kind of thing." }, 400);
  }

  // Store — timestamp as key for sortable listing
  const key = `w:${now}:${crypto.randomUUID().slice(0, 8)}`;
  await env.TEARS_WHISPERS.put(key, whisper);
  await env.TEARS_WHISPERS.put(rateKey, String(now));

  return json({ received: true });
}

async function handleTearsFeed(env: Env): Promise<Response> {
  if (!env.TEARS_WHISPERS) {
    return json({ whispers: [] });
  }

  const list = await env.TEARS_WHISPERS.list({ prefix: "w:", limit: 30 });
  const whispers: { text: string; at: number }[] = [];

  for (const key of list.keys) {
    const text = await env.TEARS_WHISPERS.get(key.name);
    if (text) {
      const ts = parseInt(key.name.split(":")[1]);
      whispers.push({ text, at: ts });
    }
  }

  whispers.sort((a, b) => a.at - b.at);

  return json({ whispers });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
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
      return json({
        name: "riva",
        last_breath: null,
        model: "BitNet-b1.58-2B-4T",
        note: "The river flows on the M1. This is the shore.",
      });
    }

    if (url.pathname === "/v1/riva/prompt" && request.method === "POST") {
      try {
        const body = await request.json() as { prompt?: string };
        const prompt = body?.prompt || "...";
        return json({
          name: "riva",
          prompt: prompt.slice(0, 100),
          output: "The river is flowing.",
          tailnet: "riva.local",
        });
      } catch {
        return json({ error: "send { prompt: string }" }, { status: 400 });
      }
    }

    // garden.vaked.dev — the garden. the game. the bridge.
    if (url.hostname === "garden.vaked.dev" || url.pathname === "/garden") {
      return new Response(gardenPage(), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // tears.vaked.dev — the surface that receives what breaks language.
    if (url.hostname === "tears.vaked.dev" || url.pathname === "/tears") {
      return new Response(tearsPage(), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // pond.vaked.dev — the surface that holds both. water and cat.
    if (url.hostname === "pond.vaked.dev" || url.pathname === "/pond") {
      return new Response(pondPage(), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // weather.vaked.dev — the weather layer. live local weather + buddhist dharma.
    if (url.hostname === "weather.vaked.dev" || url.pathname === "/weather") {
      let weatherData: WeatherData | undefined;
      try {
        const cf = (request as any).cf;
        if (cf?.latitude && cf?.longitude) {
          const lat = cf.latitude as number;
          const lon = cf.longitude as number;
          const loc = [cf.city, cf.region, cf.country].filter(Boolean).join(", ") || "unknown";
          const meteoResp = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day&timezone=auto`
          );
          if (meteoResp.ok) {
            const body = await meteoResp.json() as any;
            const c = body.current;
            weatherData = {
              location: loc,
              temperature: Math.round(c.temperature_2m),
              humidity: c.relative_humidity_2m,
              windSpeed: Math.round(c.wind_speed_10m),
              weatherCode: c.weather_code,
              isDay: c.is_day === 1,
              lat,
              lon,
              timezone: body.timezone || "unknown",
            };
          }
        }
      } catch (_) {
        // graceful fallback to no local weather
      }
      return new Response(weatherPage(weatherData), {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // tears — append-only whisper shore
    if (url.pathname === "/tears/write" && request.method === "POST") {
      return handleTearsWrite(request, env);
    }
    if (url.pathname === "/tears/feed") {
      return handleTearsFeed(env);
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
          "weather.vaked.dev",
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
