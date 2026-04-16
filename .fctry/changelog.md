# Setlist — Changelog

## 2026-04-15T18:00:00Z — /fctry:evolve (canonical areas + sub-projects, schema v11)
- Frontmatter: [modified] spec-version 0.12 → 0.13; synopsis short/medium/readme updated; tech-stack and goals augmented
- `#registration` (2.2): [modified] Core identity fields 6 → 7 (adds `area`); optional `parent_project` declared as a structural edge; registerProject signature gains area + parentProject
- `#querying` (2.3): [modified] Filter set gains `area` (literal, no descendant inheritance); `__unassigned__` sentinel introduced; type filter notes `project`-only
- `#project-profile` (2.4): [modified] "Profile is not area" clarification — area is a structural column, written via set_project_area, not enrich_project
- `#error-handling` (2.5.1): [modified] Table adds INVALID_AREA, PARENT_CYCLE (with exact message), and parent-not-found rows
- `#project-bootstrap` (2.13): [modified] bootstrap_project accepts area + parent_project; area_of_focus bootstrap variant retired
- `#desktop-app` (2.14): [modified] Home view replaced with grouped lanes (7 canonical areas + Unassigned), collapsible; Unassigned lane visually distinct with inline "Assign an area" nudge; sub-project treatment (24px indent + 1px connector, cross-area `↳ parent-name` caption); multi-select filter chips per area
- `#entities` (3.2): [modified] Areas added as first-class entity with seeded 7-row `areas` table; sub-project relationships added as structural edge; core identity field count 6 → 7 (+ optional parent edge); Areas of focus entry rewritten as retired; templates reduced from 3 to 2
- `#rules` (3.3): [modified] Project type narrowed to `project` (area_of_focus retired); area must be one of 7 canonical values or null (nullable forever); cycle prevention rule with exact error message; parent-is-project-not-area rule; archive-parent-does-not-cascade rule; four-level memory scope rule updated to include area-based inheritance (area scope flows to all projects sharing an area_id); MemoryScope enum retires `area_of_focus` and gains `area`
- `#hard-constraints` (4.3): [modified] Schema evolution entry extended through v11; tool count 34 → 36 (adds set_project_area, set_parent_project)
- `#schema` (5.2): [modified] Schema bumped 10 → 11; 19 tables (adds `areas`); projects.area_id and projects.parent_project_id DDL documented; full v10→v11 migration plan added (8 steps: seed areas, add columns, reclassify msq-advisory-board → Work and fam-estate-planning → Family, narrow type CHECK, migrate knowmarks↔knowmarks-ios entity soft-link to parent_project_id, remap memories.scope, retire area_of_focus template, bump schema_meta)
- `#ts-decisions` (5.3): [modified] Project interface gains area/parentProjectId/children; new `AreaName` union type; `MemoryScope` retires `area_of_focus`, gains `area`
- Appendix B Glossary: [added] Area, Schema v11, Sub-project, Canonical area set, retired `area_of_focus` disambiguation entries
- Appendix D MCP Tool Reference: [modified] Header updated to 36 tools; `register_project`/`update_project`/`bootstrap_project` gain area + parent_project params; `list_projects`/`search_projects`/`cross_query`/`batch_update` gain area filter; `get_project` returns area + parent_project + children; `get_registry_stats` surfaces per-area distribution + unassigned count; `archive_project` clarifies no-cascade behavior; `rename_project` notes parent_project_id back-references are updated; `enrich_project` explicitly does NOT accept area; [added] `set_project_area` and `set_parent_project` rows
- Straggler tool-count references across §5.1, §3.1, §3.4, §5.4, §7.x, Appendix B normalized from 32/34 → 36
- Non-goals (out of scope for this evolve): todoist sync; renaming the `area_of_focus` identifier anywhere it's historically referenced (schema migration, memory scope) beyond the v11 retirement; removing the free-form `entities` profile field
(2 added, 14 modified, 0 removed)

## 2026-04-15T12:00:00Z — /fctry:review (v0.12 hygiene reconciliation)
- `#enrichment` (2.5) / `#error-handling`: [structural] Demoted duplicate §2.5 "What Happens When Things Go Wrong" to §2.5.1 as a subsection of Field Enrichment; TOC updated; alias `#error-handling` preserved
- `#anti-patterns` (4.4): [modified] Tool count reference 32 → 34
- `#monorepo` (5.1): [modified] `server.ts` comment 32 → 34 tool definitions; renderer tree updated from `pages/` (Home, ProjectDetail) to `views/` (HomeView, ProjectDetailView, SettingsView) with new `hooks/` and `lib/` entries
- `#appendix-d` (D): [modified] `assess_health` row adds `fresh?` parameter with cache-bypass note; `configure_bootstrap` row renames `type_path_roots` → `path_roots` and adds `archive_path_root?`
- `#health-assessment` (2.15): [modified] "How often it's computed" paragraph mentions `fresh=true` cache-bypass escape hatch
- Code: [modified] `packages/mcp/src/server.ts` exposes `archive_path_root` in `configure_bootstrap` schema and forwards it to `bootstrapManager.configureBootstrap` (was dropped between IPC handler and MCP surface)
- Hygiene drift fix only — no behavior change, no spec version bump beyond 0.12 already set by OpenKL ref
(0 added, 6 modified, 0 removed)

