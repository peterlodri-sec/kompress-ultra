/**
 * Archivist — append-only audit store outside the Circulator cycle.
 *
 * Circulator memory M is a *cycling* store: active → pruned → memory →
 * retrieved → active. Archivist records content that should leave that
 * loop permanently: a write-once log of what was pruned, when, and under
 * what score — for audit / compliance, not automatic reuse every cycle.
 *
 * Guarantees (sketch):
 *   - append-only: no update-in-place, no silent delete of records
 *   - deliberate retrieval only (by id, hash, time range, reason)
 *   - distinct from Circulator's working memory
 *
 * @see Future Work in README — Archivist and Originist
 */

export type ArchiveReason = "pruned" | "overflow" | "budget" | "manual" | "demoted";

export type ArchiveClassification = "fact" | "event" | "instruction" | "task";

export interface ArchiveRecord {
  /** Stable record id (unique per append). */
  id: string;
  content_hash: string;
  /** Content snapshot at archive time (may be residual / truncated). */
  residual: string;
  /** Score at the moment of exit from the active loop. */
  score: number;
  classification: ArchiveClassification;
  reason: ArchiveReason;
  session_id: string;
  agent_type: string;
  timestamp_ms: number;
  /** Originist generation count at archive time, if known. */
  generation?: number;
  /** Optional free-form metadata (threshold, agent role, etc.). */
  meta?: Record<string, string | number | boolean>;
}

export interface ArchiveInput {
  content: string;
  content_hash?: string;
  score?: number;
  classification?: ArchiveClassification;
  reason?: ArchiveReason;
  session_id?: string;
  agent_type?: string;
  timestamp_ms?: number;
  generation?: number;
  meta?: Record<string, string | number | boolean>;
}

export interface ArchivistQuery {
  id?: string;
  content_hash?: string;
  reason?: ArchiveReason;
  session_id?: string;
  /** Inclusive lower bound (ms). */
  since_ms?: number;
  /** Inclusive upper bound (ms). */
  until_ms?: number;
  /** Max records to return (newest first). Default unlimited. */
  limit?: number;
}

export interface ArchivistOptions {
  /** Soft cap for in-memory records. When exceeded, oldest stay on disk only if path set. */
  cap?: number;
  /** Optional append-only JSONL path for durable audit log. */
  path?: string;
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return `h-${Math.abs(h).toString(36)}`;
}

function newRecordId(hash: string, ts: number, seq: number): string {
  return `arch-${hash}-${ts}-${seq}`;
}

/**
 * Append-only audit store. Records never mutate after append.
 * `clear()` is test-only and does not erase durable JSONL history.
 */
export class Archivist {
  private records: ArchiveRecord[] = [];
  private seq = 0;
  private readonly cap: number;
  private readonly path?: string;

  constructor(options: ArchivistOptions = {}) {
    this.cap = options.cap ?? 10_000;
    this.path = options.path;
  }

  /** Append a permanent exit record. Returns the stored record. */
  record(input: ArchiveInput): ArchiveRecord {
    const timestamp_ms = input.timestamp_ms ?? Date.now();
    const content_hash = input.content_hash ?? simpleHash(input.content);
    this.seq += 1;
    const entry: ArchiveRecord = {
      id: newRecordId(content_hash, timestamp_ms, this.seq),
      content_hash,
      residual: input.content,
      score: input.score ?? 0,
      classification: input.classification ?? "fact",
      reason: input.reason ?? "pruned",
      session_id: input.session_id ?? "unknown",
      agent_type: input.agent_type ?? "kompress",
      timestamp_ms,
      generation: input.generation,
      meta: input.meta,
    };
    // Freeze conceptually: store a shallow copy; never reassign fields later.
    this.records.push({ ...entry, meta: entry.meta ? { ...entry.meta } : undefined });
    this.appendDurable(entry);
    if (this.records.length > this.cap) {
      // Keep memory bounded; durable log (if any) retains full history.
      this.records.splice(0, this.records.length - this.cap);
    }
    return entry;
  }

  /** Batch append. */
  recordMany(inputs: ArchiveInput[]): ArchiveRecord[] {
    return inputs.map((i) => this.record(i));
  }

  size(): number {
    return this.records.length;
  }

  /**
   * Deliberate retrieval — not called on every compress cycle.
   * Filters are AND-ed; results newest-first.
   */
  query(q: ArchivistQuery = {}): ArchiveRecord[] {
    let out = this.records.slice();
    if (q.id !== undefined) out = out.filter((r) => r.id === q.id);
    if (q.content_hash !== undefined) out = out.filter((r) => r.content_hash === q.content_hash);
    if (q.reason !== undefined) out = out.filter((r) => r.reason === q.reason);
    if (q.session_id !== undefined) out = out.filter((r) => r.session_id === q.session_id);
    if (q.since_ms !== undefined) out = out.filter((r) => r.timestamp_ms >= q.since_ms!);
    if (q.until_ms !== undefined) out = out.filter((r) => r.timestamp_ms <= q.until_ms!);
    out.sort((a, b) => b.timestamp_ms - a.timestamp_ms);
    if (q.limit !== undefined && q.limit >= 0) out = out.slice(0, q.limit);
    return out.map((r) => ({ ...r, meta: r.meta ? { ...r.meta } : undefined }));
  }

  /** Full in-memory snapshot (audit export). Does not include spilled-only history. */
  snapshot(): ArchiveRecord[] {
    return this.query();
  }

  /** Test helper — clears in-memory only; durable JSONL is not truncated. */
  clearMemory(): void {
    this.records = [];
  }

  private appendDurable(entry: ArchiveRecord): void {
    if (!this.path) return;
    try {
      const line = JSON.stringify(entry) + "\n";
      // Best-effort append via Bun when available; silent on failure.
      const bun = (globalThis as { Bun?: { write: (p: string, d: string | Uint8Array) => Promise<number>; file: (p: string) => { size: number; arrayBuffer: () => Promise<ArrayBuffer> } } }).Bun;
      if (!bun) return;
      void (async () => {
        try {
          let existing = new Uint8Array(0);
          try {
            const f = bun.file(this.path!);
            if (f.size > 0) existing = new Uint8Array(await f.arrayBuffer());
          } catch {
            // new file
          }
          const enc = new TextEncoder().encode(line);
          const merged = new Uint8Array(existing.length + enc.length);
          merged.set(existing);
          merged.set(enc, existing.length);
          await bun.write(this.path!, merged);
        } catch {
          // silent — audit file best-effort
        }
      })();
    } catch {
      // silent
    }
  }
}

export function createArchivist(options?: ArchivistOptions): Archivist {
  return new Archivist(options);
}

/**
 * Helper: archive dropped messages from a compress pass (exit from active C).
 * Does not enqueue Circulator — that remains a separate, cycling path.
 */
export function archiveDropped(
  archivist: Archivist,
  dropped: Array<{ content: string; score?: number; role?: string }>,
  opts: {
    reason?: ArchiveReason;
    session_id?: string;
    agent_type?: string;
    threshold?: number;
  } = {},
): ArchiveRecord[] {
  return dropped.map((d) =>
    archivist.record({
      content: d.content,
      score: d.score ?? 0,
      reason: opts.reason ?? "pruned",
      session_id: opts.session_id,
      agent_type: opts.agent_type,
      meta: {
        ...(opts.threshold !== undefined ? { threshold: opts.threshold } : {}),
        ...(d.role !== undefined ? { role: d.role } : {}),
      },
    }),
  );
}
