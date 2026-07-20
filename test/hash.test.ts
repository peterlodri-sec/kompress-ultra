import { describe, it, expect } from "bun:test";
import { hashEmbedding, cosineSimilarity } from "../src/hash.js";

describe("hashEmbedding", () => {
  it("returns a vector of default dimension 768", () => {
    expect(hashEmbedding("hello").length).toBe(768);
  });

  it("respects custom dimension", () => {
    expect(hashEmbedding("hello", 128).length).toBe(128);
  });

  it("is deterministic", () => {
    const a = hashEmbedding("deterministic test");
    const b = hashEmbedding("deterministic test");
    expect(a).toEqual(b);
  });

  it("returns zero vector for empty string", () => {
    const vec = hashEmbedding("");
    expect(vec.every((v) => v === 0)).toBe(true);
  });

  it("returns a unit-normalized vector", () => {
    const vec = hashEmbedding("hello world");
    const mag = Math.sqrt(vec.reduce((a, v) => a + v * v, 0));
    expect(mag).toBeCloseTo(1, 6);
  });

  it("different inputs produce different vectors", () => {
    const a = hashEmbedding("apple");
    const b = hashEmbedding("banana");
    expect(a).not.toEqual(b);
  });

  it("case-insensitive", () => {
    const a = hashEmbedding("Hello World");
    const b = hashEmbedding("hello world");
    expect(a).toEqual(b);
  });
});

describe("cosineSimilarity", () => {
  it("identical vectors return 1", () => {
    const v = hashEmbedding("same text");
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 6);
  });

  it("same text hash returns 1", () => {
    const a = hashEmbedding("identical");
    const b = hashEmbedding("identical");
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 6);
  });

  it("orthogonal vectors return 0", () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("mismatched lengths return 0", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("zero vectors return 0", () => {
    expect(cosineSimilarity([0, 0, 0], [0, 0, 0])).toBe(0);
  });

  it("overlapping words produce similarity > 0", () => {
    const a = hashEmbedding("hello world foo");
    const b = hashEmbedding("hello world bar");
    expect(cosineSimilarity(a, b)).toBeGreaterThan(0);
  });

  it("opposite vectors return -1 (range is [-1, 1] for arbitrary input)", () => {
    expect(cosineSimilarity([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1, 6);
  });

  it("completely different texts produce similarity < 1", () => {
    const a = hashEmbedding("apple banana cherry");
    const b = hashEmbedding("xray yoyo zebra");
    expect(cosineSimilarity(a, b)).toBeLessThan(1);
  });
});
