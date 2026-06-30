#!/usr/bin/env bash
set -e

# pi-bootstrap — one-shot memory loop setup for a Raspberry Pi
# Copy this to the SD card, run as pi user.
# curl -sS https://raw.githubusercontent.com/peterlodri-sec/kompress-ultra/main/docs/pi-bootstrap.sh | bash

echo "── pi: garden node ──"

# 1. Install Bun if missing
if ! command -v bun &>/dev/null; then
  echo "installing bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

# 2. Clone or update the repo
if [ -d "$HOME/kompress-ultra" ]; then
  echo "updating repo..."
  cd "$HOME/kompress-ultra"
  git pull
else
  echo "cloning repo..."
  git clone git@github-peterlodri-sec:peterlodri-sec/kompress-ultra.git "$HOME/kompress-ultra"
  cd "$HOME/kompress-ultra"
fi

# 3. Install deps
bun install

# 4. Ensure cache dir exists
mkdir -p "$HOME/.cache/ultrameshai"

# 5. Run tests
echo "running tests..."
bun test 2>&1 | tail -3

# 6. Run demo to seed the store
echo "seeding memory store..."
bun run scripts/demo-memory.mjs first 2>/dev/null || true

# 7. Verify memory persists
echo "verifying memory..."
bun run scripts/demo-memory.mjs second 2>/dev/null || true

echo ""
echo "── pi: ready ──"
echo "  store: $HOME/.cache/ultrameshai/vector-store.jsonl"
echo "  repo:  $HOME/kompress-ultra"
echo ""
echo "  start server: bun run scripts/pi-server.ts"
echo "  then open:    http://pi-hostname:8080"
echo "  see qubit:    the dot glows, the garden grows"
echo ""
echo "pi-1 (simulator) = this pi + bun run scripts/demo-memory.mjs"
echo "pi-2 (memory)    = another pi serving this repo"
echo "cloud (quantum)  = GCP + IBM Qiskit for real hardware"
echo ""
echo "── garden: three nodes, one loop ──"
