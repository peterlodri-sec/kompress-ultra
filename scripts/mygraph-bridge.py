#!/usr/bin/env python3
"""
mygraph-bridge — Sync Rahul's mygraph.json → kompress-ultra brain layer

Writes two files:
  ~/.brain/graph.json           — brain-graph.sh hotswap layer (0,2,4)
  ~/.cache/ultrameshai/brain-state.json — BrainState heartbeat

Usage:
  python3 scripts/mygraph-bridge.py
  python3 scripts/mygraph-bridge.py --dry-run
  python3 scripts/mygraph-bridge.py --graph /path/to/mygraph.json

Layer encoding (brain-graph 3D):
  t: -1=past  0=present  1=future
  y:  0=data  1=info     2=knowledge  3=wisdom
  z:  0=token 1=msg      2=conv       3=session  4=project  5=mesh
"""

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

MYGRAPH_DEFAULT = Path.home() / "Desktop/ideas/knowledge-worker-private/mygraph/mygraph.json"
BRAIN_GRAPH     = Path.home() / ".brain/graph.json"
BRAIN_STATE     = Path.home() / ".cache/ultrameshai/brain-state.json"

# mygraph node type → [t, y, z]
LAYER_MAP = {
    "idea":        [0,  2, 4],   # present / knowledge / project
    "goal":        [1,  3, 4],   # future  / wisdom    / project
    "decision":    [-1, 2, 3],   # past    / knowledge / session
    "project":     [0,  1, 4],   # present / info      / project
    "topic":       [0,  2, 5],   # present / knowledge / mesh
    "reference":   [-1, 1, 5],   # past    / info      / mesh
    "source":      [-1, 0, 5],   # past    / data      / mesh
    "person":      [0,  1, 5],   # present / info      / mesh
    "observation": [-1, 1, 3],   # past    / info      / session
    "question":    [1,  2, 3],   # future  / knowledge / session
    "quote":       [-1, 0, 5],   # past    / data      / mesh
    "entity":      [0,  3, 5],   # present / wisdom    / mesh
}

CONFIDENCE_SCORE = {
    "high":        0.9,
    "medium":      0.6,
    "low":         0.3,
    "speculative": 0.2,
}

# findings = high-provenance node types
FINDING_TYPES   = {"decision", "observation", "goal", "entity"}
PATTERN_TYPES   = {"topic", "idea", "reference", "quote"}


def parse_ts_ms(ts_str: str) -> int:
    if not ts_str:
        return 0
    try:
        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        return int(dt.timestamp() * 1000)
    except Exception:
        return 0


def convert_node(node_id: str, node: dict) -> dict:
    parts = node_id.split(":", 1)
    node_type = parts[0] if len(parts) == 2 else "unknown"
    layer = LAYER_MAP.get(node_type, [0, 1, 5])
    score = CONFIDENCE_SCORE.get(node.get("confidence", "medium"), 0.6)
    created_ms = parse_ts_ms(node.get("created_at", ""))
    return {
        "id":           node_id,
        "label":        node.get("label") or node_id,
        "type":         node_type,
        "layer":        layer,
        "metadata":     {"body_snippet": str(node.get("body", ""))[:200]},
        "score":        score,
        "createdAtMs":  created_ms,
        "lastActiveMs": created_ms,
        "state":        "active",
    }


def convert_edge(edge: dict, idx: int) -> dict:
    src = edge.get("src", "")
    dst = edge.get("dst", "")
    src_type = src.split(":")[0] if ":" in src else "unknown"
    layer = LAYER_MAP.get(src_type, [0, 1, 5])
    conf = edge.get("confidence", "medium")
    weight = CONFIDENCE_SCORE.get(conf, 0.6)
    created_ms = parse_ts_ms(edge.get("created_at", ""))
    return {
        "id":              f"e-{idx}",
        "source":          src,
        "target":          dst,
        "type":            edge.get("type", "RELATES_TO"),
        "label":           edge.get("type", "RELATES_TO"),
        "weight":          weight,
        "conductivity":    weight,
        "direction":       "directed",
        "createdAtMs":     created_ms,
        "lastTraversedMs": created_ms,
        "layer":           layer,
    }


def build_brain_state(nodes: dict, findings_total: int, patterns_total: int) -> dict:
    return {
        "status":           "Alive",
        "patterns_total":   patterns_total,
        "findings_total":   findings_total,
        "units_processed":  len(nodes),
        "last_data_at_ms":  int(datetime.now(timezone.utc).timestamp() * 1000),
        "poll_count":       1,
        "interval_ms":      60000,
    }


