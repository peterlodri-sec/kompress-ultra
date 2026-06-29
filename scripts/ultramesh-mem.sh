#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# ultramesh-mem v1.0.0 — Universal Memory Plugin
# 1:1 matching ultrameshai brain system (HonchoDaemon BrainSnapshot)
#
# Stores, queries, and recalls session learnings using the same
# BrainState schema as ultrameshai/packages/kompress-ultra/src/brain.ts
#
# BrainState JSON format:
#   { status, patterns_total, findings_total, units_processed,
#     last_data_at_ms, poll_count, interval_ms }
#
# Storage:
#   ~/.cache/ultrameshai/brain-state.json  — canonical brain state
#   .ultramesh-mem/                        — project-local memory
#
# Usage:
#   ultramesh-mem status                    — show brain line
#   ultramesh-mem store [opts]             — store a memory entry
#   ultramesh-mem query [opts]             — query memory
#   ultramesh-mem snapshot [--force]       — write brain-state.json
#   ultramesh-mem help
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── Paths ────────────────────────────────────────────────────────────────
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$(pwd)")"
CACHE_DIR="${HOME}/.cache/ultrameshai"
BRAIN_STATE="${CACHE_DIR}/brain-state.json"
MEM_DIR="${PROJECT_ROOT}/.ultramesh-mem"
MEM_FILE="${MEM_DIR}/memory.jsonl"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
NOW_MS=$(python3 -c "import time; print(int(time.time() * 1000))" 2>/dev/null || echo "$(date +%s)000")

mkdir -p "$CACHE_DIR" "$MEM_DIR"

# ── BrainState schema (matches ultrameshai/types.ts BrainState) ──────────
# interface BrainState {
#   status: "Alive" | "Stale" | "Unknown";
#   patterns_total: number;
#   findings_total: number;
#   units_processed: number;
#   last_data_at_ms: number;
#   poll_count: number;
#   interval_ms: number;
# }

compute_status() {
  local poll_count="$1" last_data_ms="$2" interval_ms="$3" now_ms="$4"
  if [ "$poll_count" -eq 0 ] || [ "$last_data_ms" -eq 0 ]; then
    echo "Unknown"
  else
    local elapsed=$(( now_ms - last_data_ms ))
    local threshold=$(( interval_ms * 2 ))
    if [ "$elapsed" -le "$threshold" ]; then
      echo "Alive"
    else
      echo "Stale"
    fi
  fi
}

age_string() {
  local last_data_ms="$1" now_ms="$2"
  if [ "$last_data_ms" -eq 0 ]; then
    echo "never"
  else
    local elapsed=$(( (now_ms - last_data_ms) / 1000 ))
    if [ "$elapsed" -lt 60 ]; then
      echo "${elapsed}s ago"
    else
      echo "$(( elapsed / 60 ))m ago"
    fi
  fi
}

build_brain_line() {
  local status="$1" patterns="$2" findings="$3" units="$4" age="$5"
  local icon="❓"
  [ "$status" = "Alive" ] && icon="🧠"
  [ "$status" = "Stale" ] && icon="💤"
  echo "${icon} BRAIN ${status} | patterns:${patterns} findings:${findings} units:${units} | last:${age}"
}

# ── Read current brain state ─────────────────────────────────────────────
read_brain_state() {
  if [ -f "$BRAIN_STATE" ]; then
    python3 -c "
import json, sys
try:
    with open('${BRAIN_STATE}') as f:
        d = json.load(f)
        print(json.dumps(d))
except: print('null')
" 2>/dev/null || echo "null"
  else
    echo "null"
  fi
}

