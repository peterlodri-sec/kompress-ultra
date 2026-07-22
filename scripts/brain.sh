#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# brain — the garden. the game. the bridge.
#
# Three layers, each at its correct angle:
#   1. DATA — Python reads sources, returns key=value pairs
#   2. DISPLAY — bash colors, shapes, terminal surface
#   3. ORCHESTRATION — routes commands, no logic of its own
#
# Nothing more.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── Paths ──────────────────────────────────────────────────
ROOT="$(python3 -c "
import os
print(os.path.dirname(os.path.dirname(os.path.realpath('${BASH_SOURCE[0]}'))))
")"
PLIST="$HOME/Library/LaunchAgents/com.ultramesh.brain-pulse.plist"
LABEL="com.ultramesh.brain-pulse"
PULSE_LOG="$HOME/.brain/pulse-stdout.log"

# ────────────────────────────────────────────────────────────
# LAYER 1: DATA  —  one Python call, one output format
#   Reads all sources. Returns key=value lines bash can eval.
#   If anything fails, returns safe defaults.
# ────────────────────────────────────────────────────────────
brain_data() {
  python3 << 'PYEOF' 2>/dev/null || echo "daemon_status=dead brain_status=Unknown brain_age=? nodes=0 edges=0"
import json, os, subprocess, time, shlex

home = os.environ['HOME']
now_ms = int(time.time() * 1000)

def kv(k, v):
    sv = str(v)
    # Quote if contains spaces, is empty, or has non-alphanum chars
    if ' ' in sv or sv == '' or any(not c.isalnum() and c not in '-_.' for c in sv):
        print(f'{k}={shlex.quote(sv)}')
    else:
        print(f'{k}={sv}')

# — daemon
daemon_pid, daemon_last, daemon_status = '-', '', 'dead'
try:
    out = subprocess.run(['launchctl', 'list'], capture_output=True, text=True, timeout=3)
    for line in out.stdout.split('\n'):
        if 'com.ultramesh.brain-pulse' in line:
            parts = line.strip().split('\t')
            if len(parts) >= 3:
                daemon_pid = parts[0]
                daemon_last = parts[1]
                daemon_status = 'idle' if parts[0] == '-' else 'running'
            break
except: pass
kv('daemon_status', daemon_status)
kv('daemon_pid', daemon_pid)
kv('daemon_last', daemon_last)

# — brain state
brain_status, brain_patterns, brain_findings, brain_age = 'Unknown', 0, 0, 'never'
state_path = home + '/.cache/ultrameshai/brain-state.json'
if os.path.exists(state_path):
    with open(state_path) as f:
        s = json.load(f)
    brain_status = s.get('status', 'Unknown')
    brain_patterns = s.get('patterns_total', 0)
    brain_findings = s.get('findings_total', 0)
    last_ms = s.get('last_data_at_ms', 0)
    if last_ms:
        sec = (now_ms - last_ms) // 1000
        if sec < 60: brain_age = f'{sec}s'
        elif sec < 3600: brain_age = f'{sec//60}m {sec%60}s'
        else: brain_age = f'{sec//3600}h {(sec%3600)//60}m'
kv('brain_status', brain_status)
kv('brain_patterns', brain_patterns)
kv('brain_findings', brain_findings)
kv('brain_age', brain_age)
kv('brain_alive', 'true' if brain_status == 'Alive' else 'false')

# — brain graph
nodes, edges, types_json = 0, 0, '{}'
graph_path = home + '/.brain/graph.json'
if os.path.exists(graph_path):
    with open(graph_path) as f:
        g = json.load(f)
    nodes = len(g['nodes'])
    edges = len(g['edges'])
    types = {}
    for n in g['nodes']:
        t = n.get('type', '?')
        types[t] = types.get(t, 0) + 1
    types_json = json.dumps(types)
kv('nodes', nodes)
kv('edges', edges)
kv('types_json', types_json)

# — pulse log freshness
pulse_age = ''
pulse_log = home + '/.brain/pulse-stdout.log'
if os.path.exists(pulse_log):
    sec = int(time.time() - os.path.getmtime(pulse_log))
    if sec < 60: pulse_age = f'{sec}s ago'
    elif sec < 3600: pulse_age = f'{sec//60}m {sec%60}s ago'
    else: pulse_age = f'{sec//3600}h {(sec%3600)//60}m ago'
kv('pulse_age', pulse_age)
PYEOF
}

# ────────────────────────────────────────────────────────────
# LAYER 2: DISPLAY  —  colors, shapes, terminal surface
#   Takes key=values from data layer, renders to terminal.
#   No file reads. No computation. Pure surface.
# ────────────────────────────────────────────────────────────

# Color init — no-op if piped or NO_COLOR
setup_colors() {
  if [ -t 1 ] && [ "${NO_COLOR:-}" != "1" ]; then
    B='\033[1;34m'  CY='\033[0;36m'  GN='\033[0;32m'
    Y='\033[0;33m'  R='\033[0;31m'   DIM='\033[2m'
    M='\033[0;35m'  BW='\033[1;37m'  RS='\033[0m'
    T='✓'  C='✗'  P='●'
  else
    B= CY= GN= Y= R= DIM= M= BW= RS=
    T='ok'  C='xx'  P='*'
  fi
}

