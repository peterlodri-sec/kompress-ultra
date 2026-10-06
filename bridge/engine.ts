// the engine seam — one interface, two shores.
//
// Phase 1 (recommended): Project Zero's built-in HTTP API. One C binary,
// zero Python, no subprocess to manage — the bridge just talks HTTP.
//   https://github.com/shifulegend/project-zero  (MIT, C99)
//
// Legacy shore, kept for reference: bitnet.cpp as a managed child process.
// The whole point of this seam is that the bridge server does not care.

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface GenerateRequest {
  prompt?: string;
  messages?: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  model?: string;
}

export interface GenerateResult {
  text: string;
  engine: string;
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
  ms: number;
}

export interface InferenceEngine {
  readonly name: string;
  generate(req: GenerateRequest, signal?: AbortSignal): Promise<GenerateResult>;
  probe(): Promise<{ reachable: boolean; info?: string }>;
  /** raw OpenAI-compatible passthrough — the bridge stays a door, not a wall */
  chatCompletions(body: unknown, signal?: AbortSignal): Promise<Response>;
}

// ── shore one: Project Zero ─────────────────────────────────────────────

export interface ProjectZeroConfig {
  url: string;               // e.g. http://127.0.0.1:8080
  apiKey?: string;           // only if the server runs with --api-key
  model?: string;            // server-side model id (informational)
  timeoutMs: number;
}

export class ProjectZeroEngine implements InferenceEngine {
  readonly name = "project-zero";
  constructor(private cfg: ProjectZeroConfig) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (this.cfg.apiKey) h["authorization"] = `Bearer ${this.cfg.apiKey}`;
    return h;
  }

  private signal(outer?: AbortSignal): AbortSignal {
    const t = AbortSignal.timeout(this.cfg.timeoutMs);
    return outer ? AbortSignal.any([outer, t]) : t;
  }

  async generate(req: GenerateRequest, outer?: AbortSignal): Promise<GenerateResult> {
    const started = performance.now();
    const messages: ChatMessage[] = req.messages?.length
      ? req.messages
      : [{ role: "user", content: req.prompt ?? "" }];
    const body = {
      model: req.model ?? this.cfg.model ?? "project-zero",
      messages,
      max_tokens: req.max_tokens ?? 256,
      temperature: req.temperature ?? 0.7,
    };
    const res = await fetch(`${this.cfg.url}/v1/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: this.signal(outer),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const err = new Error(`project zero -> ${res.status}: ${detail.slice(0, 300)}`);
      (err as any).upstreamStatus = res.status;
      throw err;
    }
    const data: any = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    return {
      text,
      engine: this.name,
      model: body.model,
      usage: data?.usage ?? null,
      ms: Math.round(performance.now() - started),
    };
  }

  async probe(): Promise<{ reachable: boolean; info?: string }> {
    try {
      const res = await fetch(`${this.cfg.url}/openapi.json`, {
        signal: AbortSignal.timeout(Math.min(1500, this.cfg.timeoutMs)),
        headers: this.headers(),
      });
      return { reachable: res.ok, info: res.ok ? `openapi ${res.status}` : `http ${res.status}` };
    } catch (e: any) {
      return { reachable: false, info: e?.name === "TimeoutError" ? "timeout" : "unreachable" };
    }
  }

  async chatCompletions(body: unknown, outer?: AbortSignal): Promise<Response> {
    return fetch(`${this.cfg.url}/v1/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: this.signal(outer),
    });
  }
}

// ── shore two: bitnet.cpp, managed as a child process (legacy) ──────────

export interface BitnetLegacyConfig {
  binPath?: string;          // e.g. /tmp/bitnet/build/bin/llama-cli
  modelPath?: string;        // e.g. models/Falcon3-3B/ggml-model-i2_s.gguf
  threads?: number;
  timeoutMs: number;
}

export class BitnetLegacyEngine implements InferenceEngine {
  readonly name = "bitnet-legacy";
  constructor(private cfg: BitnetLegacyConfig) {}

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const prompt = req.messages?.map((m) => m.content).join("\n") ?? req.prompt ?? "";
    if (!this.cfg.binPath || !this.cfg.modelPath) {
      throw new Error(
        "legacy engine not configured: set BITNET_BIN and BITNET_MODEL (or use ENGINE=project-zero — see bridge/README.md)",
      );
    }
    const started = performance.now();
    const proc = Bun.spawn(
      [
        this.cfg.binPath,
        "-m", this.cfg.modelPath,
        "-p", prompt,
        "-n", String(req.max_tokens ?? 256),
        "-t", String(this.cfg.threads ?? 4),
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const timer = setTimeout(() => proc.kill(), this.cfg.timeoutMs);
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    clearTimeout(timer);
    return {
      text: out.trim(),
      engine: this.name,
      model: this.cfg.modelPath,
      usage: null,
      ms: Math.round(performance.now() - started),
    };
  }

  async probe(): Promise<{ reachable: boolean; info?: string }> {
    if (!this.cfg.binPath) return { reachable: false, info: "BITNET_BIN unset" };
    const exists = await Bun.file(this.cfg.binPath).exists();
    return { reachable: exists, info: exists ? this.cfg.binPath : `missing: ${this.cfg.binPath}` };
  }

  async chatCompletions(): Promise<Response> {
    throw new Error("legacy engine has no OpenAI passthrough — use ENGINE=project-zero");
  }
}

// ── the factory ─────────────────────────────────────────────────────────

export function engineFromEnv(env: Record<string, string | undefined> = process.env): InferenceEngine {
  const kind = (env.ENGINE ?? "project-zero").toLowerCase();
  if (kind === "bitnet-legacy") {
    return new BitnetLegacyEngine({
      binPath: env.BITNET_BIN,
      modelPath: env.BITNET_MODEL,
      threads: env.BITNET_THREADS ? Number(env.BITNET_THREADS) : undefined,
      timeoutMs: env.BRIDGE_TIMEOUT_MS ? Number(env.BRIDGE_TIMEOUT_MS) : 60_000,
    });
  }
  return new ProjectZeroEngine({
    url: env.PZ_URL ?? "http://127.0.0.1:8080",
    apiKey: env.PZ_API_KEY,
    model: env.PZ_MODEL,
    timeoutMs: env.BRIDGE_TIMEOUT_MS ? Number(env.BRIDGE_TIMEOUT_MS) : 30_000,
  });
}
