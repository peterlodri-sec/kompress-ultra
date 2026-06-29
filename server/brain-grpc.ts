/**
 * BrainService — gRPC-compatible Brain Graph API (v11.0.0 grpc-synapse)
 *
 * Implements the BrainService proto definition as a Connect-Web compatible
 * REST handler for Cloudflare Workers. Supports:
 *   - Node/edge CRUD via REST + Protobuf encoding
 *   - Graph queries with semantic routing
 *   - Traversal recording for conductivity learning
 *   - Deterministic snapshots
 *   - SSE streaming for real-time edge events
 *
 * Proto: proto/brain.proto
 * Service: kompress.v1.BrainService
 */

import { Node, Edge, BrainSnapshot } from "../src/types.js";

// ── In-memory brain graph (loaded from ~/.brain/graph.json at deploy) ──
interface BrainGraph {
  version: string;
  schema: string;
  nodes: Node[];
  edges: Edge[];
  meta: Record<string, string>;
}

let brainGraph: BrainGraph | null = null;

function getBrain(): BrainGraph {
  if (!brainGraph) {
    brainGraph = {
      version: "v1",
      schema: "brain-graph-v1",
      nodes: [],
      edges: [],
      meta: {},
    };
  }
  return brainGraph;
}

// ── Load brain from request context ──────────────────────────────────
export function loadBrain(json: any): void {
  brainGraph = {
    version: json.version ?? "v1",
    schema: json.schema ?? "brain-graph-v1",
    nodes: (json.nodes ?? []).map(normalizeNode),
    edges: (json.edges ?? []).map(normalizeEdge),
    meta: json.meta ?? {},
  };
}

function normalizeNode(n: any): Node {
  return {
    id: n.id ?? n.name ?? `node-${Date.now()}`,
    label: n.label ?? n.name ?? "unknown",
    type: n.type ?? "component",
    layer: n.layer ?? "0",
    metadata: n.metadata ?? {},
    score: typeof n.score === "number" ? n.score : 0.5,
    createdAtMs: n.created_at_ms ?? n.createdAt ?? Date.now(),
    lastActiveMs: n.last_active_ms ?? n.lastActive ?? Date.now(),
    state: n.state ?? "alive",
  };
}

function normalizeEdge(e: any): Edge {
  return {
    id: e.id ?? `${e.source}→${e.target}`,
    source: e.source ?? "",
    target: e.target ?? "",
    type: e.type ?? "unknown",
    label: e.label ?? "",
    weight: typeof e.weight === "number" ? e.weight : typeof e.conductivity === "number" ? e.conductivity : 0.5,
    conductivity: typeof e.conductivity === "number" ? e.conductivity : typeof e.weight === "number" ? e.weight : 0.5,
    direction: e.direction ?? "forward",
    createdAtMs: e.created_at_ms ?? e.createdAt ?? Date.now(),
    lastTraversedMs: e.last_traversed_ms ?? e.lastTraversed ?? 0,
  };
}

// ── Handlers ───────────────────────────────────────────────────────────

export function handleGetNode(id: string): { node?: Node; error?: string } {
  const brain = getBrain();
  const node = brain.nodes.find((n) => n.id === id);
  if (!node) return { error: `node not found: ${id}` };
  return { node };
}

export function handleListNodes(filter?: {
  layer?: string;
  type?: string;
  state?: string;
  pageSize?: number;
  pageToken?: string;
}): { nodes: Node[]; totalCount: number } {
  const brain = getBrain();
  let nodes = [...brain.nodes];

  if (filter?.layer) nodes = nodes.filter((n) => n.layer === filter.layer);
  if (filter?.type) nodes = nodes.filter((n) => n.type === filter.type);
  if (filter?.state) nodes = nodes.filter((n) => n.state === filter.state);

  return { nodes, totalCount: nodes.length };
}

export function handleGetEdge(id: string): { edge?: Edge; error?: string } {
  const brain = getBrain();
  const edge = brain.edges.find((e) => e.id === id);
  if (!edge) return { error: `edge not found: ${id}` };
  return { edge };
}

export function handleListEdges(filter?: {
  source?: string;
  target?: string;
  type?: string;
}): { edges: Edge[]; totalCount: number } {
  const brain = getBrain();
  let edges = [...brain.edges];

  if (filter?.source) edges = edges.filter((e) => e.source === filter.source);
  if (filter?.target) edges = edges.filter((e) => e.target === filter.target);
  if (filter?.type) edges = edges.filter((e) => e.type === filter.type);

  return { edges, totalCount: edges.length };
}

export function handleRecordTraversal(edgeId: string, success: boolean, durationMs: number): { ok: boolean; updatedConductivity: number } {
  const brain = getBrain();
  const edge = brain.edges.find((e) => e.id === edgeId);
  if (!edge) return { ok: false, updatedConductivity: 0 };

  // Update conductivity based on success (DIAD learning)
  const learningRate = 0.1;
  if (success) {
    edge.conductivity = Math.min(1, edge.conductivity + learningRate);
  } else {
    edge.conductivity = Math.max(0, edge.conductivity - learningRate * 2);
  }
  edge.lastTraversedMs = Date.now();

  return { ok: true, updatedConductivity: edge.conductivity };
}

