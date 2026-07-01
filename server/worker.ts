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
import { handleBrainRequest, loadBrain } from "./brain-grpc.js";
import { version, telemetryUrl, buildLandingHtml, buildBadgeJs, buildTelemetryJs } from "./landing-page.js";

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

    // Brain graph API (v11.0.0 grpc-synapse)
    if (url.pathname.startsWith("/v1/brain/")) {
      return handleBrainRequest(request);
    }

    return handleRoot(request);
  },
};
