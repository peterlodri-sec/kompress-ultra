/**
 * local-store.ts — Self-hosted vector store
 *
 * In-memory vector store with cosine similarity search and JSONL persistence.
 * Replaces Milvus. Zero external deps. Runs on any machine.
 *
 * Persistence currently uses a complete JSONL snapshot. Each line contains
 * one vector and its metadata. The file is human-readable and easy to debug.
 *
 * For <10K entries, linear cosine-similarity scanning is fast enough.
 *
 * Cross-session memory: singleton auto-loads from disk on first use.
 * Data survives restarts. Write + persist in session N → read in session N+1.
 */

import { cosineSimilarity, hashEmbedding } from "./hash.js";
import { existsSync, mkdirSync } from "fs";

export interface StoreEntry {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
  created_at: number;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

const DEFAULT_PATH =
  `${process.env.HOME}/.cache/ultrameshai/vector-store.jsonl`;

/**
 * Maintain only the best topK results while scanning.
 *
 * topK is normally very small (3–5), so keeping a tiny sorted array is
 * simpler than maintaining a full heap and avoids sorting every match.
 *
 * Array is kept in ascending order: weakest result first.
 */
function insertTopK(
  results: SearchResult[],
  candidate: SearchResult,
  topK: number,
): void {
  if (topK <= 0) return;

  if (results.length < topK) {
    results.push(candidate);
    results.sort((a, b) => a.score - b.score);
    return;
  }

  if (candidate.score <= results[0].score) return;

  results[0] = candidate;
  results.sort((a, b) => a.score - b.score);
}

export class LocalStore {
  private entries = new Map<string, StoreEntry>();

  add(
    id: string,
    vector: number[],
    metadata: Record<string, unknown> = {},
  ): void {
    this.entries.set(id, {
      id,
      vector,
      metadata,
      created_at: Date.now(),
    });
  }

  remove(id: string): boolean {
    return this.entries.delete(id);
  }

  size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  /**
   * Search top-K similar vectors by cosine similarity.
   *
   * Vector comparison remains O(n*d), but result selection is O(n*k)
   * for small k rather than collecting and sorting all matching entries.
   */
  search(query: number[], topK: number = 5): SearchResult[] {
    const best: SearchResult[] = [];

    for (const entry of this.entries.values()) {
      const score = cosineSimilarity(query, entry.vector);

      if (score > 0) {
        insertTopK(
          best,
          {
            id: entry.id,
            score,
            metadata: entry.metadata,
          },
          topK,
        );
      }
    }

    return best.sort((a, b) => b.score - a.score);
  }

  /**
   * Search with optional metadata filter.
   * Filter fn receives metadata, returns true to include.
   */
  searchFiltered(
    query: number[],
    filter: (m: Record<string, unknown>) => boolean,
    topK: number = 5,
  ): SearchResult[] {
    const best: SearchResult[] = [];

    for (const entry of this.entries.values()) {
      if (!filter(entry.metadata)) continue;

      const score = cosineSimilarity(query, entry.vector);

      if (score > 0) {
        insertTopK(
          best,
          {
            id: entry.id,
            score,
            metadata: entry.metadata,
          },
          topK,
        );
      }
    }

    return best.sort((a, b) => b.score - a.score);
  }

  /**
   * Persist the current store as a complete JSONL snapshot.
   */
  async persist(filepath: string = DEFAULT_PATH): Promise<void> {
    try {
      const dir = filepath.substring(0, filepath.lastIndexOf("/"));

      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const lines: string[] = [];

      for (const entry of this.entries.values()) {
        lines.push(JSON.stringify(entry));
      }

      await Bun.write(filepath, lines.join("\n") + "\n");
    } catch {
      // silent — in-memory store still works
    }
  }

  /**
   * Load entries from a JSONL snapshot into the current in-memory store.
   */
  async load(filepath: string = DEFAULT_PATH): Promise<void> {
    try {
      if (!existsSync(filepath)) return;

      const text = await Bun.file(filepath).text();
      if (!text.trim()) return;

      for (const line of text.trim().split("\n")) {
        try {
          const entry = JSON.parse(line) as StoreEntry;

          if (entry && entry.id && entry.vector) {
            this.entries.set(entry.id, entry);
          }
        } catch {
          // skip corrupt lines
        }
      }
    } catch {
      // silent — in-memory entries unaffected
    }
  }
}

// ── Default singleton with auto-load ────────────────────────────────

const defaultStore = new LocalStore();
let loaded = false;

async function ensureLoaded(): Promise<void> {
  if (!loaded) {
    loaded = true;
    await defaultStore.load();
  }
}

/** @deprecated Use `store.add()` on a class instance. */
export async function addToStore(
  id: string,
  vector: number[],
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await ensureLoaded();
  defaultStore.add(id, vector, metadata);
}

/** @deprecated Use `store.search()` on a class instance. */
export async function searchStore(
  query: number[],
  topK = 5,
): Promise<SearchResult[]> {
  await ensureLoaded();
  return defaultStore.search(query, topK);
}

/** @deprecated Use `store.searchFiltered()` on a class instance. */
export async function searchStoreFiltered(
  query: number[],
  filter: (m: Record<string, unknown>) => boolean,
  topK = 5,
): Promise<SearchResult[]> {
  await ensureLoaded();
  return defaultStore.searchFiltered(query, filter, topK);
}

/** @deprecated Use `store.persist()` on a class instance. */
export async function persistStore(filepath?: string): Promise<void> {
  await ensureLoaded();
  return defaultStore.persist(filepath);
}

/** @deprecated Use `store.load()` on a class instance. */
export async function loadStore(filepath?: string): Promise<void> {
  loaded = true;
  return defaultStore.load(filepath);
}

/** @deprecated Use `store.size()` on a class instance. */
export function storeSize(): number {
  return defaultStore.size();
}

/** @deprecated Use `store.clear()` on a class instance. */
export function clearStore(): void {
  defaultStore.clear();
  loaded = true;
}

export function createLocalStore(): LocalStore {
  return new LocalStore();
}

/**
 * Query past memory relevant to a topic/goal.
 */
export async function queryMemory(
  topic: string,
  topK = 3,
): Promise<string> {
  const queryEmb = hashEmbedding(topic);
  const results = await searchStore(queryEmb, topK);

  if (results.length === 0) return "";

  const lines = ["── past memory ──"];

  for (const r of results) {
    const meta = r.metadata;
    const content = String(meta.content ?? meta.summary ?? r.id);
    const source = String(
      meta.source ?? meta.classification ?? "store",
    );

    lines.push(`  [${source}] ${content.slice(0, 200)}`);
  }

  lines.push("──");
  return lines.join("\n");
}