import type { Message, KompressStats } from "./types.js";

export function computeDensity(messages: Message[]): number {
  if (messages.length < 2) return 0.0;
  const windowStart = Math.floor(messages.length / 3);
  const recent = messages.slice(windowStart);
  return recent.length / (messages.length || 1);
}

export function adaptiveThreshold(density: number, base: number): number {
  const offset = 0.15 - density * 0.4;
  return Math.max(0.4, Math.min(0.8, base + offset));
}

export function buildKompressDisplay(stats: KompressStats, transparencyMode: boolean = false): Message {
  const saved = stats.tokensPruned - stats.tokensKept;

  if (transparencyMode) {
    const lines = [
      `🗜️  kompress: context optimized`,
      `   • Removed ${stats.pruned} low-signal messages (below threshold ${stats.threshold.toFixed(2)})`,
      `   • Kept ${stats.kept} messages (last 5 + user/code/errors + high-relevance)`,
      `   • Saved ~${saved.toLocaleString()} tokens (${Math.round((saved / stats.tokensPruned) * 100)}% reduction)`,
      `   • Pruned content sent to brain for future retrieval`,
    ];

    if (stats.history.length > 0) {
      const avg = (stats.history.reduce((a, b) => a + b, 0) / stats.history.length).toFixed(0);
      lines.push(`   • Context trend: ${avg} msg avg (stable)`);
    }

    lines.push("─");

    return {
      role: "system",
      content: lines.join("\n"),
      _kompress: true,
      _kompressPruneEvent: true,
    } as Message;
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

  return {
    role: "system",
    content: lines.join("\n"),
    _kompress: true,
    _kompressPruneEvent: true,
  } as Message;
}

export async function writeCompactionStats(
  dbPath: string,
  prunedCount: number,
  contextSizeAfter: number,
): Promise<void> {
  try {
    const { execSync } = await import("child_process");
    execSync(
      `mempalace write -- pruned=${prunedCount} --context-size=${contextSizeAfter}`,
      { cwd: dbPath, stdio: "ignore" },
    );
  } catch {
    // skip
  }
}
