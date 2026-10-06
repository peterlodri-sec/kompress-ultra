// pz-bridge tests — the scaffold verifies itself against a mock Project Zero.
// run:  bun test bridge/

import { afterAll, describe, expect, test } from "bun:test";
import { startMockPz } from "./mock-pz.ts";
import { createBridge, configFromEnv, decodeState } from "./pz-bridge.ts";
import { engineFromEnv } from "./engine.ts";

const cleanups: Array<() => void> = [];
afterAll(() => {
  for (const stop of cleanups) stop();
});

function boot(pzUrl: string, env: Record<string, string> = {}) {
  const cfg = configFromEnv({ PZ_URL: pzUrl, BRIDGE_PORT: "0", ...env });
  const server = createBridge(cfg);
  cleanups.push(() => server.stop(true));
  return `http://127.0.0.1:${server.port}`;
}

const post = (url: string, path: string, body: unknown) =>
  fetch(`${url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("the seam", () => {
  test("decodeState: strings, bytes, objects", () => {
    expect(decodeState("tide")).toBe("tide");
    expect(decodeState([104, 105])).toBe("hi");
    expect(decodeState({ a: 1 })).toBe('{"a":1}');
    expect(decodeState(undefined)).toBe("");
  });

  test("engineFromEnv picks the shore", () => {
    expect(engineFromEnv({}).name).toBe("project-zero");
    expect(engineFromEnv({ ENGINE: "bitnet-legacy" }).name).toBe("bitnet-legacy");
  });
});

describe("pz-bridge against a live mock", () => {
  test("health reports the engine and its reachability", async () => {
    const mock = startMockPz();
    cleanups.push(() => mock.server.stop(true));
    const url = boot(mock.url);
    const res = await fetch(`${url}/health`);
    const data: any = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.engine).toBe("project-zero");
    expect(data.engine_status.reachable).toBe(true);
  });

  test("health stays honest when the engine is down", async () => {
    const url = boot("http://127.0.0.1:1"); // nothing lives here
    const data: any = await (await fetch(`${url}/health`)).json();
    expect(data.ok).toBe(true);
    expect(data.engine_status.reachable).toBe(false);
  });

  test("generate: text in, text out, usage mapped", async () => {
    const mock = startMockPz();
    cleanups.push(() => mock.server.stop(true));
    const url = boot(mock.url);
    const res = await post(url, "/generate", { prompt: "hello shore", max_tokens: 16 });
    const data: any = await res.json();
    expect(res.status).toBe(200);
    expect(data.text).toBe("mock: hello shore");
    expect(data.engine).toBe("project-zero");
    expect(data.usage.total_tokens).toBeNumber();
    expect(data.ms).toBeNumber();
  });

  test("generate: messages array rides through", async () => {
    const mock = startMockPz();
    cleanups.push(() => mock.server.stop(true));
    const url = boot(mock.url);
    const data: any = await (
      await post(url, "/generate", {
        messages: [
          { role: "user", content: "first" },
          { role: "assistant", content: "middle" },
          { role: "user", content: "last" },
        ],
      })
    ).json();
    expect(data.text).toBe("mock: last");
  });

  test("upstream 500 maps to 502 with detail", async () => {
    const mock = startMockPz({ status: 500 });
    cleanups.push(() => mock.server.stop(true));
    const url = boot(mock.url);
    const res = await post(url, "/generate", { prompt: "x" });
    const data: any = await res.json();
    expect(res.status).toBe(502);
    expect(data.error).toContain("500");
  });

  test("timeout maps to 504", async () => {
    const mock = startMockPz({ delayMs: 500 });
    cleanups.push(() => mock.server.stop(true));
    const url = boot(mock.url, { BRIDGE_TIMEOUT_MS: "120" });
    const res = await post(url, "/generate", { prompt: "slow" });
    const data: any = await res.json();
    expect(res.status).toBe(504);
  });

  test("resonate: state in, modulated out (token-proxy)", async () => {
    const mock = startMockPz();
    cleanups.push(() => mock.server.stop(true));
    const url = boot(mock.url);
    const data: any = await (await post(url, "/resonate", { state: "the tide at 9pm", intensity: 0.7 })).json();
    expect(data.text).toBe("mock: the tide at 9pm");
    expect(data.modulation.phase).toBe("token-proxy");
    expect(data.modulation.intensity).toBe(0.7);
  });

  test("resonate: byte states decode", async () => {
    const mock = startMockPz();
    cleanups.push(() => mock.server.stop(true));
    const url = boot(mock.url);
    const data: any = await (await post(url, "/resonate", { state: [104, 105] })).json();
    expect(data.text).toBe("mock: hi");
  });

  test("state: honestly 501, phase 2", async () => {
    const mock = startMockPz();
    cleanups.push(() => mock.server.stop(true));
    const url = boot(mock.url);
    const res = await post(url, "/state", {});
    const data: any = await res.json();
    expect(res.status).toBe(501);
    expect(data.phase).toBe(2);
  });

  test("v1 passthrough: the bridge stays a door", async () => {
    const mock = startMockPz();
    cleanups.push(() => mock.server.stop(true));
    const url = boot(mock.url);
    const res = await post(url, "/v1/chat/completions", {
      messages: [{ role: "user", content: "raw" }],
    });
    const data: any = await res.json();
    expect(res.status).toBe(200);
    expect(data.id).toBe("chatcmpl-mock");
    expect(data.choices[0].message.content).toBe("mock: raw");
  });

  test("legacy shore without a binary fails kindly", async () => {
    const mock = startMockPz();
    cleanups.push(() => mock.server.stop(true));
    const url = boot(mock.url, { ENGINE: "bitnet-legacy" });
    const res = await post(url, "/generate", { prompt: "x" });
    const data: any = await res.json();
    expect(res.status).toBe(502);
    expect(data.error).toContain("legacy engine not configured");
  });
});
