import { embedText } from "./embedding.js";

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
  milvusUrl?: string;
}

export class Circulator {
  private queue: CirculatorEntry[] = [];
  private readonly cap: number;
  private readonly batchSize: number;
  private readonly milvusUrl: string;

  constructor(options: CirculatorOptions = {}) {
    this.cap = options.cap ?? 100;
    this.batchSize = options.batchSize ?? 10;
    this.milvusUrl = options.milvusUrl ?? process.env.KOMPRESS_MILVUS_URL ?? "http://localhost:19530";
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
    try {
      const texts = entries.map((e) => e.residual).join("\n---\n");
      const embedding = await embedText(texts);
      if (!embedding) {
        spillOverflow(entries);
        return;
      }
      fetch(`${this.milvusUrl}/v1/insert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_name: "pruned_context",
          fields: {
            finding_id: `kompress-circ-${Date.now()}`,
            agent_id: "kompress",
            topic: "pruned-context",
            summary: texts.slice(0, 4096),
            embedding,
            tags: entries.map((e) => e.classification),
            created_at: Date.now(),
            embedding_model: "bge-m3",
          },
        }),
        signal: AbortSignal.timeout(1000),
      }).catch(() => spillOverflow(entries));
    } catch {
      spillOverflow(entries);
    }
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

// Default singleton for backward compatibility
const defaultCirculator = new Circulator();

export function enqueueCirculator(input: CirculatorInput): void {
  defaultCirculator.enqueue(input);
}

export function getCirculatorQueueLength(): number {
  return defaultCirculator.getQueueLength();
}

export function drainCirculatorQueue(): CirculatorEntry[] {
  return defaultCirculator.drain();
}

export function flushCirculatorAsync(): Promise<void> {
  return defaultCirculator.flushAsync();
}

export function createCirculator(options?: CirculatorOptions): Circulator {
  return new Circulator(options);
}
