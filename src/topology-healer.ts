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

export function heal(topology: TopologyState): HealingReport {
  const report: HealingReport = {
    timestamp: new Date().toISOString(),
    orphansFound: 0,
    staleEdgesPruned: 0,
    islandsDetected: 0,
    collapsedEdgesReset: 0,
    selfLoopsRemoved: 0,
    edgesReconnected: 0,
    details: [],
  };

  const { nodes, edges } = topology;
  const nodeIds = new Set(nodes.map((n) => n.id));
  const now = Date.now();

  // ── 1. Detect orphans (nodes with no edges) ─────────────────────────
  const connectedNodes = new Set<string>();
  for (const edge of edges) {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  }
  for (const node of nodes) {
    if (!connectedNodes.has(node.id) && node.state !== "dormant") {
      report.orphansFound++;
      report.details.push(`orphan: ${node.id} (${node.label}) — no edges`);
    }
  }

  // ── 2. Detect stale edges (not traversed in 7+ days) ───────────────
  const staleThreshold = 7 * 24 * 60 * 60 * 1000;
  for (const edge of edges) {
    if (edge.lastTraversedMs > 0 && (now - edge.lastTraversedMs) > staleThreshold) {
      report.staleEdgesPruned++;
      report.details.push(`stale: ${edge.id} — last traversed ${new Date(edge.lastTraversedMs).toISOString()}`);
    }
  }

  // ── 3. Detect islands (disconnected subgraphs via BFS) ──────────────
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
    adjacency.get(edge.target)?.push(edge.source);
  }

  const visited = new Set<string>();
  const islands: string[][] = [];
  for (const node of nodes) {
    if (!visited.has(node.id)) {
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
      if (island.length > 0) islands.push(island);
    }
  }

  // Islands of size 1 that aren't supposed to be standalone
  for (const island of islands) {
    if (island.length === 1) {
      const node = nodes.find((n) => n.id === island[0]);
      if (node && node.state !== "dormant") {
        report.islandsDetected++;
        report.details.push(`island: ${node.id} (${node.label}) — singleton island`);
      }
    }
  }

  // ── 4. Detect collapsed conductivity ────────────────────────────────
  for (const edge of edges) {
    if (edge.conductivity < 0.05 && edge.weight > 0.1) {
      report.collapsedEdgesReset++;
      report.details.push(`collapsed: ${edge.id} — conductivity ${edge.conductivity.toFixed(3)}`);
    }
  }

  // ── 5. Detect self-loops ────────────────────────────────────────────
  for (const edge of edges) {
    if (edge.source === edge.target) {
      report.selfLoopsRemoved++;
      report.details.push(`self-loop: ${edge.id} — ${edge.source} → itself`);
    }
  }

  // ── 6. Suggest reconnections for orphans ────────────────────────────
  // Find nodes that are topologically close but not connected
  // (simple heuristic: same layer, compatible types)
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    if (!connectedNodes.has(a.id) && a.state !== "dormant") continue;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      if (a.layer === b.layer && a.type === b.type) {
        const alreadyConnected = edges.some(
          (e) => (e.source === a.id && e.target === b.id) || (e.source === b.id && e.target === a.id),
        );
        if (!alreadyConnected && connectedNodes.has(a.id) !== connectedNodes.has(b.id)) {
          report.edgesReconnected++;
          report.details.push(`reconnect: ${a.id} ↔ ${b.id} — same layer/type, one orphan`);
          break; // one suggestion per node
        }
      }
    }
  }

  return report;
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
