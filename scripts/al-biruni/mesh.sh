#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# al-biruni — Singleton Pair Mesh
# Autonomous researcher + writer, operating as one unit.
# Named after Abu Rayhan al-Biruni (973–1048),
# the ultimate polyhistor in human history.
#
# Two agents, one brain, one purpose.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

NAME="al-biruni"
VERSION="1.0.0"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RESEARCHER="${ROOT}/scripts/${NAME}/researcher.sh"
WRITER="${ROOT}/scripts/${NAME}/writer.sh"
MEM="${ROOT}/scripts/ultramesh-mem.sh"
WORKDIR="${ROOT}/.${NAME}"
PIDFILE="${WORKDIR}/mesh.pid"

mkdir -p "$WORKDIR/research" "$WORKDIR/output" "$WORKDIR/state"

help() {
  cat << 'HELP'
al-biruni v1.0.0 — Singleton Pair Mesh
Named after Abu Rayhan al-Biruni (973–1048), the ultimate polyhistor.

USAGE:
  al-biruni research <topic>       Auto + deep research pipeline
  al-biruni write [content|tech]   Write from latest research
  al-biruni pipeline <topic>       Full: research → write → publish
  al-biruni status                  Show mesh + brain state
  al-biruni help

ARCHITECTURE:
  al-biruni-1 (Researcher)    al-biruni-2 (Writer)
  ┌──────────────────┐        ┌──────────────────┐
  │ auto-research     │ ─────→ │ content writer    │
  │ deep-research     │        │ technical writer  │
  │ synthesis         │        │ publish           │
  └──────┬───────────┘        └────────┬─────────┘
         │                             │
         └───────── brain ─────────────┘
          (ultramesh-mem brain-state.json)
HELP
  exit 0
}

# ── Research pipeline ─────────────────────────────────────────────────────
research() {
  local topic="$1"
  [ -z "$topic" ] && { echo "USAGE: al-biruni research <topic>" >&2; exit 1; }
  echo "═══ al-biruni-1: Research ─ ${topic} ═══"
  bash "$RESEARCHER" auto "$topic" "$WORKDIR/research"
  bash "$RESEARCHER" deep "$topic" "$WORKDIR/research"
  bash "$RESEARCHER" generate "$WORKDIR/research"
  bash "$MEM" store --type learning --category research \
    --finding "al-biruni research: ${topic}" \
    --severity advisory \
    --loop-name researcher --loop-cycle 1 --effectiveness 1.0
  bash "$MEM" status
  echo "═══ Research complete ═══"
}

# ── Write pipeline ────────────────────────────────────────────────────────
write_pipeline() {
  local mode="${1:-both}"
  echo "═══ al-biruni-2: Write ─ ${mode} ═══"
  case "$mode" in
    content|both)
      bash "$WRITER" content "$WORKDIR/research" "$WORKDIR/output"
      ;;
    technical|both)
      bash "$WRITER" technical "$WORKDIR/research" "$WORKDIR/output"
      ;;
  esac
  bash "$WRITER" publish "$WORKDIR/research" "$WORKDIR/output"
  bash "$MEM" store --type learning --category writing \
    --finding "al-biruni write: ${mode}" \
    --severity advisory \
    --loop-name writer --loop-cycle 1 --effectiveness 1.0
  bash "$MEM" status
  echo "═══ Write complete ═══"
}

# ── Full pipeline ─────────────────────────────────────────────────────────
pipeline() {
  local topic="$1"
  [ -z "$topic" ] && { echo "USAGE: al-biruni pipeline <topic>" >&2; exit 1; }
  echo "════════════════════════════════════════════"
  echo "  al-biruni v${VERSION} — Singleton Pair Mesh"
  echo "  Full pipeline: ${topic}"
  echo "════════════════════════════════════════════"
  research "$topic"
  write_pipeline "both"
  echo "════════════════════════════════════════════"
  echo "  Artifacts:"
  ls -la "$WORKDIR/research/" "$WORKDIR/output/"
  echo "════════════════════════════════════════════"
}

# ── Status ────────────────────────────────────────────────────────────────
status() {
  echo "═══ al-biruni v${VERSION} — Mesh Status ═══"
  echo "  Agents:"
  echo "    al-biruni-1 (researcher): $([ -x "$RESEARCHER" ] && echo 'ready' || echo 'missing')"
  echo "    al-biruni-2 (writer):     $([ -x "$WRITER" ] && echo 'ready' || echo 'missing')"
  echo "    brain (ultramesh-mem):    $([ -x "$MEM" ] && echo 'ready' || echo 'missing')"
  echo "  Workdir: ${WORKDIR}"
  if [ -d "$WORKDIR/research" ]; then
    echo "  Research files: $(find "$WORKDIR/research" -type f 2>/dev/null | wc -l)"
  fi
  if [ -d "$WORKDIR/output" ]; then
    echo "  Output files:  $(find "$WORKDIR/output" -type f 2>/dev/null | wc -l)"
  fi
  echo ""
  bash "$MEM" status 2>/dev/null || echo "  ❓ BRAIN (ultramesh-mem not initialized)"
  echo "═════════════════════════════════════════════"
}

# ── Main ──────────────────────────────────────────────────────────────────
case "${1:-help}" in
  research)  shift; research "$@" ;;
  write)     shift; write_pipeline "$@" ;;
  pipeline)  shift; pipeline "$@" ;;
  status)    status ;;
  help|--help|-h) help ;;
  *)
    echo "al-biruni v${VERSION} — Singleton Pair Mesh"
    echo "Usage: $0 {research|write|pipeline|status|help}"
    exit 1
    ;;
esac