## 2026-04-15T00:00:00Z — /fctry:ref (OpenKL pattern study)
- `#inspirations` (6.1): [modified] Added nowledge-co/OpenKL reference (knowmark 14312, Tier 2 pattern study, not adopted). Catalogs four patterns relevant to setlist's memory layer: memory vs grounding-store separation, first-class memory-distillation prompts, citations with retention classes / verify+open ops, and multi-surface hybrid search. Framed as open questions only — no scope expansion.
- Frontmatter: [modified] spec-version 0.11 → 0.12, date 2026-04-15
- Scope guardrail: explicitly pattern study; setlist's flat 10-type memory model and single-surface hybrid recall remain unchanged
(0 added, 2 modified, 0 removed)

## 2026-04-14T16:30:00Z — /fctry:evolve (project health assessment)
- `#health-assessment` (2.15): [added] New section introducing composite project health assessment — four qualitative tiers (Healthy / At risk / Stale / Unknown), worst-tier-wins composition across three dimensions (activity, completeness, outcomes), on-demand computation with brief cache, and the `assess_health` MCP tool
- `#desktop-app` (2.14): [modified] Card grid now shows a colored health dot alongside the status indicator; Overview tab gains a Health section showing tier, per-dimension breakdown, and reasons
- `#appendix-d` (D): [modified] Added `assess_health` tool reference row and Health category; tool count 33 → 34
- Synopsis: [modified] Added health assessment to medium description and three new pattern/goal entries (worst-tier-wins, on-demand-assessment, qualitative-tiers / project-health-assessment, composite-tier-surfacing, glanceable-portfolio-health)
- Scenarios: [added] S65–S70 covering composite tier, activity buckets, completeness criteria, outcome-based health, `assess_health` tool, and home-view/detail-view surfacing
- Frontmatter: [modified] spec-version 0.10 → 0.11, date 2026-04-14
(1 added, 4 modified, 0 removed)

## 2026-04-13T00:00:00Z — /fctry:ref (EngramMemory pattern study)
- `#portfolio-memory` (2.12): [modified] Added "Pattern study: tiered recall and activation-based reinforcement" note — ACT-R activation curves, hot-tier cache, LSH-on-Matryoshka-prefix as open questions, not commitments
- `#inspirations` (6.1): [added] Engram Memory reference (Tier 2 pattern study) with latency characteristics and open questions informed
- Frontmatter: [modified] spec-version 0.9 → 0.10, date 2026-04-13
- Scope guardrail: explicitly framed as pattern study; setlist remains a project registry with memory, not a general-purpose memory engine
(1 added, 3 modified, 0 removed)

## 2026-04-11T20:50:00Z — /fctry:review (drift reconciliation)
- `#what-this-is` (1.2): [modified] Fixed tool count 32 → 33, added `enrich_project` to Setlist-specific additions
- `#desktop-app` (2.14): [modified] Documented multiselect status filtering and archived-by-default behavior
- `#appendix-d` (D): [modified] Added `enrich_project` to tool reference table, fixed tool count
- Synopsis: [modified] Updated readme description to mention multiselect filtering
- All references: [modified] "32 MCP tools" → "33 MCP tools" throughout spec
- CLAUDE.md: [modified] Fixed tool count (33), scenario count (64, S01-S64), added S45-S64 app scenario category, updated compact instructions
(0 added, 6 modified, 0 removed)

## 2026-04-08T12:00:00Z — /fctry:ref (6 external references)
- `#portfolio-memory` (2.12): [modified] Added native vector search tier (sqlite-vec) to embedding provider model
- `#portfolio-memory` (2.12): [modified] Evolved summary block rewriting to hierarchical compaction trees (hipocampus)
- `#portfolio-memory` (2.12): [modified] Added progressive delivery to recall — fast FTS5 first pass, async vector re-ranking (frankensearch)
- `#portfolio-memory` (2.12): [modified] Added knowledge distillation as 6th reflect operation — synthesizes patterns/preferences from memory clusters (hindsight)
- `#portfolio-memory` (2.12): [modified] Added graph gap detection to entity/relationship extraction — surfaces isolated topic clusters as observations (infranodus)
- `#connections` (3.4): [modified] Added MCP startup tool validation and progress reporting for long-running operations (mcp-ts-core)
- `#inspirations` (6.1): [modified] Added 6 references: sqlite-vec, hipocampus, frankensearch, hindsight, infranodus, mcp-ts-core
- Frontmatter: [modified] Updated synopsis (medium, patterns, goals) to reflect memory and MCP enhancements; spec-version 0.8 → 0.9
(0 added, 8 modified, 0 removed)

