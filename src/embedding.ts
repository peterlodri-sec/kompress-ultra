/**
 * embedding.ts — Self-hosted hash-based embeddings
 *
 * WHAT: An embedding is a fixed-size vector (list of numbers) that represents
 * text. Similar texts have similar vectors (high cosine similarity).
 *
 * HOW (hashEmbedding): Each word → hash → vector position (bucket). Word
 * frequency accumulated, then normalized to unit length.
 *
 * WHY: No ML model, no API, no GPU. Pure hash + math. Runs anywhere.
 * Deterministic — same text always → same vector.
 *
 * TRADEOFF: Hash embeddings capture word overlap but not semantics.
 * "dog" and "puppy" have zero overlap. For relevance scoring this is fine —
 * keyword/topic match is one valid signal. Upgrade path: swap hashEmbedding
 * for any real embedding model (Xenova, ONNX, etc.) without changing callers.
 *
 * OVHCloud path: kept behind KOMPRESS_USE_CLOUD_EMBEDDING=1 for migration.
 * Default: local hash embeddings, zero external deps.
 */

import { isCircuitOpen } from "./circuit-breaker.js";
import { searchStore, addToStore, persistStore } from "./local-store.js";
import { hashEmbedding, cosineSimilarity } from "./hash.js";

/**
 * Embed text into a vector. Default: local hash embedding (no deps).
 * OVHCloud: set KOMPRESS_USE_CLOUD_EMBEDDING=1 + OVHCLOUD_API_KEY + OVHCLOUD_EMBEDDING_URL.
 */
export async function embedText(text: string): Promise<number[] | null> {
  if (isCircuitOpen()) return null;

  // Cloud path — opt-in via env flag
  if (process.env.KOMPRESS_USE_CLOUD_EMBEDDING === "1") {
    return embedTextCloud(text);
  }

  // Default: local hash embedding — always works, zero config
  return hashEmbedding(text);
}

/**
 * OVHCloud embedding — kept as opt-in fallback. Not used by default.
 */
async function embedTextCloud(text: string): Promise<number[] | null> {
  const endpoint =
    process.env.OVHCLOUD_EMBEDDING_URL ??
    "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions";
  const apiKey = process.env.OVHCLOUD_API_KEY ?? "";
  if (!apiKey) return null;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "bge-m3", input: text }),
      signal: AbortSignal.timeout(1000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { embedding?: number[] }[] };
    return json.data?.[0]?.embedding ?? null;
  } catch {
    // silent — network/parse failure, returns null fallback
    return null;
  }
}

/**
 * Score a message's relevance using local hash embeddings.
 * Compares message content against taskGoal via cosine similarity.
 *
 * @param text — message content to score
 * @param sliceId — task goal / context to compare against
 */
export async function scoreMessageLocal(
  text: string,
  sliceId?: string,
): Promise<number> {
  try {
    const embedding = await embedText(text);
    if (!embedding) return 0.5;

    let baseScore = 0;

    // Direct cosine similarity between message and task goal.
    // This measures keyword/topic overlap without any external store.
    // Education: this is what vector search does — just at scale.
    if (sliceId) {
      const goalEmb = hashEmbedding(sliceId);
      baseScore = cosineSimilarity(embedding, goalEmb);
    }

    // Dampen: even perfect keyword overlap shouldn't max out relevance
    return Math.min(0.7, baseScore * 0.5 + 0.3);
  } catch {
    // silent — hash embedding failure, returns 0.5 neutral score
    return 0.5;
  }
}

/**
 * Query similar content from local vector store.
 * Returns max cosine similarity score from stored entries.
 */
export async function queryLocalSimilarity(
  embedding: number[],
): Promise<number> {
  const results = await searchStore(embedding, 1);
  return results.length > 0 ? results[0].score : 0.0;
}

/**
 * Fetch learning patterns from local store filtered by topic.
 * Returns formatted strings like "[pattern_type] summary (conf=0.95)".
 */
export async function fetchPatterns(
  topic: string,
): Promise<string[]> {
  const queryEmb = hashEmbedding(topic);
  const results = await searchStore(queryEmb, 5);
  return results.map((r) => {
    const meta = r.metadata;
    const type = meta.pattern_type ?? "unknown";
    const summary = meta.summary ?? r.id;
    const conf = typeof meta.confidence === "number" ? meta.confidence.toFixed(2) : "?";
    return `[${type}] ${summary} (conf=${conf})`;
  });
}

/**
 * Write dropped message content to local vector store + persist.
 * Stores each message as a vector for future similarity search.
 */
export async function writeDroppedContent(
  dropped: { content: string }[],
): Promise<void> {
  if (dropped.length === 0) return;
  for (const msg of dropped) {
    const vec = hashEmbedding(msg.content);
    await addToStore(`dropped-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, vec, {
      content: msg.content.slice(0, 4096),
      source: "dropped-digest",
      ts: Date.now(),
    });
  }
  await persistStore();
}
