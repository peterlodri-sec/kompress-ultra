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
 *   GET  /v1/stats      — aggregate compression stats
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

const VERSION = "1.0.0";

interface Env {
  DB?: D1Database;
  VECTORIZE?: VectorizeIndex;
  KOMPRESS_STATS?: KVNamespace;
  AUTH_TOKEN?: string;
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

  return server;
}

async function handleCompress(request: Request): Promise<Response> {
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

  const scored = body.messages.map((m, i) => {
    const score = scoreMessageSync(m, i, body.messages!.length);
    const protected_ = isProtected(m, i, body.messages!.length);
    return { ...m, _score: score.total, _protected: protected_ };
  });

  const kept = scored.filter((m) => m._protected || m._score >= threshold);
  const dropped = scored.filter((m) => !m._protected && m._score < threshold);

  const inputTokens = totalTokens(body.messages);
  const outputTokens = totalTokens(kept.map((m) => ({ role: m.role, content: m.content })));

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
}

async function handleScore(request: Request): Promise<Response> {
  const body = await request.json() as { messages?: Message[] };
  if (!Array.isArray(body.messages)) {
    return json({ error: "messages array required" }, 400);
  }

  const results = body.messages.map((m, i) => ({
    role: m.role,
    score: scoreMessageSync(m, i, body.messages!.length),
    protected: isProtected(m, i, body.messages!.length),
    tokens: estimateTokens(m.content),
  }));

  return json(results);
}

async function handleRewrite(request: Request): Promise<Response> {
  const body = await request.json() as { content?: string; level?: string };
  if (!body.content) {
    return json({ error: "content required" }, 400);
  }

  const levelMap: Record<string, CompressionLevel> = {
    verbatim: CompressionLevel.Verbatim,
    lite: CompressionLevel.Lite,
    ultra: CompressionLevel.Ultra,
  };
  const level = levelMap[body.level ?? "lite"] ?? CompressionLevel.Lite;
  const rewritten = compressMessage(body.content, level);

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
}

function handleHealth(): Response {
  return json({
    status: "ok",
    version: VERSION,
    circuit_breaker: { open: isCircuitOpen(), ...getCircuitState() },
    timestamp: new Date().toISOString(),
  });
}

function handleRoot(): Response {
  return json({
    name: "kompress-ultra API",
    version: VERSION,
    mcp: "POST /mcp",
    rest: {
      compress: "POST /v1/compress",
      score: "POST /v1/score",
      rewrite: "POST /v1/rewrite",
      health: "GET /v1/health",
      budget: "GET /v1/budget?type=coder|researcher|reviewer|orchestrator",
    },
    docs: "https://github.com/peterlodri-sec/kompress-ultra#readme",
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
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

    // REST
    if (url.pathname === "/v1/compress" && request.method === "POST") {
      return handleCompress(request);
    }
    if (url.pathname === "/v1/score" && request.method === "POST") {
      return handleScore(request);
    }
    if (url.pathname === "/v1/rewrite" && request.method === "POST") {
      return handleRewrite(request);
    }
    if (url.pathname === "/v1/health") {
      return handleHealth();
    }
    if (url.pathname === "/v1/budget" && request.method === "GET") {
      const type = (url.searchParams.get("type") ?? "coder") as AgentType;
      return json(getBudget(type));
    }

    return handleRoot();
  },
};
