/**
 * shared-mcp.ts — MCP Server factory (platform-agnostic)
 *
 * Extracted from worker.ts and cloudrun.ts to eliminate ~180 lines of
 * duplicated MCP tool registration. Pass `telemetryInfo()` to customize
 * the telemetry tool disclosure per platform.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
import type { Message } from "../src/types.js";

export function buildMcpServer(
  version: string,
  telemetryInfo?: () => Record<string, unknown>,
): McpServer {
  const server = new McpServer({ name: "kompress-ultra", version });

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
            messages: kept.map((m: Record<string, unknown>) => ({
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
        text: JSON.stringify(telemetryInfo?.() ?? { status: "disabled" }, null, 2),
      }],
    }),
  );

  return server;
}
