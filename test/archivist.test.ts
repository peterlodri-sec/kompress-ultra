import { describe, it, expect } from "bun:test";
import {
  Archivist,
  createArchivist,
  archiveDropped,
} from "../src/archivist.js";

describe("archivist", () => {
  it("creates isolated instances", () => {
    const a1 = createArchivist();
    const a2 = createArchivist();
    a1.record({ content: "only in a1", score: 0.2 });
    expect(a1.size()).toBe(1);
    expect(a2.size()).toBe(0);
  });

  it("is append-only — records keep distinct ids", () => {
    const a = createArchivist();
    const r1 = a.record({ content: "same text", score: 0.1, reason: "pruned" });
    const r2 = a.record({ content: "same text", score: 0.1, reason: "pruned" });
    expect(r1.id).not.toBe(r2.id);
    expect(a.size()).toBe(2);
    expect(r1.content_hash).toBe(r2.content_hash);
  });

  it("does not mutate prior records when new ones are added", () => {
    const a = createArchivist();
    const first = a.record({ content: "alpha", score: 0.4, reason: "pruned" });
    a.record({ content: "beta", score: 0.1, reason: "budget" });
    const again = a.query({ id: first.id });
    expect(again).toHaveLength(1);
    expect(again[0].residual).toBe("alpha");
    expect(again[0].score).toBe(0.4);
  });

  it("queries by reason and session", () => {
    const a = createArchivist();
    a.record({ content: "p", reason: "pruned", session_id: "s1", timestamp_ms: 10 });
    a.record({ content: "o", reason: "overflow", session_id: "s1", timestamp_ms: 20 });
    a.record({ content: "other", reason: "pruned", session_id: "s2", timestamp_ms: 30 });
    expect(a.query({ reason: "overflow" })).toHaveLength(1);
    expect(a.query({ session_id: "s1" })).toHaveLength(2);
    expect(a.query({ reason: "pruned", session_id: "s1" })[0].residual).toBe("p");
  });

  it("returns newest first and respects limit", () => {
    const a = createArchivist();
    a.record({ content: "old", timestamp_ms: 1 });
    a.record({ content: "new", timestamp_ms: 99 });
    const q = a.query({ limit: 1 });
    expect(q).toHaveLength(1);
    expect(q[0].residual).toBe("new");
  });

  it("respects memory cap without corrupting retained rows", () => {
    const a = createArchivist({ cap: 2 });
    a.record({ content: "1", timestamp_ms: 1 });
    a.record({ content: "2", timestamp_ms: 2 });
    a.record({ content: "3", timestamp_ms: 3 });
    expect(a.size()).toBe(2);
    const residuals = a.snapshot().map((r) => r.residual).sort();
    expect(residuals).toEqual(["2", "3"]);
  });

  it("archiveDropped maps compress drops into audit records", () => {
    const a = createArchivist();
    const recs = archiveDropped(
      a,
      [
        { content: "dropped low signal", score: 0.2, role: "assistant" },
        { content: "also dropped", score: 0.1, role: "tool" },
      ],
      { reason: "pruned", session_id: "sess", threshold: 0.65 },
    );
    expect(recs).toHaveLength(2);
    expect(a.size()).toBe(2);
    expect(recs[0].meta?.threshold).toBe(0.65);
    expect(recs[0].session_id).toBe("sess");
  });

  it("stores optional generation from Originist handoff", () => {
    const a = new Archivist();
    const r = a.record({
      content: "regenerated fact",
      generation: 3,
      score: 0.5,
      reason: "demoted",
    });
    expect(r.generation).toBe(3);
  });

  it("clearMemory only clears in-memory log", () => {
    const a = createArchivist();
    a.record({ content: "x" });
    a.clearMemory();
    expect(a.size()).toBe(0);
  });
});
