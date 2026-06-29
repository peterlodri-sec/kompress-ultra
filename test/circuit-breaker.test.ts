import { describe, it, expect } from "bun:test";
import {
  isCircuitOpen,
  recordSuccess,
  recordFailure,
  getCircuitState,
  CircuitBreaker,
  createCircuitBreaker,
} from "../src/circuit-breaker.js";

describe("circuit-breaker", () => {
  describe("CircuitBreaker class", () => {
    it("starts closed", () => {
      const cb = createCircuitBreaker();
      expect(cb.isOpen()).toBe(false);
    });

    it("opens after 3 failures", () => {
      const cb = createCircuitBreaker();
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.isOpen()).toBe(false);
      cb.recordFailure();
      expect(cb.isOpen()).toBe(true);
    });

    it("resets failure count on success", () => {
      const cb = createCircuitBreaker();
      cb.recordFailure();
      cb.recordFailure();
      cb.recordSuccess();
      expect(cb.getState().failures).toBe(0);
    });

    it("returns valid state", () => {
      const cb = createCircuitBreaker();
      const state = cb.getState();
      expect(typeof state.failures).toBe("number");
      expect(typeof state.openUntil).toBe("number");
    });

    it("supports custom failure threshold", () => {
      const cb = createCircuitBreaker({ failureThreshold: 5 });
      cb.recordFailure();
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.isOpen()).toBe(false);
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.isOpen()).toBe(true);
    });

    it("supports custom cooldown", () => {
      const cb = createCircuitBreaker({ cooldownMs: 100 });
      cb.recordFailure();
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.isOpen()).toBe(true);
      const state = cb.getState();
      expect(state.openUntil - Date.now()).toBeLessThanOrEqual(100);
    });

    it("reset clears all state", () => {
      const cb = createCircuitBreaker();
      cb.recordFailure();
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.isOpen()).toBe(true);
      cb.reset();
      expect(cb.isOpen()).toBe(false);
      expect(cb.getState().failures).toBe(0);
    });

    it("isolated instances do not share state", () => {
      const cb1 = createCircuitBreaker();
      const cb2 = createCircuitBreaker();
      cb1.recordFailure();
      cb1.recordFailure();
      cb1.recordFailure();
      expect(cb1.isOpen()).toBe(true);
      expect(cb2.isOpen()).toBe(false);
    });
  });

  describe("backward-compat singleton functions", () => {
    it("starts closed after reset", () => {
      recordSuccess();
      expect(isCircuitOpen()).toBe(false);
      expect(getCircuitState().failures).toBe(0);
    });

    it("opens after 3 failures", () => {
      recordSuccess();
      recordFailure();
      recordFailure();
      expect(isCircuitOpen()).toBe(false);
      recordFailure();
      expect(isCircuitOpen()).toBe(true);
    });

    it("resets failure count on success", () => {
      recordFailure();
      recordFailure();
      recordSuccess();
      expect(getCircuitState().failures).toBe(0);
    });

    it("returns valid state", () => {
      const state = getCircuitState();
      expect(typeof state.failures).toBe("number");
      expect(typeof state.openUntil).toBe("number");
    });
  });
});
