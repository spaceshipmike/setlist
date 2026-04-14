#!/usr/bin/env bash
# Run a command with the Electron-ABI better-sqlite3 binary in place,
# restoring the Node-ABI binary on exit (even on Ctrl+C or error).
#
# Usage: ./with-electron-abi.sh <command> [args...]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SWAP="$SCRIPT_DIR/swap-sqlite-abi.sh"

restore_node() {
  bash "$SWAP" node || echo "[with-electron-abi] WARNING: failed to restore Node binary; run 'npm run sqlite:node' manually" >&2
}
trap restore_node EXIT INT TERM

bash "$SWAP" electron
"$@"
