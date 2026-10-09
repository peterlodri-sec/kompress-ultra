import { hashEmbedding } from "./hash.js";
import { addToStore, persistStore } from "./local-store.js";
import { appendFileSync, existsSync, mkdirSync } from "fs";

export interface CirculatorEntry {
  session_id: string;
  agent_type: string;
  message_role: string;
  content_hash: string;
  classification: "fact" | "event" | "instruction" | "task";
  topic_key?: string;
  residual: string;
  timestamp_ms: number;
}

export interface CirculatorInput {
  content: string;
  classification?: "fact" | "event" | "instruction" | "task";
  score?: number;
  timestamp?: string;
  session_id?: string;
  agent_type?: string;
  message_role?: string;
}

export interface CirculatorOptions {
  cap?: number;
  batchSize?: number;
}

export class Circulator {
  private queue: CirculatorEntry[] = [];
  private readonly cap: number;
  private readonly batchSize: number;
  private flushing = false;

  constructor(options: CirculatorOptions = {}) {
    this.cap = options.cap ?? 100;
    this.batchSize = options.batchSize ?? 10;
  }

  enqueue(input: CirculatorInput): void {
    const entry = inputToEntry(input);

    if (this.queue.length >= this.cap) {
      spillOverflow([entry]);
      return;
    }

    this.queue.push(entry);

    if (this.queue.length >= this.batchSize && !this.flushing) {
      void this.flushAsync();
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  drain(): CirculatorEntry[] {
    return this.queue.splice(0);
  }

  async flushAsync(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;

    this.flushing = true;

    try {
      /*
       * Keep draining until fewer than batchSize entries remain.
       * This prevents messages arriving during a flush from getting
       * stranded after their attempted flush sees flushing === true.
       */
      do {
        const entries = this.queue.splice(0);

        for (const entry of entries) {
          const vec = hashEmbedding(entry.residual);

          await addToStore(
            `circ-${entry.content_hash}-${entry.timestamp_ms}`,
            vec,
            {
              classification: entry.classification,
              session_id: entry.session_id,
              agent_type: entry.agent_type,
              content_hash: entry.content_hash,
              topic_key: entry.topic_key ?? "",
              ts: entry.timestamp_ms,
            },
          );
        }

        await persistStore();

        // Raw append-only log for debugging / manual inspection.
        spillOverflow(entries);
      } while (this.queue.length >= this.batchSize);
    } finally {
      this.flushing = false;
    }
  }
}

export function classifyMessage(
  content: string,
): "fact" | "event" | "instruction" | "task" {
  const lower = content.toLowerCase();

  if (
    /\b(shall|should|must|need|implement|create|build|fix|update)\b/.test(
      lower,
    )
  ) {
    return "instruction";
  }

  if (/\b(todo|task|step|goal|objective)\b/.test(lower)) {
    return "task";
  }

  if (
    /\b(did|done|completed|failed|error|changed|updated)\b/.test(lower)
  ) {
    return "event";
  }

  return "fact";
}

function inputToEntry(input: CirculatorInput): CirculatorEntry {
  return {
    session_id: input.session_id ?? "unknown",
    agent_type: input.agent_type ?? "kompress",
    message_role: input.message_role ?? "assistant",
    content_hash: simpleHash(input.content),
    classification:
      input.classification ?? classifyMessage(input.content),
    residual: input.content,
    timestamp_ms: input.timestamp
      ? new Date(input.timestamp).getTime()
      : Date.now(),
  };
}

function simpleHash(s: string): string {
  let h = 0;

  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }

  return `h-${Math.abs(h).toString(36)}`;
}

/**
 * Append entries to the raw circulator log.
 *
 * Unlike Bun.write(), appendFileSync() preserves earlier batches.
 */
function spillOverflow(entries: CirculatorEntry[]): void {
  if (entries.length === 0) return;

  const path =
    `${process.env.HOME}/.cache/ultrameshai/overflow-circulator.jsonl`;

  try {
    const dir = path.substring(0, path.lastIndexOf("/"));

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const lines =
      entries.map((e) => JSON.stringify(e)).join("\n") + "\n";

    appendFileSync(path, lines, "utf8");
  } catch {
    // silent — overflow log is best-effort
  }
}

/**
 * Default singleton for backward compatibility.
 * @deprecated Use `createCirculator()` + class API for isolated instances.
 */
const defaultCirculator = new Circulator();

/** @deprecated Use `circulator.enqueue()` on a class instance. */
export function enqueueCirculator(input: CirculatorInput): void {
  defaultCirculator.enqueue(input);
}

/** @deprecated Use `circulator.getQueueLength()` on a class instance. */
export function getCirculatorQueueLength(): number {
  return defaultCirculator.getQueueLength();
}

/** @deprecated Use `circulator.drain()` on a class instance. */
export function drainCirculatorQueue(): CirculatorEntry[] {
  return defaultCirculator.drain();
}

/** @deprecated Use `circulator.flushAsync()` on a class instance. */
export function flushCirculatorAsync(): Promise<void> {
  return defaultCirculator.flushAsync();
}

export function createCirculator(
  options?: CirculatorOptions,
): Circulator {
  return new Circulator(options);
}