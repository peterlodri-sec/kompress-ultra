import type { Message, KompressStats } from "./types.js";

export function computeDensity(messages: Message[]): number {
  if (messages.length < 2) return 0.0;
  const windowStart = Math.floor(messages.length / 3);
  const recentLength = messages.length - windowStart;
  return recentLength / messages.length;
}

export function adaptiveThreshold(density: number, base: number): number {
  const offset = 0.15 - density * 0.4;
  return Math.max(0.4, Math.min(0.8, base + offset));
}

function compactLines(lines: string[]): Message {
  return {
    role: "system",
    content: lines.join("\n"),
    _kompress: true,
    _kompressPruneEvent: true,
  };
}

function pctReduction(pruned: number, kept: number): string {
  if (pruned <= 0) return "0%";
  const saved = pruned - kept;
  return `${Math.round(Math.max(0, (saved / pruned) * 100))}%`;
}

export function buildKompressDisplay(stats: KompressStats, transparencyMode: boolean = false): Message {
  const saved = stats.tokensPruned - stats.tokensKept;

  if (transparencyMode) {
    const lines = [
      `🗜️  kompress: context optimized`,
      `   • Removed ${stats.pruned} low-signal messages (below threshold ${stats.threshold.toFixed(2)})`,
      `   • Kept ${stats.kept} messages (last 5 + user/code/errors + high-relevance)`,
      `   • Saved ~${saved.toLocaleString()} tokens (${pctReduction(stats.tokensPruned, stats.tokensKept)} reduction)`,
      `   • Pruned content sent to brain for future retrieval`,
    ];

    if (stats.history.length > 0) {
      const avg = (stats.history.reduce((a, b) => a + b, 0) / stats.history.length).toFixed(0);
      lines.push(`   • Context trend: ${avg} msg avg (stable)`);
    }

    lines.push("─");
    return compactLines(lines);
  }

  const lines = [
    `── kompress ${stats.model} ──`,
    `  pruned  ${stats.pruned} msg  ${stats.tokensPruned.toLocaleString()} tok  (threshold=${stats.threshold.toFixed(2)}, density=${stats.density.toFixed(2)})`,
    `  kept    ${stats.kept} msg  ${stats.tokensKept.toLocaleString()} tok`,
    `  saved   ${saved > 0 ? "+" : ""}${saved.toLocaleString()} tok`,
    `  total   ${stats.total} msg → ${stats.kept} msg`,
  ];

  if (stats.history.length > 0) {
    const avg = (stats.history.reduce((a, b) => a + b, 0) / stats.history.length).toFixed(1);
    lines.push(`  history avg ${avg} msg  (${stats.history.slice(-3).join(", ")})`);
  }

  lines.push("──");
  return compactLines(lines);
}


