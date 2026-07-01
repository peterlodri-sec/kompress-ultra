import { describe, it, expect } from "bun:test";
import { EdgeRouter } from "../src/edge-router.js";
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

describe("EdgeRouter", () => {
  describe("constructor", () => {
    it("handles empty graph", () => {
      const router = new EdgeRouter([], []);
      const state = router.getState();
      expect(state.edges).toBe(0);
      expect(state.nodes).toBe(0);
    });

    it("initializes state from nodes and edges", () => {
      const nodes = [makeNode({ id: "n1" }), makeNode({ id: "n2" })];
      const edges = [makeEdge({ source: "n1", target: "n2" })];
      const router = new EdgeRouter(nodes, edges);
      const state = router.getState();
      expect(state.edges).toBe(1);
      expect(state.nodes).toBe(2);
    });
  });

  describe("route", () => {
    it("returns empty array for empty graph", () => {
      const router = new EdgeRouter([], []);
      expect(router.route("query")).toEqual([]);
    });

    it("returns results sorted by confidence descending", () => {
      const nodes = [
        makeNode({ id: "n1", layer: "core", type: "concept" }),
        makeNode({ id: "n2", layer: "core", type: "concept" }),
      ];
      const edges = [
        makeEdge({ id: "high", conductivity: 0.9 }),
        makeEdge({ id: "low", conductivity: 0.1 }),
      ];
      const router = new EdgeRouter(nodes, edges);
      const results = router.route("query");
      expect(results.length).toBe(2);
      expect(results[0].confidence).toBeGreaterThanOrEqual(results[1].confidence);
    });

    it("respects maxPaths parameter", () => {
      const nodes = [
        makeNode({ id: "n1", layer: "core", type: "concept" }),
        makeNode({ id: "n2", layer: "core", type: "concept" }),
        makeNode({ id: "n3", layer: "core", type: "concept" }),
      ];
      const edges = [
        makeEdge({ id: "e1", source: "n1", target: "n2" }),
        makeEdge({ id: "e2", source: "n2", target: "n3" }),
        makeEdge({ id: "e3", source: "n3", target: "n1" }),
      ];
      const router = new EdgeRouter(nodes, edges);
      expect(router.route("query", undefined, 2).length).toBe(2);
    });

    it("prefers same-layer edges", () => {
      const nodes = [
        makeNode({ id: "n1", layer: "core", type: "concept" }),
        makeNode({ id: "n2", layer: "core", type: "concept" }),
        makeNode({ id: "n3", layer: "edge", type: "concept" }),
      ];
      const edges = [
        makeEdge({ id: "same-layer", source: "n1", target: "n2" }),
        makeEdge({ id: "cross-layer", source: "n1", target: "n3" }),
      ];
      const router = new EdgeRouter(nodes, edges);
      const results = router.route("query");
      // same-layer edge should score higher due to layer alignment bonus
      const sameLayer = results.find((r) => r.edgeId === "same-layer")!;
      const crossLayer = results.find((r) => r.edgeId === "cross-layer")!;
      expect(sameLayer.confidence).toBeGreaterThan(crossLayer.confidence);
    });

    it("includes reason strings in results", () => {
      const nodes = [
        makeNode({ id: "n1", layer: "core", type: "concept" }),
        makeNode({ id: "n2", layer: "core", type: "concept" }),
      ];
      const edges = [makeEdge({ conductivity: 0.9 })];
      const router = new EdgeRouter(nodes, edges);
      const results = router.route("query");
      expect(results[0].reason).toBeTruthy();
      expect(typeof results[0].reason).toBe("string");
    });
  });

  describe("recordTraversal", () => {
    it("returns 0 for unknown edge", () => {
      const router = new EdgeRouter([], []);
      expect(router.recordTraversal("unknown", true)).toBe(0);
    });

    it("increases conductivity on success", () => {
      const node = makeNode({ id: "n1" });
      const edge = makeEdge({ id: "e1", conductivity: 0.5 });
      const router = new EdgeRouter([node], [edge]);
      const newVal = router.recordTraversal("e1", true);
      expect(newVal).toBeGreaterThan(0.5);
      expect(newVal).toBeLessThanOrEqual(1);
    });

    it("decreases conductivity on failure (double rate)", () => {
      const node = makeNode({ id: "n1" });
      const edge = makeEdge({ id: "e1", conductivity: 0.5 });
      const router = new EdgeRouter([node], [edge]);
      const newVal = router.recordTraversal("e1", false);
      expect(newVal).toBeLessThan(0.5);
      expect(newVal).toBeGreaterThanOrEqual(0);
    });

    it("clamps conductivity to [0, 1]", () => {
      const node = makeNode({ id: "n1" });
      const edge = makeEdge({ id: "e1", conductivity: 0.05 });
      const router = new EdgeRouter([node], [edge]);
      // Repeated failures should not go below 0
      router.recordTraversal("e1", false);
      router.recordTraversal("e1", false);
      router.recordTraversal("e1", false);
      const val = router.recordTraversal("e1", false);
      expect(val).toBeGreaterThanOrEqual(0);
    });

    it("updates edge in-place", () => {
      const node = makeNode({ id: "n1" });
      const edge = makeEdge({ id: "e1", conductivity: 0.5, lastTraversedMs: 0 });
      const router = new EdgeRouter([node], [edge]);
      router.recordTraversal("e1", true);
      expect(edge.conductivity).toBeGreaterThan(0.5);
      expect(edge.lastTraversedMs).toBeGreaterThan(0);
    });
  });

  describe("getLowConductivityEdges", () => {
    it("returns empty when all edges above threshold", () => {
      const node = makeNode({ id: "n1" });
      const edges = [
        makeEdge({ id: "e1", conductivity: 0.5 }),
        makeEdge({ id: "e2", conductivity: 0.8 }),
      ];
      const router = new EdgeRouter([node], edges);
      expect(router.getLowConductivityEdges(0.3)).toEqual([]);
    });

    it("returns edges below threshold", () => {
      const node = makeNode({ id: "n1" });
      const edges = [
        makeEdge({ id: "low", conductivity: 0.1 }),
        makeEdge({ id: "high", conductivity: 0.9 }),
      ];
      const router = new EdgeRouter([node], edges);
      const low = router.getLowConductivityEdges(0.5);
      expect(low.length).toBe(1);
      expect(low[0].id).toBe("low");
    });

    it("uses default threshold of 0.2", () => {
      const node = makeNode({ id: "n1" });
      const edges = [
        makeEdge({ id: "e1", conductivity: 0.15 }),
        makeEdge({ id: "e2", conductivity: 0.25 }),
      ];
      const router = new EdgeRouter([node], edges);
      const low = router.getLowConductivityEdges();
      expect(low.length).toBe(1);
      expect(low[0].id).toBe("e1");
    });
  });

  describe("getState", () => {
    it("returns correct state shape", () => {
      const nodes = [makeNode({ id: "n1" })];
      const edges = [makeEdge({ id: "e1" })];
      const router = new EdgeRouter(nodes, edges);
      const state = router.getState();
      expect(state).toHaveProperty("edges");
      expect(state).toHaveProperty("nodes");
      expect(state).toHaveProperty("conductivities");
      expect(typeof state.edges).toBe("number");
      expect(typeof state.nodes).toBe("number");
      expect(typeof state.conductivities).toBe("object");
    });

    it("reflects recorded traversals", () => {
      const node = makeNode({ id: "n1" });
      const edge = makeEdge({ id: "e1", conductivity: 0.5 });
      const router = new EdgeRouter([node], [edge]);
      router.recordTraversal("e1", true);
      const state = router.getState();
      expect(state.conductivities["e1"]).toBeDefined();
      expect(state.conductivities["e1"][0]).toBe(0.5);
      expect(state.conductivities["e1"].length).toBeGreaterThanOrEqual(2);
    });
  });
});
