import { describe, it, expect, afterEach } from "bun:test";
import { clearStore, createLocalStore, LocalStore } from "../src/local-store.js";

describe("local-store", () => {
  // Reset singleton between tests
  afterEach(() => clearStore());

  describe("LocalStore class", () => {
    it("starts empty", () => {
      const store = createLocalStore();
      expect(store.size()).toBe(0);
    });

    it("adds and retrieves entries", () => {
      const store = createLocalStore();
      store.add("test-1", [1, 0, 0], { label: "hello" });
      expect(store.size()).toBe(1);
    });

    it("removes entries", () => {
      const store = createLocalStore();
      store.add("test-1", [1, 0, 0]);
      expect(store.remove("test-1")).toBe(true);
      expect(store.size()).toBe(0);
    });

    it("returns false when removing non-existent entry", () => {
      const store = createLocalStore();
      expect(store.remove("nonexistent")).toBe(false);
    });

    it("search returns top-K similar vectors", () => {
      const store = createLocalStore();
      store.add("a", [1, 0, 0], { label: "x-axis" });
      store.add("b", [0, 1, 0], { label: "y-axis" });
      store.add("c", [0.9, 0.1, 0], { label: "near-x" });

      const results = store.search([1, 0, 0], 2);
      expect(results.length).toBe(2);
      expect(results[0].id).toBe("a");
      expect(results[0].score).toBeCloseTo(1, 3);
      expect(results[1].id).toBe("c");
    });

    it("search returns empty array when no matches", () => {
      const store = createLocalStore();
      store.add("a", [1, 0, 0]);
      const results = store.search([0, 1, 0], 5);
      expect(results.length).toBe(0);
    });

    it("searchFiltered applies metadata filter", () => {
      const store = createLocalStore();
      store.add("a", [1, 0, 0], { type: "node" });
      store.add("b", [1, 0, 0], { type: "edge" });

      const nodes = store.searchFiltered([1, 0, 0], (m) => m.type === "node", 5);
      expect(nodes.length).toBe(1);
      expect(nodes[0].id).toBe("a");
    });

    it("clear removes all entries", () => {
      const store = createLocalStore();
      store.add("a", [1, 0, 0]);
      store.add("b", [0, 1, 0]);
      store.clear();
      expect(store.size()).toBe(0);
    });

    it("isolated instances do not share state", () => {
      const s1 = createLocalStore();
      const s2 = createLocalStore();
      s1.add("a", [1, 0, 0]);
      expect(s1.size()).toBe(1);
      expect(s2.size()).toBe(0);
    });
  });
});
