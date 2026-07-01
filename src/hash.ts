/**
 * hash.ts — Zero-dependency hash embeddings & cosine similarity
 *
 * Pure math. No imports. Runs anywhere. Deterministic.
 *
 * hashEmbedding: word-level hashing trick → 768-dim normalized vector.
 *   Each word maps to a vector bucket via hash → accumulated → unit-normalized.
 *   Captures keyword overlap, not semantics. Deterministic, zero-cost.
 *
 * cosineSimilarity: dot(a,b) / (|a| * |b|). Range [0, 1].
 */

const EMBED_DIM = 768;

/**
 * Hash a string into a normalized vector of `dim` floats.
 * Uses the hashing trick: each word's hash maps to a position,
 * frequency is accumulated, then unit-normalized.
 * Deterministic and zero-cost. Not semantically meaningful.
 */
export function hashEmbedding(text: string, dim: number = EMBED_DIM): number[] {
  const vec = new Array(dim).fill(0);
  const words = text.toLowerCase().split(/\s+/);
  for (const word of words) {
    if (word.length === 0) continue;
    let h = 0;
    for (let i = 0; i < word.length; i++) {
      h = ((h << 5) - h + word.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(h) % dim;
    vec[idx] += 1.0 / words.length;
  }
  const mag = Math.sqrt(vec.reduce((a, v) => a + v * v, 0));
  return mag > 0 ? vec.map((v) => v / mag) : vec;
}

/**
 * Cosine similarity between two vectors. Range: 0 to 1.
 * Core operation for all embedding-based search.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
