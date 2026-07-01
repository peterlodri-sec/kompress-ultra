import { describe, it, expect, beforeEach } from "bun:test";
import {
  embedNode,
  embedEdge,
  syncNodeToStore,
  syncEdgeToStore,
  searchSimilarNodes,
  searchSimilarEdges,
} from "../src/brain-embeddings.js";
import { clearStore, storeSize } from "../src/local-store.js";
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

beforeEach(() => {
  clearStore();
});

describe("embedNode", () => {
  it("returns id, embedding array, and text", () => {
    const node = makeNode();
    const result = embedNode(node);
    expect(result).toHaveProperty("id", "n1");
    expect(Array.isArray(result.embedding)).toBe(true);
    expect(result.embedding.length).toBeGreaterThan(0);
    expect(typeof result.text).toBe("string");
  });

  it("includes all key fields in text", () => {
    const node = makeNode({ id: "n42", label: "compressor", type: "module", layer: "core", state: "alive" });
    const result = embedNode(node);
    expect(result.text).toContain("n42");
    expect(result.text).toContain("compressor");
    expect(result.text).toContain("module");
    expect(result.text).toContain("layer:core");
    expect(result.text).toContain("state:alive");
  });

  it("produces deterministic embeddings for same input", () => {
    const node = makeNode({ id: "n1", label: "same-label", type: "same-type", layer: "same-layer", state: "alive" });
    const a = embedNode(node);
    const b = embedNode(node);
    expect(a.embedding).toEqual(b.embedding);
  });
});

describe("embedEdge", () => {
  it("returns id, embedding array, and text", () => {
    const edge = makeEdge();
    const result = embedEdge(edge);
    expect(result).toHaveProperty("id", "e1");
    expect(Array.isArray(result.embedding)).toBe(true);
    expect(result.embedding.length).toBeGreaterThan(0);
    expect(typeof result.text).toBe("string");
  });

  it("includes all key fields in text", () => {
    const edge = makeEdge({
      id: "e7",
      source: "n1",
      target: "n2",
      type: "semantic",
      label: "depends-on",
      direction: "forward",
    });
    const result = embedEdge(edge);
    expect(result.text).toContain("n1 → n2");
    expect(result.text).toContain("type:semantic");
    expect(result.text).toContain("label:depends-on");
    expect(result.text).toContain("dir:forward");
  });

  it("produces deterministic embeddings for same input", () => {
    const edge = makeEdge();
    const a = embedEdge(edge);
    const b = embedEdge(edge);
    expect(a.embedding).toEqual(b.embedding);
  });
});

describe("syncNodeToStore", () => {
  it("returns true on success", async () => {
    const result = await syncNodeToStore(makeNode());
    expect(result).toBe(true);
  });

  it("stores an entry in the vector store", async () => {
    expect(storeSize()).toBe(0);
    await syncNodeToStore(makeNode({ id: "sync-test" }));
    expect(storeSize()).toBe(1);
  });
});

describe("syncEdgeToStore", () => {
  it("returns true on success", async () => {
    const result = await syncEdgeToStore(makeEdge());
    expect(result).toBe(true);
  });

  it("stores an entry in the vector store", async () => {
    expect(storeSize()).toBe(0);
    await syncEdgeToStore(makeEdge({ id: "sync-edge-test" }));
    expect(storeSize()).toBe(1);
  });
});

describe("searchSimilarNodes", () => {
  it("finds stored nodes by query", async () => {
    await syncNodeToStore(makeNode({ id: "brain-search", label: "compression-engine" }));
    // hashEmbedding uses word-level hashing — query must match a stored word
    const results = await searchSimilarNodes("concept", 5);
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns empty array when store is empty", async () => {
    clearStore();
    const results = await searchSimilarNodes("anything", 5);
    expect(results).toEqual([]);
  });
});

describe("searchSimilarEdges", () => {
  it("finds stored edges by query", async () => {
    await syncEdgeToStore(makeEdge({ id: "edge-search", label: "deploy-route" }));
    // hashEmbedding uses word-level hashing — query must match a stored word
    const results = await searchSimilarEdges("n1", 5);
    expect(results.length).toBeGreaterThan(0);
  });

  it("does not return nodes when searching edges", async () => {
    await syncNodeToStore(makeNode({ id: "only-node", label: "find-me" }));
    const results = await searchSimilarEdges("find-me", 5);
    expect(results).toEqual([]);
  });

  it("does not return edges when searching nodes", async () => {
    await syncEdgeToStore(makeEdge({ id: "only-edge", label: "find-me-too" }));
    const results = await searchSimilarNodes("find-me-too", 5);
    expect(results).toEqual([]);
  });
});