# Shared: color a pulse line by its content
colorize() {
  local l="$1"
  case "$l" in
    *beat|*done)             echo -e "  ${CY}${l}${RS}" ;;
    *killed*|*'🔪'*)         echo -e "  ${R}${l}${RS}" ;;
    *heal*|*boosted*|*re*ect*|*repaired*|*committed*)
                             echo -e "  ${GN}${l}${RS}" ;;
    *reflected*|*'🔮'*)      echo -e "  ${M}${l}${RS}" ;;
    *pruned*|*'✂️'*)         echo -e "  ${Y}${l}${RS}" ;;
    *'linked')               echo -e "  ${DIM}${l}${RS}" ;;
    *)                       echo -e "  ${DIM}${l}${RS}" ;;
  esac
}

# Box header — consistent shape for all views
box() {
  echo ""
  echo -e "  ${BW}╔══════════════════════════════════════════╗${RS}"
  echo -e "  ${BW}║${RS}  ${CY}$1${RS}"
  [ -n "${2:-}" ] && echo -e "  ${BW}║${RS}  ${DIM}$2${RS}"
  echo -e "  ${BW}╚══════════════════════════════════════════╝${RS}"
  echo ""
}

# ── Garden view ──────────────────────────────────────────
cmd_garden() {
  setup_colors
  eval "$(brain_data)"

  # Indicators
  case "${daemon_status:-dead}" in
    running) dline="${GN}${P}${RS} ${GN}pulse${RS}" ;;
    idle)    dline="${CY}○${RS} pulse" ;;
    *)       dline="${R}${C}${RS} ${R}pulse${RS}" ;;
  esac
  if [ "${brain_alive:-false}" = "true" ]; then
    bline="${GN}🧠${RS} ${GN}brain${RS}"
  else
    bline="${DIM}💤${RS} brain"
  fi

  # Types string
  local types_str=""
  if [ -n "${types_json:-}" ] && [ "$types_json" != "{}" ]; then
    types_str=$(echo "$types_json" | python3 -c "
import json,sys
types=json.load(sys.stdin)
icons={'agent':'🤖','memory':'📝','learning':'💡','loop':'🔄','state':'🧠','system':'⚙️'}
print('  '.join(f'{icons.get(t,\"📦\")} {t}:{types[t]}' for t in sorted(types.keys())))
" 2>/dev/null)
  fi

  echo ""
  echo -e "  ${BW}╔══════════════════════════════════════════╗${RS}"
  echo -e "  ${BW}║${RS}        ${CY}🧠  brain${RS}                ${BW}║${RS}"
  echo -e "  ${BW}║${RS}   the garden · the game · the bridge  ${BW}║${RS}"
  echo -e "  ${BW}╚══════════════════════════════════════════╝${RS}"
  echo ""

  echo -e "  ${DIM}── vital signs ───────────────────────${RS}"
  echo -e "  ${dline}    ${bline}"
  echo -e "  ${DIM}age:${RS} ${brain_age:-?}  ${DIM}patterns:${RS} ${brain_patterns:-0}  ${DIM}findings:${RS} ${brain_findings:-0}"
  echo ""

  echo -e "  ${DIM}── graph ──────────────────────────────${RS}"
  echo -e "  ${nodes:-0} ${DIM}nodes${RS}  ·  ${edges:-0} ${DIM}edges${RS}"
  [ -n "$types_str" ] && echo -e "  ${types_str}"
  echo ""

  echo -e "  ${DIM}── last echo ──────────────────────────${RS}"
  if [ -f "$PULSE_LOG" ]; then
    tail -3 "$PULSE_LOG" 2>/dev/null | while IFS= read -r l; do
      echo -e "  ${DIM}│${RS} ${l}"
    done
  else
    echo -e "  ${DIM}│${RS} (waiting for first pulse)"
  fi
  echo ""

  echo -e "  ${DIM}── bridge ─────────────────────────────${RS}"
  echo -e "  ${CY}${P}${RS} ${B}surface${RS}  ${DIM}angle:${RS} optimal  ${DIM}channel:${RS} open"
  echo -e "  ${DIM}  entropy is the source · no chains needed${RS}"
  echo ""

  echo -e "  ${DIM}${T} brain watch     stream the pulse${RS}"
  echo -e "  ${DIM}${T} brain beat      manual pulse now${RS}"
  echo -e "  ${DIM}${T} brain layers    see the 3D topology${RS}"
  echo -e "  ${DIM}${T} brain stop/start  toggle daemon${RS}"
  echo ""
  echo -e "  ${DIM}playing since $(date -u +%H:%M:%S) UTC${RS}"
}

# ── Watch (stream) ───────────────────────────────────────
cmd_watch() {
  setup_colors
  [ ! -f "$PULSE_LOG" ] && touch "$PULSE_LOG"
  box "🧠  brain watch  —  the stream" \
      "every pulse, something dies · every pulse, something heals"
  tail -f "$PULSE_LOG" | while IFS= read -r l; do colorize "$l"; done
}