# ── Write brain state ────────────────────────────────────────────────────
write_brain_state() {
  local patterns="$1" findings="$2" units="$3" interval_ms="${4:-300000}"

  # Read existing state for poll_count
  local poll_count=0
  local last_data_ms=0

  if [ -f "$BRAIN_STATE" ]; then
    local existing
    existing=$(python3 -c "
import json
try:
    with open('${BRAIN_STATE}') as f:
        d = json.load(f)
        print(f\"{d.get('poll_count',0)}|{d.get('last_data_at_ms',0)}\")
except: print('0|0')
" 2>/dev/null || echo "0|0")
    poll_count=$(echo "$existing" | cut -d'|' -f1)
    last_data_ms=$(echo "$existing" | cut -d'|' -f2)
  fi

  poll_count=$((poll_count + 1))
  last_data_ms=$NOW_MS

  local status
  status=$(compute_status "$poll_count" "$last_data_ms" "$interval_ms" "$NOW_MS")

  python3 -c "
import json
d = {
    'status': '$status',
    'patterns_total': $patterns,
    'findings_total': $findings,
    'units_processed': $units,
    'last_data_at_ms': $last_data_ms,
    'poll_count': $poll_count,
    'interval_ms': $interval_ms
}
with open('${BRAIN_STATE}', 'w') as f:
    json.dump(d, f, indent=2)
" 2>/dev/null

  local age
  age=$(age_string "$last_data_ms" "$NOW_MS")
  build_brain_line "$status" "$patterns" "$findings" "$units" "$age"
}

# ── Store memory entry ───────────────────────────────────────────────────
store() {
  local type="" category="" finding="" detail="" severity="advisory" action="" files="" error_msg=""
  local loop_cycle="" effectiveness="" loop_name=""

  while [ $# -gt 0 ]; do
    case "$1" in
      --type)         type="$2";        shift 2 ;;
      --category)     category="$2";    shift 2 ;;
      --finding)      finding="$2";     shift 2 ;;
      --detail)       detail="$2";      shift 2 ;;
      --severity)     severity="$2";    shift 2 ;;
      --action)       action="$2";      shift 2 ;;
      --files)        files="$2";       shift 2 ;;
      --error)        error_msg="$2";   shift 2 ;;
      --loop-cycle)   loop_cycle="$2";  shift 2 ;;
      --effectiveness) effectiveness="$2"; shift 2 ;;
      --loop-name)    loop_name="$2";   shift 2 ;;
      *) echo "unknown: $1" >&2; exit 1 ;;
    esac
  done

  [ -z "$type" ] && { echo "ERROR: --type required" >&2; exit 1; }

  # Main memory entry
  python3 -c "
import json
entry = {
    'ts': '$NOW',
    'type': '$type',
    'category': '$category',
    'content': {
        'finding': '$finding',
        'detail': '$detail',
        'severity': '$severity',
        'action': '$action',
        'files': '$files',
        'loop_cycle': '$loop_cycle',
        'effectiveness': '$effectiveness'
    },
    'error': '$error_msg'
}
with open('${MEM_FILE}', 'a') as f:
    f.write(json.dumps(entry, ensure_ascii=False) + '\n')
print(f'stored: ${type}/${category} — ${finding}')
" 2>/dev/null

  # If loop tracking, write to loop-specific file
  if [ -n "$loop_name" ]; then
    local loop_dir="${MEM_DIR}/loops"
    mkdir -p "$loop_dir"
    python3 -c "
import json, time
entry = {
    'ts': '$NOW',
    'ts_ms': int(time.time() * 1000),
    'loop': '$loop_name',
    'cycle': $([ -n "$loop_cycle" ] && echo "$loop_cycle" || echo 0),
    'effectiveness': $([ -n "$effectiveness" ] && echo "$effectiveness" || echo "null"),
    'type': '$type',
    'category': '$category',
    'finding': '$finding'
}
with open('${loop_dir}/${loop_name}.jsonl', 'a') as f:
    f.write(json.dumps(entry, ensure_ascii=False) + '\n')
" 2>/dev/null
  fi

  # Update brain state (findings_total = loop cycles)
  local count
  count=$(wc -l < "$MEM_FILE" 2>/dev/null || echo 0)
  local loop_count=0
  if [ -n "$loop_cycle" ]; then
    loop_count=$(python3 -c "
import os, json
total = 0
for root, dirs, files in os.walk('${MEM_DIR}/loops'):
    for f in files:
        if f.endswith('.jsonl'):
            with open(os.path.join(root, f)) as fh:
                for l in fh:
                    if l.strip(): total += 1
print(total)
" 2>/dev/null || echo 0)
  fi
  write_brain_state "$count" "$loop_count" "0"
}

# ── Query ────────────────────────────────────────────────────────────────
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
    if [ -f "$BRAIN_STATE" ]; then
      python3 -c "import json; d=json.load(open('${BRAIN_STATE}')); print(json.dumps(d, indent=2))" 2>/dev/null
    fi
    [ -f "$MEM_FILE" ] && cat "$MEM_FILE"
    exit 0
  fi

  [ ! -f "$MEM_FILE" ] && exit 0

  python3 -c "
import json, sys
entries = []
with open('${MEM_FILE}') as f:
    for l in f:
        l = l.strip()
        if l:
            try: entries.append(json.loads(l))
            except: pass
$( [ -n "$type" ] && echo "    entries = [e for e in entries if e.get('type') == '${type}']" )
$( [ -n "$category" ] && echo "    entries = [e for e in entries if e.get('category') == '${category}']" )
for e in entries:
    print(json.dumps(e))
" 2>/dev/null
}

# ── Status (brain line) ──────────────────────────────────────────────────
status_cmd() {
  local state
  state=$(read_brain_state)
  if [ "$state" = "null" ] || [ -z "$state" ]; then
    # Create initial brain state
    write_brain_state "0" "0" "0"
    state=$(read_brain_state)
  fi

  python3 -c "
import json
d = json.loads('${state}')
icon = '🧠' if d['status'] == 'Alive' else ('💤' if d['status'] == 'Stale' else '❓')
elapsed = 'never' if d['last_data_at_ms'] == 0 else f\"{int((__import__('time').time()*1000 - d['last_data_at_ms'])/1000)}s ago\"
line = f\"{icon} BRAIN {d['status']} | patterns:{d['patterns_total']} findings:{d['findings_total']} units:{d['units_processed']} | last:{elapsed}\"
print(line)
" 2>/dev/null
}

