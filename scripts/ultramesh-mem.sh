#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# ultramesh-mem — Universal Memory Plugin
# Standalone, project-agnostic, zero dependencies.
#
# Stores and queries session learnings, decisions, gotchas,
# and action items. Works with any project, any agent framework.
#
# Usage:
#   ultramesh-mem store    --type <type> [flags]
#   ultramesh-mem query    [--category <cat>] [--type <type>] [--all]
#   ultramesh-mem summarize [--session <id>] [--last <n>]
#   ultramesh-mem actions  [--pending|--all]
#   ultramesh-mem sync     # sync with ultrameshai brain state
#   ultramesh-mem help
#
# Memory file: .ultramesh-mem/memory.jsonl (append-only)
# Brain file:  .ultramesh-mem/brain.json (compiled summary)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$(pwd)")"
MEM_DIR="$PROJECT_ROOT/.ultramesh-mem"
MEM_FILE="$MEM_DIR/memory.jsonl"
BRAIN_FILE="$MEM_DIR/brain.json"
SESSION_ID="${ULTRAMESH_SESSION_ID:-$(whoami)-$(hostname)-$(date +%s)}"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

mkdir -p "$MEM_DIR"

# ── Help ────────────────────────────────────────────────────────────────
help() {
  sed -n '2,/^$/{ s/^# //; s/^#$//; p; }' "$0"
  exit 0
}

# ── Write entry ─────────────────────────────────────────────────────────
store() {
  local type="" category="" finding="" detail="" severity="advisory" action="" files="" commands="" error_msg=""

  while [ $# -gt 0 ]; do
    case "$1" in
      --type)      type="$2";       shift 2 ;;
      --category)  category="$2";   shift 2 ;;
      --finding)   finding="$2";    shift 2 ;;
      --detail)    detail="$2";     shift 2 ;;
      --severity)  severity="$2";   shift 2 ;;
      --action)    action="$2";     shift 2 ;;
      --files)     files="$2";      shift 2 ;;
      --commands)  commands="$2";   shift 2 ;;
      --error)     error_msg="$2";  shift 2 ;;
      *) echo "unknown: $1" >&2; exit 1 ;;
    esac
  done

  [ -z "$type" ] && { echo "ERROR: --type required" >&2; exit 1; }

  jq -c -n \
    --arg ts "$NOW" \
    --arg session "$SESSION_ID" \
    --arg type "$type" \
    --arg category "$category" \
    --arg finding "$finding" \
    --arg detail "$detail" \
    --arg severity "$severity" \
    --arg action "$action" \
    --arg files "$files" \
    --arg commands "$commands" \
    --arg error "$error_msg" \
    '{
      ts: $ts, session: $session, type: $type, category: $category,
      content: {finding: $finding, detail: $detail, severity: $severity, action: $action},
      context: {files: ($files | split(",") // []), commands: ($commands | split(",") // []), error: $error}
    }' >> "$MEM_FILE"

  echo "stored: $type/$category — $finding"
  rebuild_brain
}

# ── Query ───────────────────────────────────────────────────────────────
query() {
  local type="" category="" all=false
  while [ $# -gt 0 ]; do
    case "$1" in
      --type)      type="$2";     shift 2 ;;
      --category)  category="$2"; shift 2 ;;
      --all)       all=true;      shift 1 ;;
      *) echo "unknown: $1" >&2; exit 1 ;;
    esac
  done

  if $all; then
    [ -f "$BRAIN_FILE" ] && cat "$BRAIN_FILE" || echo '{"entries":[],"summary":"empty"}'
    exit 0
  fi

  [ ! -f "$MEM_FILE" ] && echo '[]' && exit 0

  # Build jq filter dynamically
  local filters="."
  [ -n "$type" ]     && filters="$filters | select(.type == \"$type\")"
  [ -n "$category" ] && filters="$filters | select(.category == \"$category\")"

  jq -s "$filters" "$MEM_FILE" 2>/dev/null || echo '[]'
}

# ── Summarize ───────────────────────────────────────────────────────────
summarize() {
  local session="" last_n=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --session) session="$2"; shift 2 ;;
      --last)    last_n="$2";   shift 2 ;;
      *) echo "unknown: $1" >&2; exit 1 ;;
    esac
  done

  [ ! -f "$MEM_FILE" ] && echo '{"summary":"no memory"}' && exit 0

  if [ -n "$session" ]; then
    jq -s "[.[] | select(.session == \"$session\")]" "$MEM_FILE"
  elif [ "$last_n" -gt 0 ]; then
    jq -s "[.[-${last_n}:]]" "$MEM_FILE" 2>/dev/null || jq -s "." "$MEM_FILE"
  else
    cat "$BRAIN_FILE" 2>/dev/null || jq -s "{count: length, entries: .}" "$MEM_FILE"
  fi
}

# ── Action items ────────────────────────────────────────────────────────
actions() {
  local scope="pending"
  [ $# -gt 0 ] && scope="$1"

  [ ! -f "$MEM_FILE" ] && echo '[]' && exit 0

  case "$scope" in
    --pending|pending)
      jq -s '[.[] | select(.type == "action_item" or .content.action != "")]' "$MEM_FILE"
      ;;
    --all|all)
      jq -s '[.[] | select(.type == "action_item" or .content.action != "")]' "$MEM_FILE"
      ;;
  esac
}

# ── Rebuild brain ───────────────────────────────────────────────────────
rebuild_brain() {
  [ ! -f "$MEM_FILE" ] && return 0

  # Use python3 for reliable JSON processing (jq from_entries has key/value naming issues)
  python3 -c "
import json, sys
entries = []
with open('$MEM_FILE') as f:
    for l in f:
        l = l.strip()
        if l:
            try:
                entries.append(json.loads(l))
            except: pass
by_type = {}
by_cat = {}
for e in entries:
    t = e.get('type', '?')
    c = e.get('category', '?')
    by_type[t] = by_type.get(t, 0) + 1
    by_cat[c] = by_cat.get(c, 0) + 1
brain = {
    'updated_at': entries[-1]['ts'] if entries else 'unknown',
    'total_entries': len(entries),
    'by_type': by_type,
    'by_category': by_cat,
    'critical': [e for e in entries if e.get('content', {}).get('severity') == 'critical'],
    'summary': f'{len(entries)} entries across {len(by_type)} types, {len(by_cat)} categories'
}
with open('$BRAIN_FILE', 'w') as f:
    json.dump(brain, f, indent=2)
" 2>/dev/null || true
}

# ── Sync with ultrameshai brain ─────────────────────────────────────────
sync_ultrameshai() {
  local BRAIN_PATH="${HOME}/.cache/ultrameshai/brain-state.json"
  if [ -f "$BRAIN_PATH" ]; then
    cp "$BRAIN_PATH" "$MEM_DIR/ultrameshai-brain.json"
    echo "synced ultrameshai brain state"
  else
    echo "no ultrameshai brain found at $BRAIN_PATH"
  fi
}

# ── Main ────────────────────────────────────────────────────────────────
case "${1:-help}" in
  store)     shift; store "$@" ;;
  query)     shift; query "$@" ;;
  summarize) shift; summarize "$@" ;;
  actions)   shift; actions "$@" ;;
  sync)      sync_ultrameshai ;;
  rebuild)   rebuild_brain; echo "brain rebuilt" ;;
  help|--help|-h) help ;;
  *)
    echo "ultramesh-mem — Universal Memory Plugin"
    echo "Usage: $0 {store|query|summarize|actions|sync|rebuild|help}"
    exit 1
    ;;
esac
