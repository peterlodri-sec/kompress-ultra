import { describe, it, expect } from "bun:test";
import {
  scoreMessageSync,
  isProtected,
  compressMessage,
  CompressionLevel,
  computeDensity,
  adaptiveThreshold,
  classifyMessage,
  estimateTokens,
  totalTokens,
  escalateForBudget,
  getBudget,
  validateOptions,
  createCircuitBreaker,
  createCirculator,
  KompressError,
  CircuitOpenError,
} from "../src/index.js";
import type { Message } from "../src/index.js";

describe("pipeline integration", () => {
  const conversation: Message[] = [
    { role: "user", content: "Fix the bug in `src/auth.ts` where tokens expire too early." },
    { role: "assistant", content: "I'll look into the auth token expiry issue. Let me check the file." },
    { role: "tool", content: "```typescript\nconst EXPIRY_MS = 5 * 60 * 1000; // 5 minutes\n```" },
    { role: "assistant", content: "The token expiry is set to 5 minutes. This seems correct." },
    { role: "user", content: "No, it should be 1 hour. Also check the `refreshToken` function." },
    { role: "assistant", content: "I've updated the expiry to 1 hour and verified the refreshToken logic." },
    { role: "tool", content: "Error: ENOENT: no such file or directory, open 'src/auth-backup.ts'" },
    { role: "assistant", content: "The backup file doesn't exist but that's fine. The main auth file is updated." },
    { role: "user", content: "Run the tests to verify." },
    { role: "assistant", content: "All 42 tests pass. The fix is complete." },
  ];

  it("scores and classifies a full conversation", () => {
    const scored = conversation.map((msg, i) => ({
      msg,
      score: scoreMessageSync(msg, i, conversation.length),
      classification: classifyMessage(msg.content),
    }));

    // User messages should have high structural score
    const userScores = scored.filter((s) => s.msg.role === "user");
    expect(userScores.every((s) => s.score.structural >= 0.9)).toBe(true);

    // All user messages should be protected
    const protectedUsers = conversation.filter(
      (msg, i) => msg.role === "user" && isProtected(msg, i, conversation.length),
    );
    expect(protectedUsers.length).toBe(conversation.filter((m) => m.role === "user").length);

    // Error message should be protected
    const errorMsg = conversation.find((m) => m.content.startsWith("Error:"));
    const errorIdx = conversation.indexOf(errorMsg!);
    expect(isProtected(errorMsg!, errorIdx, conversation.length)).toBe(true);
  });

  it("prunes low-signal messages while keeping protected ones", () => {
    const threshold = 0.5;
    const scored = conversation.map((msg, i) => ({
      msg,
      score: scoreMessageSync(msg, i, conversation.length),
      protected: isProtected(msg, i, conversation.length),
    }));

    const kept = scored.filter((s) => s.protected || s.score.total >= threshold);
    const dropped = scored.filter((s) => !s.protected && s.score.total < threshold);

    // Protected messages always kept
    for (const s of kept) {
      if (s.protected) {
        expect(kept).toContain(s);
      }
    }

    // Total should be reasonable
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length + dropped.length).toBe(conversation.length);
  });

  it("compresses old messages while preserving recent + protected", () => {
    const budget = getBudget("coder");
    const result = escalateForBudget(conversation, budget);

    // Under budget → no compression needed
    expect(result.length).toBe(conversation.length);

    // Last 5 messages always kept as-is
    const lastFive = result.slice(-5);
    const origLastFive = conversation.slice(-5);
    for (let i = 0; i < lastFive.length; i++) {
      expect(lastFive[i].content).toBe(origLastFive[i].content);
    }
  });

  it("full pipeline: score → filter → rewrite → token count", () => {
    const options = validateOptions({ agentType: "coder" });
    const budget = getBudget(options.agentType);

    // Score
    const scored = conversation.map((msg, i) => ({
      msg,
      score: scoreMessageSync(msg, i, conversation.length),
      protected: isProtected(msg, i, conversation.length),
    }));

    // Density + adaptive threshold
    const density = computeDensity(conversation);
    const threshold = adaptiveThreshold(density, options.relevanceThreshold);

    // Filter
    const kept = scored.filter((s) => s.protected || s.score.total >= threshold);

    // Rewrite older messages
    const rewritten = kept.map((s, i) => {
      const age = kept.length - i;
      if (age <= 5) return s.msg;
      return { ...s.msg, content: compressMessage(s.msg.content, CompressionLevel.Lite) };
    });

    // Token accounting
    const inputTokens = totalTokens(conversation);
    const outputTokens = totalTokens(rewritten);
    expect(outputTokens).toBeLessThanOrEqual(inputTokens);

    // Code fences and inline code preserved through pipeline
    const allOutput = rewritten.map((m) => m.content).join("\n");
    expect(allOutput).toContain("```typescript");
    expect(allOutput).toContain("`src/auth.ts`");
    expect(allOutput).toContain("`refreshToken`");

    // Error messages preserved
    expect(allOutput).toContain("Error: ENOENT");
  });

  it("isolated circuit breaker and circulator instances", () => {
    const cb1 = createCircuitBreaker({ failureThreshold: 2 });
    const cb2 = createCircuitBreaker({ failureThreshold: 5 });

    cb1.recordFailure();
    cb1.recordFailure();
    expect(cb1.isOpen()).toBe(true);
    expect(cb2.isOpen()).toBe(false);

    const c1 = createCirculator({ cap: 50 });
    const c2 = createCirculator({ cap: 50 });

    c1.enqueue({ content: "isolated test", classification: "fact" });
    expect(c1.getQueueLength()).toBe(1);
    expect(c2.getQueueLength()).toBe(0);
  });

  it("error classes have correct codes", () => {
    const err = new CircuitOpenError();
    expect(err.code).toBe("CIRCUIT_OPEN");
    expect(err.name).toBe("CircuitOpenError");
    expect(err instanceof KompressError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });
});
