import { describe, it, expect, afterEach } from "bun:test";
import {
  estimateTokens,
  escalateForBudget,
  getBudget,
  totalTokens,
  DEFAULT_BUDGETS,
  setTokenEstimator,
} from "../src/token-budget.js";
import type { Message, AgentTokenBudget } from "../src/types.js";

function msg(content: string): Message {
  return { role: "assistant", content };
}

describe("token-budget", () => {
  describe("estimateTokens", () => {
    it("returns 1 for empty string", () => {
      expect(estimateTokens("")).toBe(1);
    });

    it("estimates ~1 token per 4 chars", () => {
      expect(estimateTokens("1234")).toBe(1);
      expect(estimateTokens("12345678")).toBe(2);
    });

    it("caps at 4096", () => {
      const huge = "x".repeat(100_000);
      expect(estimateTokens(huge)).toBe(4096);
    });
  });

  describe("totalTokens", () => {
    it("sums token estimates", () => {
      const messages = [msg("1234"), msg("12345678")];
      expect(totalTokens(messages)).toBe(3);
    });

    it("returns 0 for empty array", () => {
      expect(totalTokens([])).toBe(0);
    });
  });

  describe("getBudget", () => {
    it("returns budget for each agent type", () => {
      expect(getBudget("coder").max_context_tokens).toBe(100_000);
      expect(getBudget("researcher").max_context_tokens).toBe(128_000);
      expect(getBudget("reviewer").max_context_tokens).toBe(64_000);
      expect(getBudget("orchestrator").max_context_tokens).toBe(128_000);
    });

    it("falls back to coder for unknown type", () => {
      const b = getBudget("unknown" as any);
      expect(b.agent_type).toBe("coder");
    });
  });

  describe("escalateForBudget", () => {
    it("returns messages unchanged if under budget", () => {
      const messages = [msg("short")];
      const budget = getBudget("coder");
      const result = escalateForBudget(messages, budget);
      expect(result).toEqual(messages);
    });

    it("compresses old messages when over budget", () => {
      // Create messages that exceed a small budget
      const smallBudget: AgentTokenBudget = {
        agent_type: "coder",
        max_context_tokens: 50,
        compression_aggressiveness: 0.8,
        brain_injection_budget: 500,
      };
      const messages = Array.from({ length: 20 }, (_, i) =>
        msg(`Message ${i}: ${"x".repeat(100)}`)
      );
      const result = escalateForBudget(messages, smallBudget);
      // Should have fewer total tokens
      expect(totalTokens(result)).toBeLessThanOrEqual(smallBudget.max_context_tokens + 1000);
    });

    it("always keeps last 5 messages", () => {
      const smallBudget: AgentTokenBudget = {
        agent_type: "coder",
        max_context_tokens: 50,
        compression_aggressiveness: 0.8,
        brain_injection_budget: 500,
      };
      const messages = Array.from({ length: 20 }, (_, i) =>
        msg(`Message ${i}: ${"x".repeat(100)}`)
      );
      const result = escalateForBudget(messages, smallBudget);
      // Last 5 should still be there (roles match)
      const last5Original = messages.slice(15).map((m) => m.content);
      const resultContents = result.map((m) => m.content);
      for (const content of last5Original) {
        expect(resultContents).toContain(content);
      }
    });
  });

  describe("DEFAULT_BUDGETS", () => {
    it("has all 4 agent types", () => {
      expect(Object.keys(DEFAULT_BUDGETS)).toEqual(
        expect.arrayContaining(["coder", "researcher", "reviewer", "orchestrator"])
      );
    });

    it("each budget has required fields", () => {
      for (const budget of Object.values(DEFAULT_BUDGETS)) {
        expect(typeof budget.agent_type).toBe("string");
        expect(typeof budget.max_context_tokens).toBe("number");
        expect(typeof budget.compression_aggressiveness).toBe("number");
        expect(typeof budget.brain_injection_budget).toBe("number");
      }
    });
  });

  describe("pluggable token estimator", () => {
    afterEach(() => {
      // Reset to default estimator
      setTokenEstimator((text) => {
        const len = text.length;
        if (len === 0) return 1;
        return Math.max(1, Math.min(4096, Math.ceil(len / 4)));
      });
    });

    it("accepts a custom estimator", () => {
      // Custom: count words instead of chars
      setTokenEstimator((text) => text.split(/\s+/).filter(Boolean).length || 1);
      expect(estimateTokens("hello world")).toBe(2);
      expect(estimateTokens("one two three four five")).toBe(5);
    });

    it("custom estimator used by totalTokens", () => {
      setTokenEstimator(() => 10);
      const messages = [msg("a"), msg("b"), msg("c")];
      expect(totalTokens(messages)).toBe(30);
    });
  });
});
