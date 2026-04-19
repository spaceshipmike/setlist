#!/usr/bin/env bash
# SessionStart hook: warn if better-sqlite3 is compiled for the wrong ABI.
#
# The setlist MCP server (run by Claude Desktop under standalone Node) will
# fail to load if better-sqlite3 is compiled for Electron's ABI. This hook
# runs the Node-side load test at session start and surfaces a repair hint
# before the user hits a silent tool failure.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Fast path: if the verifier passes, say nothing.
if bash "$REPO_ROOT/scripts/verify-mcp-abi.sh" >/dev/null 2>&1; then
  exit 0
fi

# Failing path: emit a compact one-line warning to stderr so Claude Code
# relays it to the user at session start.
echo "MCP server will fail — better-sqlite3 has the wrong ABI. Fix: npm run sqlite:node -w packages/app" >&2
exit 0
