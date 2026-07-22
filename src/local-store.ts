/**
 * local-store.ts — Self-hosted vector store
 *
 * In-memory vector store with cosine similarity search and JSONL persistence.
 * Replaces Milvus. Zero external deps. Runs on any machine.
 *
 * Why JSONL: append-only log format. Each line = one vector + metadata.
 * Fast writes (append), readable (JSON), easy to debug.
 * For <10K entries, linear scan cosine sim is fast enough.
 *
 * Education: this is what vector DBs do internally — store vectors,
 * compute similarity, return top-K. Just at smaller scale.
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

const DEFAULT_PATH = `${process.env.HOME}/.cache/ultrameshai/vector-store.jsonl`;

export class LocalStore {
  private entries = new Map<string, StoreEntry>();

  add(id: string, vector: number[], metadata: Record<string, unknown> = {}): void {
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
   * O(n*d) — linear scan. Fast enough for <10K entries.
   */
  search(query: number[], topK: number = 5): SearchResult[] {
    const scored: SearchResult[] = [];
    for (const entry of this.entries.values()) {
      const score = cosineSimilarity(query, entry.vector);
      if (score > 0) {
        scored.push({ id: entry.id, score, metadata: entry.metadata });
      }
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
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
    const scored: SearchResult[] = [];
    for (const entry of this.entries.values()) {
      if (!filter(entry.metadata)) continue;
      const score = cosineSimilarity(query, entry.vector);
      if (score > 0) {
        scored.push({ id: entry.id, score, metadata: entry.metadata });
      }
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /** Persist all entries to JSONL file. Overwrites file. */
  async persist(filepath: string = DEFAULT_PATH): Promise<void> {
    try {
      const dir = filepath.substring(0, filepath.lastIndexOf("/"));
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const lines: string[] = [];
      for (const entry of this.entries.values()) {
        lines.push(JSON.stringify(entry));
      }
      await Bun.write(filepath, lines.join("\n") + "\n");
    } catch {
      // silent — in-memory store still works
    }
  }

  /** Load entries from JSONL file. Appends to current in-memory entries. */
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
      // silent — in-memory entries unaffected; retry on next load
    }
  }
}

// ── Default singleton with auto-load ────────────────────────────────
// Cross-session: loads persisted vectors from disk on first access.
// No explicit init call needed — just import and use.
//
// @deprecated Use `createLocalStore()` + class API for isolated instances.
// Singletons share state across modules and tests. Prefer new LocalStore().

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
export async function searchStore(query: number[], topK = 5): Promise<SearchResult[]> {
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
  loaded = true; // prevent reload
}

export function createLocalStore(): LocalStore {
  return new LocalStore();
}

/**
 * Query past memory relevant to a topic/goal.
 * Hash-embeds the topic, searches store, returns formatted context string.
 * Inject this into system prompt for cross-session continuity.
 *
 * Example usage:
 *   const memory = await queryMemory("build authentication");
 *   systemPrompt += "\n" + memory;
 */
export async function queryMemory(topic: string, topK = 3): Promise<string> {
  const queryEmb = hashEmbedding(topic);
  const results = await searchStore(queryEmb, topK);
  if (results.length === 0) return "";

  const lines = ["── past memory ──"];
  for (const r of results) {
    const meta = r.metadata;
    const content = String(meta.content ?? meta.summary ?? r.id);
    const source = String(meta.source ?? meta.classification ?? "store");
    lines.push(`  [${source}] ${content.slice(0, 200)}`);
  }
  lines.push("──");
  return lines.join("\n");
}
