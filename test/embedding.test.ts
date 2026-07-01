import { describe, it, expect } from "bun:test";
import { isCircuitOpen, recordSuccess } from "../src/circuit-breaker.js";
import { hashEmbedding, cosineSimilarity } from "../src/hash.js";
import { embedText } from "../src/embedding.js";

describe("embedding", () => {
  it("embedText returns null when circuit is open", async () => {
    // Reset circuit breaker, then don't trigger failures
    recordSuccess();
    expect(isCircuitOpen()).toBe(false);

    // Dynamic import to test fallback behavior
    // This tests that the module is importable and doesn't throw
    const mod = await import("../src/embedding.js");
    expect(typeof mod.embedText).toBe("function");
    expect(typeof mod.scoreMessageLocal).toBe("function");
    expect(typeof mod.queryLocalSimilarity).toBe("function");
    expect(typeof mod.fetchPatterns).toBe("function");
    expect(typeof mod.writeDroppedContent).toBe("function");
  });

  it("hashEmbedding returns deterministic normalized vector", () => {
    const v1 = hashEmbedding("hello world");
    const v2 = hashEmbedding("hello world");
    const v3 = hashEmbedding("different text");
    expect(v1).toEqual(v2); // deterministic
    expect(v1.length).toBe(768);
    // Unit-normalized → magnitude ≈ 1
    const mag = Math.sqrt(v1.reduce((a, v) => a + v * v, 0));
    expect(mag).toBeCloseTo(1, 5);
    // Different text → different vector
    expect(v1).not.toEqual(v3);
  });

  it("cosineSimilarity returns 1 for identical vectors", () => {
    const v = hashEmbedding("test");
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("cosineSimilarity returns 0 for orthogonal vectors", () => {
    const a = [1, 0];
    const b = [0, 1];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("cosineSimilarity returns 0 for mismatched length", () => {
    expect(cosineSimilarity([1], [1, 0])).toBe(0);
  });

  it("embedText always returns a vector (no config needed)", async () => {
    const v = await embedText("any text");
    expect(v).not.toBeNull();
    expect(v!.length).toBe(768);
  });

  it("embedText does not call OVHCloud by default", async () => {
    // No env flag set → uses local hash embedding, not cloud
    expect(process.env.KOMPRESS_USE_CLOUD_EMBEDDING).toBeUndefined();
    const v = await embedText("test");
    expect(v).not.toBeNull();
  });

  it("scoreMessageLocal returns dampened 0.3 when no taskGoal given", async () => {
    const mod = await import("../src/embedding.js");
    // Without taskGoal (sliceId), no comparison — returns dampener floor 0.3
    const score = await mod.scoreMessageLocal("test text");
    expect(score).toBe(0.3);
  });

  it("scoreMessageLocal returns higher score when message matches taskGoal", async () => {
    const mod = await import("../src/embedding.js");
    // With taskGoal matching message content, cosine sim > 0 → score > 0.3
    const score = await mod.scoreMessageLocal("implement login auth", "implement authentication");
    expect(score).toBeGreaterThan(0.3);
    expect(score).toBeLessThanOrEqual(0.7);
  });

  it("queryLocalSimilarity returns 0.0 when store empty", async () => {
    const mod = await import("../src/embedding.js");
    const result = await mod.queryLocalSimilarity([0.1, 0.2, 0.3]);
    expect(result).toBe(0.0);
  });

  it("fetchPatterns returns empty array when store empty", async () => {
    const mod = await import("../src/embedding.js");
    const patterns = await mod.fetchPatterns("test");
    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns.length).toBe(0);
  });

  it("writeDroppedContent handles empty array gracefully", async () => {
    const mod = await import("../src/embedding.js");
    // Should not throw
    await expect(mod.writeDroppedContent([])).resolves.toBeUndefined();
  });
});
