// mock-pz — a stand-in for Project Zero's HTTP API, for tests and dry runs.
// Speaks just enough OpenAI to fool the bridge: /v1/chat/completions,
// /openapi.json, /docs. Delay + status are controllable for timeout tests.

import { serve } from "bun";

export interface MockOptions {
  port?: number;
  delayMs?: number;   // per-request delay (also readable from header x-mock-delay-ms)
  status?: number;    // force a status (also readable from header x-mock-status)
}

export function startMockPz(opts: MockOptions = {}) {
  const server = serve({
    hostname: "127.0.0.1",
    port: opts.port ?? 0,
    async fetch(req) {
      const url = new URL(req.url);
      const delay = Number(req.headers.get("x-mock-delay-ms") ?? opts.delayMs ?? 0);
      const status = Number(req.headers.get("x-mock-status") ?? opts.status ?? 200);
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));

      if (url.pathname === "/openapi.json") {
        return Response.json({ openapi: "3.0.0", info: { title: "project-zero (mock)", version: "0.1.0" } });
      }
      if (url.pathname === "/docs") {
        return new Response("<html><body>project-zero (mock) docs</body></html>", {
          headers: { "content-type": "text/html" },
        });
      }
      if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
        if (status !== 200) return new Response(`mock upstream error`, { status });
        const body: any = await req.json().catch(() => ({}));
        const last = [...(body?.messages ?? [])].reverse().find((m: any) => m.role === "user");
        const prompt = last?.content ?? "";
        return Response.json({
          id: "chatcmpl-mock",
          object: "chat.completion",
          model: body?.model ?? "mock",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: `mock: ${prompt}` },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: prompt.length, completion_tokens: 8, total_tokens: prompt.length + 8 },
        });
      }
      return Response.json({ error: "not found (mock)" }, { status: 404 });
    },
  });
  return { server, url: `http://127.0.0.1:${server.port}` };
}

if (import.meta.main) {
  const { url } = startMockPz({ port: Number(process.env.MOCK_PORT ?? 8180) });
  console.log(`mock project-zero on ${url}`);
}