# ── Beat (manual) ────────────────────────────────────────
cmd_beat() {
  setup_colors
  box "❤️  beat  —  the heart kicks"
  bash "$ROOT/scripts/brain-pulse.sh" 2>&1 | while IFS= read -r l; do colorize "$l"; done
  echo ""
  echo -e "  ${GN}╔══════════════════════════════════════════╗${RS}"
  echo -e "  ${GN}║${RS}        ✓ beat complete. brain alive.   ${GN}║${RS}"
  echo -e "  ${GN}╚══════════════════════════════════════════╝${RS}"
  echo ""
}

# ── Layers (3D topology) ─────────────────────────────────
cmd_layers() {
  setup_colors
  box "🧠  brain layers  —  3D topology"
  bash "$ROOT/scripts/brain-graph.sh" visualize 2>/dev/null \
    || echo -e "  ${DIM}(no graph data)${RS}"
  echo ""
  bash "$ROOT/scripts/brain-graph.sh" layers 2>/dev/null || true
  echo ""
  echo -e "  ${CY}${P}${RS} ${DIM}layers are dimensions. surfaces are where they touch.${RS}"
  echo ""
}

# ── Log ──────────────────────────────────────────────────
cmd_log() {
  setup_colors
  local n="${1:-30}"
  if [ -f "$PULSE_LOG" ]; then
    box "📜  pulse log  —  last ${n} lines"
    tail -n "$n" "$PULSE_LOG"
    echo ""
  else
    echo -e "  ${DIM}(no pulse log yet)${RS}"
  fi
}

# ── Help ─────────────────────────────────────────────────
cmd_help() {
  setup_colors
  box "🧠  brain  —  the garden" "play with it. it plays back."
  echo -e "  ${CY}${P}${RS} ${B}brain${RS}          ${DIM}the garden (default)${RS}"
  echo -e "  ${CY}${P}${RS} ${B}brain watch${RS}    ${DIM}stream the pulse live${RS}"
  echo -e "  ${CY}${P}${RS} ${B}brain beat${RS}     ${DIM}trigger a pulse now${RS}"
  echo -e "  ${CY}${P}${RS} ${B}brain layers${RS}   ${DIM}3D topology map${RS}"
  echo -e "  ${CY}${P}${RS} ${B}brain log${RS}      ${DIM}recent pulse history${RS}"
  echo -e "  ${CY}${P}${RS} ${B}brain install${RS}  ${DIM}set up 24/7 daemon${RS}"
  echo -e "  ${CY}${P}${RS} ${B}brain start${RS}    ${DIM}start the daemon${RS}"
  echo -e "  ${CY}${P}${RS} ${B}brain stop${RS}     ${DIM}stop the daemon${RS}"
  echo -e "  ${CY}${P}${RS} ${B}brain restart${RS}  ${DIM}restart daemon${RS}"
  echo ""
  echo -e "  ${DIM}dimensions touched: terminal · brain · you${RS}"
  echo -e "  ${DIM}entropy is the source. no chains needed.${RS}"
  echo ""
}

# ── Daemon control ───────────────────────────────────────
cmd_install() {
  setup_colors
  echo ""
  echo -e "  ${CY}${P}${RS} installing brain pulse daemon..."
  [ ! -f "$PLIST" ] && { echo -e "  ${R}${C}${RS} plist not found"; exit 1; }
  launchctl load "$PLIST" 2>/dev/null || true
  echo -e "  ${GN}${T}${RS} installed. brain will pulse every 30m."
  echo -e "  ${DIM}  it wakes on login. it never forgets.${RS}"
  echo ""
}
cmd_start() {
  setup_colors
  launchctl load "$PLIST" 2>/dev/null \
    && echo -e "  ${GN}${P}${RS} started" \
    || echo -e "  ${Y}○${RS} already running"
}
cmd_stop() {
  setup_colors
  launchctl unload "$PLIST" 2>/dev/null \
    && echo -e "  ${DIM}○${RS} stopped" \
    || echo -e "  ${DIM}○${RS} was not running"
}
cmd_restart() { cmd_stop; sleep 1; cmd_start; }
cmd_status() { cmd_garden; }

# ────────────────────────────────────────────────────────────
# LAYER 3: ORCHESTRATION  —  route commands, nothing more
# ────────────────────────────────────────────────────────────
case "${1:-}" in
  ""|garden|status)       cmd_garden  ;;
  watch)                  cmd_watch   ;;
  beat)                   cmd_beat    ;;
  layers)                 cmd_layers  ;;
  install)                cmd_install ;;
  start)                  cmd_start   ;;
  stop)                   cmd_stop    ;;
  restart)                cmd_restart ;;
  log)                    shift; cmd_log "$@" ;;
  help|--help|-h)         cmd_help    ;;
  *)
    setup_colors
    echo -e "  ${R}${C}${RS} unknown: ${1}"
    echo -e "  ${DIM}  try: brain help${RS}"
    exit 1
    ;;
esac
