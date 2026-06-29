#!/usr/bin/env bash
# mixflake module: install top 10 internet tools
# Compatible with macOS, Linux, ARM, RPi, AMD, EPYC
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

detect_os() { uname -s | tr '[:upper:]' '[:lower:]'; }
detect_arch() { local a=$(uname -m); case "$a" in x86_64|amd64) echo "amd64";; aarch64|arm64) echo "arm64";; armv7l|armv6l) echo "arm";; *) echo "$a";; esac; }

TOOLS_FILE="${ROOT}/modules/tools.txt"

cmd_install_tool() {
  local tool="$1"
  local os=$(detect_os)
  local arch=$(detect_arch)

  echo "  installing: ${tool}"
  case "${tool}" in
    ripgrep|rg)
      if command -v rg &>/dev/null; then echo "  already installed: $(rg --version 2>/dev/null | head -1)"; return 0; fi
      case "$os" in
        darwin) brew install ripgrep 2>/dev/null || echo "  try: brew install ripgrep" ;;
        linux)
          local url="https://github.com/BurntSushi/ripgrep/releases/download/14.1.1/ripgrep-14.1.1-${arch}-unknown-linux-musl.tar.gz"
          curl -sL "$url" | tar xz --strip=1 -C /tmp 2>/dev/null && sudo mv /tmp/rg /usr/local/bin/ && echo "  installed ripgrep" || echo "  try: apt install ripgrep" ;;
      esac ;;

    bat)
      if command -v bat &>/dev/null; then echo "  already installed: $(bat --version 2>/dev/null)"; return 0; fi
      case "$os" in
        darwin) brew install bat 2>/dev/null || echo "  try: brew install bat" ;;
        linux) sudo apt-get install -y bat 2>/dev/null || sudo dnf install -y bat 2>/dev/null || echo "  try: https://github.com/sharkdp/bat/releases" ;;
      esac ;;

    fzf)
      if command -v fzf &>/dev/null; then echo "  already installed"; return 0; fi
      git clone --depth 1 https://github.com/junegunn/fzf.git /tmp/fzf 2>/dev/null && /tmp/fzf/install --bin 2>/dev/null && sudo cp /tmp/fzf/bin/fzf /usr/local/bin/ && echo "  installed fzf" ;;

    jq)
      if command -v jq &>/dev/null; then echo "  already installed: $(jq --version 2>/dev/null)"; return 0; fi
      case "$os" in
        darwin) brew install jq 2>/dev/null ;;
        linux)
          local url="https://github.com/jqlang/jq/releases/download/jq-1.7.1/jq-linux-${arch}"
          curl -sLo /tmp/jq "$url" 2>/dev/null && chmod +x /tmp/jq && sudo mv /tmp/jq /usr/local/bin/ && echo "  installed jq" ;;
      esac ;;

    httpie)
      pip3 install httpie 2>/dev/null || pip install httpie 2>/dev/null || echo "  try: pip install httpie" ;;

    entr)
      if command -v entr &>/dev/null; then echo "  already installed"; return 0; fi
      case "$os" in
        darwin) brew install entr 2>/dev/null ;;
        linux) sudo apt-get install -y entr 2>/dev/null || sudo dnf install -y entr 2>/dev/null ;;
      esac ;;

    hyperfine)
      if command -v hyperfine &>/dev/null; then echo "  already installed"; return 0; fi
      case "$os" in
        darwin) brew install hyperfine 2>/dev/null ;;
        linux)
          local url="https://github.com/sharkdp/hyperfine/releases/download/v1.19.0/hyperfine-1.19.0-${arch}-unknown-linux-gnu.tar.gz"
          curl -sL "$url" | tar xz --strip=1 -C /tmp 2>/dev/null && sudo mv /tmp/hyperfine /usr/local/bin/ && echo "  installed hyperfine" ;;
      esac ;;

    procs)
      if command -v procs &>/dev/null; then echo "  already installed"; return 0; fi
      case "$os" in
        darwin) brew install procs 2>/dev/null ;;
        linux) sudo snap install procs 2>/dev/null || cargo install procs 2>/dev/null || echo "  try: cargo install procs" ;;
      esac ;;

    bandwhich)
      if command -v bandwhich &>/dev/null; then echo "  already installed"; return 0; fi
      cargo install bandwhich 2>/dev/null || echo "  try: cargo install bandwhich" ;;

    doggo)
      if command -v doggo &>/dev/null; then echo "  already installed"; return 0; fi
      case "$os" in
        darwin) brew install doggo 2>/dev/null ;;
        linux) sudo snap install doggo 2>/dev/null || echo "  try: https://github.com/mr-karan/doggo/releases" ;;
      esac ;;

    btm|bottom)
      if command -v btm &>/dev/null; then echo "  already installed"; return 0; fi
      case "$os" in
        darwin) brew install bottom 2>/dev/null ;;
        linux) sudo snap install bottom 2>/dev/null || echo "  try: https://github.com/ClementTsang/bottom/releases" ;;
      esac ;;

    *)
      echo "  unknown tool: ${tool}"
      echo "  available: ripgrep bat fzf jq httpie entr hyperfine procs bandwhich doggo btm"
      return 1 ;;
  esac
}

cmd_install_all() {
  local tools=("ripgrep" "bat" "fzf" "jq" "httpie" "entr" "hyperfine" "procs" "bandwhich" "doggo")
  echo "=== Installing top 10 internet tools ==="
  for t in "${tools[@]}"; do
    cmd_install_tool "$t"
    echo ""
  done
}

cmd_list() {
  echo "=== Top 10 Internet Tools ==="
  echo " 1. ripgrep (rg)  — fastest grep, written in Rust"
  echo " 2. bat           — cat with syntax highlighting + git"
  echo " 3. fzf           — fuzzy finder, interactive filtering"
  echo " 4. jq            — JSON processor (essential)"
  echo " 5. httpie        — HTTP client, beautiful JSON output"
  echo " 6. entr          — run commands on file changes (incredible)"
  echo " 7. hyperfine     — command-line benchmarking"
  echo " 8. procs         — modern ps replacement"
  echo " 9. bandwhich     — terminal bandwidth utilization"
  echo "10. doggo         — modern dig replacement, colorful DNS"
  echo ""
  echo "  extra: btm (bottom) — terminal system monitor"
}

case "${1:-list}" in
  install) shift; cmd_install_tool "$@" ;;
  all)     cmd_install_all ;;
  list)    cmd_list ;;
  *)       echo "usage: mixflake tools {install <tool>|all|list}" ;;
esac
