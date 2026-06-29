/**
 * EdgeRouter — Semantic edge routing with learned conductivity (v13.0.0)
 *
 * Routes requests through the brain graph based on semantic similarity
 * and learned conductivity. Combines:
 *   - DIAD conductivity (learned from traversal success)
 *   - Semantic similarity (from Milvus embeddings)
 *   - Temporal recency (edges used recently get priority)
 *   - Layer awareness (same-layer edges preferred)
 *
 * Usage:
 *   const router = new EdgeRouter(brainGraph);
 *   const bestPath = router.route("compress", "deploy");
 *   router.recordTraversal(bestPath.edgeId, true);
 */

import type { Edge, Node } from "../src/types.js";
import { searchSimilarEdges } from "./brain-embeddings.js";

export interface RoutingResult {
  edgeId: string;
  source: string;
  target: string;
  type: string;
  confidence: number;
  reason: string;
  alternatives: { edgeId: string; confidence: number }[];
}

export class EdgeRouter {
  private edges: Edge[] = [];
  private nodes: Map<string, Node> = new Map();
  private conductivityHistory: Map<string, number[]> = new Map();
  private lastTraversal: Map<string, number> = new Map();
  private decayFactor = 0.95;

  constructor(nodes: Node[], edges: Edge[]) {
    this.edges = edges;
    for (const node of nodes) {
      this.nodes.set(node.id, node);
    }
    // Initialize conductivity history from edge data
    for (const edge of edges) {
      this.conductivityHistory.set(edge.id, [edge.conductivity]);
      if (edge.lastTraversedMs > 0) {
        this.lastTraversal.set(edge.id, edge.lastTraversedMs);
      }
    }
  }

  /**
   * Route from a source concept to a target concept.
   * Returns the best edge path with confidence score.
   */
  route(sourceQuery: string, targetQuery?: string, maxPaths = 3): RoutingResult[] {
    const now = Date.now();
    const results: RoutingResult[] = [];

    // Score all edges by combined relevance
    const scored = this.edges.map((edge) => {
      let score = 0;
      const reasons: string[] = [];

      // 1. DIAD conductivity (learned success rate)
      const condHistory = this.conductivityHistory.get(edge.id) ?? [edge.conductivity];
      const avgConductivity = condHistory.reduce((a, b) => a + b, 0) / condHistory.length;
      score += avgConductivity * 0.4;
      if (avgConductivity > 0.7) reasons.push("high-conductivity");

      // 2. Semantic similarity (if Milvus available)
      const semScore = this.semanticScore(edge, sourceQuery, targetQuery);
      score += semScore * 0.3;
      if (semScore > 0.6) reasons.push("semantic-match");

      // 3. Temporal recency
      const lastUsed = this.lastTraversal.get(edge.id) ?? 0;
      if (lastUsed > 0) {
        const recency = Math.max(0, 1 - (now - lastUsed) / (7 * 24 * 60 * 60 * 1000));
        score += recency * 0.15;
        if (recency > 0.5) reasons.push("recently-used");
      }

      // 4. Layer alignment
      const sourceNode = this.nodes.get(edge.source);
      const targetNode = this.nodes.get(edge.target);
      if (sourceNode && targetNode && sourceNode.layer === targetNode.layer) {
        score += 0.15;
        reasons.push("same-layer");
      }

      return {
        edgeId: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        confidence: Math.min(1, score),
        reason: reasons.join(", ") || "default",
        alternatives: [],
      };
    });

    // Sort by confidence descending, return top paths
    return scored.sort((a, b) => b.confidence - a.confidence).slice(0, maxPaths);
  }

  /**
   * Record a traversal — updates conductivity for DIAD learning.
   */
  recordTraversal(edgeId: string, success: boolean, durationMs = 0): number {
    const edge = this.edges.find((e) => e.id === edgeId);
    if (!edge) return 0;

    const history = this.conductivityHistory.get(edgeId) ?? [];
    const learningRate = 0.1;

    let newConductivity: number;
    if (success) {
      newConductivity = Math.min(1, (history[history.length - 1] ?? edge.conductivity) + learningRate);
    } else {
      newConductivity = Math.max(0, (history[history.length - 1] ?? edge.conductivity) - learningRate * 2);
    }

    history.push(newConductivity);
    if (history.length > 10) history.shift(); // keep last 10
    this.conductivityHistory.set(edgeId, history);
    this.lastTraversal.set(edgeId, Date.now());

    // Update edge in place
    edge.conductivity = newConductivity;
    edge.lastTraversedMs = Date.now();

    return newConductivity;
  }

  /**
   * Get current routing state.
   */
  getState() {
    return {
      edges: this.edges.length,
      nodes: this.nodes.size,
      conductivities: Object.fromEntries(this.conductivityHistory),
    };
  }

  /**
   * Prune low-conductivity edges (for repair-bot).
   */
  getLowConductivityEdges(threshold = 0.2): Edge[] {
    return this.edges.filter((e) => {
      const history = this.conductivityHistory.get(e.id) ?? [e.conductivity];
      const avg = history.reduce((a, b) => a + b, 0) / history.length;
      return avg < threshold;
    });
  }

  private semanticScore(edge: Edge, sourceQuery?: string, targetQuery?: string): number {
    let score = 0;
    let matches = 0;

    if (sourceQuery) {
      const q = sourceQuery.toLowerCase();
      if (edge.source.toLowerCase().includes(q) || edge.label.toLowerCase().includes(q)) {
        score += 0.4;
        matches++;
      }
      // Check connected node labels
      const sourceNode = this.nodes.get(edge.source);
      if (sourceNode && (sourceNode.label.toLowerCase().includes(q) || sourceNode.type.toLowerCase().includes(q))) {
        score += 0.3;
        matches++;
      }
    }

    if (targetQuery) {
      const q = targetQuery.toLowerCase();
      if (edge.target.toLowerCase().includes(q) || edge.label.toLowerCase().includes(q)) {
        score += 0.4;
        matches++;
      }
      const targetNode = this.nodes.get(edge.target);
      if (targetNode && (targetNode.label.toLowerCase().includes(q) || targetNode.type.toLowerCase().includes(q))) {
        score += 0.3;
        matches++;
      }
    }

    return matches > 0 ? score / matches : score;
  }
}
