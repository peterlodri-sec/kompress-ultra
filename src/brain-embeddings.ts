/**
 * BrainEmbeddings — Vector embedding pipeline for brain graph (v12.0.0)
 *
 * Generates and stores embeddings for every brain node/edge in Milvus.
 * Enables semantic search across the graph topology.
 */

import type { Node, Edge } from "../src/types.js";

interface EmbeddingResult {
  id: string;
  embedding: number[];
  text: string;
}

const EMBED_DIM = 768;
const MILVUS_HTTP = process.env.KOMPRESS_MILVUS_URL ?? "http://localhost:9091";

// Simple hash-based embedding for when no ML endpoint is available
function hashEmbedding(text: string, dim: number = EMBED_DIM): number[] {
  const vec = new Array(dim).fill(0);
  const words = text.toLowerCase().split(/\s+/);
  for (const word of words) {
    let h = 0;
    for (let i = 0; i < word.length; i++) {
      h = ((h << 5) - h + word.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(h) % dim;
    vec[idx] += 1.0 / words.length;
  }
  // Normalize
  const mag = Math.sqrt(vec.reduce((a, v) => a + v * v, 0));
  return mag > 0 ? vec.map((v) => v / mag) : vec;
}

export function embedNode(node: Node): EmbeddingResult {
  const text = `${node.id} ${node.label} ${node.type} layer:${node.layer} state:${node.state}`;
  return {
    id: node.id,
    embedding: hashEmbedding(text),
    text,
  };
}

export function embedEdge(edge: Edge): EmbeddingResult {
  const text = `${edge.source} → ${edge.target} type:${edge.type} label:${edge.label} dir:${edge.direction}`;
  return {
    id: edge.id,
    embedding: hashEmbedding(text),
    text,
  }
}

export async function syncNodeToMilvus(node: Node): Promise<boolean> {
  const { id, embedding, text } = embedNode(node);
  try {
    const res = await fetch(`${MILVUS_HTTP}/api/v1/insert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collection_name: "brain_nodes",
        fields: {
          embedding,
          topic: node.type,
          summary: text.slice(0, 8192),
          tags: JSON.stringify(["brain-node", node.layer, node.state]),
          confidence: node.score,
          created_at: node.createdAtMs,
        },
      }),
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function syncEdgeToMilvus(edge: Edge): Promise<boolean> {
  const { id, embedding, text } = embedEdge(edge);
  try {
    const res = await fetch(`${MILVUS_HTTP}/api/v1/insert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collection_name: "brain_edges",
        fields: {
          embedding,
          topic: edge.type,
          summary: text.slice(0, 8192),
          tags: JSON.stringify(["brain-edge", edge.direction]),
          confidence: edge.conductivity,
          created_at: edge.createdAtMs,
        },
      }),
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function searchSimilarNodes(query: string, topK = 5): Promise<string[]> {
  const queryEmb = hashEmbedding(query);
  try {
    const res = await fetch(`${MILVUS_HTTP}/api/v1/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collection_name: "brain_nodes",
        output_fields: ["topic", "summary", "confidence"],
        topK,
        vector: queryEmb,
      }),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return [];
    const json = await res.json() as { results?: { summary?: string }[] };
    return (json.results ?? []).map((r) => r.summary ?? "").filter(Boolean);
  } catch {
    return [];
  }
}

export async function searchSimilarEdges(query: string, topK = 5): Promise<string[]> {
  const queryEmb = hashEmbedding(query);
  try {
    const res = await fetch(`${MILVUS_HTTP}/api/v1/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collection_name: "brain_edges",
        output_fields: ["summary", "topic", "confidence"],
        topK,
        vector: queryEmb,
      }),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return [];
    const json = await res.json() as { results?: { summary?: string }[] };
    return (json.results ?? []).map((r) => r.summary ?? "").filter(Boolean);
  } catch {
    return [];
  }
}
