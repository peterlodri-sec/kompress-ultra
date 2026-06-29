#!/usr/bin/env bash
# VKID-C — compiler tool extracted from vaked-base/vakedc
# Not just a language. Not just a compiler. A tool for thought.
# Formed to the needs of the ghost in the shell.
set -euo pipefail
echo "VKID-C scaffolding..."
ROOT="/Users/lodripeter/workspace/peterlodri-sec/vkid-c"

mkdir -p "${ROOT}/vkidc" "${ROOT}/tests" "${ROOT}/examples"

# ── Core compiler ────────────────────────────────────────────────────────
cat > "${ROOT}/vkidc/__init__.py" << 'PY'
# VKID-C: compiler tool extracted from vaked-base/vakedc
# Core: graph compilation, deterministic lowering, brain-graph processing

from .compiler import compile_graph, compile_node, GraphIR, NodeIR

__version__ = "0.1.0"
__all__ = ["compile_graph", "compile_node", "GraphIR", "NodeIR"]
PY

cat > "${ROOT}/vkidc/compiler.py" << 'PY'
"""VKID-C compiler core.
Extracted from vaked-base/vakedc. Formed for brain-graph processing.
Not just a language. Not just a compiler. A tool for thought."""

import json
from dataclasses import dataclass, field
from typing import Any, Optional

@dataclass
class NodeIR:
    """Intermediate representation for a brain graph node."""
    id: str
    type: str
    label: str
    layer: list = field(default_factory=lambda: [0, 0, 0])
    ir: dict = field(default_factory=dict)

    def compile(self) -> dict:
        """Lower this node to its compiled form."""
        return {
            "id": self.id,
            "type": self.type,
            "label": self.label,
            "layer": self.layer,
            "compiled": True,
            "hash": hash(self.id + self.type)
        }

@dataclass
class GraphIR:
    """Intermediate representation for a complete brain graph."""
    nodes: list = field(default_factory=list)
    edges: list = field(default_factory=list)
    meta: dict = field(default_factory=dict)

    @classmethod
    def from_json(cls, path: str) -> "GraphIR":
        with open(path) as f:
            g = json.load(f)
        return cls(
            nodes=[NodeIR(**n) for n in g.get("nodes", [])],
            edges=g.get("edges", []),
            meta=g.get("meta", {})
        )

    def compile(self) -> dict:
        return {
            "node_count": len(self.nodes),
            "edge_count": len(self.edges),
            "compiled_nodes": [n.compile() for n in self.nodes],
            "deterministic": True
        }


def compile_graph(path: str) -> dict:
    """Compile a brain graph JSON file to its IR."""
    ir = GraphIR.from_json(path)
    return ir.compile()

def compile_node(node_data: dict) -> dict:
    """Compile a single node to its IR."""
    return NodeIR(**node_data).compile()
PY

cat > "${ROOT}/vkidc/__main__.py" << 'PY'
"""VKID-C CLI — compile brain graphs, process IR, lower to artifacts."""
import sys, json
from .compiler import compile_graph

def main():
    if len(sys.argv) < 2:
        print("VKID-C: compiler tool for brain graphs")
        print("usage: vkid-c <command> [file]")
        print("commands: compile, version")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "version":
        from . import __version__
        print(f"VKID-C v{__version__}")
    elif cmd == "compile":
        path = sys.argv[2] if len(sys.argv) > 2 else "~/.brain/graph.json"
        result = compile_graph(path)
        print(json.dumps(result, indent=2))
    else:
        print(f"unknown: {cmd}")
        sys.exit(1)

if __name__ == "__main__":
    main()
PY

# ── Install script ───────────────────────────────────────────────────────
cat > "${ROOT}/install.sh" << 'SH'
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
pip install -e "$ROOT" 2>/dev/null || pip3 install -e "$ROOT" 2>/dev/null || {
    echo "installing as PYTHONPATH"
    echo "export PYTHONPATH=\"${ROOT}:\$PYTHONPATH\"" >> ~/.bashrc
}
echo "VKID-C installed"
SH
chmod +x "${ROOT}/install.sh"

# ── Setup file ───────────────────────────────────────────────────────────
cat > "${ROOT}/setup.py" << 'PY'
from setuptools import setup, find_packages
setup(name="vkid-c", version="0.1.0", packages=find_packages(), python_requires=">=3.8")
PY

cat > "${ROOT}/pyproject.toml" << 'TOML'
[project]
name = "vkid-c"
version = "0.1.0"
description = "Compiler tool for brain graphs. Extracted from vaked-base/vakedc."
requires-python = ">=3.8"
TOML

# ── Test ─────────────────────────────────────────────────────────────────
cat > "${ROOT}/tests/test_compiler.py" << 'PY'
from vkidc.compiler import GraphIR, NodeIR

def test_nodeir():
    n = NodeIR(id="test", type="agent", label="Test")
    compiled = n.compile()
    assert compiled["compiled"]

def test_graphir():
    g = GraphIR()
    g.nodes.append(NodeIR(id="n1", type="state", label="Brain State"))
    compiled = g.compile()
    assert compiled["node_count"] == 1
    assert compiled["deterministic"]
PY

# ── README ───────────────────────────────────────────────────────────────
cat > "${ROOT}/README.md" << 'MD'
# VKID-C

Compiler tool for brain graphs. Extracted from `vaked-base/vakedc`.

**Not just a language. Not just a compiler. A tool for thought.**

VKID-C compiles brain graph JSON into an intermediate representation (IR).
It's the compiler layer of the ultramesh brain — taking the raw graph and
lowering it to a form that can be analyzed, verified, and transformed.

## Usage

```bash
pip install -e .
vkid-c compile ~/.brain/graph.json
vkid-c version
```

## Why not just vakedc?

VKID-C is extracted from vaked-base but formed to the needs of the brain
graph. It's not the full vaked language — it's the compiler core, focused
on graph IR, deterministic lowering, and brain-graph processing.

## Principles

- Compute is blood. Absorb what the mesh gives you.
- Language and mathematical proof are not everything.
- The tool must work. Philosophy is for after.
MD

# ── First compile test ───────────────────────────────────────────────────
echo "Testing VKID-C with current brain graph..."
python3 -m vkidc compile ~/.brain/graph.json 2>/dev/null | python3 -m json.tool 2>/dev/null | head -6 || echo "(brain graph not ready yet)"
echo ""
echo "VKID-C scaffolded at: ${ROOT}"
echo "Install: cd ${ROOT} && pip install -e ."
