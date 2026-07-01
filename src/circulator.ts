import { hashEmbedding } from "./hash.js";
import { addToStore, persistStore } from "./local-store.js";

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
    if (this.queue.length >= this.batchSize) {
      this.flushAsync();
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  drain(): CirculatorEntry[] {
    return this.queue.splice(0);
  }

  async flushAsync(): Promise<void> {
    if (this.queue.length === 0) return;
    const entries = this.queue.splice(0);
    // Store each entry as vector in local store for similarity search
    for (const entry of entries) {
      const vec = hashEmbedding(entry.residual);
      await addToStore(`circ-${entry.content_hash}-${entry.timestamp_ms}`, vec, {
        classification: entry.classification,
        session_id: entry.session_id,
        agent_type: entry.agent_type,
        content_hash: entry.content_hash,
        topic_key: entry.topic_key ?? "",
        ts: entry.timestamp_ms,
      });
    }
    await persistStore();
    // Also write raw JSONL for debugging / manual inspection
    spillOverflow(entries);
  }
}

export function classifyMessage(content: string): "fact" | "event" | "instruction" | "task" {
  const lower = content.toLowerCase();
  if (/\b(shall|should|must|need|implement|create|build|fix|update)\b/.test(lower)) return "instruction";
  if (/\b(todo|task|step|goal|objective)\b/.test(lower)) return "task";
  if (/\b(did|done|completed|failed|error|changed|updated)\b/.test(lower)) return "event";
  return "fact";
}

function inputToEntry(input: CirculatorInput): CirculatorEntry {
  return {
    session_id: input.session_id ?? "unknown",
    agent_type: input.agent_type ?? "kompress",
    message_role: input.message_role ?? "assistant",
    content_hash: simpleHash(input.content),
    classification: input.classification ?? classifyMessage(input.content),
    residual: input.content,
    timestamp_ms: input.timestamp ? new Date(input.timestamp).getTime() : Date.now(),
  };
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return `h-${Math.abs(h).toString(36)}`;
}

function spillOverflow(entries: CirculatorEntry[]): void {
  const path = `${process.env.HOME}/.cache/ultrameshai/overflow-circulator.jsonl`;
  try {
    const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
    Bun.write(path, lines);
  } catch {
    // silent
  }
}

/**
 * Default singleton for backward compatibility.
 * @deprecated Use `createCirculator()` + class API for isolated instances.
 * Singletons share state across modules and tests. Prefer new Circulator().
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

export function createCirculator(options?: CirculatorOptions): Circulator {
  return new Circulator(options);
}
