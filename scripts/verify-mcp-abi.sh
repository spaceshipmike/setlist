#!/usr/bin/env bash
# Verify that better-sqlite3 loads under Node's ABI — required for the
# MCP server (which Claude Desktop runs under standalone Node, not Electron).
#
# Exits 0 if the Node-ABI binary loads cleanly.
# Exits 1 and prints a repair hint if the binary is compiled for the wrong ABI.
#
# Invoked by:
#   - npm run verify:mcp-abi  (manual / Observer per-chunk check)
#   - .claude/hooks/mcp-abi-session-warn.sh  (SessionStart proactive warning)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

OUTPUT=$(
  cd "$REPO_ROOT" && node -e "
    try {
      const db = require('better-sqlite3')(':memory:');
      const v = db.prepare('SELECT sqlite_version() as v').get().v;
      db.close();
      console.log('OK sqlite ' + v);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  " 2>&1
) || {
  echo "[verify:mcp-abi] FAILED — MCP server would not start under Claude Desktop."
  echo ""
  echo "$OUTPUT"
  echo ""
  echo "Repair: npm run sqlite:node -w packages/app"
  echo "Root cause: better-sqlite3 is compiled for Electron's ABI; the MCP server needs Node's."
  echo "This typically happens after running the Electron app without the with-electron-abi.sh wrapper."
  exit 1
}

echo "[verify:mcp-abi] $OUTPUT"
