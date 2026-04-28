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

NODE_ABI="$(node -p 'process.versions.modules')"
NODE_CACHE="$CACHE_DIR/better_sqlite3.abi-$NODE_ABI.node"
ELECTRON_CACHE="$CACHE_DIR/better_sqlite3.electron.node"

target_cache() {
  case "$1" in
    node) echo "$NODE_CACHE" ;;
    electron) echo "$ELECTRON_CACHE" ;;
  esac
}

build_for() {
  local which="$1"
  if [[ "$which" == "node" ]]; then
    echo "[swap] rebuilding better-sqlite3 for Node ($(node --version))..."
    (cd "$REPO_ROOT" && npm rebuild better-sqlite3 >/dev/null 2>&1)
  else
    echo "[swap] rebuilding better-sqlite3 for Electron..."
    (cd "$APP_DIR" && npx --no-install electron-rebuild -f -w better-sqlite3)
    # @electron/rebuild produces a LINKER-signed ad-hoc signature (flags=0x20002)
    # that Electron's hardened runtime on ARM64 macOS refuses to dlopen
    # (EXC_BAD_ACCESS / Code Signature Invalid / Invalid Page). Force a fresh
    # ad-hoc sign (flags=0x2) via codesign to produce a signature the runtime
    # will accept.
    echo "[swap] re-signing (codesign --force -s -) to fix linker-signed sig..."
    codesign --force -s - "$BINARY_PATH" 2>&1 | /usr/bin/grep -v "replacing existing signature" || true
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

# Always re-sign after a swap or build. @electron/rebuild and npm rebuild both
# produce LINKER-signed ad-hoc signatures (flags=0x20002) that macOS's hardened
# runtime refuses to dlopen — manifesting as ERR_IPC_CHANNEL_CLOSED inside
# vitest workers or exit 137 from `node -e`. A fresh ad-hoc sign (flags=0x2)
# via codesign fixes both ABIs. Idempotent: safe to re-run on an already-signed
# binary. Cached binaries are also re-signed because cache copy discards the
# extended attributes that carry the signature on APFS.
codesign --force -s - "$BINARY_PATH" 2>&1 | /usr/bin/grep -v "replacing existing signature" || true
if [[ -f "$ELECTRON_CACHE" && "$TARGET" == "electron" ]]; then
  codesign --force -s - "$ELECTRON_CACHE" 2>&1 | /usr/bin/grep -v "replacing existing signature" || true
fi
echo "[swap] re-signed $BINARY_PATH (hardened-runtime compatible)"
