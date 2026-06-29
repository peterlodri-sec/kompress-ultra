import { describe, it, expect } from "bun:test";
import {
  classifyMessage,
  enqueueCirculator,
  getCirculatorQueueLength,
  drainCirculatorQueue,
  Circulator,
  createCirculator,
} from "../src/circulator.js";

describe("circulator", () => {
  describe("classifyMessage", () => {
    it("classifies instructions", () => {
      expect(classifyMessage("Please implement the new feature")).toBe("instruction");
      expect(classifyMessage("We should build a test suite")).toBe("instruction");
      expect(classifyMessage("Fix the bug in main.ts")).toBe("instruction");
    });

    it("classifies tasks", () => {
      expect(classifyMessage("Add todo item for deployment")).toBe("task");
      expect(classifyMessage("The next step is to configure")).toBe("task");
    });

    it("classifies events", () => {
      expect(classifyMessage("The deployment was done yesterday")).toBe("event");
      expect(classifyMessage("Error: test failed")).toBe("event");
      expect(classifyMessage("File was updated")).toBe("event");
    });

    it("defaults to fact", () => {
      expect(classifyMessage("The sky is blue")).toBe("fact");
      expect(classifyMessage("2 + 2 = 4")).toBe("fact");
    });
  });

  describe("Circulator class", () => {
    it("creates isolated instances", () => {
      const c1 = createCirculator();
      const c2 = createCirculator();
      c1.enqueue({ content: "test 1" });
      c1.enqueue({ content: "test 2" });
      expect(c1.getQueueLength()).toBe(2);
      expect(c2.getQueueLength()).toBe(0);
    });

    it("drains only its own queue", () => {
      const c1 = createCirculator();
      const c2 = createCirculator();
      c1.enqueue({ content: "c1 msg" });
      c2.enqueue({ content: "c2 msg" });
      const drained = c1.drain();
      expect(drained.length).toBe(1);
      expect(drained[0].residual).toBe("c1 msg");
      expect(c2.getQueueLength()).toBe(1);
    });

    it("respects custom cap", () => {
      const c = createCirculator({ cap: 2 });
      c.enqueue({ content: "msg 1" });
      c.enqueue({ content: "msg 2" });
      // Third should trigger spill (cap=2 already reached)
      c.enqueue({ content: "msg 3" });
      expect(c.getQueueLength()).toBeLessThanOrEqual(2);
    });

    it("auto-classifies enqueued content", () => {
      const c = createCirculator();
      c.enqueue({ content: "implement the fix" });
      const entries = c.drain();
      expect(entries[0].classification).toBe("instruction");
    });

    it("respects custom classification", () => {
      const c = createCirculator();
      c.enqueue({ content: "test", classification: "event" });
      const entries = c.drain();
      expect(entries[0].classification).toBe("event");
    });
  });

  describe("backward-compat singleton functions", () => {
    it("queues entries", () => {
      drainCirculatorQueue();
      enqueueCirculator({ content: "test message" });
      enqueueCirculator({ content: "another message" });
      expect(getCirculatorQueueLength()).toBe(2);
    });

    it("drains queue", () => {
      drainCirculatorQueue();
      enqueueCirculator({ content: "test" });
      const entries = drainCirculatorQueue();
      expect(entries.length).toBe(1);
      expect(entries[0].residual).toBe("test");
      expect(getCirculatorQueueLength()).toBe(0);
    });

    it("auto-classifies content", () => {
      drainCirculatorQueue();
      enqueueCirculator({ content: "implement the fix" });
      const entries = drainCirculatorQueue();
      expect(entries[0].classification).toBe("instruction");
    });

    it("respects custom classification", () => {
      drainCirculatorQueue();
      enqueueCirculator({ content: "test", classification: "event" });
      const entries = drainCirculatorQueue();
      expect(entries[0].classification).toBe("event");
    });
  });
});
