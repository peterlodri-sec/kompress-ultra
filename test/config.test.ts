import { describe, it, expect } from "bun:test";
import { validateOptions, DEFAULT_OPTIONS } from "../src/types.js";

describe("config validation", () => {
  it("returns defaults when no options provided", () => {
    const result = validateOptions({});
    expect(result).toEqual(DEFAULT_OPTIONS);
  });

  it("merges partial options with defaults", () => {
    const result = validateOptions({ relevanceThreshold: 0.5 });
    expect(result.relevanceThreshold).toBe(0.5);
    expect(result.maxMessagesKept).toBe(DEFAULT_OPTIONS.maxMessagesKept);
  });

  it("rejects negative relevanceThreshold", () => {
    expect(() => validateOptions({ relevanceThreshold: -0.1 })).toThrow("relevanceThreshold");
  });

  it("rejects relevanceThreshold above 1", () => {
    expect(() => validateOptions({ relevanceThreshold: 1.5 })).toThrow("relevanceThreshold");
  });

  it("rejects non-positive maxMessagesKept", () => {
    expect(() => validateOptions({ maxMessagesKept: 0 })).toThrow("maxMessagesKept");
  });

  it("rejects aggression out of range", () => {
    expect(() => validateOptions({ aggression: 1.5 })).toThrow("aggression");
    expect(() => validateOptions({ aggression: -0.1 })).toThrow("aggression");
  });

  it("rejects negative pollIntervalMs", () => {
    expect(() => validateOptions({ pollIntervalMs: -100 })).toThrow("pollIntervalMs");
  });

  it("rejects invalid agentType", () => {
    expect(() => validateOptions({ agentType: "invalid" as any })).toThrow("agentType");
  });

  it("accepts valid agentTypes", () => {
    for (const type of ["coder", "researcher", "reviewer", "orchestrator"] as const) {
      const result = validateOptions({ agentType: type });
      expect(result.agentType).toBe(type);
    }
  });
});
