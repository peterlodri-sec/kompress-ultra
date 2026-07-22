/**
 * BrainEmbeddings — Vector embedding pipeline for brain graph (v12.0.0)
 *
 * Generates and stores embeddings for every brain node/edge using local
 * hash embeddings + local vector store. No Milvus. No cloud API.
 *
 * embedNode/embedEdge: convert graph elements → text → hash vector.
 * sync/search: backed by local-store.ts in-memory + JSONL persistence.
 */

import { hashEmbedding } from "./hash.js";
import { addToStore, searchStore, persistStore } from "./local-store.js";
import type { Node, Edge } from "./types.js";

interface EmbeddingResult {
  id: string;
  embedding: number[];
  text: string;
}

function embed(id: string, text: string): EmbeddingResult {
  return { id, embedding: hashEmbedding(text), text };
}

export function embedNode(node: Node): EmbeddingResult {
  return embed(node.id, `${node.id} ${node.label} ${node.type} layer:${node.layer} state:${node.state}`);
}

export function embedEdge(edge: Edge): EmbeddingResult {
  return embed(edge.id, `${edge.source} → ${edge.target} type:${edge.type} label:${edge.label} dir:${edge.direction}`);
}

async function syncToStore(
  storeId: string,
  embedding: number[],
  text: string,
  metadata: Record<string, unknown>,
): Promise<boolean> {
  await addToStore(storeId, embedding, { summary: text.slice(0, 8192), ...metadata });
  await persistStore();
  return true;
}

export async function syncNodeToStore(node: Node): Promise<boolean> {
  const { id, embedding, text } = embedNode(node);
  return syncToStore(`brain-node-${id}`, embedding, text, {
    type: node.type,
    layer: node.layer,
    state: node.state,
    confidence: node.score,
    source: "brain-node",
  });
}

export async function syncEdgeToStore(edge: Edge): Promise<boolean> {
  const { id, embedding, text } = embedEdge(edge);
  return syncToStore(`brain-edge-${id}`, embedding, text, {
    type: edge.type,
    direction: edge.direction,
    confidence: edge.conductivity,
    source: "brain-edge",
  });
}

async function searchBySource(query: string, sourcePrefix: string, topK = 5): Promise<string[]> {
  const queryEmb = hashEmbedding(query);
  const results = await searchStore(queryEmb, topK);
  return results
    .filter((r) => String(r.metadata.source ?? "").startsWith(sourcePrefix))
    .map((r) => String(r.metadata.summary ?? "") || r.id)
    .filter(Boolean);
}

export async function searchSimilarNodes(query: string, topK = 5): Promise<string[]> {
  return searchBySource(query, "brain-node", topK);
}

export async function searchSimilarEdges(query: string, topK = 5): Promise<string[]> {
  return searchBySource(query, "brain-edge", topK);
}
