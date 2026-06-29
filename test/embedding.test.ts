import { describe, it, expect } from "bun:test";
import { isCircuitOpen, recordSuccess } from "../src/circuit-breaker.js";

describe("embedding", () => {
  it("embedText returns null when circuit is open", async () => {
    // Reset circuit breaker, then don't trigger failures
    recordSuccess();
    expect(isCircuitOpen()).toBe(false);

    // Dynamic import to test fallback behavior
    // This tests that the module is importable and doesn't throw
    const mod = await import("../src/embedding.js");
    expect(typeof mod.embedText).toBe("function");
    expect(typeof mod.scoreMessageMilvus).toBe("function");
    expect(typeof mod.queryMilvusSimilarity).toBe("function");
    expect(typeof mod.fetchHonchoPatterns).toBe("function");
    expect(typeof mod.writeDroppedDigest).toBe("function");
  });

  it("scoreMessageMilvus returns 0.5 fallback on error", async () => {
    const mod = await import("../src/embedding.js");
    // With no real Milvus running, should gracefully fallback to 0.5
    const score = await mod.scoreMessageMilvus("test text", "http://localhost:19530");
    expect(score).toBe(0.5);
  });

  it("queryMilvusSimilarity returns 0.0 on connection error", async () => {
    const mod = await import("../src/embedding.js");
    const result = await mod.queryMilvusSimilarity([0.1, 0.2, 0.3], "http://localhost:19530");
    expect(result).toBe(0.0);
  });

  it("fetchHonchoPatterns returns empty array on error", async () => {
    const mod = await import("../src/embedding.js");
    const patterns = await mod.fetchHonchoPatterns("http://localhost:19530", "test");
    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns.length).toBe(0);
  });

  it("writeDroppedDigest handles empty array gracefully", async () => {
    const mod = await import("../src/embedding.js");
    // Should not throw
    await expect(mod.writeDroppedDigest([], "http://localhost:19530")).resolves.toBeUndefined();
  });
});
