import { describe, it, expect } from "bun:test";
import {
  isCircuitOpen,
  recordSuccess,
  recordFailure,
  getCircuitState,
} from "../src/circuit-breaker.js";

describe("circuit-breaker", () => {
  it("starts closed", () => {
    // Reset state by recording successes
    recordSuccess();
    expect(isCircuitOpen()).toBe(false);
    expect(getCircuitState().failures).toBe(0);
  });

  it("opens after 3 failures", () => {
    recordSuccess(); // reset
    recordFailure();
    recordFailure();
    expect(isCircuitOpen()).toBe(false);
    recordFailure(); // 3rd failure
    expect(isCircuitOpen()).toBe(true);
  });

  it("resets failure count on success", () => {
    recordFailure();
    recordFailure();
    recordSuccess();
    expect(getCircuitState().failures).toBe(0);
    // Circuit may still be open if cooldown hasn't elapsed — that's correct
  });

  it("returns valid state", () => {
    const state = getCircuitState();
    expect(typeof state.failures).toBe("number");
    expect(typeof state.openUntil).toBe("number");
  });
});