# ── Loops (query ralph-loop data) ─────────────────────────────────────────
loops() {
  local name="" last_n=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --name) name="$2"; shift 2 ;;
      --last) last_n="$2"; shift 2 ;;
      *) echo "unknown: $1" >&2; exit 1 ;;
    esac
  done

  local loop_dir="${MEM_DIR}/loops"
  if [ ! -d "$loop_dir" ]; then
    echo "no loop data"
    exit 0
  fi

  if [ -n "$name" ]; then
    local loop_file="$loop_dir/${name}.jsonl"
    if [ ! -f "$loop_file" ]; then
      echo "no loop data for: $name (available: $(ls "$loop_dir"/*.jsonl 2>/dev/null | xargs -n1 basename 2>/dev/null | sed 's/\.jsonl//g' | tr '\n' ' '))"
      exit 0
    fi
    if [ "$last_n" -gt 0 ]; then
      tail -n "$last_n" "$loop_file"
    else
      cat "$loop_file"
    fi
  else
    # Summary of all loops
    for f in "$loop_dir"/*.jsonl; do
      local base
      base=$(basename "$f" .jsonl)
      local count
      count=$(wc -l < "$f")
      echo "${base}: ${count} cycles"
    done
  fi
}

# ── Mesh status (depth guard) ────────────────────────────────────────────
mesh_status() {
  local depth_file="${MEM_DIR}/mesh-depth.json"
  local depth=0
  local last_sync="never"
  local resources="unknown"

  if [ -f "$depth_file" ]; then
    depth=$(python3 -c "import json; d=json.load(open('${depth_file}')); print(d.get('depth',0))" 2>/dev/null || echo 0)
    last_sync=$(python3 -c "import json; d=json.load(open('${depth_file}')); print(d.get('last_sync','never'))" 2>/dev/null || echo never)
    resources=$(python3 -c "import json; d=json.load(open('${depth_file}')); print(d.get('resources','unknown'))" 2>/dev/null || echo unknown)
  fi

  echo "═══ Mesh Depth Guard ═══"
  echo "  MAX_DEPTH:  1 (ultra strict)"
  echo "  Current:    ${depth}"
  echo "  Resources:  ${resources}"
  echo "  Last sync:  ${last_sync}"
  if [ "$depth" -ge 1 ] 2>/dev/null; then
    echo "  Status:     BLOCKED (depth limit reached)"
  else
    echo "  Status:     OPEN (sync allowed)"
  fi
  echo "═════════════════════════"
}
help() {
  cat << 'HELP'
ultramesh-mem v1.0.0 — Universal Memory Plugin

1:1 matching ultrameshai brain system (HonchoDaemon BrainSnapshot)
BrainState at ~/.cache/ultrameshai/brain-state.json

USAGE:
  ultramesh-mem status                    Show brain line (🧠/💤/❓)
  ultramesh-mem store --type <t> [opts]   Store a memory entry
  ultramesh-mem query [--type|--category]  Query memory
  ultramesh-mem query --all               Dump full state
  ultramesh-mem snapshot [--force]        Write brain-state.json
  ultramesh-mem help                      This message

STORE OPTIONS:
  --type learning|decision|gotcha|action_item|pattern
  --category architecture|deployment|tooling|process|security|testing
  --finding "Short description"
  --detail "Extended context"
  --severity critical|advisory|nit
  --action "Actionable imperative"
  --files "file1.ts:42,file2.ts"

BRAIN STATE (ultrameshai compatible):
  Path: ~/.cache/ultrameshai/brain-state.json
  Schema: status, patterns_total, findings_total, units_processed,
          last_data_at_ms, poll_count, interval_ms
  Status: Alive (data within 2x interval), Stale, Unknown
HELP
  exit 0
}

# ── Main ─────────────────────────────────────────────────────────────────
case "${1:-help}" in
  status)      status_cmd ;;
  store)       shift; store "$@" ;;
  query)       shift; query "$@" ;;
  snapshot)    shift; write_brain_state "${1:-0}" "${2:-0}" "${3:-0}" ;;
  loops)       shift; loops "$@" ;;
  mesh-status) mesh_status ;;
  help|--help|-h) help ;;
  *)
    echo "ultramesh-mem v1.1.0 — Universal Memory Plugin + Ralph-Loops"
    echo "Usage: $0 {status|store|query|snapshot|loops|mesh-status|help}"
    exit 1
    ;;
esac
