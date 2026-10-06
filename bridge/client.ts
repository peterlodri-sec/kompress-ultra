// client.ts — the mesh-side client. Point any agent at the bridge; it never
// needs to know which shore the engine lives on.

export interface BridgeClientOptions {
  url: string;          // e.g. http://127.0.0.1:8088 (or the tailnet address)
  token?: string;       // reserved: bridge auth, if ever enabled
  timeoutMs?: number;
}

export class BridgeClient {
  constructor(private opts: BridgeClientOptions) {}

  private async call(path: string, body?: unknown, timeoutMs = this.opts.timeoutMs ?? 60_000) {
    const res = await fetch(`${this.opts.url}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(this.opts.token ? { authorization: `Bearer ${this.opts.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`bridge ${path} -> ${res.status}: ${JSON.stringify(data)?.slice(0, 300)}`);
    return data;
  }

  health() {
    return this.call("/health", undefined, 5_000);
  }

  generate(prompt: string, opts: { max_tokens?: number; temperature?: number } = {}) {
    return this.call("/generate", { prompt, ...opts });
  }

  resonate(state: string | number[] | object, intensity = 0.5) {
    return this.call("/resonate", { state, intensity });
  }
}
