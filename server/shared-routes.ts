/**
 * shared-routes.ts — Pure route handler logic (platform-agnostic)
 *
 * Extracted from worker.ts and cloudrun.ts to eliminate ~250 lines of
 * duplicated REST/MCP handler code. Each function takes typed data and
 * returns typed data — no Request, Response, or Hono context dependency.
 *
 * Import these in transport-specific files and wrap with telemetry + HTTP.
 */

import {
  scoreMessageSync,
  isProtected,
  compressMessage,
  CompressionLevel,
  estimateTokens,
  getBudget,
  totalTokens,
  isCircuitOpen,
  getCircuitState,
} from "../src/index.js";
import type { Message, AgentType, AgentTokenBudget } from "../src/types.js";

// ── Compress ──────────────────────────────────────────────────────────

export interface ProcessedMessage {
  role: string;
  content: string;
  _score: number;
  _protected: boolean;
}

export interface CompressResult {
  kept: ProcessedMessage[];
  dropped: ProcessedMessage[];
  inputTokens: number;
  outputTokens: number;
  threshold: number;
  agentType: string;
}

export function processCompress(
  messages: Message[],
  agentType?: string,
  aggression?: number,
): CompressResult {
  const effectiveAgent = (agentType ?? "coder") as AgentType;
  const budget = getBudget(effectiveAgent);
  const threshold = aggression ?? budget.compression_aggressiveness;

  const scored = messages.map((m, i) => {
    const score = scoreMessageSync(m, i, messages.length);
    const protected_ = isProtected(m, i, messages.length);
    return { ...m, _score: score.total, _protected: protected_ };
  });

  const kept = scored.filter((m) => m._protected || m._score >= threshold);
  const dropped = scored.filter((m) => !m._protected && m._score < threshold);
  const inputTokens = totalTokens(messages);
  const outputTokens = totalTokens(kept.map((m) => ({ role: m.role, content: m.content })));

  return { kept, dropped, inputTokens, outputTokens, threshold, agentType: effectiveAgent };
}

export function computeSavingsPct(inputTokens: number, outputTokens: number): number {
  return inputTokens > 0
    ? parseFloat(((1 - outputTokens / inputTokens) * 100).toFixed(1))
    : 0;
}

// ── Score ─────────────────────────────────────────────────────────────

export interface ScoredMessage {
  role: string;
  content: string;
  score: number;
  protected: boolean;
  tokens: number;
}

export function processScore(messages: Message[]): ScoredMessage[] {
  return messages.map((m, i) => ({
    role: m.role,
    content: m.content,
    score: scoreMessageSync(m, i, messages.length).total,
    protected: isProtected(m, i, messages.length),
    tokens: estimateTokens(m.content),
  }));
}

// ── Rewrite ───────────────────────────────────────────────────────────

export interface RewriteResult {
  rewritten: string;
  level: string;
  originalTokens: number;
  rewrittenTokens: number;
  savingsPct: number;
}

export function processRewrite(content: string, level?: string): RewriteResult {
  const levelMap: Record<string, CompressionLevel> = {
    verbatim: CompressionLevel.Verbatim,
    lite: CompressionLevel.Lite,
    ultra: CompressionLevel.Ultra,
  };
  const effectiveLevel = levelMap[level ?? "lite"] ?? CompressionLevel.Lite;
  const rewritten = compressMessage(content, effectiveLevel);
  const originalTokens = estimateTokens(content);
  const rewrittenTokens = estimateTokens(rewritten);

  return {
    rewritten,
    level: level ?? "lite",
    originalTokens,
    rewrittenTokens,
    savingsPct: parseFloat(
      ((1 - rewrittenTokens / Math.max(originalTokens, 1)) * 100).toFixed(1),
    ),
  };
}

// ── Response builders ─────────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  version: string;
  telemetry: string;
  circuit_breaker: { open: boolean; failures: number; openUntil: number };
  timestamp: string;
}

export function buildHealthResponse(version: string, hasTelemetry: boolean): HealthResponse {
  return {
    status: "ok",
    version,
    telemetry: hasTelemetry ? "on" : "off",
    circuit_breaker: { open: isCircuitOpen(), ...getCircuitState() },
    timestamp: new Date().toISOString(),
  };
}

export interface StatusResponse {
  status: string;
  version: string;
  timestamp: string;
}

export function buildStatusResponse(version: string): StatusResponse {
  return {
    status: "live",
    version,
    timestamp: new Date().toISOString(),
  };
}

export function buildBudgetResponse(agentType?: string): AgentTokenBudget {
  return getBudget((agentType ?? "coder") as AgentType);
}

export interface RootResponse {
  name: string;
  version: string;
  mcp: string;
  rest: Record<string, string>;
  docs: string;
  telemetry: string;
  runtime?: string;
}

export function buildRootResponse(version: string, telemetryUrl: string, runtime?: string): RootResponse {
  return {
    name: "kompress-ultra API",
    version,
    ...(runtime ? { runtime } : {}),
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
    telemetry: telemetryUrl,
  };
}


