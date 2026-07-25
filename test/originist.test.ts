import { describe, it, expect } from "bun:test";
import {
  Originist,
  createOriginist,
  generationRisk,
  trustWeight,
  asymmetricLossWithOrigin,
  originAdjustedScore,
  nextGeneration,
  isCriticalContent,
  ORIGIN_LAMBDA,
  GENERATION_RISK_STEP,
  GENERATION_RISK_CAP,
} from "../src/originist.js";

describe("originist pure helpers", () => {
  it("generation 0 has zero risk and full trust", () => {
    expect(generationRisk(0, true)).toBe(0);
    expect(trustWeight(0, true)).toBe(1);
  });

  it("risk grows with generation and caps", () => {
    const r1 = generationRisk(1, true);
    const r3 = generationRisk(3, true);
    const r20 = generationRisk(20, true);
    expect(r3).toBeGreaterThan(r1);
    expect(r20).toBe(GENERATION_RISK_CAP);
  });

  it("critical accrues risk faster than non-critical", () => {
    expect(generationRisk(2, true)).toBeGreaterThan(generationRisk(2, false));
  });

  it("asymmetric loss multiplies drop-side cost by generation risk", () => {
    const threshold = 0.35;
    const score = 0.1;
    const g0 = asymmetricLossWithOrigin(score, threshold, 0, true);
    const g3 = asymmetricLossWithOrigin(score, threshold, 3, true);
    expect(g0).toBeCloseTo(ORIGIN_LAMBDA * (threshold - score), 10);
    expect(g3).toBeGreaterThan(g0);
  });

  it("keep-side loss ignores generation", () => {
    const k0 = asymmetricLossWithOrigin(0.9, 0.35, 0, true);
    const k5 = asymmetricLossWithOrigin(0.9, 0.35, 5, true);
    expect(k0).toBeCloseTo(k5, 12);
  });

  it("originAdjustedScore reduces keep score by trust", () => {
    const adj = originAdjustedScore(1.0, 3, true);
    expect(adj).toBeLessThan(1);
    expect(adj).toBeGreaterThan(0);
    expect(originAdjustedScore(0.8, 0, true)).toBeCloseTo(0.8, 10);
  });

  it("nextGeneration bumps only when content changes away from original", () => {
    expect(nextGeneration(0, "h-a", "h-a", false)).toBe(0);
    expect(nextGeneration(0, "h-a", "h-b", true)).toBe(1);
    expect(nextGeneration(2, "h-a", "h-a", true)).toBe(0); // recovered original
  });

  it("isCriticalContent matches safety-floor sketches", () => {
    expect(isCriticalContent("/usr/bin/cargo")).toBe(true);
    expect(isCriticalContent("foo::bar")).toBe(true);
    expect(isCriticalContent("```code```")).toBe(true);
    expect(isCriticalContent("Error: boom")).toBe(true);
    expect(isCriticalContent("hello world")).toBe(false);
  });
});

describe("Originist class", () => {
  it("tags fresh content at generation 0", () => {
    const o = createOriginist();
    const p = o.tag({ id: "m1", content: "fact A", is_critical: true });
    expect(p.generation).toBe(0);
    expect(o.getGeneration("m1")).toBe(0);
    expect(o.risk("m1")).toBe(0);
  });

  it("recordRewrite bumps generation when text changes", () => {
    const o = createOriginist();
    o.tag({ id: "m1", content: "original fact", is_critical: true });
    const p = o.recordRewrite("m1", "compressed fact");
    expect(p.generation).toBe(1);
    o.recordRewrite("m1", "even shorter");
    expect(o.getGeneration("m1")).toBe(2);
  });

  it("noop rewrite does not bump", () => {
    const o = createOriginist();
    o.tag({ id: "m1", content: "same" });
    expect(o.recordRewrite("m1", "same").generation).toBe(0);
  });

  it("reanchor resets to generation 0", () => {
    const o = createOriginist();
    o.tag({ id: "m1", content: "v1", is_critical: true });
    o.recordRewrite("m1", "v2");
    o.recordRewrite("m1", "v3");
    expect(o.getGeneration("m1")).toBe(2);
    const p = o.reanchor("m1", "v3");
    expect(p?.generation).toBe(0);
    expect(o.risk("m1")).toBe(0);
  });

  it("adjustedScore and loss use stored provenance", () => {
    const o = createOriginist();
    o.tag({ id: "m1", content: "crit /path/to/file", is_critical: true });
    o.recordRewrite("m1", "crit path file");
    o.recordRewrite("m1", "crit path");
    const score = 0.2;
    const threshold = 0.35;
    expect(o.adjustedScore("m1", 1.0)).toBeLessThan(1.0);
    expect(o.loss("m1", score, threshold)).toBeGreaterThan(
      asymmetricLossWithOrigin(score, threshold, 0, true),
    );
  });

  it("unknown id is generation 0 / pass-through score", () => {
    const o = createOriginist();
    expect(o.getGeneration("nope")).toBe(0);
    expect(o.adjustedScore("nope", 0.77)).toBe(0.77);
    expect(o.risk("nope")).toBe(0);
  });

  it("snapshot exports all provenance", () => {
    const o = createOriginist();
    o.tag({ id: "a", content: "1" });
    o.tag({ id: "b", content: "2" });
    expect(o.snapshot()).toHaveLength(2);
    o.clear();
    expect(o.size()).toBe(0);
  });

  it("instances are isolated", () => {
    const o1 = createOriginist();
    const o2 = createOriginist();
    o1.tag({ id: "x", content: "only o1" });
    expect(o1.size()).toBe(1);
    expect(o2.size()).toBe(0);
  });
});

describe("originist × archivist handoff shape", () => {
  it("generation can travel with an archive record payload", () => {
    const o = createOriginist();
    o.tag({ id: "drop-1", content: "important path /etc/hosts", is_critical: true });
    o.recordRewrite("drop-1", "hosts path summary");
    const gen = o.getGeneration("drop-1");
    expect(gen).toBe(1);
    // Shape check: Archivist.record accepts generation (integration is call-site).
    expect(typeof gen).toBe("number");
    expect(GENERATION_RISK_STEP).toBeGreaterThan(0);
    expect(GENERATION_RISK_CAP).toBeGreaterThan(GENERATION_RISK_STEP);
  });
});
