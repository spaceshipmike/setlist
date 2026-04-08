# Setlist — Changelog

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
