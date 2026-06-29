import type { BrainState } from "./types.js";

export async function readBrainState(): Promise<BrainState | null> {
  const path = `${process.env.HOME}/.cache/ultrameshai/brain-state.json`;
  try {
    const content = await Bun.file(path).text();
    return JSON.parse(content) as BrainState;
  } catch {
    return null;
  }
}

export function buildBrainLine(brainState: BrainState): string {
  const icon = brainState.status === "Alive" ? "🧠" : brainState.status === "Stale" ? "💤" : "❓";
  const age =
    brainState.last_data_at_ms === 0
      ? "never"
      : `${Math.round((Date.now() - brainState.last_data_at_ms) / 1000)}s ago`;
  return `${icon} BRAIN ${brainState.status} | patterns:${brainState.patterns_total} findings:${brainState.findings_total} units:${brainState.units_processed} | last:${age}`;
}
