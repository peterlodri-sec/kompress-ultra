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
  };
}

export async function syncNodeToStore(node: Node): Promise<boolean> {
  const { id, embedding, text } = embedNode(node);
  await addToStore(`brain-node-${id}`, embedding, {
    summary: text.slice(0, 8192),
    type: node.type,
    layer: node.layer,
    state: node.state,
    confidence: node.score,
    source: "brain-node",
  });
  await persistStore();
  return true;
}

export async function syncEdgeToStore(edge: Edge): Promise<boolean> {
  const { id, embedding, text } = embedEdge(edge);
  await addToStore(`brain-edge-${id}`, embedding, {
    summary: text.slice(0, 8192),
    type: edge.type,
    direction: edge.direction,
    confidence: edge.conductivity,
    source: "brain-edge",
  });
  await persistStore();
  return true;
}

export async function searchSimilarNodes(query: string, topK = 5): Promise<string[]> {
  const queryEmb = hashEmbedding(query);
  const results = await searchStore(queryEmb, topK);
  return results
    .filter((r) => (r.metadata.source as string)?.startsWith("brain-node"))
    .map((r) => (r.metadata.summary as string) ?? r.id)
    .filter(Boolean);
}

export async function searchSimilarEdges(query: string, topK = 5): Promise<string[]> {
  const queryEmb = hashEmbedding(query);
  const results = await searchStore(queryEmb, topK);
  return results
    .filter((r) => (r.metadata.source as string)?.startsWith("brain-edge"))
    .map((r) => (r.metadata.summary as string) ?? r.id)
    .filter(Boolean);
}
