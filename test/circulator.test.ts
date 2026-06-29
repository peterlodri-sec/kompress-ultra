import { describe, it, expect } from "bun:test";
import {
  classifyMessage,
  enqueueCirculator,
  getCirculatorQueueLength,
  drainCirculatorQueue,
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

  describe("enqueueCirculator", () => {
    it("queues entries", () => {
      drainCirculatorQueue(); // clear
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
