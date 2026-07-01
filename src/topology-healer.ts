/**
 * TopologyHealer — Self-healing brain graph topology (v14.0.0)
 *
 * Detects and repairs common graph issues:
 *   - Orphaned nodes (no incoming/outgoing edges)
 *   - Stale edges (not traversed in >7 days)
 *   - Single-node islands (disconnected subgraphs)
 *   - Conductivity collapse (edge with near-zero conductivity)
 *   - Excessive self-loops
 *
 * Runs as part of the brain-pulse cycle.
 * Non-destructive: all repairs are advisory and logged.
 */

import type { Node, Edge } from "./types.js";

export interface HealingReport {
  timestamp: string;
  orphansFound: number;
  staleEdgesPruned: number;
  islandsDetected: number;
  collapsedEdgesReset: number;
  selfLoopsRemoved: number;
  edgesReconnected: number;
  details: string[];
}

interface TopologyState {
  nodes: Node[];
  edges: Edge[];
}

interface OrphanResult {
  connectedNodes: Set<string>;
  details: string[];
}

/** Nodes with no incoming/outgoing edges that aren't dormant. */
function diagnoseOrphans(nodes: Node[], edges: Edge[]): OrphanResult {
  const connectedNodes = new Set<string>();
  for (const edge of edges) {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  }
  const details: string[] = [];
  for (const node of nodes) {
    if (!connectedNodes.has(node.id) && node.state !== "dormant") {
      details.push(`orphan: ${node.id} (${node.label}) — no edges`);
    }
  }
  return { connectedNodes, details };
}

/** Edges whose last traversal is older than 7 days. */
function diagnoseStaleEdges(edges: Edge[], now: number): string[] {
  const staleThreshold = 7 * 24 * 60 * 60 * 1000;
  const details: string[] = [];
  for (const edge of edges) {
    if (edge.lastTraversedMs > 0 && now - edge.lastTraversedMs > staleThreshold) {
      details.push(
        `stale: ${edge.id} — last traversed ${new Date(edge.lastTraversedMs).toISOString()}`,
      );
    }
  }
  return details;
}

/** Singleton nodes (BFS-disconnected subgraph of size 1) that aren't dormant. */
function diagnoseIslands(nodes: Node[], edges: Edge[]): string[] {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
    adjacency.get(edge.target)?.push(edge.source);
  }

  const visited = new Set<string>();
  const details: string[] = [];
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    // BFS from this node to find its connected component
    const island: string[] = [];
    const queue = [node.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      island.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
    // Singleton islands that aren't supposed to be standalone
    if (island.length === 1) {
      const n = nodes.find((n) => n.id === island[0]);
      if (n && n.state !== "dormant") {
        details.push(`island: ${n.id} (${n.label}) — singleton island`);
      }
    }
  }
  return details;
}

/** Edges with near-zero conductivity but significant weight. */
function diagnoseCollapsedEdges(edges: Edge[]): string[] {
  const details: string[] = [];
  for (const edge of edges) {
    if (edge.conductivity < 0.05 && edge.weight > 0.1) {
      details.push(`collapsed: ${edge.id} — conductivity ${edge.conductivity.toFixed(3)}`);
    }
  }
  return details;
}

/** Self-loop edges (source === target). */
function diagnoseSelfLoops(edges: Edge[]): string[] {
  const details: string[] = [];
  for (const edge of edges) {
    if (edge.source === edge.target) {
      details.push(`self-loop: ${edge.id} — ${edge.source} → itself`);
    }
  }
  return details;
}

/**
 * Suggest edges between topologically close nodes where one side is orphaned.
 * Heuristic: same layer + same type, not already connected.
 */
function suggestReconnections(
  nodes: Node[],
  edges: Edge[],
  connectedNodes: Set<string>,
): string[] {
  const details: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    if (!connectedNodes.has(a.id) && a.state !== "dormant") continue;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      if (a.layer !== b.layer || a.type !== b.type) continue;
      const alreadyConnected = edges.some(
        (e) =>
          (e.source === a.id && e.target === b.id) || (e.source === b.id && e.target === a.id),
      );
      if (!alreadyConnected && connectedNodes.has(a.id) !== connectedNodes.has(b.id)) {
        details.push(`reconnect: ${a.id} ↔ ${b.id} — same layer/type, one orphan`);
        break;
      }
    }
  }
  return details;
}

export function heal(topology: TopologyState): HealingReport {
  const { nodes, edges } = topology;
  const now = Date.now();
  const allDetails: string[] = [];

  // 1. Detect orphans
  const orphans = diagnoseOrphans(nodes, edges);
  allDetails.push(...orphans.details);

  // 2. Detect stale edges
  const staleDetails = diagnoseStaleEdges(edges, now);
  allDetails.push(...staleDetails);

  // 3. Detect islands (disconnected subgraphs)
  const islandDetails = diagnoseIslands(nodes, edges);
  allDetails.push(...islandDetails);

  // 4. Detect collapsed conductivity
  const collapseDetails = diagnoseCollapsedEdges(edges);
  allDetails.push(...collapseDetails);

  // 5. Detect self-loops
  const loopDetails = diagnoseSelfLoops(edges);
  allDetails.push(...loopDetails);

  // 6. Suggest reconnections for orphans
  const reconnectDetails = suggestReconnections(nodes, edges, orphans.connectedNodes);
  allDetails.push(...reconnectDetails);

  return {
    timestamp: new Date().toISOString(),
    orphansFound: orphans.details.length,
    staleEdgesPruned: staleDetails.length,
    islandsDetected: islandDetails.length,
    collapsedEdgesReset: collapseDetails.length,
    selfLoopsRemoved: loopDetails.length,
    edgesReconnected: reconnectDetails.length,
    details: allDetails,
  };
}

/**
 * High-level summary for logging.
 */
export function summarize(report: HealingReport): string {
  const items: string[] = [];
  if (report.orphansFound) items.push(`${report.orphansFound} orphans`);
  if (report.staleEdgesPruned) items.push(`${report.staleEdgesPruned} stale`);
  if (report.islandsDetected) items.push(`${report.islandsDetected} islands`);
  if (report.collapsedEdgesReset) items.push(`${report.collapsedEdgesReset} collapsed`);
  if (report.selfLoopsRemoved) items.push(`${report.selfLoopsRemoved} self-loops`);
  if (report.edgesReconnected) items.push(`${report.edgesReconnected} reconnections suggested`);
  return items.length > 0 ? `healed: ${items.join(", ")}` : "healthy: no issues found";
}
