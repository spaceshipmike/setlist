# CLAUDE.md — Setlist

## What This Is

Setlist is the TypeScript implementation of the Project Registry — the active intelligence hub for the user's personal ecosystem. It provides project identity, capability declarations, portfolio memory, port allocation, task routing, batch operations, cross-project intelligence, and a desktop control panel via a local SQLite database, MCP server, and Electron app.

Spec 0.28 is **shipped through v0.5.0**: user-managed areas (seeded with seven defaults, full CRUD via Settings), first-class user-managed project types (default directory, git-init flag, optional template directory) backed by the `project_types` table, restructured Settings panel, Home-view controls (column visibility, density toggle, sort persistence, default landing view, Cmd-, accelerator), and **user-composable bootstrap primitive composition** (per-type recipes assembled from a closed three-shape primitive set — `filesystem-op` / `shell-command` / `mcp-tool` — built-ins plus user-authored entries, with combined dry-run + pre-flight, stop-and-report-resumable failure handling, and an automatic `register-in-registry` trailer) are all live. For origin and port history, see spec §1.5.

Running system: Schema v14 (adds `bootstrap_primitives` and `project_type_recipe_steps` tables to back the user-composable bootstrap recipe runner; builds on v13's `project_types` user-managed table + FK from `projects.type`, reclassified `areas` table, v12's `project_digests` table, v11's canonical areas + first-class `area_id`/`parent_project_id` columns on projects, area_of_focus type retired, and v10's unified memory types, belief classification, temporal validity, entity extraction, procedural versioning), 56 MCP tools, desktop UI sharing Chorus's design system with multiselect status filtering and archived project visibility.

## Factory Contract

This project is built and maintained using the fctry spec-driven workflow.

