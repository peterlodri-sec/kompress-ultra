import { describe, it, expect } from "bun:test";
import { computeDensity, adaptiveThreshold } from "../src/compression.js";
import type { Message } from "../src/types.js";

function msgs(n: number): Message[] {
  return Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `Message ${i}`,
  }));
}

describe("compression", () => {
  describe("computeDensity", () => {
    it("returns 0 for empty or single message", () => {
      expect(computeDensity([])).toBe(0.0);
      expect(computeDensity(msgs(1))).toBe(0.0);
    });

    it("returns between 0 and 1", () => {
      expect(computeDensity(msgs(10))).toBeGreaterThan(0);
      expect(computeDensity(msgs(10))).toBeLessThanOrEqual(1);
    });

    it("higher density for shorter conversations", () => {
      const short = computeDensity(msgs(4));
      const long = computeDensity(msgs(40));
      expect(short).toBeGreaterThanOrEqual(long);
    });
  });

  describe("adaptiveThreshold", () => {
    it("clamps between 0.4 and 0.8", () => {
      const low = adaptiveThreshold(0.0, 0.65);
      const high = adaptiveThreshold(1.0, 0.65);
      expect(low).toBeGreaterThanOrEqual(0.4);
      expect(low).toBeLessThanOrEqual(0.8);
      expect(high).toBeGreaterThanOrEqual(0.4);
      expect(high).toBeLessThanOrEqual(0.8);
    });

    it("adjusts based on density", () => {
      const sparse = adaptiveThreshold(0.1, 0.65);
      const dense = adaptiveThreshold(0.9, 0.65);
      // Higher density should give lower threshold (keep more)
      expect(dense).toBeLessThanOrEqual(sparse);
    });
  });
});
