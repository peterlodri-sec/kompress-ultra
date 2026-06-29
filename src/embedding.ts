import { isCircuitOpen } from "./circuit-breaker.js";
import { DEFAULT_OPTIONS } from "./types.js";

export async function embedText(text: string): Promise<number[] | null> {
  if (isCircuitOpen()) return null;
  const endpoint =
    process.env.OVHCLOUD_EMBEDDING_URL ??
    "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions";
  const apiKey = process.env.OVHCLOUD_API_KEY ?? "";

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
    return null;
  }
}

export async function scoreMessageMilvus(
  text: string,
  _milvusUrl: string,
  sliceId?: string,
): Promise<number> {
  try {
    const embedding = await embedText(text);
    if (!embedding) return 0.5;

    let baseScore = await queryMilvusSimilarity(embedding, DEFAULT_OPTIONS.milvusUrl);
    if (sliceId && DEFAULT_OPTIONS.sliceAwareBoost) {
      const sliceEmbedding = await embedText(`slice:${sliceId}`);
      if (sliceEmbedding) {
        const sliceScore = await queryMilvusSimilarity(sliceEmbedding, DEFAULT_OPTIONS.milvusUrl);
        baseScore += Math.min(0.15, sliceScore * 0.15);
      }
    }
    return baseScore;
  } catch {
    return 0.5;
  }
}

export async function queryMilvusSimilarity(
  embedding: number[],
  milvusUrl: string,
): Promise<number> {
  const collections = ["research_findings", "learning_patterns"];
  try {
    const promises = collections.map(async (coll) => {
      try {
        const res = await fetch(`${milvusUrl}/v1/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collection_name: coll,
            output_fields: ["embedding"],
            topK: 1,
            vector: embedding,
          }),
          signal: AbortSignal.timeout(1000),
        });
        if (res.ok) {
          const json = (await res.json()) as { results?: { distance?: number }[] };
          return json.results?.[0]?.distance ?? 0.0;
        }
      } catch {
        // ignore
      }
      return 0.0;
    });
    const results = await Promise.all(promises);
    return Math.max(...results);
  } catch {
    return 0.0;
  }
}

export async function fetchHonchoPatterns(
  milvusUrl: string,
  topic: string,
): Promise<string[]> {
  try {
    const embedding = await embedText(topic);
    if (!embedding) return [];

    const res = await fetch(`${milvusUrl}/v1/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collection_name: "learning_patterns",
        output_fields: ["summary", "confidence", "pattern_type"],
        topK: 5,
        vector: embedding,
        filter: "confidence >= 0.5",
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results?: { summary?: string; confidence?: number; pattern_type?: string }[];
    };
    return (json.results ?? []).map(
      (r) => `[${r.pattern_type}] ${r.summary} (conf=${r.confidence?.toFixed(2)})`,
    );
  } catch {
    return [];
  }
}

export async function writeDroppedDigest(
  dropped: { content: string }[],
  milvusUrl: string,
): Promise<void> {
  if (dropped.length === 0) return;
  try {
    const texts = dropped.map((m) => m.content).join("\n---\n");
    const embedding = await embedText(texts);
    if (!embedding) return;

    await fetch(`${milvusUrl}/v1/insert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collection_name: "research_findings",
        fields: {
          finding_id: `kompress-discard-${Date.now()}`,
          agent_id: "kompress",
          topic: "kompress-discard",
          summary: texts.slice(0, 4096),
          embedding,
          tags: ["kompress-discard"],
          created_at: Date.now(),
          embedding_model: "bge-m3",
        },
      }),
      signal: AbortSignal.timeout(1000),
    });
  } catch {
    // skip
  }
}