def build_snapshot(brain_nodes: list, brain_edges: list) -> dict:
    payload = json.dumps({"nodes": brain_nodes, "edges": brain_edges}, sort_keys=True)
    checksum = hashlib.sha256(payload.encode()).hexdigest()
    return {
        "version":       "v1",
        "schema":        "brain-graph-v1",
        "nodes":         brain_nodes,
        "edges":         brain_edges,
        "meta": {
            "source":     "mygraph-bridge",
            "origin":     str(MYGRAPH_DEFAULT),
            "synced_at":  datetime.now(timezone.utc).isoformat(),
        },
        "checksumSha256": checksum,
        "takenAtMs":      int(datetime.now(timezone.utc).timestamp() * 1000),
    }


def main():
    parser = argparse.ArgumentParser(description="Sync mygraph → kompress-ultra brain layer")
    parser.add_argument("--graph",   default=str(MYGRAPH_DEFAULT), help="Path to mygraph.json")
    parser.add_argument("--dry-run", action="store_true",          help="Print output, don't write files")
    args = parser.parse_args()

    graph_path = Path(args.graph)
    if not graph_path.exists():
        print(f"error: mygraph not found at {graph_path}", file=sys.stderr)
        sys.exit(1)

    with open(graph_path) as f:
        mygraph = json.load(f)

    raw_nodes = mygraph.get("nodes", {})
    raw_edges = mygraph.get("edges", [])

    brain_nodes = [convert_node(nid, ndata) for nid, ndata in raw_nodes.items()]
    brain_edges = [convert_edge(e, i) for i, e in enumerate(raw_edges)]

    findings_total = sum(1 for n in brain_nodes if n["type"] in FINDING_TYPES)
    patterns_total = sum(1 for n in brain_nodes if n["type"] in PATTERN_TYPES)

    snapshot    = build_snapshot(brain_nodes, brain_edges)
    brain_state = build_brain_state(raw_nodes, findings_total, patterns_total)

    if args.dry_run:
        print(f"[dry-run] would write {len(brain_nodes)} nodes, {len(brain_edges)} edges")
        print(f"[dry-run] brain-state: {json.dumps(brain_state, indent=2)}")
        print(f"[dry-run] targets: {BRAIN_GRAPH}  |  {BRAIN_STATE}")
        return

    BRAIN_GRAPH.parent.mkdir(parents=True, exist_ok=True)
    BRAIN_STATE.parent.mkdir(parents=True, exist_ok=True)

    # Merge into existing ~/.brain/graph.json if it exists
    existing = {"version": "1.0.0", "schema": "ultramesh-brain-graph", "meta": {}, "nodes": [], "edges": []}
    if BRAIN_GRAPH.exists():
        with open(BRAIN_GRAPH) as f:
            existing = json.load(f)

    # Remove any prior mygraph layer (layer [0,2,4] and adjacent) before hotswap
    mygraph_layer_set = {tuple(v) for v in LAYER_MAP.values()}
    existing["nodes"] = [n for n in existing.get("nodes", [])
                         if tuple(n.get("layer", [])) not in mygraph_layer_set]
    existing["edges"] = [e for e in existing.get("edges", [])
                         if tuple(e.get("layer", [])) not in mygraph_layer_set]

    existing["nodes"].extend(brain_nodes)
    existing["edges"].extend(brain_edges)
    existing["meta"]["last_modified"]    = datetime.now(timezone.utc).isoformat()
    existing["meta"]["mygraph_synced"]   = datetime.now(timezone.utc).isoformat()
    existing["meta"]["mygraph_nodes"]    = len(brain_nodes)
    existing["meta"]["mygraph_edges"]    = len(brain_edges)

    with open(BRAIN_GRAPH, "w") as f:
        json.dump(existing, f, indent=2)

    with open(BRAIN_STATE, "w") as f:
        json.dump(brain_state, f, indent=2)

    print(f"[mygraph-bridge] synced {len(brain_nodes)} nodes / {len(brain_edges)} edges")
    print(f"  patterns : {patterns_total}  (ideas, topics, references, quotes)")
    print(f"  findings : {findings_total}  (decisions, observations, goals, entities)")
    print(f"  → {BRAIN_GRAPH}")
    print(f"  → {BRAIN_STATE}")


if __name__ == "__main__":
    main()
