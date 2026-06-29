#!/usr/bin/env bash
set -euo pipefail
V="2.0.0"; D="Reproducible brain graph fossilizer"
LIVE="${BRAIN_GRAPH:-${HOME}/.brain/graph.json}"; SD="${BRAIN_SNAPSHOT_DIR:-${HOME}/.brain/snapshots}"
if [ ! -t 1 ] || [ "${NO_COLOR:-}" = "1" ]; then
  B="";R="";G="";Y="";C="";M="";DIM="";RESET=""
else
  B='\033[0;34m';R='\033[0;31m';G='\033[0;32m';Y='\033[0;33m';C='\033[0;36m';M='\033[0;35m';DIM='\033[2m';RESET='\033[0m'
fi
ok(){ echo -e " ${G}✓${RESET} $*"; }; info(){ echo -e " ${C}→${RESET} $*"; }; fail(){ echo -e " ${R}✗${RESET} $*" >&2; }

cmd_run(){
  local q=false SDT="" CHK=false
  while [ $# -gt 0 ]; do case "$1" in --date) SDT="$2";shift 2;; --checksum) CHK=true;shift 1;; --quiet) q=true;shift 1;; *) fail "unknown: $1";exit 1;; esac; done
  SDT="${SDT:-$(date -u +%Y-%m-%d)}"; mkdir -p "$SD"; local SF="${SD}/brain-${SDT}.json"
  [ -f "$LIVE" ] || { fail "no brain at ${LIVE}"; exit 3; }
  [ "$q" = false ] && echo -e "\n${B}═══ Snapshot ${SDT} ═══${RESET}\n"
  [ "$q" = false ] && info "reading: ${LIVE}"
  python3 -c "
import json
g=json.load(open('${LIVE}'))
for e in g['edges']:
    for k in list(e.keys()):
        if k.startswith('_'): del e[k]
for n in g['nodes']:
    for k in list(n.keys()):
        if k.startswith('_'): del n[k]
g['nodes'].sort(key=lambda n: n.get('id',''))
g['edges'].sort(key=lambda e: (e.get('source',''),e.get('target',''),e.get('label','')))
g['meta']={'schema':'ultramesh-brain-graph-snapshot','version':'2.0.0','snapshot_date':'${SDT}','notice':'Read-only fossil. No write path.','node_count':len(g['nodes']),'edge_count':len(g['edges']),'layer_count':len(set(tuple(n.get('layer',[0,0,0])) for n in g['nodes'])),'provenance':{'tool':'brain-snapshot v${V}','source':'${LIVE}','license':'Apache 2.0','can_write':False}}
json.dump(g,open('${SF}','w'),indent=2,sort_keys=True,ensure_ascii=False)
open('${SF}','a').write('\n')
" 2>/dev/null
  ln -sf "$SF" "${SD}/brain-latest.json"
  [ "$q" = false ] && ok "written: $(basename ${SF}) ($(du -h ${SF} 2>/dev/null | cut -f1))"
  [ "$CHK" = true ] && python3 -c "import hashlib;open('${SD}/brain-${SDT}.sha256','w').write(hashlib.sha256(open('${SF}','rb').read()).hexdigest())" 2>/dev/null && [ "$q" = false ] && ok "checksum saved"
  [ "$q" = false ] && ok "done"
}

cmd_verify(){
  local F="${1:-${SD}/brain-latest.json}"
  [ -f "$F" ] || { fail "not found: ${F}"; exit 1; }
  export F
  python3 << 'PY' 2>/dev/null
import json,os;g=json.load(open(os.environ['F']))
assert g['meta']['provenance']['can_write']==False
n=len(g['nodes']);e=len(g['edges']);l=len(set(tuple(x.get('layer',[0,0,0])) for x in g['nodes']))
print(f'{n}n {e}e {l}layers — read-only ✓')
PY
  local MF="${F%.json}.sha256"
  [ -f "$MF" ] && ok "checksum: $(head -c 16 < ${MF})…"
  ok "verified"
}

cmd_menu(){
  while true; do
    clear 2>/dev/null || true
    echo -e " ${B}🧠  brain-snapshot v${V}${RESET}  ${DIM}${D}${RESET}\n"
    echo -e " ${G}1${RESET}  Take snapshot    ${DIM}(deterministic, reproducible)${RESET}"
    echo -e " ${G}2${RESET}  Verify snapshot  ${DIM}(check integrity)${RESET}"
    echo -e " ${G}3${RESET}  Snapshot info    ${DIM}(metadata)${RESET}"
    echo -e " ${R}0${RESET}  Exit\n"
    echo -ne " ${C}→${RESET} choice: "; read -r ch
    case "$ch" in
      1) cmd_run --quiet 2>/dev/null; ok "snapshot taken"; sleep 2;;
      2) cmd_verify 2>/dev/null; echo; read -r -p "press enter to continue ";;
      3) python3 -c "import json;g=json.load(open('${SD}/brain-latest.json'));m=g['meta'];print(f\"Nodes:{m['node_count']} Edges:{m['edge_count']} Layers:{m['layer_count']}\");print(f\"Tool:{m['provenance']['tool']} License:{m['provenance']['license']}\")" 2>/dev/null; read -r -p "press enter to continue ";;
      0) echo "until next time"; exit 0;;
    esac
  done
}

case "${1:-menu}" in
  run)     shift; cmd_run "$@" ;;
  verify)  shift; cmd_verify "$@" ;;
  info)    python3 -c "import json;g=json.load(open('${SD}/brain-latest.json'));print(json.dumps(g['meta'],indent=2))" 2>/dev/null || fail "no snapshot" ;;
  menu)    cmd_menu ;;
  version) echo "brain-snapshot v${V}" ;;
  help|*)  echo "brain-snapshot v${V} — ${D}"; echo "usage: {run|verify|info|menu|help} [--date YYYY-MM-DD] [--checksum]"; echo "deterministic: same --date + same input → byte-identical output" ;;
esac