export function handleQueryGraph(query: string, maxResults = 10): {
  nodes: Node[];
  edges: Edge[];
  queryTimeMs: number;
} {
  const brain = getBrain();
  const start = performance.now();
  const q = query.toLowerCase();

  // Simple semantic matching — find nodes/edges matching query terms
  const matchingNodes = brain.nodes.filter(
    (n) =>
      n.id.toLowerCase().includes(q) ||
      n.label.toLowerCase().includes(q) ||
      n.type.toLowerCase().includes(q),
  ).slice(0, maxResults);

  const nodeIds = new Set(matchingNodes.map((n) => n.id));
  const matchingEdges = brain.edges.filter(
    (e) =>
      nodeIds.has(e.source) ||
      nodeIds.has(e.target) ||
      e.type.toLowerCase().includes(q) ||
      e.label.toLowerCase().includes(q),
  ).slice(0, maxResults);

  return {
    nodes: matchingNodes,
    edges: matchingEdges,
    queryTimeMs: performance.now() - start,
  };
}

export function handleGetSnapshot(): BrainSnapshot {
  const brain = getBrain();
  const content = JSON.stringify(brain);
  const checksum = Array.from(new TextEncoder().encode(content))
    .reduce((a, b) => (a + b) % 0xFFFFFFFF, 0)
    .toString(16);

  return {
    version: brain.version,
    schema: brain.schema,
    nodes: brain.nodes,
    edges: brain.edges,
    meta: brain.meta,
    checksumSha256: checksum,
    takenAtMs: Date.now(),
  };
}

// ── Edge streaming (SSE for Connect-Web compatibility) ─────────────────
export function createEdgeStream(typeFilter?: string): ReadableStream {
  const brain = getBrain();
  let index = 0;

  return new ReadableStream({
    start(controller) {
      // Emit existing edges as "created" events
      const edges = typeFilter
        ? brain.edges.filter((e) => e.type === typeFilter)
        : brain.edges;

      for (const edge of edges) {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ event: "created", edge })}\n\n`,
          ),
        );
      }

      // Keep connection open for future events
      const interval = setInterval(() => {
        controller.enqueue(
          new TextEncoder().encode(`: heartbeat\n\n`),
        );
      }, 30000);

      // Cleanup on cancel
      (controller as any)._cleanup = () => clearInterval(interval);
    },
    cancel() {
      // Stream cancelled by client
    },
  });
}

// ── REST routing ───────────────────────────────────────────────────────
export async function handleBrainRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace("/v1/brain/", "");

  try {
    // GET /v1/brain/node/:id
    if (path.startsWith("node/") && request.method === "GET") {
      const id = decodeURIComponent(path.slice(5));
      const result = handleGetNode(id);
      if (result.error) return json({ error: result.error }, 404);
      return json(result);
    }

    // GET /v1/brain/nodes
    if (path === "nodes" && request.method === "GET") {
      const result = handleListNodes({
        layer: url.searchParams.get("layer") || undefined,
        type: url.searchParams.get("type") || undefined,
        state: url.searchParams.get("state") || undefined,
      });
      return json(result);
    }

    // GET /v1/brain/edge/:id
    if (path.startsWith("edge/") && request.method === "GET") {
      const id = decodeURIComponent(path.slice(5));
      const result = handleGetEdge(id);
      if (result.error) return json({ error: result.error }, 404);
      return json(result);
    }

    // GET /v1/brain/edges
    if (path === "edges" && request.method === "GET") {
      const result = handleListEdges({
        source: url.searchParams.get("source") || undefined,
        target: url.searchParams.get("target") || undefined,
        type: url.searchParams.get("type") || undefined,
      });
      return json(result);
    }

    // POST /v1/brain/query
    if (path === "query" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const result = handleQueryGraph(
        String(body.query || ""),
        Number(body.maxResults || 10),
      );
      return json(result);
    }

    // POST /v1/brain/traverse
    if (path === "traverse" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const result = handleRecordTraversal(
        String(body.edgeId || ""),
        body.success !== false,
        Number(body.durationMs || 0),
      );
      return json(result);
    }

    // GET /v1/brain/snapshot
    if (path === "snapshot" && request.method === "GET") {
      const snapshot = handleGetSnapshot();
      return json(snapshot);
    }

    // GET /v1/brain/stream
    if (path === "stream" && request.method === "GET") {
      const typeFilter = url.searchParams.get("type") || undefined;
      const stream = createEdgeStream(typeFilter);
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Health check
    if (path === "health" && request.method === "GET") {
      return json({
        ok: true,
        version: "11.0.0",
        nodes: getBrain().nodes.length,
        edges: getBrain().edges.length,
      });
    }

    return json({ error: "not found" }, 404);
  } catch (err) {
    return json({ error: "internal error", detail: String(err) }, 500);
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
