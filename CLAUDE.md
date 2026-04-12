# CLAUDE.md — Setlist

## What This Is

Setlist is the TypeScript implementation of the Project Registry — the active intelligence hub for the user's personal ecosystem. It provides project identity, capability declarations, portfolio memory, port allocation, task routing, batch operations, cross-project intelligence, and a desktop control panel via a local SQLite database, MCP server, and Electron app.

Originally a direct port of `project-registry-service` (Python), now evolved beyond parity. Schema v10 (unified memory types, belief classification, temporal validity, entity extraction, procedural versioning), 33 MCP tools, desktop UI sharing Chorus's design system with multiselect status filtering and archived project visibility. Different language (TypeScript), different packaging (npm monorepo).

## Factory Contract

This project is built and maintained using the fctry spec-driven workflow.

- **Spec:** `.fctry/spec.md` — the complete natural-language specification
- **Scenarios:** `.fctry/scenarios.md` — 64 end-to-end scenarios defining behavioral satisfaction
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
├── mcp/     # @setlist/mcp — MCP server (33 tools, stdio)
├── cli/     # @setlist/cli — CLI commands + async worker
└── app/     # @setlist/app — desktop control panel (Electron + React)
```

### Key Architectural Decisions

- **better-sqlite3** — Synchronous native SQLite binding. No async wrapper overhead.
- **@modelcontextprotocol/sdk** — Official MCP SDK for the server package.
- **Electron** — Desktop shell for @setlist/app. Main process imports @setlist/core via IPC bridge.
- **React + Tailwind CSS 4 + Radix UI** — Renderer stack, shared design system with Chorus.
- **ESM-only** — All packages produce ESM output. No CJS.
- **Schema v10** — Evolved from Python's v8. The .db file is the contract.
- **Library-first** — @setlist/core is the primary interface. MCP, CLI, and desktop app are thin wrappers.

### Database

Location: `~/.local/share/project-registry/registry.db`
18 tables, schema v10, WAL mode, FTS5 for memory search.

### 33 MCP Tools

**Identity (12):** list_projects, get_project, switch_project, search_projects, get_registry_stats, register_project, update_project, archive_project, rename_project, batch_update, write_fields, enrich_project

**Capabilities (2):** register_capabilities, query_capabilities

**Memory Agent (5):** retain, recall, feedback, memory_status, portfolio_brief

**Memory Admin (5):** reflect, correct, forget, inspect_memory, configure_memory

**Ports (4):** claim_port, release_port, check_port, discover_ports

**Tasks (3):** queue_task, list_tasks, cross_query

**Bootstrap (2):** bootstrap_project, configure_bootstrap

## Project Enrichment

Every project in the registry should be discoverable and understandable by agents. Enrichment happens in three steps:

### Step 1: Identity (`register_project` / `update_project`)
- `description` — one paragraph explaining what the project is and does. Write for an agent that has never seen this project. Focus on capabilities and architecture, not marketing.

### Step 2: Profile (`enrich_project`)
- `goals` — what the project is trying to achieve (list of strings)
- `topics` — searchable tags (e.g. "electron", "mcp", "vector-search")
- `entities` — other projects, services, or tools this project depends on or integrates with

### Step 3: Structured fields (`write_fields`)

| Field | Required | When to use |
|-------|----------|-------------|
| `short_description` | All projects | One line (~10 words). Used in portfolio briefs and search results. |
| `medium_description` | Code projects | One paragraph. The default description for agent consumption. |
| `readme_description` | Code projects (optional) | Full context for deep reasoning. 3-5 sentences. |
| `tech_stack` | Code projects | Languages, frameworks, databases, APIs. Comma-separated string or JSON array. |
| `patterns` | Code projects | Architectural patterns and approaches. Comma-separated string or JSON array. |

### What makes a good description
- **Agent-friendly** = capabilities and architecture, not marketing copy
- Lead with what it *is*, then what it *does*, then how
- Name the tech stack in the description so search finds it
- Non-code projects only need `short_description` — skip tech_stack/patterns

### When to enrich
- When registering a new project
- When a project's scope or tech stack changes significantly
- When search fails to find a project that should match a query

## .fctry/ Directory

| File | Purpose |
|------|---------|
| spec.md | NLSpec v2 — the complete specification |
| scenarios.md | Holdout scenario set (64 scenarios) |
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
- **S31:** Rename project
- **S32-S37:** Schema v10, unified memory types, chorus-compatible fields
- **S38-S44:** Project bootstrap (configuration, code/non-code/area bootstrapping, error states)
- **S45-S64:** Desktop app (window management, IPC bridge, card grid, filtering/sorting, detail tabs, CRUD operations, design system, CLI launcher, empty state, error feedback, data refresh, packaging)

<!-- compact-instructions
Preserve during auto-compaction:
- Spec: .fctry/spec.md (Setlist NLSpec, experience-ported from project-registry-service)
- Scenarios: .fctry/scenarios.md (64 scenarios, S01-S64)
- Config: .fctry/config.json (external 0.1.10, spec 0.9)
- State: .fctry/state.json (current workflow step)
- Key constraint: Schema v10 with unified memory types, 18 tables
- Key constraint: 29 Python-compatible MCP tools + 4 Setlist additions (enrich, rename, bootstrap, configure_bootstrap)
- Key constraint: Library-first (@setlist/core), ESM-only, better-sqlite3
-->