## 2026-04-07T16:30:00Z — /fctry:evolve desktop-app
- `#what-this-is` (1.2): [modified] Added @setlist/app as 4th package; updated "three packages" → "four packages"
- `#design-principles` (1.3): [modified] Evolved "invisible infrastructure" to "invisible infrastructure, operable surface"; added "shared design language" principle
- `#success` (1.4): [modified] Added desktop app success criteria (launch, card grid, single-instance, bidirectional visibility)
- `#desktop-app` (2.14): [added] New section — desktop control panel (home view card grid, tabbed project detail, project CRUD, read-only memory/capabilities/ports, Electron IPC architecture, design tokens, Chorus relationship)
- `#capabilities` (3.1): [modified] Added desktop dashboard, project detail, and project CRUD capabilities
- `#connections` (3.4): [modified] Added Chorus design system as external connection
- `#scope` (4.1): [modified] Added desktop control panel to scope coverage
- `#platform` (4.2): [modified] Added Electron runtime, UI framework, desktop shell, visual consumers
- `#hard-constraints` (4.3): [modified] Added Electron security constraint (no nodeIntegration) and single-instance constraint
- `#monorepo` (5.1): [modified] Added packages/app/ to tree; fixed "30 tool" → "32 tool" in mcp comment
- `#ts-decisions` (5.3): [modified] Added Electron IPC, React/Tailwind/Radix, and packaging decisions
- `#satisfaction` (7.1): [modified] Added desktop app satisfaction criteria
- `#convergence` (7.2): [modified] Added @setlist/app layer to convergence sequence
- `#observability` (7.3): [modified] Added desktop app observability signals
- `#agent-decides` (7.4): [modified] Added frontend agent decisions and hard constraints (Electron, React, design tokens, IPC model)
- Appendix A: [modified] Added desktop app and design system rationale
- Appendix B: [modified] Added @setlist/app and IPC bridge glossary entries
- `#deferred-futures` (Appendix C): [modified] Added 6 deferred desktop features (memory CRUD, capability CRUD, port management, task management, bootstrap UI, web version)
- Frontmatter: [modified] Updated synopsis (short, medium, readme, tech-stack, patterns, goals) to include desktop control panel; spec-version 0.7 → 0.8
(1 added, 17 modified, 0 removed)

## 2026-04-07T12:00:00Z — /fctry:evolve project-bootstrap
- `#project-bootstrap` (2.13): [added] New section — end-to-end project creation (register + folder + templates + git init for code projects), configure_bootstrap for path roots and template directory
- `#capabilities` (3.1): [modified] Added bootstrap_project and configure_bootstrap capabilities; updated tool count 28→30
- `#entities` (3.2): [modified] Added bootstrap configuration as tracked entity
- `#scope` (4.1): [modified] Added project bootstrap to scope coverage
- `#hard-constraints` (4.3): [modified] Updated tool count constraint 28→30 with bootstrap_project and configure_bootstrap
- `#appendix-d-mcp-tool-reference`: [modified] Added Bootstrap tool table (bootstrap_project, configure_bootstrap); updated tool count 28→30
- Frontmatter: [modified] Updated synopsis (short, medium, readme, patterns, goals) to reflect bootstrap capability
- Spec version: 0.6 → 0.7
(1 added, 6 modified, 0 removed)

## 2026-04-06T13:00:00Z — write_fields MCP tool
<!-- Enables any producer (Chorus, fctry, user) to write extended fields to projects via MCP -->
- Appendix D: [modified] Added `write_fields` tool — write extended fields (short_description, medium_description, tech_stack, etc.) to a project with producer ownership. Wraps existing `registry.updateFields()`.
- Spec version: 0.4 → 0.5
(0 added, 1 modified, 0 removed)

## 2026-04-06T12:00:00Z — Portfolio intelligence support (observation type + portfolio_brief)
<!-- Step 2 of integration architecture: setlist provides the memory substrate for orchestrator continuity -->
- `#portfolio-memory` (2.12): [modified] Added `observation` memory type — cross-project findings from portfolio intelligence. Portfolio-scoped by default, carries verified/inferred confidence tag, decay rate 0.5
- `#portfolio-memory` (2.12): [modified] Added `portfolio_brief` agent tool — structured portfolio snapshot (active projects, portfolio memories, health indicators, pending observations) for session start
- `#scope` (4.1): [modified] Added portfolio intelligence support to scope coverage
- Appendix D: [modified] Added `portfolio_brief` to Memory — Agent tool reference
- Spec version: 0.3 → 0.4
(0 added, 4 modified, 0 removed)
