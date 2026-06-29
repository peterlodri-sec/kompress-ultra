import { describe, it, expect } from "bun:test";
import {
  isProtected,
  ebbinghausDecay,
  structuralBoost,
  scoreMessageSync,
} from "../src/scoring.js";
import type { Message } from "../src/types.js";

function msg(role: string, content: string, type?: string): Message {
  return { role, content, ...(type ? { type } : {}) };
}

describe("scoring", () => {
  describe("isProtected", () => {
    it("protects last 5 messages", () => {
      const messages = Array.from({ length: 10 }, (_, i) =>
        msg("assistant", `msg ${i}`)
      );
      // Last 5 (indices 5-9) should be protected
      expect(isProtected(messages[5], 5, 10)).toBe(true);
      expect(isProtected(messages[9], 9, 10)).toBe(true);
      expect(isProtected(messages[4], 4, 10)).toBe(false);
    });

    it("protects user messages", () => {
      expect(isProtected(msg("user", "hello"), 0, 10)).toBe(true);
    });

    it("protects messages with code fences", () => {
      expect(isProtected(msg("assistant", "```js\nconst x = 1;\n```"), 0, 10)).toBe(true);
    });

    it("protects error messages", () => {
      expect(isProtected(msg("assistant", "Error: something broke"), 0, 10)).toBe(true);
      expect(isProtected(msg("assistant", "ok", "error"), 0, 10)).toBe(true);
    });

    it("does not protect regular old messages", () => {
      expect(isProtected(msg("assistant", "just a normal message"), 0, 10)).toBe(false);
    });
  });

  describe("ebbinghausDecay", () => {
    it("returns 1 for age 0", () => {
      expect(ebbinghausDecay(0)).toBeCloseTo(1.0);
    });

    it("decays over time", () => {
      expect(ebbinghausDecay(5)).toBeLessThan(ebbinghausDecay(0));
      expect(ebbinghausDecay(10)).toBeLessThan(ebbinghausDecay(5));
    });

    it("is always positive", () => {
      for (let age = 0; age < 100; age += 5) {
        expect(ebbinghausDecay(age)).toBeGreaterThan(0);
      }
    });
  });

  describe("structuralBoost", () => {
    it("boosts user messages to 0.9", () => {
      expect(structuralBoost(msg("user", "hello"))).toBe(0.9);
    });

    it("boosts code messages to 0.8", () => {
      expect(structuralBoost(msg("assistant", "```js\nx```"))).toBe(0.8);
    });

    it("boosts error messages to 0.9", () => {
      expect(structuralBoost(msg("assistant", "Error: fail"))).toBe(0.9);
      expect(structuralBoost(msg("assistant", "ok", "error"))).toBe(0.9);
    });

    it("boosts tool messages to 0.6", () => {
      expect(structuralBoost(msg("tool", "result"))).toBe(0.6);
    });

    it("returns 0.3 for plain assistant messages", () => {
      expect(structuralBoost(msg("assistant", "hello"))).toBe(0.3);
    });
  });

  describe("scoreMessageSync", () => {
    it("returns a valid score", () => {
      const score = scoreMessageSync(msg("assistant", "hello"), 0, 10);
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(1);
      expect(typeof score.protected).toBe("boolean");
    });

    it("gives higher total to protected messages", () => {
      const userScore = scoreMessageSync(msg("user", "hello"), 0, 10);
      const oldAssistant = scoreMessageSync(msg("assistant", "hello"), 0, 10);
      expect(userScore.total).toBeGreaterThanOrEqual(oldAssistant.total);
    });

    it("gives higher recency to recent messages", () => {
      const recent = scoreMessageSync(msg("assistant", "hello"), 8, 10);
      const old = scoreMessageSync(msg("assistant", "hello"), 0, 10);
      expect(recent.recency).toBeGreaterThan(old.recency);
    });
  });
});
