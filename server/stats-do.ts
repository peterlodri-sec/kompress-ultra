/**
 * StatsDO — Cross-region Durable Object for compression statistics.
 *
 * Coordinates stats across regional Worker deployments. Each region
 * writes to its local KV, and this DO merges them on read.
 *
 * Part of the triple-crown (v5.0.0) multi-region architecture.
 */

interface StatsPayload {
  region: string;
  compressed: number;
  tokens_saved: number;
  duration_ms: number;
}

export class StatsDO {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  private stats: Map<string, { compressed: number; tokens_saved: number; duration_ms: number; count: number }> = new Map();

  constructor(ctx: DurableObjectState) {
    this.state = ctx;
    this.storage = ctx.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    if (method === "POST" && url.pathname === "/record") {
      const payload: StatsPayload = await request.json();
      return this.handleRecord(payload);
    }

    if (method === "GET" && url.pathname === "/stats") {
      return this.handleGetStats();
    }

    if (method === "POST" && url.pathname === "/merge") {
      const remoteStats = await request.json() as { regions?: { region: string; compressed: number; tokens_saved: number; duration_ms: number; count: number }[] };
      return this.handleMerge(remoteStats);
    }

    return new Response(JSON.stringify({ error: "unknown endpoint" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  private async handleRecord(payload: StatsPayload): Promise<Response> {
    const region = payload.region || "unknown";
    const existing = this.stats.get(region) || { compressed: 0, tokens_saved: 0, duration_ms: 0, count: 0 };

    existing.compressed += payload.compressed;
    existing.tokens_saved += payload.tokens_saved;
    existing.duration_ms += payload.duration_ms;
    existing.count += 1;

    this.stats.set(region, existing);

    // Persist to storage
    await this.storage.put(`region:${region}`, existing);
    await this.storage.put("last_updated", Date.now());

    return new Response(JSON.stringify({ ok: true, region }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  private async handleGetStats(): Promise<Response> {
    // Merge in-memory + storage
    const entries: { region: string; compressed: number; tokens_saved: number; duration_ms: number; count: number }[] = [];

    for (const [region, data] of this.stats.entries()) {
      entries.push({ region, ...data });
    }

    // Also check storage for any regions not in memory
    const stored = await this.storage.list({ prefix: "region:" });
    for (const [key, value] of stored) {
      const region = key.replace("region:", "");
      if (!this.stats.has(region)) {
        entries.push({ region, ...(value as Record<string, number>) } as typeof entries[number]);
      }
    }

    const lastUpdated = (await this.storage.get("last_updated")) as number | null;

    return new Response(
      JSON.stringify({
        regions: entries,
        total: entries.reduce((a, e) => a + e.compressed, 0),
        last_updated: lastUpdated,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  private async handleMerge(remoteStats: { regions?: { region: string; compressed: number; tokens_saved: number; duration_ms: number; count: number }[] }): Promise<Response> {
    // Merge stats from another region's DO
    const regions = remoteStats.regions || [];
    for (const entry of regions) {
      const existing = this.stats.get(entry.region) || { compressed: 0, tokens_saved: 0, duration_ms: 0, count: 0 };
      existing.compressed = Math.max(existing.compressed, entry.compressed);
      existing.tokens_saved = Math.max(existing.tokens_saved, entry.tokens_saved);
      existing.duration_ms = Math.max(existing.duration_ms, entry.duration_ms);
      existing.count = Math.max(existing.count, entry.count);
      this.stats.set(entry.region, existing);
    }
    return new Response(JSON.stringify({ ok: true, merged: regions.length }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
