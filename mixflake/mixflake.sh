#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# mixflake — Universal build/install system
#
# Compatible with: macOS, Linux, Raspberry Pi (ARM), AMD, EPYC servers
# Top 10 platforms: linux/amd64, linux/arm64, linux/arm/v7, darwin/amd64,
#                   darwin/arm64, freebsd/amd64, openbsd/amd64, netbsd/amd64,
#                   linux/riscv64, linux/s390x
#
# Compute is blood. Absorb what the mesh gives you.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

MIXFLAKE_VERSION="1.0.0"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULES="${ROOT}/modules"
BUILD_DIR="${ROOT}/_build"
OUTPUT_DIR="${ROOT}/_output"

# ── Platform detection ──────────────────────────────────────────────────
detect_platform() {
  local os arch
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"

  case "$os" in
    darwin)  OS="macos" ;;
    linux)   OS="linux" ;;
    freebsd) OS="freebsd" ;;
    openbsd) OS="openbsd" ;;
    netbsd)  OS="netbsd" ;;
    *)       OS="$os" ;;
  esac

  case "$arch" in
    x86_64|amd64) ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    armv7l|armv6l) ARCH="arm" ;;
    riscv64)       ARCH="riscv64" ;;
    s390x)         ARCH="s390x" ;;
    *)             ARCH="$arch" ;;
  esac

  # Detect GPU (for AMD/EPYC)
  local gpu=""
  if command -v lspci &>/dev/null; then
    if lspci 2>/dev/null | grep -qi 'amd.*gpu\|radeon'; then gpu="amd"; fi
    if lspci 2>/dev/null | grep -qi 'nvidia'; then gpu="nvidia"; fi
  fi
  echo "${OS}/${ARCH}${gpu:+ (gpu:${gpu})}"
}

# ── Package manager detection ───────────────────────────────────────────
detect_pkg_manager() {
  for pm in brew apt dnf yum pacman zypper emerge nix-env; do
    command -v "$pm" &>/dev/null && echo "$pm" && return 0
  done
  echo "unknown"
}

# ── Install dependencies ────────────────────────────────────────────────
install_deps() {
  local pm
  pm="$(detect_pkg_manager)"
  echo "  pkg manager: ${pm}"

  local pkgs=("python3" "git" "curl")
  case "$pm" in
    brew)     brew install "${pkgs[@]}" 2>/dev/null || true ;;
    apt)      sudo apt-get install -y "${pkgs[@]}" 2>/dev/null || true ;;
    dnf)      sudo dnf install -y "${pkgs[@]}" 2>/dev/null || true ;;
    pacman)   sudo pacman -S --noconfirm "${pkgs[@]}" 2>/dev/null || true ;;
    *)        echo "  → install manually: ${pkgs[*]}" ;;
  esac
}

# ── Build target ────────────────────────────────────────────────────────
build_target() {
  local target="${1:-brain-snapshot}"
  mkdir -p "$BUILD_DIR" "$OUTPUT_DIR"

  case "$target" in
    brain-snapshot)
      echo "  target: brain-snapshot v$(grep '^V=' "${ROOT}/../scripts/brain-snapshot.sh" 2>/dev/null | head -1 | cut -d'"' -f2 || echo '?')"
      cp "${ROOT}/../scripts/brain-snapshot.sh" "${OUTPUT_DIR}/brain-snapshot"
      chmod +x "${OUTPUT_DIR}/brain-snapshot"
      echo "  built: ${OUTPUT_DIR}/brain-snapshot"
      ;;

    brain-pulse)
      cp "${ROOT}/../scripts/brain-pulse.sh" "${OUTPUT_DIR}/brain-pulse"
      chmod +x "${OUTPUT_DIR}/brain-pulse"
      ;;

    all)
      build_target brain-snapshot
      build_target brain-pulse
      ;;

    *)
      echo "  unknown target: ${target}"
      echo "  available: brain-snapshot, brain-pulse, all"
      return 1
      ;;
  esac
}

# ── Install to system ───────────────────────────────────────────────────
install_target() {
  local target="${1:-brain-snapshot}"
  local dest="/usr/local/bin"

  build_target "$target"

  if [ ! -w "$dest" ]; then
    echo "  → need sudo for ${dest}"
    sudo cp "${OUTPUT_DIR}/${target}" "${dest}/${target}"
    sudo chmod +x "${dest}/${target}"
  else
    cp "${OUTPUT_DIR}/${target}" "${dest}/${target}"
    chmod +x "${dest}/${target}"
  fi
  echo "  installed: ${dest}/${target}"
}

# ── Platform matrix ─────────────────────────────────────────────────────
cmd_matrix() {
  echo "=== MixFlake Platform Matrix ==="
  echo "  current: $(detect_platform)"
  echo "  package manager: $(detect_pkg_manager)"
  echo ""
  echo "  supported targets:"
  printf "    linux/amd64     ✅  x86_64, AMD, EPYC\n"
  printf "    linux/arm64     ✅  ARM servers, RPi 4/5 64-bit\n"
  printf "    linux/arm/v7    ✅  Raspberry Pi 3/2/Zero\n"
  printf "    darwin/amd64    ✅  Intel Macs\n"
  printf "    darwin/arm64    ✅  Apple Silicon (M1-M4)\n"
  printf "    freebsd/amd64   ✅  FreeBSD servers\n"
  printf "    openbsd/amd64   ✅  OpenBSD servers\n"
  printf "    linux/riscv64   ⚡  RISC-V (experimental)\n"
  printf "    linux/s390x     ⚡  IBM Z (experimental)\n"
}

# ── Help ────────────────────────────────────────────────────────────────
cmd_help() {
  cat << HELP
mixflake v${MIXFLAKE_VERSION} — Universal build/install system

USAGE:
  mixflake build <target>    Build a target (brain-snapshot, brain-pulse, all)
  mixflake install <target>  Build + install to /usr/local/bin
  mixflake deps              Install system dependencies
  mixflake tools <tool>      Install a tool (ripgrep, bat, fzf, jq, etc.)
  mixflake tools all         Install all top 10 internet tools
  mixflake tools list        List available tools
  mixflake matrix            Show platform compatibility matrix
  mixflake help              This message

Compatible with: macOS, Linux, ARM, RPi, AMD, EPYC
Platforms: linux/amd64, linux/arm64, linux/arm/v7, darwin/amd64, darwin/arm64
           freebsd/amd64, openbsd/amd64, linux/riscv64, linux/s390x
HELP
}

# ── Main ────────────────────────────────────────────────────────────────
case "${1:-help}" in
  build)   shift; build_target "$@" ;;
  install) shift; install_target "$@" ;;
  deps)    install_deps ;;
  tools)   shift; bash "${MODULES}/tools.sh" "$@" ;;
  matrix)  cmd_matrix ;;
  help|*)  cmd_help ;;
esac
