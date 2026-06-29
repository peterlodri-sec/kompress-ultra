#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# kompress-ultra local npm registry (Verdaccio)
# ─────────────────────────────────────────────────────────────
# Usage:
#   ./scripts/registry.sh start    — start verdaccio (background)
#   ./scripts/registry.sh stop     — stop verdaccio
#   ./scripts/registry.sh restart  — restart verdaccio
#   ./scripts/registry.sh publish  — build + publish to local
#   ./scripts/registry.sh login    — create user + get token
#
# The registry runs on http://localhost:4873
# Configure npm/bun: --registry http://localhost:4873
# ─────────────────────────────────────────────────────────────

set -euo pipefail
cd "$(dirname "$0")/.."
CONFIG="verdaccio/config.yaml"
LOG="verdaccio/verdaccio.log"
PIDFILE="verdaccio/verdaccio.pid"

case "${1:-help}" in
  start)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "verdaccio already running (pid $(cat "$PIDFILE"))"
      exit 0
    fi
    nohup verdaccio -c "$CONFIG" > "$LOG" 2>&1 &
    echo $! > "$PIDFILE"
    sleep 2
    echo "verdaccio started (pid $(cat "$PIDFILE")) — http://localhost:4873"
    ;;
  stop)
    [ -f "$PIDFILE" ] && kill "$(cat "$PIDFILE")" 2>/dev/null && rm -f "$PIDFILE" && echo "stopped" || echo "not running"
    ;;
  restart)
    "$0" stop; sleep 1; "$0" start
    ;;
  login)
    node -e "
      const http = require('http');
      const d = JSON.stringify({name:'kompress',password:'kompress',email:'peter@peterl.dev'});
      const r = http.request({hostname:'localhost',port:4873,path:'/-/user/org.couchdb.user:kompress',method:'PUT',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(d)}}, res => {
        let b=''; res.on('data',c=>b+=c); res.on('end',() => {
          const j = JSON.parse(b);
          if (j.token) {
            echo \"//localhost:4873/:_authToken=\"\$AUTH >> .npmrc
            echo \"Logged in. Token written to .npmrc\";
          }
        });
      });
      r.write(d); r.end();
    "
    ;;
  publish)
    npm publish --registry http://localhost:4873
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|login|publish}"
    exit 1
    ;;
esac
