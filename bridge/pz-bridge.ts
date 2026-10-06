// pz-bridge — the Phase-1 token bridge (kompress-ultra issue #6).
//
// A Node/Bun server that puts a 1-bit model behind a stable interface:
//   GET  /health                     — is the bridge (and its engine) up?
//   POST /generate                   — text in, text out
//   POST /resonate                   — compressed state in, modulated out (Phase-1 stand-in)
//   POST /state                      — raw hidden vector (Phase 2 — 501 today)
//   ANY  /v1/*                       — raw passthrough to the engine's OpenAI API
//
// Default engine: Project Zero's built-in HTTP API (no subprocess, no Python).
// Legacy engine: bitnet.cpp as a child process (ENGINE=bitnet-legacy).
//
// Run:  bun run bridge/pz-bridge.ts        (env: see bridge/README.md)

import { engineFromEnv, type InferenceEngine, type GenerateRequest } from "./engine.ts";

export interface BridgeConfig {
  host: string;
  port: number;
  engine: InferenceEngine;
}

export function configFromEnv(env: Record<string, string | undefined> = process.env): BridgeConfig {
  return {
    host: env.BRIDGE_HOST ?? "127.0.0.1",
    port: env.BRIDGE_PORT ? Number(env.BRIDGE_PORT) : 8088,
    engine: engineFromEnv(env),
  };
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" },
  });

/** accept string | number[] (bytes) | object; return bridge material */
export function decodeState(state: unknown): string {
  if (typeof state === "string") return state;
  if (Array.isArray(state) && state.every((n) => typeof n === "number")) {
    const bytes = Uint8Array.from(state.map((n) => n & 0xff));
    return new TextDecoder().decode(bytes);
  }
  if (state && typeof state === "object") return JSON.stringify(state);
  return "";
}

async function readJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export function createBridge(cfg: BridgeConfig) {
  const { engine } = cfg;

  async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "content-type, authorization",
        },
      });
    }

    if (path === "/health" && req.method === "GET") {
      const pz = await engine.probe();
      return json({
        ok: true,
        bridge: "kompress-ultra token bridge",
        phase: 1,
        engine: engine.name,
        engine_status: pz,
      });
    }

    if (path === "/generate" && req.method === "POST") {
      const body = (await readJson(req)) as GenerateRequest;
      try {
        const result = await engine.generate(body);
        return json(result);
      } catch (e: any) {
        const status = e?.upstreamStatus ? 502 : e?.name === "TimeoutError" ? 504 : 502;
        return json({ error: String(e?.message ?? e), engine: engine.name }, status);
      }
    }

    if (path === "/resonate" && req.method === "POST") {
      // Phase 1: the state is rendered to material and modulated through the
      // token channel. Phase 2 replaces the inner step with the hidden-state
      // bridge (/state) — same envelope, same callers.
      const body = await readJson(req);
      const material = decodeState(body?.state);
      const intensity = typeof body?.intensity === "number" ? body.intensity : 0.5;
      if (!material) return json({ error: "state is empty or undecodable" }, 400);
      try {
        const result = await engine.generate({
          messages: [
            {
              role: "system",
              content:
                "You are a resonant bridge. Return the state you receive, modulated: " +
                "keep its spine, shift its surface. No commentary.",
            },
            { role: "user", content: material },
          ],
          max_tokens: body?.max_tokens ?? 256,
          temperature: typeof body?.temperature === "number" ? body.temperature : 0.7,
        });
        return json({
          text: result.text,
          modulation: {
            phase: "token-proxy",
            intensity,
            note: "latent-space modulation arrives with the Phase-2 hidden-state bridge (/state)",
          },
          engine: engine.name,
          ms: result.ms,
        });
      } catch (e: any) {
        const status = e?.name === "TimeoutError" ? 504 : 502;
        return json({ error: String(e?.message ?? e), engine: engine.name }, status);
      }
    }

    if (path === "/state" && req.method === "POST") {
      return json(
        {
          error: "not implemented — Phase 2",
          phase: 2,
          detail:
            "the hidden-state bridge needs the raw vector before the LM head; " +
            "hook point documented in bridge/README.md (Project Zero: the logits path)",
        },
        501,
      );
    }

    if (path.startsWith("/v1/")) {
      // raw passthrough — the bridge stays a door, not a wall
      try {
        const raw = await req.arrayBuffer();
        const upstream = await engine.chatCompletions(
          raw.byteLength ? JSON.parse(new TextDecoder().decode(raw)) : undefined,
        );
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "content-type": upstream.headers.get("content-type") ?? "application/json",
            "access-control-allow-origin": "*",
          },
        });
      } catch (e: any) {
        return json({ error: String(e?.message ?? e), engine: engine.name }, 502);
      }
    }

    return json({ error: "not found", routes: ["/health", "/generate", "/resonate", "/state", "/v1/*"] }, 404);
  }

  const server = Bun.serve({
    hostname: cfg.host,
    port: cfg.port,
    fetch: handle,
  });
  return server;
}

if (import.meta.main) {
  const cfg = configFromEnv();
  const server = createBridge(cfg);
  console.log(`pz-bridge listening on http://${cfg.host}:${server.port} · engine=${cfg.engine.name}`);
}
