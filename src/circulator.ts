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

const circulatorQueue: CirculatorEntry[] = [];
const CIRCULATOR_CAP = 100;
const CIRCULATOR_BATCH = 10;

export function classifyMessage(content: string): "fact" | "event" | "instruction" | "task" {
  const lower = content.toLowerCase();
  if (/\b(shall|should|must|need|implement|create|build|fix|update)\b/.test(lower)) return "instruction";
  if (/\b(todo|task|step|goal|objective)\b/.test(lower)) return "task";
  if (/\b(did|done|completed|failed|error|changed|updated)\b/.test(lower)) return "event";
  return "fact";
}

export function enqueueCirculator(entry: CirculatorEntry): void {
  if (circulatorQueue.length >= CIRCULATOR_CAP) {
    spillCirculatorOverflow([entry]);
    return;
  }
  circulatorQueue.push(entry);
  if (circulatorQueue.length >= CIRCULATOR_BATCH) {
    flushCirculatorAsync();
  }
}

export async function flushCirculatorAsync(): Promise<void> {
  if (circulatorQueue.length === 0) return;
  const entries = circulatorQueue.splice(0);
  try {
    const texts = entries.map((e) => e.residual).join("\n---\n");
    const embedding = await embedText(texts);
    if (!embedding) {
      spillCirculatorOverflow(entries);
      return;
    }
    fetch(`${process.env.KOMPRESS_MILVUS_URL ?? "http://localhost:19530"}/v1/insert`, {
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
    }).catch(() => spillCirculatorOverflow(entries));
  } catch {
    spillCirculatorOverflow(entries);
  }
}

function spillCirculatorOverflow(entries: CirculatorEntry[]): void {
  const path = `${process.env.HOME}/.cache/ultrameshai/overflow-circulator.jsonl`;
  try {
    const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
    Bun.write(path, lines, { append: true });
  } catch {
    // silent
  }
}