- **Spec:** `.fctry/spec.md` — the complete natural-language specification
- **Scenarios:** `.fctry/scenarios.md` — 154 end-to-end scenarios defining behavioral satisfaction
- **Config:** `.fctry/config.json` — version registry (external 0.5.0, spec 0.28)
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
├── mcp/     # @setlist/mcp — MCP server (56 tools, stdio)
├── cli/     # @setlist/cli — CLI commands + async worker
└── app/     # @setlist/app — desktop control panel (Electron + React)
```

### Key Architectural Decisions

- **better-sqlite3** — Synchronous native SQLite binding. No async wrapper overhead. The app and the MCP server need different native ABIs (Electron's Node vs standalone Node 24). `packages/app/scripts/with-electron-abi.sh` wraps `dev`/`build`/`preview`/`start` to swap binaries via `native-cache/` and always restore the Node binary on exit, so the Claude Desktop MCP server keeps working after running the app. If the MCP server ever fails with a `NODE_MODULE_VERSION` mismatch, run `npm run sqlite:node -w packages/app` to manually restore. A `SessionStart` hook (`.claude/hooks/mcp-abi-session-warn.sh`) auto-checks at session-open; Observer/humans can also invoke `npm run verify:mcp-abi` on demand (recommended after any build step touching `packages/app/**` or native deps).
- **@modelcontextprotocol/sdk** — Official MCP SDK for the server package.
- **Electron** — Desktop shell for @setlist/app. Main process imports @setlist/core via IPC bridge.
- **React + Tailwind CSS 4 + Radix UI** — Renderer stack, shared design system with Chorus.
- **ESM-only** — All packages produce ESM output. No CJS.
- **Schema v14** — Current schema: adds `bootstrap_primitives` (the closed three-shape primitive set, seeded with four built-ins: create-folder, copy-template, git-init, update-parent-gitignore) and `project_type_recipe_steps` (the ordered list of primitive invocations per project type, with `params_json` carrying bound parameter values and `UNIQUE(project_type_id, position)` enforcing position uniqueness). Together these back the user-composable bootstrap recipe runner shipped in v0.5.0. Builds on v13 (`project_types` as a user-managed table + FK from `projects.type`, `areas` reclassified as user-managed), v12's `project_digests` (free-form per-project essence summaries, one row per `(project, digest_kind)`, versioned by spec version, cascaded on archive), and v11's canonical areas + first-class area_id/parent_project_id columns on projects (area_of_focus type retired). Migration history from v8 (port origin) through v9 (observation memory type), v10 (unified memory types + belief/temporal/entity/procedural-versioning fields), v11, v12, and v13 is preserved in spec §5.2.
- **Library-first** — @setlist/core is the primary interface. MCP, CLI, and desktop app are thin wrappers.

### Database

Location: `~/.local/share/project-registry/registry.db`
24 tables, schema v14, WAL mode, FTS5 for memory search.

### 56 MCP Tools

**Identity (14):** list_projects, get_project, switch_project, search_projects, get_registry_stats, register_project, update_project, archive_project, rename_project, batch_update, write_fields, enrich_project, set_project_area, set_parent_project

**Capabilities (2):** register_capabilities, query_capabilities

**Memory Agent (5):** retain, recall, feedback, memory_status, portfolio_brief

**Memory Admin (5):** reflect, correct, forget, inspect_memory, configure_memory

**Ports (4):** claim_port, release_port, check_port, discover_ports

**Tasks (3):** queue_task, list_tasks, cross_query

**Bootstrap (3):** bootstrap_project, configure_bootstrap, bootstrap_resolve

**Health (1):** assess_health

**Digests (3):** get_project_digest, get_project_digests, refresh_project_digest

**Areas (4):** list_areas, create_area, update_area, delete_area

**Project types (4):** list_project_types, create_project_type, update_project_type, delete_project_type

**Primitives (5):** list_primitives, get_primitive, create_primitive, update_primitive, delete_primitive

**Recipes (3):** get_recipe, set_recipe, preview_recipe

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
| scenarios.md | Holdout scenario set (154 scenarios) |
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

- **S01-S02:** Schema initialization and port-era compatibility (see spec §1.5)
- **S03-S06:** Project identity (registration, querying, fields, errors)
- **S07:** Migration
- **S08-S09:** Port management and discovery
- **S10:** Capability declarations
- **S11-S16:** Portfolio memory (retain, recall, feedback, correction, reflection, FTS5-only)
- **S17-S18:** Batch operations and task dispatch
- **S19:** Cross-project queries
- **S20:** Archive cleanup
- **S21-S24:** Library and packaging (library import, npm build, test scaffolding)
- **S25:** Async worker
- **S26-S30:** Administration, context switching, search, task lifecycle, stats
- **S31:** Rename project
- **S32-S37:** Schema v10, unified memory types, chorus-compatible fields
- **S38-S44:** Project bootstrap (configuration, code/non-code/area bootstrapping, error states)
- **S45-S64:** Desktop app (window management, IPC bridge, card grid, filtering/sorting, detail tabs, CRUD operations, design system, CLI launcher, empty state, error feedback, data refresh, packaging)
- **S65-S70:** Project health assessment (composite tier, activity/completeness/outcomes dimensions, assess_health MCP tool, Home view health dot and Overview Health section)
- **S71-S80:** Areas as a structural element and sub-projects (S71 superseded by S128, S77 superseded by S133 in spec 0.28; remaining: knowmarks soft-link migration, set_project_area, set_parent_project + cycle prevention, memory scope bubble-up through area, parent archive non-cascade, get_project returns area+parent+children)
- **S81-S90:** Auto-update (dev-disabled, signed+notarized release, channel persistence, stable vs beta feeds, Check For Updates menu, About dialog version, silent background download, update-downloaded toast, install-on-quit prompt, Settings status line)
- **S91-S96:** Testing discipline and native-binding hygiene (CI gates, Electron security, ABI safety net)
- **S97-S111:** Project digests (write/replace/staleness/archive-cascade/ceiling; generator v2 provider + fallback, non-code docling extraction, docling-unavailable, file-tree-hash staleness, --all portfolio refresh, multi-project no-silent-drop, underscore-dir walker skip, `.digestignore` composition, large-spec handling)
- **S112-S117:** Capability self-registration (MCP tools, CLI commands, and library exports re-declare on every server startup; per-surface failure isolation; drift is structurally impossible)
- **S118:** Bootstrap auto-appends sub-project entries to the parent project's `.gitignore` (idempotent, best-effort)
- **S119-S123:** Home view controls (column visibility, row density, sort persistence, default landing view, Cmd-, accelerator)
- **S124-S127:** Project types as first-class user-managed entities (CRUD, fields, delete-block-with-projects, path-based migration on upgrade)
- **S128-S131:** User-managed areas (CRUD in Settings, delete-block-with-projects, label-only renames preserve memory routing, curated 12-preset color palette)
- **S132-S134:** Legacy `area_of_focus` removed, area-name validation against live table, Settings panel structure (Areas → Project types → View → Bootstrap → Updates) — supersedes S41/S71/S77
- **S135-S138:** Client-independent agent onboarding (server `instructions` on initialize, `next_steps` arrays in registration responses, `setlist://docs/onboarding` MCP resource, `portfolio_brief` enrichment-gap annotations) — token-efficient pointer-shaped surfaces, MCP-native so any conforming client onboards a new project without bespoke integration
- **S139-S154:** User-composable bootstrap primitives (per-type recipes, three primitive shapes — `filesystem-op` / `shell-command` / `mcp-tool`, peer Settings panel for authoring, existing 5 hardcoded steps refactored into the registry as built-ins, non-draggable `register-in-registry` trailer, combined dry-run + pre-flight, stop-and-report-resumable failure with Retry/Skip/Abandon, honest abandon cleanup, recipes evaluated at bootstrap time only)

<!-- compact-instructions
Preserve during auto-compaction:
- Spec: .fctry/spec.md (Setlist NLSpec at 0.28; port history in §1.5)
- Scenarios: .fctry/scenarios.md (154 scenarios, S01-S154)
- Config: .fctry/config.json (external 0.5.0, spec 0.28)
- State: .fctry/state.json (current workflow step)
- Key constraint: Spec 0.28 shipped through v0.5.0 — areas user-managed (CRUD, seeded defaults), project types first-class (default_directory, git_init, template_directory), Home view has column visibility/density/sort persistence/landing view, Cmd-, opens Settings; user-composable bootstrap primitive composition live (per-type recipes, three primitive shapes: filesystem-op/shell-command/mcp-tool, four built-ins + user-authored, dry-run + pre-flight, stop-and-report-resumable failure with Retry/Skip/Abandon, automatic register-in-registry trailer); schema v14 live
- Key constraint: Running code is on schema v14 (bootstrap_primitives + project_type_recipe_steps tables backing the recipe runner; built on v13 project_types user-managed table + FK from projects.type, areas reclassified user-managed, v12 project_digests, v11 canonical areas + sub-projects, 24 tables)
- Key constraint: 56 MCP tools covering identity, capabilities, memory, ports, tasks, bootstrap (incl. bootstrap_resolve), health, digests, areas, project types, primitives, recipes (areas + project types + primitives + recipes CRUD exposed via MCP as of 0.28)
- Key constraint: Library-first (@setlist/core), ESM-only, better-sqlite3
-->
