import { describe, it, expect } from "bun:test";
import { heal, summarize } from "../src/topology-healer.js";
import type { Node, Edge } from "../src/types.js";

function makeNode(overrides: Partial<Node> = {}): Node {
  return {
    id: "n1",
    label: "test-node",
    type: "concept",
    layer: "core",
    metadata: {},
    score: 1,
    createdAtMs: 0,
    lastActiveMs: 0,
    state: "alive",
    ...overrides,
  };
}

function makeEdge(overrides: Partial<Edge> = {}): Edge {
  return {
    id: "e1",
    source: "n1",
    target: "n2",
    type: "semantic",
    label: "test-edge",
    weight: 1,
    conductivity: 0.5,
    direction: "bidirectional",
    createdAtMs: 0,
    lastTraversedMs: 0,
    ...overrides,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe("topology-healer", () => {
  describe("heal", () => {
    it("returns healthy for empty topology", () => {
      const report = heal({ nodes: [], edges: [] });
      expect(report.orphansFound).toBe(0);
      expect(report.staleEdgesPruned).toBe(0);
      expect(report.islandsDetected).toBe(0);
      expect(report.collapsedEdgesReset).toBe(0);
      expect(report.selfLoopsRemoved).toBe(0);
      expect(report.edgesReconnected).toBe(0);
      expect(report.details).toEqual([]);
    });

    it("detects orphan nodes", () => {
      const nodes = [makeNode({ id: "n1" }), makeNode({ id: "n2" })];
      const edges = [makeEdge({ source: "n1", target: "n2" })];
      const report = heal({ nodes, edges });
      expect(report.orphansFound).toBe(0);

      // Add an orphan
      const orphan = makeNode({ id: "n3", label: "loner" });
      const report2 = heal({ nodes: [...nodes, orphan], edges });
      expect(report2.orphansFound).toBe(1);
      expect(report2.details.some((d) => d.includes("loner"))).toBe(true);
    });

    it("excludes dormant nodes from orphan detection", () => {
      const nodes = [
        makeNode({ id: "n1" }),
        makeNode({ id: "n2", state: "dormant" }),
      ];
      const report = heal({ nodes, edges: [] });
      expect(report.orphansFound).toBe(1); // only n1, not dormant n2
    });

    it("detects stale edges (>7 days since last traversal)", () => {
      const now = Date.now();
      const fresh = makeEdge({ id: "fresh", lastTraversedMs: now - DAY_MS });
      const stale = makeEdge({
        id: "stale",
        lastTraversedMs: now - 8 * DAY_MS,
      });
      const nodes = [makeNode({ id: "n1" }), makeNode({ id: "n2" })];
      const report = heal({ nodes, edges: [fresh, stale] });
      expect(report.staleEdgesPruned).toBe(1);
      expect(report.details.some((d) => d.includes("stale"))).toBe(true);
    });

    it("ignores edges with lastTraversedMs === 0", () => {
      const never = makeEdge({ id: "never", lastTraversedMs: 0 });
      const report = heal({
        nodes: [makeNode({ id: "n1" }), makeNode({ id: "n2" })],
        edges: [never],
      });
      expect(report.staleEdgesPruned).toBe(0);
    });

    it("detects singleton islands", () => {
      const island = makeNode({ id: "isolated" });
      const connected = makeNode({ id: "connected" });
      const edge = makeEdge({ source: "connected", target: "other" });
      const other = makeNode({ id: "other" });
      const report = heal({
        nodes: [island, connected, other],
        edges: [edge],
      });
      expect(report.islandsDetected).toBe(1);
      expect(report.details.some((d) => d.includes("isolated"))).toBe(true);
    });

    it("excludes dormant nodes from island detection", () => {
      const dormant = makeNode({ id: "dormant", state: "dormant" });
      const report = heal({ nodes: [dormant], edges: [] });
      expect(report.islandsDetected).toBe(0);
    });

    it("detects collapsed conductivity (< 0.05 with weight > 0.1)", () => {
      const collapsed = makeEdge({ id: "c1", conductivity: 0.01, weight: 0.5 });
      const ok = makeEdge({ id: "ok", conductivity: 0.5, weight: 1 });
      const nodes = [makeNode({ id: "n1" }), makeNode({ id: "n2" })];
      const report = heal({ nodes, edges: [collapsed, ok] });
      expect(report.collapsedEdgesReset).toBe(1);
      expect(report.details.some((d) => d.includes("collapsed"))).toBe(true);
    });

    it("detects self-loops", () => {
      const loop = makeEdge({ id: "loop", source: "n1", target: "n1" });
      const nodes = [makeNode({ id: "n1" })];
      const report = heal({ nodes, edges: [loop] });
      expect(report.selfLoopsRemoved).toBe(1);
      expect(report.details.some((d) => d.includes("self-loop"))).toBe(true);
    });

    it("suggests reconnections for connected-orphan pairs", () => {
      // n1-n2 connected, n3 orphan — all same layer+type
      const nodes = [
        makeNode({ id: "n1", layer: "core", type: "concept" }),
        makeNode({ id: "n2", layer: "core", type: "concept" }),
        makeNode({ id: "n3", layer: "core", type: "concept" }),
      ];
      const edges = [makeEdge({ source: "n1", target: "n2" })];
      const report = heal({ nodes, edges });
      expect(report.edgesReconnected).toBeGreaterThanOrEqual(1);
      expect(report.details.some((d) => d.includes("reconnect"))).toBe(true);
    });

    it("handles all issues simultaneously", () => {
      const now = Date.now();
      const nodes = [
        makeNode({ id: "n1", layer: "core", type: "concept" }),
        makeNode({ id: "n2", layer: "core", type: "concept" }),
        makeNode({ id: "n3", layer: "core", type: "concept" }),
        makeNode({ id: "n4", state: "dormant" }),
      ];
      const edges = [
        makeEdge({ id: "e1", source: "n1", target: "n2" }),
        makeEdge({ id: "e2", source: "n1", target: "n1" }), // self-loop
        makeEdge({
          id: "e3",
          source: "n2",
          target: "n3",
          conductivity: 0.01,
          weight: 0.5,
        }), // collapsed
        makeEdge({
          id: "e4",
          source: "n3",
          target: "n2",
          lastTraversedMs: now - 10 * DAY_MS,
        }), // stale
      ];
      const report = heal({ nodes, edges });
      expect(report.orphansFound).toBe(0); // all connected
      expect(report.staleEdgesPruned).toBe(1); // e4
      expect(report.islandsDetected).toBe(0); // n4 dormant
      expect(report.collapsedEdgesReset).toBe(1); // e3
      expect(report.selfLoopsRemoved).toBe(1); // e2
      expect(report.details.length).toBeGreaterThanOrEqual(3);
    });

    it("reports a timestamp", () => {
      const report = heal({ nodes: [], edges: [] });
      expect(report.timestamp).toBeDefined();
      expect(new Date(report.timestamp).toISOString()).toBe(report.timestamp);
    });
  });

  describe("summarize", () => {
    it('returns "healthy" for clean report', () => {
      const report = heal({ nodes: [], edges: [] });
      expect(summarize(report)).toBe("healthy: no issues found");
    });

    it("lists found issues", () => {
      const now = Date.now();
      const edge = makeEdge({
        lastTraversedMs: now - 10 * DAY_MS,
        source: "n1",
        target: "n1",
      });
      const report = heal({
        nodes: [makeNode({ id: "n1" })],
        edges: [edge],
      });
      const summary = summarize(report);
      expect(summary).toContain("stale");
      expect(summary).toContain("self-loops");
    });
  });
});
