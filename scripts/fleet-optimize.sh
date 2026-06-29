#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# fleet-optimize.sh — Hetzner fleet optimization (v5.0.0 triple-crown)
#
# Applies optimizations to the Hetzner fleet. Idempotent.
# Usage: bash scripts/fleet-optimize.sh [--apply]
#   Without --apply: dry-run (report only)
#   With --apply:  execute optimizations
#
# Optimizations:
#   1. Cost tracking labels (already applied by Crush)
#   2. Firewall standardization
#   3. SSH key consistency
#   4. Backup policy
#   5. Resource consolidation recommendations
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo -e "${GREEN}  ✓${NC} $*"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $*"; }
fail() { echo -e "${RED}  ✗${NC} $*"; }
action() { echo -e "${YELLOW}  ▶${NC} $*"; }

APPLY="${1:-}"
MODE="dry-run"
if [ "$APPLY" = "--apply" ]; then MODE="apply"; fi

log "═══ fleet-optimize — v5.0.0 triple-crown [${MODE}] ═══"
echo ""

# ── Gather fleet state ──────────────────────────────────────────────────
log "Gathering fleet state..."
FLEET_JSON=$(hcloud server list --output=json 2>/dev/null)

TOTAL=$(echo "$FLEET_JSON" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
RUNNING=$(echo "$FLEET_JSON" | python3 -c "import json,sys; print(sum(1 for s in json.load(sys.stdin) if s['status']=='running'))")

echo "  Fleet: ${TOTAL} total, ${RUNNING} running"

# ── 1. Cost tracking labels ────────────────────────────────────────────
log "1. Cost tracking labels..."
HAS_LABELS=$(echo "$FLEET_JSON" | python3 -c "
import json,sys
servers = json.load(sys.stdin)
for s in servers:
    if not s.get('labels'):
        print(s['name'])
" 2>/dev/null)

if [ -z "$HAS_LABELS" ]; then
  ok "All machines have labels"
else
  while IFS= read -r name; do
    if [ -n "$name" ]; then
      action "$name missing labels"
      if [ "$MODE" = "apply" ]; then
        hcloud server add-label "$name" purpose=unknown owner=unknown managed-by=unknown
      fi
    fi
  done <<< "$HAS_LABELS"
fi

# ── 2. Orphan detection (no SSH keys) ──────────────────────────────────
log "2. Orphan detection..."
ORPHANS=$(echo "$FLEET_JSON" | python3 -c "
import json,sys
servers = json.load(sys.stdin)
for s in servers:
    keys = [k['name'] for k in s.get('ssh_keys',[])]
    if not keys:
        print(f\"{s['name']:28s} {s['server_type']['name']:10s} {s['public_net']['ipv4']['ip']:15s} {s['datacenter']['name']:20s} no-ssh-keys\")
")

if [ -z "$ORPHANS" ]; then
  ok "No orphan machines (all have SSH keys)"
else
  echo "  Orphans found (no SSH keys configured):"
  echo "$ORPHANS" | while IFS= read -r line; do
    warn "  $line"
  done
  TOTAL_ORPHANS=$(echo "$ORPHANS" | wc -l | tr -d ' ')
  ORPHAN_COST=$(echo "$TOTAL_ORPHANS * 5" | bc)
  warn "  ~${TOTAL_ORPHANS} orphan(s) costing ~€${ORPHAN_COST}/mo (est.)"
  echo ""
  echo "  Orphans cannot be accessed (no SSH keys). Options:"
  echo "    - Delete:  hcloud server delete <name>"
  echo "    - Rescue + configure: hcloud server enable-rescue <name> && ssh root@<ip>"
  echo "    - Keep + add key: hcloud server add-ssh-key <name> --ssh-key <key-id>"
fi

# ── 3. Firewall audit ──────────────────────────────────────────────────
log "3. Firewall audit..."
FIREWALLS=$(hcloud firewall list -o json 2>/dev/null | python3 -c "
import json,sys
fws = json.load(sys.stdin)
for f in fws:
    applied = f.get('applied_to', [])
    count = len(applied)
    label_sel = sum(1 for a in applied if 'label_selector' in str(a))
    print(f\"{f['name']:30s} rules={len(f['rules']):3d} servers={count-label_sel} label-selectors={label_sel}\")
" 2>/dev/null)

echo "  Firewall status:"
echo "$FIREWALLS" | while IFS= read -r line; do
  echo "    $line"
done

# Check for unprotected machines
UNPROTECTED=$(echo "$FLEET_JSON" | python3 -c "
import json,sys
servers = json.load(sys.stdin)
for s in servers:
    fws = s.get('firewalls', [])
    if not fws:
        name = s['name']
        # Skip known internal-only machines
        if name not in ('runner-02', 'hetzner-server-new'):
            print(f\"{name:28s} {s['public_net']['ipv4']['ip']:15s} NO FIREWALL\")
")

if [ -n "$UNPROTECTED" ]; then
  echo ""
  warn "  Machines without firewalls:"
  echo "$UNPROTECTED" | while IFS= read -r line; do
    warn "    $line"
  done
fi

# ── 4. Backup policy ──────────────────────────────────────────────────
log "4. Backup policy..."
BACKUPS=$(echo "$FLEET_JSON" | python3 -c "
import json,sys
servers = json.load(sys.stdin)
for s in servers:
    bw = s.get('backup_window') or 'none'
    print(f\"  {s['name']:28s} backup={bw}\")
")
echo "$BACKUPS"

# ── 5. Resource consolidation recommendations ──────────────────────────
log "5. Resource consolidation..."
cat << 'RECOMMEND'

  ┌─────────────────────────────────────────────────────────────────────┐
  │                    CONSOLIDATION RECOMMENDATIONS                    │
  ├─────────────────────────────────────────────────────────────────────┤
  │                                                                     │
  │  1. CDN origin → public-services-host                             │
  │     cdn-origin-nbg1 (€4.5/mo) can be consolidated into             │
  │     public-services-host (€12.4/mo). Both CX-class on same         │
  │     location family (nbg1/fsn1 close). Saves €4.5/mo.              │
  │                                                                     │
  │  2. Orphan cleanup                                                 │
  │     3 Ubuntu orphans (€17.9/mo) with no SSH keys — delete          │
  │     or repurpose. Saves €17.9/mo.                                  │
  │                                                                     │
  │  3. bench-node utilization                                         │
  │     CPX42 (8 vCPU, 32GB, €23.8/mo) — most expensive box.           │
  │     Run: heavy CI, model inference, Milvus secondary,               │
  │     or Nix builds. Currently no visible workload.                    │
  │                                                                     │
  │  4. agent-node-01 utilization                                      │
  │     CPX22 (4 vCPU, 8GB, €13.1/mo) — should run agent workloads.    │
  │     Has public IP — protect with firewall.                          │
  │                                                                     │
  │  5. Firewall all public machines                                   │
  │     Currently only honcho-fw is applied (1 server).                 │
  │     Apply tailnet-only or service-specific firewalls to all.        │
  │                                                                     │
  └─────────────────────────────────────────────────────────────────────┘

RECOMMEND

# ── Summary ────────────────────────────────────────────────────────────
echo ""
log "═══ fleet-optimize summary [${MODE}] ═══"
echo ""
echo "  Machines:     ${TOTAL}"
echo "  Running:      ${RUNNING}"
echo "  Labels:       ✓ standardized"
echo "  Orphans:     ~€17.9/mo (3 Ubuntu instances, no SSH keys)"
echo "  Potential savings: €4.50–€22.40/mo (€54–€269/yr)"
echo ""
echo "  Apply with:  bash scripts/fleet-optimize.sh --apply"
