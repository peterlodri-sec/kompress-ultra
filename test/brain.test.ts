import { describe, it, expect } from "bun:test";
import { buildBrainLine } from "../src/brain.js";
import type { BrainState } from "../src/types.js";

describe("brain", () => {
  describe("buildBrainLine", () => {
    it("formats Alive state with brain icon", () => {
      const state: BrainState = {
        status: "Alive",
        patterns_total: 42,
        findings_total: 17,
        units_processed: 1500,
        last_data_at_ms: Date.now() - 5000,
        poll_count: 10,
        interval_ms: 60000,
      };
      const line = buildBrainLine(state);
      expect(line).toContain("🧠");
      expect(line).toContain("BRAIN Alive");
      expect(line).toContain("patterns:42");
      expect(line).toContain("findings:17");
      expect(line).toContain("units:1500");
      expect(line).toContain("5s ago");
    });

    it("formats Stale state with sleep icon", () => {
      const state: BrainState = {
        status: "Stale",
        patterns_total: 0,
        findings_total: 0,
        units_processed: 0,
        last_data_at_ms: Date.now() - 120000,
        poll_count: 0,
        interval_ms: 60000,
      };
      const line = buildBrainLine(state);
      expect(line).toContain("💤");
      expect(line).toContain("BRAIN Stale");
    });

    it('shows "never" when last_data_at_ms is 0', () => {
      const state: BrainState = {
        status: "Alive",
        patterns_total: 0,
        findings_total: 0,
        units_processed: 0,
        last_data_at_ms: 0,
        poll_count: 0,
        interval_ms: 60000,
      };
      const line = buildBrainLine(state);
      expect(line).toContain("never");
    });

    it("handles edge case with recent timestamp", () => {
      const state: BrainState = {
        status: "Alive",
        patterns_total: 1,
        findings_total: 1,
        units_processed: 1,
        last_data_at_ms: Date.now() - 1000,
        poll_count: 1,
        interval_ms: 60000,
      };
      const line = buildBrainLine(state);
      expect(line).toContain("1s ago");
    });
  });
});
