import type { Message, AgentTokenBudget } from "./types.js";
import { compressMessage, CompressionLevel } from "./rewriter.js";
import { isProtected } from "./scoring.js";

export function estimateTokens(text: string): number {
  const len = text.length;
  if (len === 0) return 1;
  return Math.max(1, Math.min(4096, Math.ceil(len / 4)));
}

export const DEFAULT_BUDGETS: Record<string, AgentTokenBudget> = {
  coder: { agent_type: "coder", max_context_tokens: 100_000, compression_aggressiveness: 0.8, brain_injection_budget: 500 },
  researcher: { agent_type: "researcher", max_context_tokens: 128_000, compression_aggressiveness: 0.4, brain_injection_budget: 1000 },
  reviewer: { agent_type: "reviewer", max_context_tokens: 64_000, compression_aggressiveness: 0.6, brain_injection_budget: 500 },
  orchestrator: { agent_type: "orchestrator", max_context_tokens: 128_000, compression_aggressiveness: 0.5, brain_injection_budget: 800 },
};

export function escalateForBudget(
  messages: Message[],
  budget: AgentTokenBudget,
): Message[] {
  const currentTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  if (currentTokens <= budget.max_context_tokens) return messages;

  let result = messages.map((msg, i) => {
    const age = messages.length - i;
    if (age <= 5) return msg;
    return { ...msg, content: compressMessage(msg.content, CompressionLevel.Ultra) };
  });

  if (result.reduce((sum, m) => sum + estimateTokens(m.content), 0) <= budget.max_context_tokens) {
    return result;
  }

  result = result.filter((msg, i) => {
    if (isProtected(msg, i, result.length)) return true;
    return true;
  });

  return result;
}
