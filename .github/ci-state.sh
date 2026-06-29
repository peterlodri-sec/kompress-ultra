#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# ci-state — Non-blocking simple state machine for CI agents
#
# Each CI agent has a state. States are transitions only. Never block.
# The state machine is: idle → running → success | failed | skipped
# Any agent can read any other agent's state. Coordination without locks.
#
# State file: ~/.brain/ci-state.json (part of the brain graph ecosystem)
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

STATEFILE="${HOME}/.brain/ci-state.json"
LOCKFILE="${HOME}/.brain/ci-state.lock"

# ── State definitions ───────────────────────────────────────────────────
# Each agent follows: idle → running → {success, failed, skipped}
# States:
#   idle     — waiting for trigger
#   running  — currently executing
#   success  — completed successfully
#   failed   — completed with errors (advisory, non-blocking)
#   skipped  — was triggered but conditions not met
#   sleeping — completed and waiting for cool-down
#   blocked  — dependency not met (waiting for another agent)

init_state() {
  if [ ! -f "$STATEFILE" ]; then
    echo '{}' > "$STATEFILE"
  fi
}

# ── Read an agent's state ───────────────────────────────────────────────
read_state() {
  local agent="${1:-}"
  init_state
  if [ -z "$agent" ]; then
    cat "$STATEFILE"
  else
    python3 -c "import json; d=json.load(open('${STATEFILE}')); print(json.dumps(d.get('${agent}', {'state':'idle','transitions':0}), indent=2))" 2>/dev/null || echo '{"state":"idle","transitions":0}'
  fi
}

# ── Transition an agent to a new state ──────────────────────────────────
transition() {
  local agent="$1" new_state="$2" message="${3:-}"

  init_state
  local old_state
  old_state=$(python3 -c "import json; d=json.load(open('${STATEFILE}')); print(d.get('${agent}', {}).get('state', 'idle'))" 2>/dev/null || echo "idle")

  # Validate transition
  case "$old_state:$new_state" in
    idle:running|running:success|running:failed|running:skipped|success:idle|failed:idle|skipped:idle|sleeping:idle|blocked:idle|running:blocked|blocked:running|success:sleeping|failed:sleeping|*:error)
      ;;
    *)
      echo "  invalid transition: ${old_state} → ${new_state} (agent: ${agent})"
      return 1
      ;;
  esac

  python3 -c "
import json, os, time
d = json.load(open('${STATEFILE}'))
agent = '${agent}'
now = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
entry = d.get(agent, {'state': 'idle', 'transitions': 0, 'history': []})
entry['prev_state'] = entry.get('state', 'idle')
entry['state'] = '${new_state}'
entry['transitions'] = entry.get('transitions', 0) + 1
entry['message'] = '${message}'
entry['updated_at'] = now
entry.setdefault('history', []).append({'from': entry['prev_state'], 'to': '${new_state}', 'at': now})
if len(entry['history']) > 10: entry['history'] = entry['history'][-10:]
d[agent] = entry
with open('${STATEFILE}', 'w') as f: json.dump(d, f, indent=2)
print(f'  ${agent}: ${old_state} → ${new_state}')
" 2>/dev/null
}

# ── Run an agent through the state machine ──────────────────────────────
run_agent() {
  local agent="$1"
  shift
  local cmd=("$@")

  transition "$agent" "running" "started at $(date -u +%H:%M:%S)"
  echo "  running: ${agent}"

  if [ ${#cmd[@]} -eq 0 ]; then
    transition "$agent" "success" "no command to run"
    echo "  success: ${agent} (no-op)"
    return 0
  fi

  # Run the command, capture exit code
  set +e
  "${cmd[@]}" 2>&1 | while IFS= read -r line; do echo "    ${line}"; done
  local exit_code=$?
  set -euo pipefail

  if [ "$exit_code" -eq 0 ]; then
    transition "$agent" "success" "exit code 0"
    echo "  success: ${agent}"
  else
    # Non-blocking: failure is advisory, never blocks
    transition "$agent" "failed" "exit code ${exit_code}"
    echo "  failed: ${agent} (advisory, non-blocking)"
    echo "  (this is informational — CI never blocks)"
  fi
}

# ── List all agents and their states ────────────────────────────────────
list_states() {
  init_state
  python3 -c "
import json
d = json.load(open('${STATEFILE}'))
if not d:
    print('  (no agents registered)')
    exit(0)
print(f'  {\"agent\":25s} {\"state\":12s} {\"transitions\":5s} {\"message\"}')
print(f'  {\"-\"*25} {\"-\"*12} {\"-\"*5} {\"-\"}')
for agent, entry in sorted(d.items()):
    s = entry.get('state', '?')
    t = entry.get('transitions', 0)
    m = entry.get('message', '')[:40]
    print(f'  {agent:25s} {s:12s} {t:5d} {m}')
" 2>/dev/null
}

# ── Reset an agent to idle ──────────────────────────────────────────────
reset_agent() {
  local agent="$1"
  transition "$agent" "idle" "reset by user"
}

# ── Register a new CI agent ─────────────────────────────────────────────
register_agent() {
  local agent="$1" description="${2:-}"
  init_state
  python3 -c "
import json
d = json.load(open('${STATEFILE}'))
if '${agent}' not in d:
  d['${agent}'] = {'state': 'idle', 'transitions': 0, 'description': '${description}', 'history': []}
  with open('${STATEFILE}', 'w') as f: json.dump(d, f, indent=2)
  print(f'  registered: ${agent}')
else:
  print(f'  already registered: ${agent}')
" 2>/dev/null
}

# ── Main ────────────────────────────────────────────────────────────────
case "${1:-help}" in
  state)       shift; read_state "$@" ;;
  transition)  shift; transition "$@" ;;
  run)         shift; run_agent "$@" ;;
  list)        list_states ;;
  reset)       shift; reset_agent "$@" ;;
  register)    shift; register_agent "$@" ;;
  *)
    echo "ci-state — Non-blocking simple state machine"
    echo "usage: ci-state {state|transition|run|list|reset|register} [args]"
    echo ""
    echo "  state [agent]      — read agent state (or all)"
    echo "  transition a s [m] — transition agent to state with message"
    echo "  run agent cmd...   — run command through state machine"
    echo "  list               — list all agents and states"
    echo "  reset agent        — reset agent to idle"
    echo "  register agent [d] — register a new agent"
    echo ""
    echo "States: idle → running → {success,failed,skipped} → idle"
    echo "Non-blocking: failed is advisory. CI never blocks."
    ;;
esac
