import type { Message, MessageScore } from "./types.js";

export function isProtected(msg: Message, index: number, total: number): boolean {
  if (index >= total - 5) return true;
  if (msg.role === "user") return true;
  if (msg.content?.includes("```")) return true;
  if (msg.type === "error" || msg.content?.startsWith("Error:")) return true;
  return false;
}

export function ebbinghausDecay(age: number): number {
  const halfLife = 5;
  return Math.exp(-age / halfLife);
}

export function structuralBoost(msg: Message): number {
  let boost = 0.3;
  if (msg.role === "user") boost = 0.9;
  if (msg.content?.includes("```")) boost = Math.max(boost, 0.8);
  if (msg.type === "error" || msg.content?.startsWith("Error:")) boost = Math.max(boost, 0.9);
  if (msg.role === "tool") boost = Math.max(boost, 0.6);
  return boost;
}

export async function scoreMessage(
  msg: Message,
  index: number,
  total: number,
  taskGoal?: string,
): Promise<MessageScore> {
  const recency = ebbinghausDecay(total - index);
  const structural = structuralBoost(msg);
  let relevance = 0.5;
  if (taskGoal && msg.content) {
    try {
      const { scoreMessageMilvus } = await import("./embedding.js");
      relevance = await scoreMessageMilvus(msg.content, "", taskGoal);
    } catch {
      relevance = 0.5;
    }
  }
  const total_score = relevance * 0.4 + recency * 0.3 + structural * 0.3;
  return {
    relevance,
    recency,
    structural,
    total: total_score,
    protected: isProtected(msg, index, total),
  };
}
