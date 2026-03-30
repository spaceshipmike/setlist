# CLAUDE.md — Setlist

## What This Is

Setlist is the TypeScript implementation of the Project Registry — the active intelligence hub for the user's personal ecosystem. It provides project identity, capability declarations, portfolio memory, port allocation, task routing, batch operations, and cross-project intelligence via a local SQLite database and MCP server.

This is a direct port of `project-registry-service` (Python). Same experience, same schema (v8), same 27 MCP tools. Different language (TypeScript), different packaging (npm monorepo).

## Factory Contract

This project is built and maintained using the fctry spec-driven workflow.

- **Spec:** `.fctry/spec.md` — the complete natural-language specification
- **Scenarios:** `.fctry/scenarios.md` — 30 end-to-end scenarios defining behavioral satisfaction
- **Config:** `.fctry/config.json` — version registry (external 0.1.0, spec 0.1)
- **State:** `.fctry/state.json` — current workflow state

Code is validated solely through scenario satisfaction. No human reviews the code.

## Commands

```bash
# Build all packages
npm run build

# Run all tests
npm test

# Run tests for a specific package
npm test -w packages/core

# Type-check without emitting
npm run typecheck
```

## Architecture

### Monorepo (npm workspaces)

```
packages/
├── core/    # @setlist/core — library (all registry logic)
├── mcp/     # @setlist/mcp — MCP server (27 tools, stdio)
└── cli/     # @setlist/cli — CLI commands + async worker
```

### Key Architectural Decisions

- **better-sqlite3** — Synchronous native SQLite binding. No async wrapper overhead.
- **@modelcontextprotocol/sdk** — Official MCP SDK for the server package.
- **ESM-only** — All packages produce ESM output. No CJS.
- **Schema v8** — Shared with Python implementation. The .db file is the contract.
- **Library-first** — @setlist/core is the primary interface. MCP and CLI are thin wrappers.

### Database

Location: `~/.local/share/project-registry/registry.db`
14 tables, schema v8, WAL mode, FTS5 for memory search.

### 27 MCP Tools

**Identity (9):** list_projects, get_project, switch_project, search_projects, get_registry_stats, register_project, update_project, archive_project, batch_update

**Capabilities (2):** register_capabilities, query_capabilities

**Memory Agent (4):** retain, recall, feedback, memory_status

**Memory Admin (5):** reflect, correct, forget, inspect_memory, configure_memory

**Ports (4):** claim_port, release_port, check_port, discover_ports

**Tasks (3):** queue_task, list_tasks, cross_query

## .fctry/ Directory

| File | Purpose |
|------|---------|
| spec.md | NLSpec v2 — the complete specification |
| scenarios.md | Holdout scenario set (30 scenarios) |
| config.json | Version registry |
| state.json | Current workflow state |
| interview-state.md | Interview completion record |
| tool-check | Tool availability snapshot |

## Workflow Guidance

- Run `/fctry:evolve <section>` to refine any spec section
- Run `/fctry:ref <url>` to incorporate external references
- Run `/fctry:execute` to start or continue the build
- Run `/fctry:review` to audit spec vs. codebase

## Scenarios

Scenarios in `.fctry/scenarios.md` define the behavioral contract. Key categories:

- **S01-S02:** Schema initialization and Python compatibility
- **S03-S06:** Project identity (registration, querying, fields, errors)
- **S07:** Migration
- **S08-S09:** Port management and discovery
- **S10:** Capability declarations
- **S11-S16:** Portfolio memory (retain, recall, feedback, correction, reflection, FTS5-only)
- **S17-S18:** Batch operations and task dispatch
- **S19:** Cross-project queries
- **S20:** Archive cleanup
- **S21-S24:** TypeScript-specific (MCP drop-in, library import, npm build, test parity)
- **S25:** Async worker
- **S26-S30:** Administration, context switching, search, task lifecycle, stats

<!-- compact-instructions
Preserve during auto-compaction:
- Spec: .fctry/spec.md (Setlist NLSpec, experience-ported from project-registry-service)
- Scenarios: .fctry/scenarios.md (30 scenarios, S01-S30)
- Config: .fctry/config.json (external 0.1.0, spec 0.1)
- State: .fctry/state.json (current workflow step)
- Key constraint: Schema v8 compatibility with Python implementation
- Key constraint: Same 27 MCP tools, same parameters, same response shapes
- Key constraint: Library-first (@setlist/core), ESM-only, better-sqlite3
-->
