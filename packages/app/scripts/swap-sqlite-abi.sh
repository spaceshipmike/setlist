#!/usr/bin/env bash
# Swap the better-sqlite3 native binary between Node and Electron ABIs.
#
# The Electron app (packages/app) needs better-sqlite3 compiled against
# Electron's Node ABI, while the MCP server (packages/mcp, run by Claude
# Desktop under its bundled Node) needs the same binary compiled against
# standalone Node's ABI. npm workspaces hoists better-sqlite3 to the root
# node_modules so only one copy exists — this script caches pre-built
# binaries for each target and swaps them in on demand.
#
# Usage:
#   ./swap-sqlite-abi.sh node       # restore Node binary (MCP-compatible)
#   ./swap-sqlite-abi.sh electron   # install Electron binary (dev/build)

set -euo pipefail

TARGET="${1:-}"
if [[ "$TARGET" != "node" && "$TARGET" != "electron" ]]; then
  echo "usage: swap-sqlite-abi.sh {node|electron}" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_DIR/../.." && pwd)"
CACHE_DIR="$APP_DIR/native-cache"
BINARY_PATH="$REPO_ROOT/node_modules/better-sqlite3/build/Release/better_sqlite3.node"

if [[ ! -f "$BINARY_PATH" ]]; then
  echo "better-sqlite3 not built yet; run 'npm install' first" >&2
  exit 1
fi

NODE_CACHE="$CACHE_DIR/better_sqlite3.node22.node"
ELECTRON_CACHE="$CACHE_DIR/better_sqlite3.electron.node"

target_cache() {
  case "$1" in
    node) echo "$NODE_CACHE" ;;
    electron) echo "$ELECTRON_CACHE" ;;
  esac
}

build_for() {
  local which="$1"
  cd "$REPO_ROOT"
  if [[ "$which" == "node" ]]; then
    echo "[swap] rebuilding better-sqlite3 for Node ($(node --version))..."
    npm rebuild better-sqlite3 >/dev/null 2>&1
  else
    echo "[swap] rebuilding better-sqlite3 for Electron..."
    local electron_ver
    electron_ver=$(cd "$APP_DIR" && npx --no-install electron --version 2>/dev/null | tr -d v)
    (
      cd "$REPO_ROOT/node_modules/better-sqlite3"
      npx --no-install node-gyp rebuild \
        --target="$electron_ver" \
        --arch=arm64 \
        --dist-url=https://electronjs.org/headers >/dev/null 2>&1
    )
  fi
}

cache="$(target_cache "$TARGET")"

if [[ ! -f "$cache" ]]; then
  # Cache miss — build and populate
  build_for "$TARGET"
  cp "$BINARY_PATH" "$cache"
  echo "[swap] cached $TARGET binary at $cache"
else
  # Cache hit — just copy
  cp "$cache" "$BINARY_PATH"
  echo "[swap] restored $TARGET binary from cache"
fi
