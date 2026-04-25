# Setlist — Natural Language Specification

```yaml
---
title: Setlist
spec-version: "0.26"
date: 2026-04-24
status: active
author: Mike
spec-format: nlspec-v2
---
synopsis:
  short: "TypeScript project registry — intelligence hub with desktop control panel, user-managed areas + project types, customizable Home view, 39 MCP tools, unified memory, per-project essence digests"
  medium: "TypeScript monorepo (@setlist/core, @setlist/mcp, @setlist/cli, @setlist/app) implementing the project registry as both invisible infrastructure and a directly operable desktop surface. Local SQLite (better-sqlite3) + MCP server + Electron control panel sharing Chorus's design system (Tailwind 4, Radix UI), distributed as signed and notarized release builds that auto-update over two user-selectable channels (stable, beta). The desktop app exposes a single-page Settings panel (Areas, Project types, View, Bootstrap, Updates) where the user manages canonical areas as a CRUD list (seeded with seven defaults, recolored from a curated 12-preset palette, deletion blocked while projects are attached) and manages project types as a first-class CRUD list with per-type default directory, git-init flag, and optional template directory (seeded with Code project at ~/Code and Non-code project at ~/Projects). The Home view supports column visibility toggles (Status, Health, Type, Updated, area badge — Name is always shown), a compact/spacious row-density toggle, sort persistence across sessions, a default landing view (grouped lanes vs flat grid), and the standard Cmd-, accelerator to open Settings; the Type column reads the actual stored project type, no longer a path heuristic. Provides project identity, capability declarations, unified portfolio memory (10 types with FTS5 full-text search, belief classification, temporal validity, entity storage, procedural versioning, four-level scoping with area bubble-up, and triple-gate stale-memory archival; vector retrieval, hybrid RRF fusion, hierarchical compaction, gap detection, and distillation are studied aspirations gated on an embedding-tier decision), project bootstrap (now driven by the user's project_types list rather than a hardcoded enum, with the legacy area_of_focus type fully removed), port allocation, batch operations, cross-project intelligence, and composite project health assessment (activity + completeness + outcomes). Schema v13 (adds project_types table and replaces the projects.type CHECK constraint with a foreign key into it; areas table CHECK relaxed; builds on v12's project_digests table and v11's structural areas + parent_project_id columns), 39 MCP tools, importable as @setlist/core by Chorus and Ensemble. The digest generator in @setlist/cli defaults to a hosted model (Gemini 2.5 Flash-Lite via OpenRouter, 1M-token context, cost-attributed per project) with a local MLX fallback when the key is missing or the provider fails, and extracts markdown from PDFs and Office documents for non-code projects that have no spec file."
  readme: "Setlist is the TypeScript implementation of the Project Registry — both invisible infrastructure at the center of the user's personal ecosystem and a directly operable desktop control panel. As infrastructure, it provides structured, queryable identity for every project (organized under a user-managed list of areas seeded at install with seven sensible defaults — Work, Family, Home, Health, Finance, Personal, Infrastructure — that the user can rename, recolor, add to, or remove via Settings, with optional parent-child sub-project relationships), with programmatic administration, capability declarations, unified portfolio memory (10 types with belief classification, temporal validity, entity storage, procedural versioning, four-level scoping with area bubble-up, and triple-gate stale-memory archival; today recall runs over FTS5 full-text search with a composite score over reinforcement, recency, and outcome history — vector retrieval and RRF fusion are studied aspirations consolidated in §2.12.1 and gated on an unresolved embedding-tier decision), port allocation, user-managed project types governing bootstrap behavior, batch operations, and cross-project intelligence via 39 MCP tools and direct library import. As a desktop application, it presents a card-grid dashboard of all projects with multiselect status filtering (archived hidden by default), togglable column visibility, compact/spacious row density, persistent sort across sessions, a configurable default landing view (grouped lanes or flat grid), tabbed project detail views (overview, memory, capabilities, ports), full project CRUD — register, edit, archive, rename — and a single-page Settings panel for managing areas, project types, view defaults, bootstrap roots, and update channels (Cmd-, opens Settings). All this runs through a native macOS Electron app sharing Chorus's design language (Tailwind CSS 4, Radix UI, terracotta accent, warm charcoal surfaces). The main process imports @setlist/core directly; no API layer sits between the UI and the registry. Distributed as four npm packages (@setlist/core, @setlist/mcp, @setlist/cli, @setlist/app), Setlist is directly consumable by Chorus, Ensemble, and any Node.js tool in the ecosystem, while also standing alone as a full-featured project management surface."
  tech-stack: [typescript, better-sqlite3, "@modelcontextprotocol/sdk", node, npm-monorepo, electron, electron-updater, react, tailwindcss-v4, radix-ui]
  patterns: [user-managed-canonical-set, user-managed-project-types, seeded-then-mutable, curated-color-palette, label-rename-stable-id, reassign-before-delete, structural-parent-child, area-scoped-memory-inheritance, atomized-fields, progressive-disclosure, producer-consumer, registration-not-discovery, invisible-infrastructure, operable-surface, config-file-scanning, hub-and-spoke, capability-declaration, definition-is-truth, fuzzy-match-suggestions, archive-triggered-cleanup, producer-attribution, summary-compactness, freshness-importance-scoring, invocation-metadata, retain-recall-reflect, outcome-aware-reinforcement, content-hash-dedup, embedding-provider-abstraction, budget-controlled-recall, four-level-scoping, hybrid-retrieval, belief-classification, temporal-validity, entity-extraction, procedural-versioning, unified-memory-store, template-driven-bootstrap, configure-then-use, shared-design-system, ipc-bridge, per-machine-view-prefs, native-vector-search, hierarchical-compaction, progressive-retrieval, knowledge-distillation, graph-gap-detection, mcp-startup-validation, progress-notification, worst-tier-wins, on-demand-assessment, qualitative-tiers, signed-notarized-builds, silent-download-prompt-before-install, two-channel-release, scenarios-as-contract, canaries-not-gates, narrow-ci-wide-local, edit-time-security-check, release-blocking-preflight, dual-abi-swap-and-restore, detect-and-recover-over-prevent, derived-essence-digest, spec-version-as-staleness-signal, external-generator-internal-store, hosted-digest-generation-with-local-fallback, document-extraction-for-non-code-digests, project-tagged-llm-cost-attribution, filetree-hash-as-staleness-signal, introspected-capability-declarations]
  goals: [user-managed-area-organization, user-managed-project-types, customizable-home-view, sub-project-hierarchy, unified-project-identity, capability-discovery, programmatic-project-administration, batch-operations, cross-project-task-dispatch, conflict-free-port-allocation, automatic-port-discovery, async-task-execution, cross-project-intelligence, crash-resilient-worker, ranked-cross-project-results, capability-invocation-awareness, portfolio-memory, outcome-reinforcement, hybrid-retrieval, npm-packageable-distribution, canonical-memory-store, chorus-memory-unification, project-bootstrap-and-scaffolding, desktop-control-panel, project-dashboard, project-crud-ui, single-page-settings, implicit-connection-surfacing, fast-first-pass-recall, synthesized-knowledge-from-memory-clusters, memory-graph-blind-spot-detection, project-health-assessment, composite-tier-surfacing, glanceable-portfolio-health, auto-update-with-channels, project-essence-digests, digest-staleness-signal, cross-project-semantic-matching, non-code-project-digests, provider-agnostic-digest-generator, capability-self-registration]
plugin-version: 0.81.0
```

Setlist is the TypeScript implementation of the Project Registry and the active intelligence hub for the user's personal ecosystem. Schema v13 (adds `project_types` as a user-managed table, replaces the `projects.type` CHECK with a FK into it, and reclassifies the `areas` table from system-owned to user-managed; builds on v12's `project_digests`, v11's structural `area_id` and `parent_project_id` columns, retired `area_of_focus` type, and v10's unified memory types, belief classification, temporal validity, entity extraction, and procedural versioning). 39 MCP tools covering project identity, capabilities, portfolio memory, digests, ports, task dispatch, bootstrap, cross-project queries, and composite project health. Native macOS desktop control panel with a single-page Settings panel (Areas, Project types, View, Bootstrap, Updates) for direct human operation. Area-scoped memory inheritance. See §1.5 for origin and port history.

The rewrite exists because Chorus (Electron + React) and Ensemble need the registry as a direct npm dependency, not a subprocess or MCP-only integration. @setlist/core provides the library API importable from any Node.js process. @setlist/mcp wraps it as an MCP server. @setlist/cli exposes it from the terminal. @setlist/app provides a desktop control panel — an Electron app that imports @setlist/core directly, giving the user a visual surface for project management alongside the programmatic interfaces. The behavioral contract is carried by the 118-scenario holdout set in `.fctry/scenarios.md` and evaluated by LLM-as-judge; vitest is available for targeted unit tests against @setlist/core but is not the truth signal.

---

## Table of Contents

1. [Vision and Principles](#1-vision-and-principles)
   - 1.1 [Problem Statement](#11-problem-statement) `#problem-statement`
   - 1.2 [What This System Is](#12-what-this-system-is) `#what-this-is`
   - 1.3 [Design Principles](#13-design-principles) `#design-principles`
   - 1.4 [What Success Looks Like](#14-what-success-looks-like) `#success`
2. [The Experience](#2-the-experience)
   - 2.1 [First Run: Migration](#21-first-run-migration) `#first-run`
   - 2.2 [Registration](#22-registration) `#registration`
   - 2.3 [Querying: Progressive Disclosure](#23-querying-progressive-disclosure) `#querying`
   - 2.4 [Structured Project Profile](#24-structured-project-profile) `#project-profile`
   - 2.5 [Field Enrichment](#25-field-enrichment) `#enrichment`
     - 2.5.1 [What Happens When Things Go Wrong](#251-what-happens-when-things-go-wrong) `#error-handling`
   - 2.6 [The Details That Matter](#26-the-details-that-matter) `#details`
   - 2.7 [Task Queue](#27-task-queue) `#task-queue`
   - 2.8 [Async Execution](#28-async-execution) `#async-worker`
   - 2.9 [Cross-Project Queries](#29-cross-project-queries) `#cross-project`
   - 2.10 [Port Registry](#210-port-registry) `#port-registry`
   - 2.11 [Capability Declarations](#211-capability-declarations) `#capability-declarations`
   - 2.12 [Portfolio Memory](#212-portfolio-memory) `#portfolio-memory`
     - 2.12.1 [Deferred Aspirations](#2121-deferred-aspirations) `#deferred-aspirations`
   - 2.13 [Project Bootstrap](#213-project-bootstrap) `#project-bootstrap`
   - 2.14 [Desktop Control Panel](#214-desktop-control-panel) `#desktop-app`
     - 2.14.1 [Auto-Update](#2141-auto-update) `#auto-update`
   - 2.15 [Project Health Assessment](#215-project-health-assessment) `#health-assessment`
3. [System Behavior](#3-system-behavior)
   - 3.1 [Core Capabilities](#31-core-capabilities) `#capabilities`
   - 3.2 [Things the System Keeps Track Of](#32-things-the-system-keeps-track-of) `#entities`
   - 3.3 [Rules and Logic](#33-rules-and-logic) `#rules`
   - 3.4 [External Connections](#34-external-connections) `#connections`
   - 3.5 [Performance Expectations](#35-performance-expectations) `#performance`
4. [Boundaries and Constraints](#4-boundaries-and-constraints)
   - 4.1 [Scope](#41-scope) `#scope`
   - 4.2 [Platform and Environment](#42-platform-and-environment) `#platform`
   - 4.3 [Hard Constraints](#43-hard-constraints) `#hard-constraints`
   - 4.4 [Anti-Patterns](#44-anti-patterns) `#anti-patterns`
   - 4.5 [Testing Discipline](#45-testing-discipline) `#testing-discipline`
5. [Implementation Architecture](#5-implementation-architecture)
   - 5.1 [Monorepo Structure](#51-monorepo-structure) `#monorepo`
   - 5.2 [Schema Compatibility](#52-schema-compatibility) `#schema`
   - 5.3 [TypeScript-Specific Decisions](#53-typescript-specific-decisions) `#ts-decisions`
   - 5.4 [Native Binding Hygiene](#54-native-binding-hygiene) `#native-binding-hygiene`
6. [Reference and Prior Art](#6-reference-and-prior-art)
   - 6.1 [Inspirations](#61-inspirations) `#inspirations`
   - 6.2 [Ecosystem Context](#62-ecosystem-context) `#ecosystem-context`
   - 6.3 [Porting History](#63-porting-history) `#porting`
7. [Satisfaction and Convergence](#7-satisfaction-and-convergence)
   - 7.1 [Satisfaction Definition](#71-satisfaction-definition) `#satisfaction`
   - 7.2 [Convergence Strategy](#72-convergence-strategy) `#convergence`
   - 7.3 [Observability](#73-observability) `#observability`
   - 7.4 [What the Agent Decides](#74-what-the-agent-decides) `#agent-decides`

Appendices:
- [A: Decision Rationale](#appendix-a-decision-rationale)
- [B: Glossary](#appendix-b-glossary)
- [C: Deferred Futures](#appendix-c-deferred-futures)
- [D: MCP Tool Reference](#appendix-d-mcp-tool-reference)

---

## 1. Vision and Principles

### 1.1 Problem Statement {#problem-statement}

A person with many projects -- code, research, planning, personal -- scatters project presence across many surfaces: filesystem directories, AI tools, knowledge tools, task managers. Each surface reinvents project discovery, each tool extracts its own partial view of project metadata through lossy heuristics, and no single place answers "what are all my projects, what state are they in, and where do they live?"

Setlist is the structured, queryable answer. It provides authoritative project identity, capability declarations, portfolio memory, port allocation, task dispatch, and cross-project intelligence through a local SQLite database, an MCP server, a CLI, a library, and a desktop control panel. Consumers that reason about "my projects" — Chorus, Ensemble, agent harnesses, the user themselves through the desktop app — query Setlist rather than scanning the filesystem or maintaining their own shadow indexes.

### 1.2 What This System Is {#what-this-is}

Setlist is a TypeScript monorepo providing the Project Registry as four npm packages:

- **@setlist/core** -- The library. All registry logic: project identity, field model, variable-depth querying, filtering, migration, port management, capability declarations, portfolio memory (retain/recall/reflect), task queue, cross-project queries, batch operations. Importable from any Node.js process. This is what Chorus, Ensemble, and the desktop app consume directly.

- **@setlist/mcp** -- The MCP server. A thin translation layer wrapping @setlist/core as 39 MCP tools via @modelcontextprotocol/sdk, using stdio transport managed by Claude Code's lifecycle.

- **@setlist/cli** -- The CLI. Terminal commands for project management, migration, worker installation, and diagnostics. Entry point: `setlist`.

- **@setlist/app** -- The desktop control panel. An Electron application providing a visual surface for project management: a card-grid dashboard of all projects, tabbed project detail views, and project CRUD operations. The main process imports @setlist/core directly via an IPC bridge to the renderer. Consumes design tokens from the `chorus-ui` package (Tailwind CSS 4, Radix UI). Launchable as a standalone macOS .app bundle or via `setlist ui` from the CLI.

The four packages share the same SQLite database (schema v11) at `~/.local/share/project-registry/registry.db`. Library consumers (Chorus, Ensemble) import `@setlist/core` directly rather than opening the file.

### 1.3 Design Principles {#design-principles}

**Invisible infrastructure, operable surface.** The registry is both a data layer that producers and consumers use without the user's awareness, and a directly operable control panel when the user wants to see and manage their project landscape. During normal agent-driven work, the registry is invisible — agents read and write through MCP tools and library imports without surfacing the registry itself. But the user can open the desktop app at any time to browse projects, edit metadata, archive old work, or simply see the state of their ecosystem. These two modes coexist: the control panel reads and writes the same database the agents use, and changes from either surface are immediately visible to the other.

**Filesystem-first.** The database is a durable file on the local filesystem. No cloud service required. Any tool that can open a SQLite database can read the registry.

**Visible, stoppable, self-managing.** Background processes (MCP server, async worker) are acceptable when they meet three criteria: visible, stoppable, and self-managing.

**Progressive disclosure.** Data is available at variable depth. Summary for ambient context, standard for reasoning, full for deep context.

**Elasticity over prediction.** The field model accommodates fields that do not yet exist without schema changes, code modifications, or restarts.

**Atomized identity.** Project identity is composed of independent, typed fields. Each field has one authoritative producer. Producers write to disjoint field sets.

**Registration, not discovery.** Projects exist because something explicitly registered them. The registry does not scan the filesystem looking for projects.

**Definition is truth.** Producers define project identity; consumers derive from it. The registry is the authoritative source.

**Bounded-file discipline.** Free-form surfaces carry explicit token/line ceilings, enforced at write time, selected for compactness not comprehensiveness. The existing project-digest ceiling (500–800 target, 1200 hard cap) is the first concrete manifestation; any future free-form surface — event feeds, additional digest kinds, session summaries — inherits the same discipline. Informed by `chiefautism/claude-intel` (see §6.1), whose five-file knowledge taxonomy treats each file as a surgically-edited bounded surface rather than an append-only log.

**Additional principle for Setlist:**

**Library-first, server-second.** @setlist/core is the primary interface. The MCP server, CLI, and desktop app are thin wrappers. Any capability available through MCP, CLI, or the UI must first be available as a library function. Chorus and Ensemble import @setlist/core directly; they never spawn subprocesses or connect to servers for registry operations.

**Shared design language.** The desktop app consumes `chorus-ui`, an extracted design token package providing CSS custom properties and TypeScript constants for the shared visual language (terracotta accent, warm charcoal surfaces, Inter typeface). Setlist and Chorus are separate products that coexist in the same ecosystem — sharing design tokens from a single source makes them feel like siblings, not strangers. The tokens are imported as `chorus-ui/tokens.css` (CSS custom properties on `:root`) or `chorus-ui/tokens` (TypeScript constants).

### 1.4 What Success Looks Like {#success}

- Every project in the ecosystem is registered with structured identity (name, area, type, description, goals, topics, tech-stack, patterns) and discoverable through `list_projects`, `get_project`, and `search_projects`.
- Chorus imports `@setlist/core` and calls `listProjects()` at launch. No subprocess, no MCP server needed.
- Ensemble imports `@setlist/core` and retains/recalls memories during agent orchestration.
- Agents call MCP tools (`retain`, `recall`, `reflect`, `feedback`, `correct`) to accumulate portfolio memory across sessions; memory survives restarts and is shared across consumers.
- Capability declarations are registered by each project (`register_capabilities`) and discoverable across the ecosystem (`query_capabilities`) — answering "which project exposes capability X."
- Port allocation across projects is conflict-free (`claim_port`, `release_port`, `discover_ports`) and recoverable after crashes.
- Cross-project queries (`cross_query`, `portfolio_brief`) return ranked results grounded in the registry's structured fields.
- Composite project health assessment (`assess_health`) returns a qualitative tier (green/yellow/red) combining activity, completeness, and outcome signals.
- Per-project essence digests (`get_project_digest`, `get_project_digests`, `refresh_project_digest`) carry free-form summaries suitable for embedding, semantic matching, or drop-in cross-project context. Digests are versioned deterministically — by the source spec version for code projects, or by a file-tree hash for non-code projects whose content lives in heterogeneous documents. The generator defaults to a hosted provider (Gemini 2.5 Flash-Lite via OpenRouter) with a local MLX fallback and extracts markdown from PDFs and Office documents when needed.
- Behavioral correctness is carried by the 118-scenario holdout set in `.fctry/scenarios.md` (see §4.5 `#testing-discipline`), evaluated by LLM-as-judge; vitest is available for targeted unit tests against @setlist/core where a fast, local signal is useful.
- The desktop app launches as a standalone macOS .app and via `setlist ui`. It displays a card grid of all registered projects, allows navigating to project detail tabs, and supports registering, editing, archiving, and renaming projects through the UI.
- Changes made through the desktop app are immediately visible to agents via MCP and library import. Changes made by agents are visible in the desktop app on next render.
- The desktop app enforces single-instance: launching a second instance activates the existing window.
- Auto-update delivers signed and notarized release builds over two user-selectable channels (stable, beta) without disrupting the user's session.

### 1.5 Origin and Port History {#origin}

Setlist originated as a TypeScript port of `project-registry-service`, a Python implementation that served the registry role through spec 1.3 and schema v8. The port landed at full behavioral parity — 27 MCP tools matching the Python server's surface, schema v8-compatible — and has since evolved beyond parity.

Schema has advanced three versions past the port point: v9 added the `observation` memory type, v10 introduced unified memory types and chorus-compatible fields (belief classification, temporal validity, entity extraction, procedural versioning), and v11 introduced the canonical areas table with first-class `area_id` and `parent_project_id` columns on projects. The MCP tool surface grew from 27 to 36: the 9 additions introduced with the rewrite are `enrich_project`, `write_fields`, `portfolio_brief`, `rename_project`, `bootstrap_project`, `configure_bootstrap`, `assess_health`, `set_project_area`, and `set_parent_project`. Other surfaces that did not exist in the Python implementation: area-scoped memory inheritance, composite project health assessment, the Electron control panel, signed and notarized auto-update, and the shared design system with Chorus.

The Python implementation is retired as a runtime as of spec version 0.19. It is not invoked from any wired MCP or library consumer, and the "shared database contract" claim in earlier spec versions (0.18 and prior) reflected the port period and no longer describes current operation. Appendix A retains the Python→TypeScript module map as retrospective reference for anyone tracing behavioral lineage between the two trees.

---

## 2. The Experience

The registry's primary "users" are programs — producers that write data and consumers that read it. The desktop control panel (section 2.14) adds a direct human surface, but the programmatic interfaces remain the backbone. This section describes the experience from the perspective of producers, consumers, and (for the desktop app) the human user.

### 2.1 First Run: Migration {#first-run}

The registry's first useful act is to absorb existing projects. The user's ecosystem has approximately 40 projects spread across `~/Code/` (code projects, some with fctry specs and synopsis blocks) and `~/Projects/` (non-code projects, some with `brief.md` files).

A migration capability scans these conventional locations, extracts whatever metadata already exists from each project, and proposes registrations. The migration is not silent -- the user can review what was found and what will be registered before it commits. This is the one moment the user is aware of the registry: they see their existing project landscape reflected back to them as structured data for the first time. The CLI command is `setlist migrate`.

**What the migration extracts:**

- For projects with fctry specs: the NLSpec v2 synopsis block contains structured fields -- short description, medium description, readme description, tech stack array, patterns array, goals array. These map directly to registry fields and are captured as structured data, not re-extracted via regex.
- For projects with `brief.md` files: a natural-language description and possibly goals can be extracted from the brief content.
- For projects with only a directory name: the name is derived from the directory name, the type is set to `project` (directory location alone cannot distinguish projects from areas of focus), and the path is stored. The entry is sparse but present.

**Display name derivation during migration:**

Migration derives a `display_name` for every project. If a project has an fctry spec with a `title` field in its frontmatter, that title becomes the display_name. Otherwise, the display_name is derived from the directory slug by replacing hyphens and underscores with spaces and title-casing the result (e.g., "project-registry-service" becomes "Project Registry Service"). Every migrated project gets a display_name -- it is never absent after migration.

**Port discovery during migration:**

After extracting project identity, the migration also scans each project's config files for port patterns -- dev server ports in `vite.config.ts`, `--port` flags in `package.json` scripts, port mappings in `docker-compose.yml`, `PORT=` assignments in `.env` files, and similar patterns in common dev config files. Discovered ports are proposed as port claims alongside the project registrations. The user reviews both identity and port proposals before committing. If a discovered port clashes with one already proposed for another project, the migration skips that port with a note (it does not fail the whole project's registration). Service labels are derived from context -- a port found in `vite.config.ts` is labeled "vite dev server," a port from `docker-compose.yml` gets a label from the service name.

**After migration:**

Every discoverable project has a registry entry. Rich projects have rich entries. Sparse projects have sparse entries. No project that exists on disk in the conventional locations is missed. Projects with port-bearing config files also have their port allocations registered, preventing collisions from the start.

### 2.2 Registration {#registration}

Registration is the act of creating or updating a project entry in the registry. It is a programmatic operation performed by producers.

**Creating a new project entry:**

A producer provides the seven core identity fields: name, display_name, type (any name from the user-managed `project_types` table), status, description, goals, and area (any name from the user-managed `areas` table, or null). Display_name, description, and goals may be empty strings for sparse entries but are always present in the record. Area is nullable forever — a project may be registered without one and assigned later. If display_name is not provided, it defaults to name. The producer also typically provides at least one filesystem path where the project lives. Extended fields (tech stack, patterns, stakeholders, timeline, domain) are provided if the producer has them.

A project may also optionally declare a **parent project** at registration time, making it a sub-project of another registered project. This is a structural relationship, not a field — the parent link is stored as a first-class foreign key. Cycles are rejected at write time (see §3.3). A sub-project inherits nothing automatically from its parent: area, goals, and memory scope are independent. The parent link exists to express "this project belongs to that one" for navigation and visual grouping, not to propagate state.

The registration completes and the project is immediately queryable. No manual step, no approval, no configuration. A subsequent query for the project by name returns all fields that were provided.

In TypeScript, the library call is:

```typescript
import { Registry } from '@setlist/core';
const registry = new Registry();
registry.registerProject({ name, displayName, type, status, description, goals, paths, area, parentProject });
```

**Registration from fctry:**

When a user runs `fctry:init` for a new code project, fctry's interview process produces structured identity: descriptions, tech stack, patterns, goals. fctry registers the project in the registry, writing core identity fields (name, display_name, type=project, status=active, description, goals, optional area, optional parent_project) and code-specific extended fields (tech stack, patterns). The display_name is typically derived from the spec's title field.

**Registration from Chorus:**

When a user uses Chorus to set up a non-code project, Chorus's guided flow produces structured identity: description, goals, stakeholders, timeline, domain context. Chorus registers the project with core identity and non-code extended fields. The project does not have tech stack or pattern fields -- those simply are not present because they were never written.

**Updating an existing entry:**

A producer can write additional fields to an existing project entry at any time. This is an additive operation: new fields are added, existing fields written by the same producer can be updated, but fields written by other producers are not touched. A sparse migration entry can be enriched later when a producer writes a full set of identity fields.

### 2.3 Querying: Progressive Disclosure {#querying}

Consumers query the registry at variable depth. The registry supports three depth levels, each serving a different use case.

**Summary level:**

Returns name, display_name, type, status, and a one-line description for all projects (or a filtered subset). The summary for all projects must remain compact enough for agents to load as ambient context without materially impacting their context budget. Summary compactness is a design constraint, not just a convenience -- as the registry grows from 40 to 100+ projects, agents that load all project summaries at session start get persistent background awareness of the ecosystem, but only if that summary remains lightweight. No extended fields (tech stack, goals, stakeholders) appear at this level. The display_name provides a human-friendly label (e.g., "Project Registry Service") alongside the slug-style name used for lookups.

**Standard level:**

Returns core identity fields plus consumer-relevant extended fields. For a code project, this includes tech stack, patterns, and goals. For a non-code project, this includes stakeholders, timeline, and domain. This is enough for an agent to reason about a specific project's purpose and nature. Standard level contains meaningfully more information than summary but meaningfully less than full.

**Full level:**

Returns everything the registry knows about a project: every field from every producer, every known filesystem path, every piece of metadata. This is the complete identity, suitable for deep context building. Nothing is omitted.

**Filtering:**

Consumers can filter queries by type (any name from the user-managed `project_types` table), by status (active, paused, archived, etc.), and by **area** (any name from the user-managed `areas` table, or the literal sentinel `__unassigned__` to match projects with no area). Area filtering is literal: requesting `area=Work` returns only projects whose `area_id` resolves to a row currently named `Work`. There is no descendant inheritance — sub-projects are not included implicitly by virtue of their parent's area. Filtering combines with depth levels -- a consumer can request "summary of all active projects under Work" and receive a compact, filtered result.

**Pull model:**

The registry does not push data to consumers. Consumers read on demand at their chosen depth. There are no notifications, no subscriptions, no webhooks.

**Pattern study: wake-up context snapshot (mindbank).** `portfolio_brief` (see §2.12) is recomputed on every call — it re-reads the registry, re-runs an internal portfolio-scoped recall, and assembles the structured snapshot fresh each time. mindbank (see §6.1, https://github.com/spfcraze/mindbank) proposes pre-computing a small "what matters right now" bundle at session start — pinned items, recent decisions, active procedurals — cached and served cheaply to subsequent calls, rather than recomputing the full brief from scratch each time. Applied to setlist, this would let repeated `portfolio_brief` calls within a session (orchestrator wake-up, desktop app refresh, agent session start) hit a pre-baked snapshot rather than rerunning the full assembly. Open question: what triggers invalidation — on every `retain` (safest but noisy), on a scheduled interval (simple but potentially stale), on an explicit `refresh` flag (pushes the decision to the caller), or some combination. The cache-invalidation answer is load-bearing for whether this pattern is worth adopting at all; until it is resolved, this is a pattern study only, with a natural cross-reference to §3.5 `#performance` where `portfolio_brief` latency targets live. Not adopted.

### 2.4 Structured Project Profile {#project-profile}

Every project carries a **structured profile** — a machine-readable fingerprint that agents and tools use for association, routing, and discovery. The profile sits alongside the human-readable description and replaces the old comma-separated goals string.

**Profile is not area.** Areas (seeded with seven sensible defaults — Work, Family, Home, Health, Finance, Personal, Infrastructure — and user-managed thereafter) are structural — they live in a dedicated `areas` table and attach to projects via a first-class `area_id` column, not as a profile field. Area governs grouping, filtering, and memory scope inheritance. Goals, topics, entities, and concerns remain profile fields that agents freely enrich. An agent never writes area through `enrich_project`; it uses the dedicated `set_project_area` tool.

**Profile fields:**

- **Goals** (array of strings) — What this project is trying to achieve. Each goal is a semantic anchor: agents match tasks to projects by goal alignment, Knowmarks associates incoming knowledge against goals, and the orchestrator routes work by goal relevance. Goals are durable — they change when the project's direction changes, not with daily activity.

- **Topics** (array of strings) — Domains, technologies, concepts, and subject areas the project involves. Lowercase, hyphenated tokens (e.g., `typescript`, `estate-planning`, `mcp`, `newsletter-automation`). Topics are the primary signal for cross-project association: Knowmarks matches bookmarks against topics, agents find related projects by topic overlap.

- **Entities** (array of strings) — Specific things the project references or connects to: other projects, tools, services, people, organizations. Unlike topics (which are categorical), entities are proper nouns (e.g., `chorus`, `better-sqlite3`, `mailchimp`, `claude-code`).

- **Concerns** (array of strings) — What's actively being worked on right now. Ephemeral by nature — concerns rotate as work progresses. An agent checking "what's in flight?" reads concerns. Examples: `desktop-app-v1`, `archive-filesystem`, `voice-sample-collection`.

**How profiles are populated:**

Profiles are populated by agents via a dedicated `enrich_project` tool. An agent reads the project's spec, CLAUDE.md, description, and memories, then writes structured profile data. The tool accepts partial updates — an agent can add topics without touching goals. Multiple agents can enrich the same project; arrays are merged (union semantics, no duplicates).

For initial population of existing projects, agents run a backfill pass across the portfolio. For new projects created via bootstrap, the bootstrapping agent enriches the profile as part of setup.

**Goals migration:**

The structured goals array replaces the legacy comma-separated goals string in the core `projects` table. Existing goals are migrated: the comma-separated string is split into an array and stored in the new format. The `goals` column in the `projects` table becomes a JSON array. Queries that previously read `goals` as a string now read it as a parsed array.

**Queryability:**

Profile fields are stored as JSON arrays in the project record. `cross_query` and `search_projects` search across profile fields. A query like "which projects involve MCP?" matches projects with `mcp` in their topics or entities. `list_projects` at standard depth includes the profile.

### 2.5 Field Enrichment {#enrichment}

A project's identity grows over time. The atomized field model means any producer can add fields to any project at any time without coordinating with other producers.

**Two producers writing to the same project:**

Consider a code project initially registered by fctry with core identity and technical fields (tech stack, patterns). Later, Chorus writes its own fields to the same entry -- perhaps conversation context, stakeholder information, or domain context that Chorus captured but fctry did not. After both writes, the project entry contains the union of all fields from both producers. fctry's fields are unchanged. Chorus's fields are also present. There is no merge conflict because the producers operate on disjoint field sets.

**Enriching sparse entries:**

A project registered during migration with only a name, type, path, and status can later be enriched by any producer. The original fields are preserved and the new fields are added alongside them. The entry transitions from sparse to rich without re-registration.

#### 2.5.1 What Happens When Things Go Wrong {#error-handling}

| What Went Wrong | What the Consumer/Producer Sees | What It Can Do |
|----------------|-------------------------------|----------------|
| Registry database does not exist | A clear error indicating the database has not been initialized | Run migration or create an empty registry |
| Query for a project that does not exist | Library API: an empty result (null/undefined), not an error. MCP server: a structured `Error [NOT_FOUND]` with a suggestion for next steps. When the queried name is close to an existing project name (e.g., "project-registy" vs. "project-registry-service"), the error includes a "did you mean?" suggestion with the closest match. | Distinguish "not found" from "registry broken"; retry with the suggested name if appropriate |
| Query when registry is empty | An empty collection, not an error or crash | The consumer knows the registry is working but unpopulated |
| Producer writes a field not in the default catalog | The field is accepted and stored | Query at full depth to see the custom field |
| Duplicate registration (same name or same path) | The system handles this gracefully -- either rejects with a clear reason or recognizes it as the same project | Existing data is never silently overwritten or duplicated |
| Registered path no longer exists on disk | The orphaned path remains in the registry (does not self-heal) | Manual cleanup; future versions will detect orphaned data |
| Assigning an area name that does not exist in the user's current `areas` table | A structured `Error [INVALID_AREA]` naming the rejected value and listing the area names that currently exist | Retry with an existing area name, add the area in Settings → Areas first, or pass null to leave unassigned |
| Setting a parent that would create a cycle (the proposed parent is a descendant of the child) | A structured `Error [PARENT_CYCLE]` with the exact message: "Cannot set parent: {child-name} is a descendant of {project-name}. Moving it would create a cycle." | Pick a different parent, or restructure the chain manually |
| Setting a parent that does not exist | A structured `Error [NOT_FOUND]` with a did-you-mean suggestion | Retry with the suggested name |

### 2.6 The Details That Matter {#details}

**Empty fields are absent, not null.** If a project has no tech stack, the tech stack field is simply not present in the response -- not an empty array, not a null, not a placeholder string. A consumer never has to check whether a field is "real" or "empty."

**Description quality matters.** Natural-language description and goals fields are the foundation for semantic reasoning by agents. These fields must preserve the richness of their source material. A description authored by a human during fctry's interview or Chorus's guided flow should be stored verbatim, not summarized or truncated.

**Structured fields are structured.** Tech stack is a list, not a comma-separated string. Patterns are enumerated, not prose. Consumers can iterate over structured extended fields without parsing. Goals are a JSON array of strings — each goal is a distinct semantic anchor, not a prose paragraph. Topics, entities, and concerns follow the same pattern.

**Paths are exact.** The registry stores the exact filesystem path provided during registration. It does not normalize, relocate, or validate paths against conventions.

### 2.7 Task Queue {#task-queue}

The registry accepts async work items from agents. A task is a description of work to be done, optionally scoped to a project, with a schedule.

**Queueing a task:**

An agent calls `queue_task` with a natural-language description of the work, an optional project name, and a schedule (`now`, `tonight`, `weekly`). The registry creates a task entry with status "pending" and returns a task ID.

**Project-scoped tasks:**

When a task has a project, the async worker executes it in that project's working directory with its CLAUDE.md and .mcp.json context. The CC session spawned for the task has the same environment as if the user had opened Claude Code in that project manually.

**Global tasks:**

When a task has no project, the async worker executes it in a neutral context. Global tasks are useful for cross-project work.

**Scheduling:**

- `now` -- eligible for immediate execution on the next worker cycle
- `tonight` -- eligible for execution after the user's configured quiet hours begin (default: after 10pm local time)
- `weekly` -- recurring task, re-queued after completion

**Cross-project task dispatch:**

An agent can dispatch the same task to multiple projects at once by providing a project filter instead of a single project name. Calling `queue_task` with a filter (e.g., `type=project, status=active`) fans out into N individual tasks -- one per matching project. Each fanned-out task is a first-class task entry, indistinguishable from a task that was individually queued. The fanned-out tasks run independently through the existing async worker; one failure does not block or cancel the others. The response from the dispatch call reports how many tasks were created and lists the affected project names.

**Listing tasks:**

An agent calls `list_tasks` to see pending, running, and completed tasks. Filters by status and project are supported. Each task entry includes: ID, project (if any), description, status, schedule, creation time, and (for completed tasks) the session reference.

### 2.8 Async Execution {#async-worker}

A lightweight launchd periodic job checks the task queue and executes pending tasks by spawning Claude Code sessions.

**The worker lifecycle:**

The async worker is a launchd plist that runs periodically (configurable interval, default: every 15 minutes). On each run, it:
1. Opens the registry database
2. Checks for tasks whose schedule makes them eligible (now → always eligible; tonight → eligible during quiet hours, default 10 PM–6 AM; weekly → always eligible, re-queued on completion)
3. For each eligible task, transitions it to "running" status
4. Spawns a Claude Code session: `claude -p "<task description>" --output-format json` in the project's working directory
5. Captures the session ID from CC's JSON output
6. On completion, transitions the task to "completed" and stores the session ID as the result reference
7. Exits (the worker is not a persistent process)

The worker script is `node packages/cli/dist/worker.js`.

**Task results are session references:**

The registry does not store the full output of a CC session. It stores the session ID, which is sufficient to locate the session's JSONL file and resume or review it.

**Failure handling:**

If a CC session exits with an error, the task transitions to "failed" with the exit code and a brief error message. Failed tasks can be retried via `queue_task` with the same description.

**Crash recovery:**

If the worker process terminates unexpectedly, the system restarts it immediately rather than waiting for the next scheduled cycle. The worker remains a run-and-exit process, not a persistent daemon.

**Working directory:**

The worker process runs with an explicit working directory set to the registry's data directory. This prevents path-related failures regardless of how the system service manager launches the process.

**Pre-deploy validation:**

The worker install command validates the runtime environment before loading the service definition. It verifies that Node.js exists, that @setlist/core can be imported, and that the database is accessible. If validation fails, the install aborts with a clear error.

**Startup sentinel:**

On every worker cycle, the first action is emitting a startup log line with the process ID and timestamp. If this line never appears in the log, the worker died before reaching application code.

**Visibility:**

The worker is visible via `launchctl list | grep setlist`. It can be stopped via the system service management commands. It is self-managing.

**Pattern study: sync / maintain / ask as a worker job catalog (lerim-cli).** The current async worker has one first-class background operation (reflection) and a generic task queue that executes whatever the caller puts on it. lerim-cli (see §6.1, https://github.com/lerim-dev/lerim-cli) proposes a more structured split of the background agent into three named flows: **sync** — extract memory from fresh session transcripts as they land; **maintain** — consolidate, dedupe, summarize, and archive memory on idle cycles; **ask** — serve queries and recall for the foreground agent. Applied to setlist, this would give the worker a concrete job catalog beyond reflection — `sync` as the explicit home for transcript-driven retain, `maintain` as the explicit home for dedup/compaction/archival cycles (today diffused across `reflect` and implicit cleanup), and `ask` as a recall-serving path if the worker ever hosts a long-lived query surface. Open question: how this maps onto setlist's existing `queue_task` / `list_tasks` / `reflect` surface — in particular, whether `sync` meaningfully overlaps with the already-specified pattern of Chorus populating entities / memories from live transcripts (§2.12), and whether carving out `maintain` as its own lane adds clarity or just relabels what reflection already does. Scope TBD; not adopted. Retained as a shaping lens for the next evolve that touches the worker, not as a commitment to rename or restructure anything today.

### 2.9 Cross-Project Queries {#cross-project}

The registry can synthesize answers across all projects, drawing from structured registry data, portfolio memories, and Claude Code's per-project auto-memory files.

**The query experience:**

An agent calls `cross_query` with a natural-language question and a scope. The registry searches across the specified sources, collects relevant information, and returns a synthesized answer.

**Sources:**

- **Registry fields** (scope="registry") -- searches project names, descriptions, goals, tech stacks, patterns, and other extended fields. Fast, self-contained, no filesystem access needed.
- **Structured memories** (scope="memories") -- delegates to `recall` to search the portfolio memory store. Memories are typed, scored, and reinforced by outcomes -- a decision memory that led to a successful build ranks higher than a stale pattern note.
- **Registry + memories + CC auto-memory** (scope="all") -- searches all three sources: registry fields, structured memories via recall, and CC's per-project `MEMORY.md` files at `~/.claude/projects/<encoded-path>/MEMORY.md`. Richest results but requires filesystem access.

**What this enables:**

- "Which projects use SQLite?" → lists projects with SQLite in tech_stack or descriptions
- "What authentication patterns have I used?" → draws from registry fields and memory files
- "What's the status of all my active projects?" → registry field query, fast and structured
- "What did I decide about caching in the knowmarks project?" → scoped cross_query targeting one project's memory

**Response format:**

The response is a synthesized answer, not a raw data dump. It identifies which projects are relevant, quotes or paraphrases the relevant information, and cites the source (registry field vs. memory file).

**Attribution:**

Cross-project query results include producer and timestamp attribution -- which producer wrote the matched data and when it was last updated.

**Freshness and importance scoring:**

Cross-project query results are ranked by a combination of relevance, freshness, and importance -- not returned as a flat, unordered list. Recent matches outrank older ones through time-decay weighting on the existing `updated_at` timestamps. Matches containing high-signal keywords (e.g., "decision", "architecture", "critical", "breaking change") receive an importance boost. Core identity fields (name, type, status) are treated as evergreen and do not decay. The scoring is deterministic and runs entirely within the existing SQLite query.

### 2.10 Port Registry {#port-registry}

The registry manages port allocation across all project services -- dev servers, databases, MCP servers, debuggers, websockets, anything that binds a port. Ports are a shared, finite resource across the ecosystem; the registry ensures no two projects claim the same port.

**Claiming a port:**

An agent or producer calls `claim_port` with a project name, a port number (or omits it for auto-allocation), a service label describing what uses the port (e.g., "dev server", "postgres", "MCP debug"), and an optional protocol (tcp, udp; defaults to tcp). If the requested port is available, the claim succeeds and the port is associated with the project. If the port is already held by another project, the claim fails with a clear error identifying the current owner.

**Auto-allocation:**

When an agent needs a port but has no preference, it omits the port number. The registry allocates the next available port from the range 3000--9999 and returns it.

**Releasing a port:**

An agent calls `release_port` with a project name and port number. The port is freed and becomes available for other projects. Releasing a port that is not claimed by the specified project is a no-op (not an error).

**Checking port availability:**

An agent calls `check_port` with a port number and receives one of two responses: the port is available, or the port is claimed by a specific project for a specific service.

**Static and dynamic claims:**

Ports can be claimed at any time. During project setup, a producer may claim well-known ports for the project's standard services (static registration). During development, an agent may claim additional ports as needed (dynamic registration). Both use the same mechanism. Port claims persist until explicitly released.

**Port discovery:**

An agent or producer can discover ports for any registered project at any time by calling `discover_ports`. This scans the project's filesystem paths for config files that contain port patterns and claims the found ports. Discovery is useful for projects that were registered before the port registry existed, or for projects whose config files have changed.

Service labels are derived from the config file context. A port in `vite.config.ts` becomes "vite dev server." A port from the `postgres` service in `docker-compose.yml` becomes "postgres (docker-compose)." A `PORT=` line in `.env` becomes "env PORT."

**Archive-triggered port cleanup:**

When a project is archived, its port claims are automatically released. Archiving a project removes its active footprint from the ecosystem -- metadata and history remain queryable, but active resources like ports are freed.

**Ports in context switching:**

When an agent calls `switch_project`, the response includes the project's port assignments alongside paths, status, and workspace metadata.

### 2.11 Capability Declarations {#capability-declarations}

Projects declare their capabilities in the registry -- a structured map of every integration surface they expose. Capabilities are the answer to "what can this project do?" from the perspective of another project or agent trying to connect to it.

**What a capability is:**

A capability is any integration surface another app, agent, or script might need to connect to. For code projects: MCP tools, CLI commands, API endpoints, databases, and library functions. For non-code projects and areas of focus: skills, agents, prompt templates, and workflows. The type field is an open string. Each capability declaration is rich: a name, a type, a description of what it does, what it accepts (inputs/parameters), and what it returns (output shape).

**Granularity principle:**

A capability is one callable thing — not a feature, not a category, not a summary of related functionality. The test: could an agent invoke this capability with a single call and get a result? If the answer is no, it is too coarse.

- Each MCP tool is its own capability. A project exposing 40 MCP tools registers 40 capabilities, not 8 feature groups.
- Each CLI command is its own capability.
- Each API endpoint is its own capability.
- Each library function meant for external consumption is its own capability.

Do not register internal features, architectural patterns, or design decisions. "memory-system" is not a capability — `ctx_remember`, `ctx_search`, and `ctx_recall` are. "mail-triage" is not a capability if it names a workflow composed of multiple tools — register each tool individually.

The name field should match the actual callable identifier (the MCP tool name, the CLI command, the endpoint path). The type field should be `tool`, `cli-command`, `api-endpoint`, `library`, `connector`, or another concrete integration type — never `feature`.

Data sources and connectors are also valid capabilities. A connector represents a specific integration that brings external data into the project — each one individually registered. Connectors answer "what data sources does this project have access to?" which is valuable for cross-project discovery even though connectors are not directly invocable by an external agent.

This matters because `query_capabilities` and `cross_query` match against individual capabilities. Bundled registrations hide the specific thing an agent is searching for inside a description blob, defeating the purpose of structured discovery.

**Writing capabilities:**

A producer writes a project's capabilities by providing the complete set of capability declarations for that project. Each write uses **replace semantics** -- the new set replaces the previous set entirely. This ensures the registry always reflects what the code actually exposes, not a stale accumulation.

**fctry as the first capability producer:**

fctry writes capability declarations after builds, not during spec writing. Capabilities reflect code reality -- what was actually built.

**Discovering capabilities:**

An agent calls `query_capabilities` to discover what capabilities exist across the ecosystem. The query supports:

- **By project:** "What capabilities does ctx expose?"
- **By type:** "What MCP tools exist across the ecosystem?"
- **By keyword:** "Who can do mail search?"
- **Combined:** "What API endpoints does Archibald expose?"

**Archive-triggered capability cleanup:**

When a project is archived, its capability declarations are cleared.

**Invocation metadata:**

Capability declarations optionally include invocation metadata:

- **requires_auth** -- whether invoking this capability requires authentication or human approval.
- **invocation_model** -- the capability's execution pattern: `sync`, `async`, or `streaming`.
- **audience** -- who the capability is designed for: `agent`, `developer`, or `end-user`.

All three fields are optional. Capabilities without invocation metadata remain valid and discoverable.

**Setlist self-registration:**

Setlist self-registers its own capabilities on every MCP server startup. The operation is idempotent and silent — if the registry already reflects the running code, the startup hook does no writes and emits no log lines; drift, partial state, or a missing registration heals automatically on the next start. Setlist is a capability producer like any other project, subject to the same replace semantics described above; it is not a special case in the data model. Nothing in the registry schema or `register_capabilities` contract changes to accommodate it.

Three surfaces are registered on startup, each introspected directly from the running code:

- **MCP tools** — every tool the server exposes (currently 39), registered with `type: tool`. The source of truth is the tool-registration array in the MCP server entrypoint; whatever the server is about to expose to clients is what lands in the registry.
- **CLI commands** — every top-level subcommand in `@setlist/cli` (e.g., `migrate`, `digest refresh`, `ui`), registered with `type: cli-command`. The source of truth is the command-registration structure in `packages/cli/src/index.ts`.
- **Library exports** — every public export from `@setlist/core`, registered with `type: library`. The source of truth is the package's public API entrypoint (`packages/core/src/index.ts`).

Introspection is the source of truth — no hand-maintained `capabilities.json` seed ships with the package, no post-build hook writes a snapshot. Whatever is callable is what is registered. Drift between declared and actual capabilities is structurally impossible: the next startup rewrites the declaration from the running code.

**First-run behavior:** on a fresh registry, the MCP server ensures the `setlist` project row exists before writing capabilities. If it is missing, the server creates it with canonical defaults — `area: Infrastructure`, `type: project`, and a description identifying it as the TypeScript project registry — then proceeds with the three capability writes. This is safe because setlist is the registry; it is writing to its own database.

**Failure isolation:** the three surfaces are introspected and registered independently. If reflection on CLI commands fails (for example, because the CLI package has not been built), the MCP tool and library registrations still complete. The server logs one warning line identifying the surface that failed and continues its normal startup; it never crashes or refuses to serve MCP traffic because of a self-registration error.

### 2.12 Portfolio Memory {#portfolio-memory}

The registry maintains a structured memory store that transforms it from a static project phone book into a learning system. Agents retain decisions, outcomes, patterns, preferences, dependencies, corrections, learnings, observations, and procedural memories as typed entries. These memories are recalled via budget-controlled FTS5 full-text search today (with vector / graph / RRF-fusion retrieval studied as aspirations in §2.12.1), reinforced by build outcomes, and consolidated through background reflection.

**The three-verb API:**

Memory operates through three verbs: **retain** (write a memory), **recall** (retrieve relevant memories), and **reflect** (consolidate and synthesize in the background).

**Retain: capturing knowledge.**

An agent or producer calls `retain` with content, a memory type, and optional metadata (project, scope, tags, session ID, agent role, is_static, is_inference). The memory is stored immediately and the caller receives an acknowledgment. The hot path is fast -- no LLM processing, no embedding generation, no blocking computation. Enrichment (embedding generation, L0/L1 summary creation, importance scoring) happens asynchronously after the caller has moved on. Static memories (`is_static`) are exempt from time decay and archival. Inference memories (`is_inference`) are flagged as derived rather than directly observed, which affects scoring.

If the same content has been retained before (determined by a content hash of the type and normalized content), the existing memory is reinforced rather than duplicated: its reinforcement count increments and its last-reinforced timestamp updates.

Implementation note: better-sqlite3 is synchronous, which simplifies the hot path for retain (no async overhead for the database write). Enrichment still runs asynchronously via Node.js mechanisms (worker threads, setTimeout callbacks, or similar).

**Proactive contradiction detection:** During retain, after dedup checking, the system searches for existing active memories with the same project scope and high content similarity that may contradict the new memory. This applies to preference and correction types -- the most likely to represent superseding knowledge (e.g., "use Postgres" followed by "use MySQL" for the same project). When embeddings are available and similarity exceeds 0.85 with a different conclusion, the older memory is automatically superseded (same mechanism as the explicit correction flow: `contradicts` edge, original archived). When in FTS5-only mode, exact contradiction detection is unreliable, so potential conflicts are flagged in the retain response for admin review via `inspect_memory` rather than auto-resolved. This complements the explicit correction flow -- corrections handle "I'm telling you this is wrong," while proactive detection handles "I just said something that conflicts with what I said before."

**Memory types:**

- **decision** -- An explicit choice made during development or knowledge work.
- **outcome** -- What happened as a result of an action.
- **pattern** -- A recurring approach or technique observed across sessions.
- **preference** -- An explicit user preference or convention.
- **dependency** -- A relationship between this project and something external.
- **correction** -- An explicit "don't do that" or "actually, use this instead."
- **learning** -- A fact, insight, or discovery made during work. Distinguished from decisions (which are choices) and outcomes (which are results of actions). Learnings are what was found out, not what was decided or what happened.
- **context** -- Ephemeral working memory: background information, intermediate findings, explored-but-abandoned approaches. Context memories decay fastest and are cleaned up aggressively by reflection. They exist so that cross-session context persists without the producing agent managing its own cleanup.
- **procedural** -- A reusable workflow or multi-step technique extracted from repeated work. Procedural memories support versioning: when a workflow is refined, the new version links to its predecessor via `parent_version_id`, and only the current version (`is_current = true`) surfaces in recall. Previous versions remain queryable via `inspect_memory`.
- **observation** -- A cross-project finding produced by portfolio intelligence — a pattern detected, a convergence opportunity identified, a drift noticed, or a dependency inferred. Observations are portfolio-scoped by default and carry a confidence indicator (verified vs. inferred). They represent compounding insight: each observation builds on what was previously retained, so portfolio intelligence improves across sessions rather than rediscovering from zero.

**Per-type decay rates:** Different memory types fade at different rates during recall scoring. Corrections and preferences represent durable knowledge that should persist indefinitely -- they decay very slowly (rate 0.25). Procedural memories and observations decay slowly (rate 0.5) -- they represent synthesized knowledge that took effort to produce. Decisions, dependencies, and learnings decay at baseline rate (1.0). Outcomes and patterns decay faster (1.5) -- they are naturally ephemeral and should be displaced by newer observations. Context memories decay fastest (rate 2.0) -- they are working memory meant to bridge sessions, not persist long-term. The decay rate multiplies the time-decay exponent in recall scoring: a memory with rate 0.25 takes 4x longer to fade than one with rate 1.0. This prevents important conventions from being buried by recent but trivial observations.

**Belief classification and confidence.** Memories optionally carry epistemic metadata:

- **belief** -- Classifies the memory as `fact` (verified), `opinion` (subjective judgment), or `hypothesis` (unverified inference). Null when not classified. Belief classification is orthogonal to type -- a decision can be fact-based or hypothesis-based.
- **confidence** -- A 0.0--1.0 score reflecting how certain the content is. Already present in the schema (used by proactive contradiction detection). The semantic is unchanged.
- **extraction_confidence** -- A 0.0--1.0 score reflecting the quality of the source from which the memory was extracted. Null for manually retained memories. Producers that extract memories from conversations or documents set this to indicate source reliability.

**Temporal validity.** Memories optionally carry temporal bounds:

- **valid_from** -- ISO timestamp marking when the memory becomes applicable. Null means applicable from creation.
- **valid_until** -- ISO timestamp marking when the memory expires. Null means no expiration. Expired memories are not archived automatically -- they still appear in recall but with a temporal penalty in scoring. Reflection may archive memories whose `valid_until` is far in the past.

**Entity extraction.** Memories optionally carry structured entity metadata as a JSON array in the `entities` field. Each entry has a `name` and `type` (person, organization, project, topic). Entity data is denormalized on the memory row for fast single-memory reads. Chorus and other producers populate this during extraction; setlist stores and returns it but does not extract entities itself. Entity overlap is a signal in hybrid retrieval when the caller provides entity context.

**Procedural versioning.** Procedural memories support an in-row version chain via `parent_version_id` (FK to memories.id) and `is_current` (boolean, default true). When a workflow is refined, the producer retains a new procedural memory with `parent_version_id` pointing to the previous version and sets `is_current = false` on the predecessor. Recall filters to `is_current = true` by default. This coexists with the `memory_versions` table, which serves a different purpose: `memory_versions` tracks edit history within a single memory (audit trail), while `parent_version_id` tracks evolution across distinct procedural memory entries (version chain).

**Four-level scoping:**

Memories exist at one of four scope levels:

- **project** -- Scoped to a specific project (most memories).
- **area-of-focus** -- Scoped to an area of focus.
- **portfolio** -- Spans multiple projects but not everything.
- **global** -- Universal to the user.

Scope determines retrieval behavior: a recall for a specific project returns that project's memories plus portfolio and global memories, weighted by relevance. A recall without project context returns portfolio and global memories only.

**Recall: retrieving knowledge.**

An agent calls `recall` with a query (natural language or structured), an optional project scope, and a token budget. Today the memory system searches FTS5 keyword matching against the memory corpus and ranks by a composite score that balances reinforcement strength, temporal recency, and outcome history. The fuller retrieval picture — vector similarity as a second leg, graph traversal as a third, and Reciprocal Rank Fusion across the three — is studied as the end-state for hybrid retrieval; see `#deferred-aspirations` (2.12.1).

The recall response fills the caller's token budget with the highest-scored memories, using tiered content: L0 summaries (one-sentence abstracts) first, expanding to L1 overviews and then full L2 content as budget allows. An adaptive cutoff stops retrieval when scores drop sharply (a "score cliff"). A two-pass progressive-delivery model (fast FTS5 first pass, vector-refined second pass) is studied but not built — see `#deferred-aspirations` (2.12.1) below.

**Bootstrap mode:** An agent starting a new session calls recall with no query and a project scope. This returns the project's memory profile -- its key decisions, active patterns, preferences, and recent outcomes -- suitable for injection into the agent's context at session start. Pinned memories (memories with `is_pinned` set) always surface at the top of bootstrap recall regardless of score.

**Query intent classification (no-op):** The recall system's `classifyIntent()` function is wired into the retrieval path, but the weight-fusion it feeds into requires multiple retrieval legs (vector + graph) that do not exist in the current FTS5-only implementation. Until those legs exist, the classifier runs as a no-op: it categorizes the query (temporal, relational, factual, exploratory) but does not adjust retrieval weights. The studied end-state — per-intent weight profiles across fused legs — is captured in `#deferred-aspirations` (2.12.1) below.

Type-priority budget allocation across memory types (corrections first, then outcomes/learnings, etc.) is studied but not built — see `#deferred-aspirations` (2.12.1).

**Reflect: background consolidation.**

Reflection is a background process that maintains the health and quality of the memory store. It runs on its own schedule -- triggered when cumulative new memory importance exceeds a threshold, on a periodic schedule, or via explicit admin invocation.

Reflection performs the following operations today:

1. **Semantic dedup** -- Finds memories with cosine similarity above 0.95 and merges them. Active only when embeddings are available; otherwise a no-op.
2. **Entity and relationship extraction** -- Identifies entities mentioned in memories and creates or updates graph edges. (Gap detection — finding structural holes where topic clusters sit in isolation — is studied but not built; see `#deferred-aspirations` (2.12.1).)
3. **Summary block rewriting** -- Maintains per-scope summary blocks. (Multi-level hierarchical compaction trees across topic hierarchies are studied but not built; see `#deferred-aspirations` (2.12.1).)
4. **Stale memory archival** -- Archives memories that pass the triple gate: low quality score (below 0.3) AND low access count (fewer than 2 retrievals) AND old age (more than 90 days). All three conditions must be true. This is the operative shipping behavior today.
5. **Enrichment log update** -- Records what reflection did.

(Knowledge distillation — synthesizing new patterns/preferences/procedurals from clusters of related memories — is studied but not built; see `#deferred-aspirations` (2.12.1).)

**Outcome-aware reinforcement:**

Build outcomes feed back into the memory store. When a build succeeds, the memories that were recalled during that build session receive a positive outcome signal. When a build fails, those memories receive a negative signal. The outcome score uses exponential moving average (EMA) with alpha = 0.1.

The feedback flow has two paths:
- **Explicit builds:** fctry reports outcomes per chunk, not per build. Each chunk commit triggers a success signal for all memory IDs that were recalled during bootstrap or error-triggered recall. Failed chunks (retries exhausted) receive a failure signal at build completion. The per-chunk granularity means memories are reinforced as work progresses, not batched at the end.
- **Async tasks:** The worker automatically captures the task result and the memories that were part of the task context.

**Correction flow:**

When a user explicitly corrects the system, the correction creates a new memory of type `correction` with high importance (0.9+). The correction is linked to the memory it corrects via a `contradicts` edge. The corrected memory transitions to `archived` status. In future recalls, the correction surfaces and the contradicted memory does not.

**Embedding provider model:**

The memory system supports three tiers of embedding generation:

- **OpenAI** (text-embedding-3-small, 1536 dimensions) -- Highest quality, requires internet and API key.
- **Local/Ollama** (nomic-embed-text, 768 dimensions) -- Local generation via Ollama. No internet required.
- **None (FTS5-only)** -- No embedding generation. The system works entirely on FTS5 keyword matching and graph traversal. This is the zero-config baseline.

A fourth tier — **native vector search via sqlite-vec** — is studied but not built; see `#deferred-aspirations` (2.12.1). The current implementation ships the three generation tiers above (OpenAI, Ollama, FTS5-only) with application-level cosine computation on stored embedding blobs when a generation provider is active.

The embedding provider is a runtime configuration. Changing providers does not invalidate existing memories. The dual-column pattern (embedding + embedding_new) supports gradual migration between providers. When the provider is set to "none", recall degrades to FTS5-only. When a provider is re-enabled, vector similarity resumes immediately.

**Pattern study: tiered recall and activation-based reinforcement (Engram Memory).** Setlist's current recall scoring already blends importance, similarity, recency, and access count. Engram Memory (see §6.1) formalizes a closely related idea using the ACT-R cognitive-architecture activation equation: each memory carries an activation strength that grows on access and decays exponentially with elapsed time, and the system is structured as a three-tier pipeline where an in-memory hot-tier cache answers repeat queries in sub-millisecond time without touching vector search or disk, multi-head LSH on a Matryoshka prefix of the embedding prunes candidates in O(1) for near-miss queries, and full hybrid vector + BM25 re-ranking runs only on novel queries — with top results self-promoting into the hot tier. This is retained as a pattern study rather than a commitment: setlist remains a project registry with memory, not a general-purpose memory engine. The specific open questions this pattern informs are (a) whether setlist's access-count and reinforcement terms should be re-expressed as an ACT-R activation curve with explicit exponential time decay, so that frequently-accessed memories rise and idle memories fall in a principled rather than ad-hoc way; (b) whether the recall path should acquire a hot-tier activation cache in front of the sqlite-vec / FTS5 layer, so that repeated bootstrap recalls and dashboard refreshes short-circuit the full retrieval pipeline; and (c) whether candidate pre-filtering via LSH on a Matryoshka prefix of the embedding is worth adopting as the memory corpus grows beyond what brute-force cosine comparison handles comfortably. These are evaluations, not decisions — none of them expand setlist's scope, and any adoption would be validated against setlist's existing scenario set before being promoted out of this pattern-study note.

**Pattern study: contradiction detection across the committed corpus (Engram Memory).** Setlist already distinguishes committed beliefs from observations (belief classification) and records explicit corrections that archive the contradicted memory via a `contradicts` edge (see the correction flow above). Engram Memory (see §6.1, https://github.com/agentscreator/engram-memory) extends that model by surfacing conflicts *proactively* — when a new observation or retained fact semantically contradicts an existing committed belief, the conflict is flagged before an agent acts on the stale side of the disagreement. The pattern is not about a new memory type; it is about a new signal on top of the existing corpus: recall and retain can detect and report "these two committed memories disagree" without the user having to call `correct` first. Open question: robust semantic contradiction detection requires embeddings — keyword/FTS5 overlap is insufficient to catch paraphrased contradictions, and the cases where contradiction detection pays off are exactly the ones where the two memories share few literal tokens. This pattern is therefore **gated on the same embedding-tier decision as the existing vector / RRF / progressive-delivery work in this section** — deferred pending resolution of whether setlist ships with OpenAI, Ollama, or FTS5-only as the default embedding posture. Not adopted; no implementation scope committed.

**Pattern study: temporal versioning with soft-delete and an explicit history endpoint (mindbank).** Setlist's schema already carries `valid_from` / `valid_until` columns (temporal validity, schema v10) but does not yet commit to a concrete endpoint shape for accessing prior versions. mindbank (see §6.1, https://github.com/spfcraze/mindbank) models every update as a new version row: the previous version is not mutated; `valid_to` on the superseded row is set to the update timestamp (soft-delete, never destructive); and a dedicated history endpoint returns the full version chain for a given memory ID. This gives setlist a concrete endpoint-shape pattern to study for the temporal-validity work it has already declared. Open question: whether setlist should expose a dedicated `memory_history` MCP tool, or fold the same functionality into `inspect_memory` as an additional parameter (e.g., `inspect_memory(id, includeHistory=true)`). The scope decision — new surface vs. extended surface — is TBD and not committed by this pattern study. Not adopted; pattern catalog entry only.

**Pattern study: named digest-kind catalog (claude-intel).** Setlist's `project_digests` table ships today with a single `essence` kind, but the schema key `(project_id, digest_kind)` already admits a small catalog of named kinds without migration. claude-intel (see §6.1, https://github.com/chiefautism/claude-intel) organizes its per-project knowledge as a fixed taxonomy of five named free-form files — architecture, commands, patterns, gotchas, decisions — each with its own one-line editorial charter and surgical-edit discipline rather than append-only growth. The specific CC filenames are not adopted; this is explicitly producer-agnostic. What the pattern contributes is a shaping lens for an open question: whether setlist's `essence` kind should evolve into a small named catalog (candidates: `essence`, `commands`, `gotchas`, `decisions`) so that different producers can write to disjoint kinds with distinct editorial charters, and consumers can request the slice they need. Open question: which kinds belong in the catalog, what each kind's charter is, and whether `refresh_project_digest` grows a `--kind` argument or stays `essence`-only. Not adopted; no new kinds committed. Pattern catalog entry only.

**Pattern study: typed event-feed ingest surface (claude-intel).** Interactive sessions produce rich tool-use signal that setlist currently discards — the registry sees explicit `retain`/`feedback`/`correct` calls, but nothing from the continuous Edit/Write/Bash activity of an agent at work. claude-intel addresses the equivalent gap in Claude Code with a `PostToolUse` hook writing low-cost JSONL events: `{ts, tool, file}` for Edit/Write/NotebookEdit; `{ts, tool:"Bash", cmd, exit, err}` for Bash; Read/Glob/Grep explicitly skipped as noisy. Rotation discipline caps the feed at 500 lines and tails the most recent 300. Setlist's gap: no uniform surface for streaming session signal into the reinforcement path, so Chorus, Ensemble, fctry, and the orchestrator each invent ad-hoc ways to report session activity (or skip it). The pattern contributes a shaping lens for a potential event-ingest surface — either a new `feed_event` verb or a `feedback` extension — with the JSONL schema (tool + file + exit code + error text for Bash; tool + file for edits) and the noisy-tool-exclusion discipline as the two parts worth borrowing. The bash hook itself is not adopted: setlist is library-first and cross-platform, and the hook is bash-only and CC-specific; producers call into `@setlist/core` directly. The event feed itself is embedding-independent (keyword + tool-success signals), so it does not pattern-gate on the embedding-tier decision; reinforcement weighting over event streams is where embeddings would re-enter, and that's held as a downstream question. Open question: relationship to the existing `feedback` surface — is this a new verb or a parameter extension? Not adopted; pattern catalog entry only.

**Pattern study: stateless read + cursor-based incremental reflection (claude-intel).** Setlist's reflection is threshold-triggered deep consolidation today — run when cumulative new importance crosses a threshold, on schedule, or on admin invocation. It does not include the complementary pattern claude-intel runs: a per-invocation lightweight update layer where the agent reads existing knowledge, tails the event delta since a cursor, surgically updates the relevant bounded-file surfaces, and advances the cursor. The shaping lens is the *separation of concerns* — continuous incremental reinforcement (cheap, per-call, cursor-advancing) vs. threshold-triggered deep consolidation (expensive, rare, what `reflect` does today) — not any specific cadence. The every-recall trigger frequency claude-intel uses is specifically rejected for setlist: `recall` is on the read hot path with multiple concurrent consumers (Chorus, Ensemble, fctry, orchestrator) and cannot carry a write on every call. This pattern study pattern-gates on the event-feed pattern above (Pattern 2) landing first — there must be a typed event stream and a cursor position before a cursor-driven incremental loop has anything to consume. Open question: what triggers the incremental update when it is adopted — explicit `feedback` call, session-end signal, debounced event arrival, or something else. Trigger frequency and placement in the call graph are both TBD. Not adopted; pattern catalog entry only.

**Agent and admin tool surfaces:**

*Agent tools* (used during normal development work):
- `retain` -- Store a memory.
- `recall` -- Retrieve relevant memories.
- `feedback` -- Report a build outcome.
- `memory_status` -- Quick health check.
- `portfolio_brief` -- Structured portfolio snapshot for session start.

**Portfolio brief:**

`portfolio_brief` returns a structured snapshot of the portfolio's current state, designed as the starting point for any portfolio-level reasoning session. It assembles:

- All active projects with status, type, spec version, and last activity timestamp
- Portfolio-scoped and global-scoped memories (via an internal recall with no query, portfolio scope, and a generous token budget)
- Known health indicators: projects with no recent commits, stale specs, missing capabilities, or unresolved drift observations
- Recent observations (memory type `observation`) that haven't been acted on

The response is structured data, not synthesized prose. The calling agent (e.g., the orchestrator) does the reasoning — `portfolio_brief` provides the raw material efficiently in a single call, replacing what would otherwise require `list_projects` + `recall` + multiple `get_project` calls.

`portfolio_brief` does not read specs or code from disk. It returns only what setlist already knows from its database: registry fields, memories, and capability data. Filesystem reads are the calling agent's job.

*Admin tools* (used for memory maintenance and debugging):
- `reflect` -- Trigger a reflection cycle manually.
- `correct` -- Create a correction memory linked to a specific existing memory.
- `forget` -- Archive a specific memory by ID. Soft delete, not destruction.
- `inspect_memory` -- View a specific memory's full details.
- `configure_memory` -- Set memory configuration: embedding provider, reflect schedule, reflect threshold.

#### 2.12.1 Deferred Aspirations {#deferred-aspirations}

The following memory behaviors have accumulated across spec evolutions as studied designs. None of them are built today. Each is gated on the same upstream resolution: **the embedding-tier decision** (see "Embedding provider model" above) — whether setlist's default posture is OpenAI, Ollama, or FTS5-only. That choice governs which retrieval legs exist, which in turn governs which of these behaviors are feasible. Framing follows the EngramMemory / OpenKL pattern-study style established in §6.1 `#inspirations` and earlier evolve cycles: catalog entries that inform design, not commitments to build.

- **Progressive delivery (two-pass FTS5-first / vector-refined recall).** Recall returns FTS5 keyword hits immediately as a first pass, then an asynchronous vector-similarity re-ranking arrives as a refined second pass. Valuable for bootstrap mode where agents need to start working quickly and can absorb improved rankings as they arrive. Status: studied, not built. Gated on: embedding-tier decision.

- **Query intent classifier weight-fusion across legs.** The classifier categorizes queries (temporal, relational, factual, exploratory) and routes weight profiles across fused retrieval legs — temporal boosts recency, factual boosts FTS5, relational boosts graph traversal, exploratory uses balanced weights. The classifier is implemented as a no-op in code (it categorizes but does not fuse), because the vector and graph legs required for fusion do not exist. Status: studied, not built. Gated on: embedding-tier decision (weight fusion is meaningless with a single leg).

- **Type-priority budget allocation.** When filling a caller's token budget, the recall system allocates in priority order across memory types: corrections/preferences first, then outcomes/learnings, then patterns/procedural, then decisions/dependencies/observations, with context lowest. Within each tier, L0 → L1 → L2 expansion. Status: studied, not built. Gated on: embedding-tier decision (the scoring pipeline this sits on top of is itself aspirational).

- **sqlite-vec fourth tier (native in-SQLite vector search).** When the sqlite-vec extension is loaded, vector similarity queries execute entirely within SQLite as KNN operations on a `vec0` virtual table rather than requiring application-level cosine computation. Faster and more memory-efficient as the corpus grows. Status: studied, not built. Gated on: embedding-tier decision (native KNN is moot when no vectors are produced).

- **Gap detection (memory-graph blind spots).** Reflection's entity/relationship extraction additionally identifies structural holes — topic clusters that sit in isolation without connecting edges — and surfaces them as `observation`-type memories for portfolio intelligence to act on. Status: studied, not built. Gated on: embedding-tier decision (detecting semantic clusters that should relate but don't requires a similarity signal stronger than keyword overlap).

- **Hierarchical compaction trees / multi-level topic hierarchies.** Reflection's summary block rewriting produces multi-level topic hierarchies rather than flat per-scope summaries, bridging topics that keyword search alone cannot connect. Consumed by recall's bootstrap mode as the "holistic view" of accumulated knowledge. Status: studied, not built. Gated on: embedding-tier decision (topic clustering requires embeddings; hierarchical structure on top of FTS5 alone is not a meaningful improvement over the flat summary_blocks already present).

- **Knowledge distillation (clusters → patterns / preferences / procedurals).** Reflection examines clusters of related memories (outcomes, decisions, learnings) and extracts higher-order knowledge: recurring outcomes become patterns, repeated decisions become preferences, sequences of corrections become procedural memories. Distilled memories link back to source memories via edges, preserving provenance. Distinct from dedup (which merges near-identical content). Status: studied, not built. Gated on: embedding-tier decision (clustering related-but-distinct memories requires semantic similarity).

**What ships today.** The main §2.12 body above describes the current behavior: FTS5 full-text search over the memory corpus, `retain` / `recall` / `feedback` as the three-verb API, reflection's triple-gate stale-memory archival (score < 0.3 AND access < 2 AND age > 90 days), belief classification (`fact` / `opinion` / `hypothesis`), temporal validity fields (`valid_from` / `valid_until`), entity storage as denormalized JSON on the memory row, procedural versioning via `parent_version_id` + `is_current`, and four-level scoping (project / area / portfolio / global) with area-based bubble-up. `classifyIntent()` is wired but inert. No vector retrieval, no graph traversal, no RRF fusion, no compaction trees, no distillation, no gap detection, no sqlite-vec. The dual-column embedding schema (`embedding` / `embedding_new`) is in place so that adopting any of the above does not require re-migration; the columns are unpopulated pending the embedding-tier decision.

### 2.13 Project Bootstrap {#project-bootstrap}

The registry can create a new project end-to-end: registering its identity, creating its folder on disk, populating it from templates, and optionally initializing version control. This subsumes the manual `new-project.sh` shell script entirely — the bootstrap is now a first-class registry operation available through MCP, CLI, and library import.

**Before bootstrap works: configuration.**

Bootstrap is driven by the user's **project types** list — a CRUD-managed set of types maintained in Settings (see `#desktop-app` (2.14) and `#entities` (3.2)). Each type carries the bootstrap behavior for projects of that kind: a default directory where new projects are created, a flag for whether to initialize git, and an optional template directory whose contents are copied into the new folder. The set ships seeded at install with two defaults — **Code project** (default directory `~/Code/`, git init on, no template) and **Non-code project** (default directory `~/Projects/`, git init off, no template) — both of which the user is free to edit, rename, recolor, or delete. The user may add additional types (e.g., "Notes notebook", "Research dossier") at any time, and they immediately become selectable in the bootstrap flow.

Bootstrap also needs the archive path root for archive cleanup. The user sets that in Settings alongside the types list. The legacy `area_of_focus` bootstrap type has been removed entirely — both as a type value and from the bootstrap configuration's path-roots map.

If `bootstrap_project` is called before any project types exist on disk (a fresh install before migrations, or a user who has deleted every type), the call fails with a clear error: "Bootstrap has no project types configured. Open Settings → Project types to add at least one." The error names the exact next step — no silent fallbacks, no guessing at paths.

**Bootstrapping with a project type:**

An agent or user calls `bootstrap_project` with a project name, a project type (any user-defined type, looked up by name), optionally an area, optionally a parent_project name (making the new entry a sub-project), and optionally a path override. The registry:

1. Registers the project in the registry (internally calls the same registration logic as `register_project` — core identity fields are created, and the project's stored type is set to the chosen type).
2. Creates the project folder at the chosen type's default directory (e.g., `~/Code/my-new-project` for "Code project", `~/Projects/my-thing` for "Non-code project"), unless a path override is provided.
3. If the chosen type has a template directory configured, copies the contents of that template into the new folder.
4. If the chosen type has its git-init flag enabled, initializes a git repository in the new folder and creates an initial commit. If the flag is off, no `.git` directory is created — non-code projects living in iCloud-synced paths where git repositories are forbidden are safe by default.

When the new project's parent directory is itself a git repository with an existing `.gitignore` — the portfolio-root convention at `~/Code/`, where each project is its own git repo and the parent directory tracks only its own metadata — `bootstrap_project` appends the new project's directory name (with a trailing slash) to that `.gitignore` so the parent repo ignores the nested sub-repo. The append is best-effort and silent: it never fails the bootstrap, it is a no-op when the parent directory is not a git repo, when the parent has no `.gitignore` (one is not created), or when the entry is already listed. The result surfaces this as `parent_gitignore_updated: true | false` alongside the existing `git_initialized` and `templates_applied` flags.

The caller receives confirmation with the registered project name, the chosen type, and the created path. The project is immediately queryable in the registry and ready for development.

**Path override:**

The caller can provide an explicit path instead of using the configured default. This accommodates projects that need to live in non-standard locations. The override applies to a single bootstrap call; it does not change the stored configuration.

**When the folder already exists:**

If the target folder already exists on disk, the bootstrap fails with a clear error identifying the conflicting path. It does not overwrite, merge into, or silently skip the existing folder. The caller can either choose a different name, provide a path override, or handle the existing folder manually before retrying.

**Archiving with filesystem cleanup.**

When a project is archived (via the desktop app, CLI, or MCP), the archive operation can optionally move the project's folder to the configured `archive_path_root`. If an archive path root is configured:

1. For each registered path of the project, the folder is moved to the archive path root (e.g., `~/Code/my-project` → `~/Archive/my-project`).
2. Before moving, any `.git` directory inside the folder is removed. The archive destination may be in iCloud-synced storage where git repositories are forbidden.
3. The project's paths in the registry are updated to reflect the new location.
4. If the archive path root is not configured, the archive operation works as before — status change only, no filesystem move.

The `.git` stripping is a safety measure, not a data loss concern: the canonical git history lives on the remote (GitHub). The archived folder preserves the project's files for reference without the repository overhead.

**What bootstrap does NOT do:**

- It does not create dual-surface folders (no automatic linking between `~/Code/` and `~/Projects/`). One folder per project.
- It does not run post-creation hooks or install dependencies. The folder is scaffolded; the agent or user takes it from there.
- It does not modify `register_project`. Registration remains pure data with no filesystem side effects. Bootstrap is a separate, higher-level operation that composes registration with folder creation.

### 2.14 Desktop Control Panel {#desktop-app}

The desktop app gives the user a direct window into their project landscape — a visual surface for browsing, managing, and understanding the same data that agents interact with programmatically.

**Launching the app.**

The app has two entry points: a standalone macOS `.app` bundle (double-click to launch) and a CLI command (`setlist ui`). Both start the same Electron process. The app enforces single-instance behavior — if a window is already open, launching again brings the existing window to the foreground rather than creating a second instance.

**Home view: grouped project lanes.**

On launch, the user sees their projects organized into lanes — one lane per area in the user's current areas list (seeded with Work, Family, Home, Health, Finance, Personal, Infrastructure at install but freely editable from Settings; see `#entities` (3.2)), plus a final **Unassigned** lane for projects with no area. Each lane is a labelled section with a collapsible header showing the area name, its accent color, and a count. Inside each lane is a card grid of the projects belonging to that area. Each card shows the project name, a status indicator, a small colored health dot (green Healthy, amber At risk, red Stale, gray Unknown — see `#health-assessment` (2.15)), the project's stored **Type** (read directly from the user's project types list — no longer a path heuristic), and a last-updated timestamp. The lanes give the user a panoramic but organized view of the ecosystem — work, life, and infrastructure are visually separated instead of blended into one wall of cards.

Lanes are collapsible: clicking a header folds the lane to a thin summary row. Collapsed state persists per lane across sessions. Empty lanes (no projects in that area) still render but show a muted "No projects yet" placeholder. When the user adds, renames, recolors, or removes an area in Settings, the Home view updates immediately to match — a renamed area keeps the same lane (and the same projects), an added area appears as a new empty lane at the end of the list, and a removed area's lane disappears (its projects must be reassigned first; see `#rules` (3.3)).

**Unassigned lane treatment.** The Unassigned lane is visually distinct from the user's areas: its header uses a muted text color (not an accent), and the lane background carries a subtle warning tint to communicate "these need attention." Each card in this lane shows a gentle inline nudge — "Assign an area" — that opens the area picker when clicked. The nudge is an invitation, not a block: the project works fine unassigned, forever.

**Sub-project visual treatment.** A project that declares a parent is rendered inside its own area lane (not its parent's, unless they happen to share one), indented 24px from the left edge of the card grid with a 1px muted vertical connector running from the parent card down to the child. When parent and child live in different area lanes (cross-area children), the connector cannot be drawn, so the child instead shows a `↳ parent-name` caption under its title — a textual backlink to the parent. Clicking the caption navigates to the parent's detail view.

**Filter chips.** A row of filter chips sits above the lanes — one chip per area in the user's current list, plus an Unassigned chip. Chips are multi-select with OR semantics: activating Work + Family hides every other lane. An "All" chip clears the selection. Type and status filters remain available as secondary dropdowns (status filter is still a multiselect, and the type filter draws its options from the user's project types list). Archived projects are hidden by default; an "N archived projects" link below the last lane adds the archived filter with one click. Filtering, sorting, and lane collapse are immediate — no loading states for a local database of this size.

**Column visibility.** A small dropdown in the Home view header (sitting beside the existing sort and status menus) lets the user toggle which secondary columns appear on each card: **Status**, **Health**, **Type**, **Updated**, and the **area badge**. The project name is always shown — it cannot be hidden. The dropdown is a multi-select checklist; toggling a column updates the grid immediately. The user's choice persists per machine (alongside the existing lane-collapse and area-chip preferences), so different workstations can carry different column setups. Custom column ordering is out of scope in this evolve — the columns appear in their canonical order regardless of which subset is on.

**Row density.** A toggle in the same header — labelled with two density icons — switches between **Compact** and **Spacious** card heights. Compact tightens vertical padding and shrinks the timestamp row to fit more projects on screen at once; Spacious is the existing layout. The choice persists per machine. Density and column visibility compose: a compact card with Health and Updated hidden is a single dense line of name and status.

**Sort persistence.** The Home view sort menu (Name, Updated, Status, Health) now persists the user's selection across launches, instead of resetting to the default each session. The choice is stored per machine alongside the other view preferences. The same applies to sort direction (ascending/descending).

**Default landing view.** The Settings panel exposes a "Default landing view" preference with two values: **Grouped lanes** (the lane-per-area presentation described above) and **Flat grid** (a single card grid with all projects merged, sortable and filterable but without lane structure). The choice governs which presentation the Home view opens to on launch and after navigation back from a detail view. Either presentation can be switched to from the Home view header at any time without changing the stored default. The preference is per machine.

**Cmd-, opens Settings.** The desktop app honors the standard macOS preferences accelerator (Cmd-,) by opening the Settings panel from any view. The same accelerator closes Settings and returns the user to the previous view. The Settings menu item under the **Setlist** application menu carries this accelerator visibly so the shortcut is discoverable without documentation.

**Project detail: the tabbed view.**

Clicking a project card opens a detail view with a persistent header showing the project name, type badge, status, description, and action buttons (Edit, Archive). Below the header, content is organized into tabs:

- **Overview tab** — Displays the project's fields, filesystem paths, and goals. For code projects, this includes tech stack, patterns, and tooling fields. For non-code projects, stakeholders, timeline, and domain. The tab also shows a Health section (see `#health-assessment` (2.15)) with the project's overall health tier, per-dimension breakdown, and the full list of reasons behind the assessment. This is the project's identity card.

- **Memory tab** — A read-only browse of the project's memories: decisions, outcomes, patterns, preferences, and other retained knowledge. Memories are displayed in score order with type badges and timestamps. The user can see what agents have learned about this project but cannot create, edit, or delete memories from the UI in v1.

- **Capabilities tab** — A read-only list of the project's declared capabilities, grouped by type. Each capability shows its name, type, description, and invocation metadata where present. Read-only in v1.

- **Ports tab** — A read-only view of the project's port allocations: port number, service label, protocol, and claim timestamp. Read-only in v1.

**Project CRUD operations.**

The desktop app supports the full project identity lifecycle through the UI:

- **Register** — A form for creating a new project entry. Collects the six core identity fields (name, display name, type, status, description, goals) and optionally filesystem paths. Calls `registry.registerProject()` through the IPC bridge. The new project appears in the card grid immediately.

- **Edit** — From the project detail header, the user can edit the project's display name, status, description, and goals. Edits are committed individually or as a batch. Calls `registry.updateProject()` through the IPC bridge.

- **Archive** — From the project detail header, the user can archive a project. This triggers the same archive behavior as the programmatic `archive_project` — ports released, capabilities cleared, status set to archived. If an archive path root is configured, the project's folders are moved there (with `.git` stripped). The project disappears from the default card grid.

- **Rename** — The user can rename a project (change its slug identifier). This triggers the same atomic rename as `registry.renameProject()` — all references updated in a single transaction.

**Settings: a single scrolling page.**

The Settings panel is a single vertical-scrolling page, accessible from the Home view, the Setlist application menu, or the Cmd-, accelerator. The page is divided into five sections, in this top-to-bottom order: **Areas**, **Project types**, **View**, **Bootstrap**, **Updates**. Each section is a self-contained block with its own heading; the user scrolls between them or jumps via a left-side rail of section anchors. Changes save immediately and silently — there is no confirm-and-apply step. Closing the panel (Cmd-, again, or the close control) returns the user to whatever view they came from.

**Settings → Areas.** A managed list of the user's areas. Each row shows the area's name, a small color swatch, and a count of projects currently assigned to it. The user can:

- **Add an area** — opens an inline editor for a name and a color swatch picked from the curated palette.
- **Rename an area** — inline edit on the row. Memories and projects keep their existing assignments unchanged; only the displayed label moves.
- **Recolor an area** — opens the curated palette picker. The new color flows through immediately to the lane header on Home, the area badge on cards, and the chip row.
- **Delete an area** — only allowed when the area has no projects assigned. If projects are attached, the action is blocked with a modal showing the count and a reassignment picker; once the user picks a destination area (or "Unassigned") and confirms, the projects move and the original area is then deletable.

The seven defaults (Work, Family, Home, Health, Finance, Personal, Infrastructure) are seeded at install and may all be edited or removed — they hold no special status after the first launch.

**Settings → Project types.** A managed list of the user's project types, with the same shape as the areas list. Each row shows the type's name, default directory, git-init flag, optional template directory, and a count of projects of that type. The user can:

- **Add a type** — opens a form for name, default directory (e.g., `~/Code`, `~/Projects`, `~/Notebooks`), a git-init checkbox, and an optional template directory.
- **Edit a type** — change the name, default directory, git-init flag, or template path inline. Changes apply to subsequent bootstraps; existing projects of that type are unaffected unless their stored type label changes (which is purely cosmetic — see `#rules` (3.3)).
- **Delete a type** — only allowed when no projects carry that type. If projects are attached, the action is blocked with a modal showing the count and a reassignment picker for picking a different existing type to move them to before deletion.

Two defaults are seeded at install: **Code project** (default directory `~/Code/`, git init on, no template) and **Non-code project** (default directory `~/Projects/`, git init off, no template). Both can be edited or removed once they are no longer attached to any projects.

**Settings → View.** Per-machine view preferences for the Home view:

- **Default landing view** — Grouped lanes or Flat grid. Governs the initial presentation on launch.
- **Default density** — Compact or Spacious. Governs the initial card density on launch.
- **Visible columns** — A checklist of Status, Health, Type, Updated, and area badge. Governs which columns are on at launch.
- **Default sort** — Field (Name, Updated, Status, Health) and direction (ascending / descending). Governs the initial sort on launch.

These mirror the controls in the Home view header — toggling a control there updates the corresponding preference here, and vice versa. All view preferences are stored per machine.

**Settings → Bootstrap.** The non-type bootstrap configuration: the **Archive path root** (where archived projects are moved) and any other paths shared across all types. Per-type defaults (default directory, git init, template directory) live in the **Project types** section above; this section holds only the residual cross-cutting paths.

**Settings → Updates.** Auto-update channel and status (described in `#auto-update` (2.14.1)).

#### 2.14.1 Auto-Update {#auto-update}

The user runs an installed native app, not a web service — so updates have to come to them. Setlist delivers new versions through an in-app auto-update flow that is quiet by default, under the user's control, and never forced.

**Two channels: stable and beta.** The user picks which release stream they follow. **Stable** is the default; new users are on stable from first launch and stay there unless they opt out. **Beta** delivers earlier, less-proven builds for users who want to help shake out issues before general release. The active channel persists across launches, across updates, and across reinstalls (it is user state, not app state). Switching channels takes effect on the next update check.

**Settings › Updates.** The Settings panel's **Updates** section (the bottom block of the single-page Settings layout described above) contains:

- A **channel toggle** (Stable / Beta) — changing this immediately changes which release stream subsequent checks consult. The choice persists.
- The **current app version**, displayed plainly.
- A **Check now** button — triggers an immediate update check on demand.
- A **status line** showing the most recent check: timestamp and result. On success, the result reads "Up to date" or "Update available — vX.Y.Z downloading" or "Update ready — install on next quit." On failure, the status line shows the timestamp and the error message. This is the only durable in-app record of update activity.

**About dialog.** The standard macOS **About Setlist** menu item opens a small dialog showing the current app version, the build date, and the active channel. Nothing interactive — this is the canonical "what am I running?" answer.

**Check for Updates… menu item.** The standard macOS app menu (Setlist menu, next to About) includes **Check for Updates…**. Selecting it runs the same check as the Settings button. If an update is found, it enters the silent download flow below. The outcome is reflected in the Settings status line; if a new update downloads, the user also sees the toast described next. The menu item never opens a blocking progress window.

**Silent background download.** When a check finds an update, the download runs in the background with no progress UI. The user continues working. No spinners, no banners, no interruption. If the download fails, the failure lands only in the Settings status line.

**Toast on update downloaded.** When the download finishes, an in-app toast appears: "**Update ready — install on next quit.**" with a **Quit and install** action. Dismissing the toast leaves the update staged; the app continues running normally. The toast supersedes any OS-level notification for the same event.

**Prompt before install.** The user is never forced to restart. When the user initiates a quit (Cmd-Q, the App › Quit Setlist menu item, or closing the last window on a platform that treats that as quit), if an update is staged, a confirmation dialog asks: "**Update ready — install now or skip?**" with **Install and quit** and **Skip** actions. Choosing install quits the app and installs the new version on the next launch. Choosing skip quits without installing; the downloaded update stays staged and is offered again on the next quit, or installs immediately if the user clicks the toast's Quit and install action. There is no force-restart and no timer.

**Failure surface.** Update check failures and download failures surface only in the Settings › Updates status line, with timestamp and error message. There is no toast, no menu-bar badge, no error dialog, no modal. Failures do not interrupt the user's work. The user sees them when they go look. Errors continue to write to stderr for developer debugging.

**No telemetry.** Update events are not retained as portfolio memory, not written to a dedicated log, and not reported anywhere external. The Settings status line is the only in-app record beyond stderr.

**What the desktop app does NOT do in v1:**

- Memory write operations (retain, correct, forget, reflect) — the Memory tab is read-only
- Capability write operations (register, replace) — the Capabilities tab is read-only
- Port write operations (claim, release, discover) — the Ports tab is read-only
- Migration — this remains a CLI operation (`setlist migrate`)
- Task management — queuing and monitoring async tasks remains programmatic
- Bootstrap — creating new projects with folder scaffolding remains CLI/programmatic

These operations are deferred to future versions (see Appendix C).

**Architecture: Electron with IPC bridge.**

The main process imports `@setlist/core` directly — the same library that Chorus and Ensemble use. All database operations happen in the main process. The renderer communicates with the main process through Electron's `contextBridge` and `ipcRenderer`/`ipcMain` — no `nodeIntegration` in the renderer, no direct database access from the browser context. This follows Electron security best practices.

The renderer is a React application styled with Tailwind CSS 4 and Radix UI primitives. It imports design tokens from the `chorus-ui` package — CSS custom properties for the shared visual language (surfaces, accents, typography, status colors). The visual language is the same as Chorus; the information architecture is Setlist's own. Token values are defined and maintained in `chorus-ui`; Setlist consumes them, never redefines them.

**Design token consumption:**

```css
@import 'chorus-ui/tokens.css';  /* `:root` custom properties */
```

The tokens provide surfaces (warm charcoal palette), accents (terracotta), text colors, borders, status colors, font families (Inter, JetBrains Mono), and easing curves. See the `chorus-ui` package for the complete token inventory.

**Relationship to Chorus.**

Setlist and Chorus are separate products. Setlist is the registry control panel — it manages project identity, shows what agents have learned, and lets the user administer their ecosystem. Chorus is the AI workspace — it hosts conversations, builds projects, and manages knowledge. They share a design system and a database, but they serve different purposes and run as independent applications. Setlist does not depend on Chorus being installed, and Chorus does not depend on the Setlist desktop app (Chorus imports @setlist/core directly as a library).

---

### 2.15 Project Health Assessment {#health-assessment}

The user and their agents need to know, at a glance, which projects are thriving, which are drifting, and which are neglected. Setlist answers that with a composite health assessment — a single human-readable verdict per project, with the reasons spelled out.

**The four tiers.**

Every non-archived project is placed into one of four tiers:

- **Healthy** — the project is alive and well on every dimension the assessment looks at
- **At risk** — something is slipping. The project isn't broken, but a dimension is trending the wrong way and deserves attention
- **Stale** — a dimension has crossed a threshold that makes the project effectively dormant or incomplete enough that it can't be acted on confidently
- **Unknown** — there isn't enough signal to evaluate (e.g., an archived project, or a freshly-registered project with no data yet)

Tiers are qualitative by design. The user sees "Healthy" or "Stale," not "72/100." Behind the tier is always a list of contributing reasons in plain language: "no activity in 45 days," "description missing," "3 unresolved contradictions in project memories."

**Three dimensions.**

The composite tier is the *worst* of three dimension tiers. Any single dimension at Stale makes the whole project Stale. This is conservative by design — it surfaces red flags instead of letting them average out.

- **Activity** — when was the project last meaningfully touched? Updates to core registry fields, memory retains scoped to the project, and (if a path with a git repository is declared) commits inside the project folder all count as a touch. Healthy is within 7 days, At risk is 8–30 days, Stale is beyond 30 days.

- **Completeness** — is the project's profile filled in enough that agents and humans can act on it? A project needs a description, at least one goal, and at least one path. Code projects additionally need tech_stack and patterns. Every project benefits from topics and entities being populated. Missing description or goals drops completeness to Stale; missing the enrichment fields drops it to At risk.

- **Outcomes** — what do the memories say? A project with recent positive build feedback and no unresolved contradictions is Healthy. A project with recent failures or with active contradictions is At risk. A project with a high ratio of corrections to original decisions is Stale. A project with no feedback history at all is Healthy — absence of signal is not a negative signal.

**Where health shows up.**

Health is both a human signal and an agent signal. It appears in three places:

- **Home view dot** — the desktop app's home view shows a small colored dot on each project row alongside the existing status indicator. Green for Healthy, amber for At risk, red for Stale, gray for Unknown. The user can glance at the grid and immediately see which projects need attention. Archived projects do not show a dot.

- **Project detail Overview tab** — opening a project's detail view shows a Health section on the Overview tab. The section displays the overall tier, the three dimension tiers, and the full list of reasons. This is where the user drills in to understand *why* a project is flagged.

- **`assess_health` MCP tool** — a dedicated MCP tool exposes the same assessment to agents. `assess_health(name)` returns a structured result for a single project. `assess_health()` without arguments returns a portfolio-wide snapshot — every active project ordered worst-to-best, plus summary counts per tier. This is the structured counterpart to the home view dot — the orchestrator and other agents consume it to reason about where attention is needed.

**How often it's computed.**

Health is computed on demand. The MCP tool and the desktop app both request fresh assessments when the user or agent asks. Results are cached briefly (a few minutes) so that scrolling the home view or an agent making multiple calls in quick succession doesn't hammer the database. Callers that need to bypass the cache — for example, immediately after mutating a project — can pass `fresh=true` to force recomputation. There is no background worker and no stored health field in the registry — the assessment is always derived from current data, not from a maybe-stale snapshot.

**What health does not do.**

Health does not prescribe actions. It surfaces what needs attention and why — it doesn't archive projects, flag them in the database, notify external systems, or rewrite anything. Those decisions remain with the user or the agent reading the assessment. Health is a lens, not a lever.

---

## 3. System Behavior

### 3.1 Core Capabilities {#capabilities}

The library API in @setlist/core exposes each capability as a method on the `Registry` class (or domain-specific classes like `MemoryStore`, `PortRegistry`). The MCP server in @setlist/mcp wraps each as an MCP tool. The CLI in @setlist/cli exposes the subset appropriate for terminal use.

**Project registration.** Accepts a set of fields for a new project and creates a persistent entry. Requires the six core identity fields (name, display_name, type, status, description, goals); display_name, description, and goals may be empty strings for sparse entries. If display_name is not provided, it defaults to name. Returns confirmation.

**Field writing.** Accepts additional or updated fields for an existing project from a producer. Adds new fields, updates fields owned by the same producer, preserves fields written by other producers.

**Variable-depth querying.** Serves project data at summary, standard, or full depth. Supports queries for all projects, a filtered subset, or a single project by name.

**Filtering.** Supports filtering by type (project, area of focus) and status (active, paused, archived, draft, idea, etc.). Filters compose with depth levels.

**Migration.** Scans conventional locations, extracts metadata from existing sources, proposes registrations. CLI: `setlist migrate`.

**Field catalog.** Maintains a catalog of known fields, each with a name, type, category, and description. The catalog is extensible -- fields not in the catalog are still accepted and stored.

**Port management.** Claims, releases, and checks port allocations across all projects. Ports are globally unique. Supports explicit port requests and auto-allocation from 3000--9999.

**Port discovery.** Scans a project's config files for port usage patterns and claims found ports. Non-destructive: claims available ports silently and skips clashing ports with a note.

**Batch operations.** Applies field changes to multiple projects matching a filter in a single atomic operation. Supports `dry_run` flag for previewing impact.

**Project administration.** Updates core identity fields on existing projects and archives projects. `update_project` changes display_name, status, description, or goals. `archive_project` is a convenience shorthand for setting status to "archived" with automatic port and capability cleanup. `rename_project` changes the project's name (the slug-style identifier used for all lookups) atomically -- updating the `projects` row, all `tasks.project_name` references, all `memories.project_id` references, all port claims, capability declarations, and paths in a single transaction. The old name ceases to exist and becomes available for re-use. Renaming to an existing name fails with a clear error.

**Capability declaration writing.** Accepts a project name and a complete set of capability declarations, replacing the project's previous capability set. Replace semantics ensure the registry reflects current code reality. Setlist itself is a producer against this surface: its MCP server populates the `setlist` project's capabilities on every startup via code introspection — see §2.11 `#capability-declarations` for the self-registration contract.

**Capability querying.** Searches capability declarations across the ecosystem. Supports filtering by project, capability type, and keyword search.

**Memory retention.** Accepts content, a memory type, and optional metadata. Persists immediately with content-hash dedup. Returns an acknowledgment with the memory ID. Hot path completes without LLM processing.

**Memory recall.** Accepts a query, optional project scope, and token budget. Executes hybrid retrieval across FTS5, vector similarity, and graph traversal legs. Fuses via Reciprocal Rank Fusion, fills budget with tiered content.

**Memory feedback.** Accepts a build result and list of memory IDs. Updates outcome scores using EMA (alpha = 0.1).

**Memory status.** Returns a health summary: counts by type and scope, last reflection time, embedding provider configuration.

**Memory reflection.** Triggers background consolidation: semantic dedup, entity extraction, summary rewriting, triple-gate archival.

**Memory correction.** Creates a correction memory linked to a specific existing memory via `contradicts` edge. Corrected memory archived.

**Memory forgetting.** Archives a specific memory by ID. Soft delete.

**Memory inspection.** Returns full details of a specific memory.

**Memory configuration.** Sets runtime memory configuration. Changes take effect immediately.

**Project enrichment.** Accepts a project name and partial profile data (goals, topics, entities, concerns). Merges with existing profile using union semantics — new items are added, duplicates are ignored. Any field can be updated independently. This is the primary mechanism for agents to build structured project identity over time.

**Producer-scoped field writing.** The `Registry.updateFields()` method enforces field domain isolation via the `producer` parameter. Each field tracks which producer last wrote it, and a write from producer A cannot overwrite a field owned by producer B. This is implemented via `ON CONFLICT ... WHERE producer = excluded.producer` in the upsert. Producers pass their identity (e.g., 'fctry', 'chorus', 'migration') on every write. Shared fields (short_description, medium_description, keywords) use first-producer-wins semantics.

The fctry-owned field domain includes: tech_stack, patterns, short_description, medium_description, readme_description, keywords, ide, terminal_profile, mcp_servers, urls. The Chorus-owned domain includes: stakeholders, timeline, domain, short_description, medium_description, keywords.

**Consumer querying.** The `Registry` class provides all consumer query patterns directly: `listProjects()` at variable depth for ambient awareness, `getProject()` for single-project detail, `searchProjects()` for keyword search, `switchProject()` for workspace context, `getRegistryStats()` for portfolio overview.

**Memory migration utility.** A utility to migrate existing CC auto-memory files (`~/.claude/projects/*/memory/*.md`) and fctry global memory (`~/.fctry/memory.md`) into the registry's memory store. Maps CC memory types (feedback, project, user, reference) to registry memory types (preference, decision, correction, etc.). Available as `setlist migrate-memories` CLI command with `--apply` flag (dry-run by default).

**Project bootstrap.** Creates a new project end-to-end: registers it in the database, creates its folder at the configured path root, populates from the template directory, and initializes git for code projects. Requires bootstrap configuration (path roots and template directory) to be set first via `configure_bootstrap`. Fails clearly if unconfigured or if the target folder already exists.

**Bootstrap configuration.** Stores the mapping of project type to default path root and the template directory path. Persisted in the registry database. Readable and updatable at any time.

**Desktop project dashboard.** Displays all registered projects as a card grid with name, type badge, status indicator, and last-updated timestamp. Supports filtering by type and status, and sorting by name, status, or last updated. Backed by `registry.listProjects({ depth: 'summary' })`.

**Desktop project detail.** Displays a single project's full identity in a tabbed view: overview (fields, paths, goals), memory (read-only browse), capabilities (read-only list), and ports (read-only view). Backed by `registry.getProject()` at full depth.

**Desktop project CRUD.** Provides UI forms for registering new projects, editing project identity fields (display name, status, description, goals), archiving projects, and renaming projects. Each operation delegates to the corresponding @setlist/core method through the IPC bridge.

**MCP server access.** @setlist/mcp wraps @setlist/core as 39 MCP tools via @modelcontextprotocol/sdk using stdio transport managed by Claude Code's lifecycle. The server provides:

- `list_projects` -- List projects at a given depth with optional filters.
- `get_project` -- Get a single project by name at a given depth.
- `switch_project` -- Look up a project and return paths, status, ports, workspace metadata.
- `search_projects` -- Search projects by keyword.
- `get_registry_stats` -- Return project count and distributions.
- `register_project` -- Register a new project.
- `update_project` -- Update core identity fields.
- `archive_project` -- Archive a project.
- `rename_project` -- Rename a project atomically (rewrites all references).
- `batch_update` -- Apply field changes to filtered project sets. Supports `dry_run`.
- `write_fields` -- Write arbitrary extended fields to a project (Setlist addition).
- `enrich_project` -- Update profile fields (goals, topics, entities, concerns) on a project (Setlist addition).
- `register_capabilities` -- Write a project's complete capability set.
- `query_capabilities` -- Discover capabilities across the ecosystem.
- `claim_port` -- Claim a port for a project's service.
- `release_port` -- Release a previously claimed port.
- `check_port` -- Check port availability.
- `discover_ports` -- Scan config files and claim found ports.
- `queue_task` -- Queue async work (single project or fan-out dispatch).
- `list_tasks` -- List tasks with optional filters.
- `cross_query` -- Search across all projects.
- `retain` -- Store a memory.
- `recall` -- Retrieve relevant memories.
- `feedback` -- Report build outcome.
- `memory_status` -- Memory health check.
- `portfolio_brief` -- Cross-project memory brief at portfolio scope (Setlist addition).
- `reflect` -- Trigger consolidation.
- `correct` -- Create correction memory.
- `forget` -- Archive a memory.
- `inspect_memory` -- View memory details.
- `configure_memory` -- Set memory configuration.
- `bootstrap_project` -- Register a project and create its folder from templates (Setlist addition).
- `configure_bootstrap` -- Set path roots per project type and template directory (Setlist addition).
- `assess_health` -- Compute composite project health score (activity + completeness + outcomes) (Setlist addition).
- `set_project_area` -- Assign or change a project's canonical area (Setlist addition).
- `set_parent_project` -- Assign or change a project's parent (sub-project link) (Setlist addition).
- `get_project_digest` -- Read one project's essence digest, with staleness flag (Setlist addition, v12).
- `get_project_digests` -- Batch read essence digests for one or more projects (Setlist addition, v12).
- `refresh_project_digest` -- Write a project's essence digest (invoked by the CLI generator, not by consumer agents) (Setlist addition, v12).

See [Appendix D](#appendix-d-mcp-tool-reference) for the complete tool reference with parameters and return types.

**MCP tool surface design:**

- *Progressive detail:* Read tools accept a `detail` parameter (`minimal`, `summary`, `standard`, `full`).
- *Structured errors:* All errors follow `Error [CODE]: message. Suggestion: next action.` with codes: `NOT_FOUND`, `EMPTY_REGISTRY`, `INVALID_INPUT`, `NO_RESULTS`. `NOT_FOUND` errors include fuzzy-match "did you mean?" suggestions.
- *Workflow-aware descriptions:* Each tool's docstring suggests logical next tools.
- *Response minimization:* Empty fields are omitted, not rendered as blanks.

**Workspace context switching.** When an agent calls `switch_project`, the response includes all information needed to orient: filesystem paths, project type and status, description, goals, port assignments, and workspace-relevant extended fields (MCP servers, IDE, terminal profile).

### 3.2 Things the System Keeps Track Of {#entities}

- **Projects** -- Initiatives tracked in the registry. They progress through a lifecycle: idea, draft, active, paused, archived, complete. Each project has core identity fields, zero or more extended fields, one or more filesystem paths, an optional area assignment, and an optional parent project. Each project also carries a **type** chosen from the user's project types list (see below); the legacy `area_of_focus` project type was retired in schema v11.

- **Areas** -- The user's set of organizational buckets. Stored as first-class entities in a dedicated `areas` table (id PK, name UNIQUE, display_name, description, color). The table is seeded at install with seven sensible defaults — **Work, Family, Home, Health, Finance, Personal, Infrastructure** — but the set is **fully user-managed thereafter**: areas can be added, renamed, recolored, or deleted from the Settings panel (see `#desktop-app` (2.14)). There is no closed canonical set; the seeded defaults hold no special status after first launch. Projects reference an area via `area_id` (nullable). Areas have no status and no completion criteria. Memory scope routing (project → area → portfolio → global) joins on the stable `area_id`, so renaming an area is a label-only update and does not break inheritance.

- **Project types** -- The user's set of project kinds, governing bootstrap behavior and the Type column in the Home view. Stored as first-class entities (id PK, name UNIQUE, default_directory, git_init flag, optional template_directory, color, created_at). Each type carries the per-type bootstrap configuration: where new projects of that type land on disk, whether to initialize git, and which template directory (if any) to copy in. The table is seeded at install with two defaults — **Code project** (default directory `~/Code/`, git init on, no template) and **Non-code project** (default directory `~/Projects/`, git init off, no template) — both of which are user-editable and user-deletable once detached from any projects. Users may add additional types at any time. Projects reference their type via `project_type_id` (foreign key into `project_types`); see `#schema` (5.2). The legacy single-value `type` fossil and the `area_of_focus` type are removed.

- **Sub-project relationships** -- A project may declare another project as its parent via `parent_project_id`. This is a structural edge, not a field: it lives as a first-class foreign key and participates in cycle checks. A parent's children are queryable (`get_project` returns the children list). Parent and child are independent in every other respect — area, status, memory scope, archival — except that archiving a parent does not cascade to children; children remain active with the link intact, and their detail view shows an "(archived)" tag next to the parent link.

- **Fields** -- The atomic units of project identity beyond the structural columns. Each field is typed (string, list, enum, text), categorized (identity, technical, context, tooling, lifecycle), and self-describing.

- **Core identity fields** -- The seven fields every project must have, plus one optional structural relationship:
  - **Name** -- slug-style identifier for lookups (e.g., "project-registry-service")
  - **Display name** -- human-friendly label (e.g., "Project Registry Service"). Defaults to name. Does not need to be unique.
  - **Type** -- a reference to a row in the user-managed `project_types` table (see above). Stored on the project as `project_type_id`. The Home view's Type column reads this value directly.
  - **Status** -- lifecycle position
  - **Description** -- natural-language description suitable for semantic reasoning
  - **Goals** -- what the initiative is trying to achieve
  - **Area** -- a reference to a row in the user-managed `areas` table, or null (unassigned)
  - **Parent project** (optional structural edge) -- another project this one belongs to

- **Extended fields** -- Fields beyond core identity: technical (tech stack, patterns, IDE, terminal profile), context (stakeholders, timeline, domain), tooling (MCP servers, URLs, workspace preferences).

- **Filesystem paths** -- Known locations where a project has a presence on disk. A project may have multiple paths for dual-surface projects.

- **Field catalog** -- The registry's master list of known fields, each with a name, type (string, list, enum, text), category (identity, technical, context, tooling, lifecycle), and description. The catalog ships with a default set and is extensible -- fields not in the catalog are accepted and stored.

- **Templates** -- Configurations governing which fields are relevant for a given project kind. Two canonical templates ship with the registry: code_project (includes tech_stack, patterns, mcp_servers, urls, keywords) and non_code_project (includes stakeholders, timeline, domain, keywords). Templates govern which fields appear at standard depth. The per-type **template directory** (the folder whose contents are copied into a new project on bootstrap) is bound on the project type itself, not on these field-template entities — a project type may point at any folder on disk for scaffolding, independent of which field template applies to projects of its kind.

- **Schema meta** -- Version tracking for the database schema. Stores the current schema version (13) used by migration logic to determine whether upgrades are needed.

- **Ports** -- Port allocations claimed by projects for their services. Each entry has: port number (3000--9999, globally unique), project, service label, protocol (tcp/udp), claimed_at.

- **Capability declarations** -- Structured descriptions of a project's integration surfaces. Each has: name, type (open string), description, inputs, outputs, project, and optional invocation metadata (requires_auth, invocation_model, audience).

- **Memories** -- Structured knowledge entries. Each has: ID, content, content_l0 (one-sentence abstract), content_l1 (structural overview), type, importance, confidence, status, project_id (FK to projects), scope, agent_role, session_id, tags (JSON array), content_hash, embedding (BLOB), embedding_model, embedding_new (BLOB for migration), embedding_model_new, reinforcement_count, outcome_score, is_pinned, is_static (non-decaying, exempt from archival), is_inference (derived vs. directly observed), forget_after, forget_reason, belief (fact/opinion/hypothesis), extraction_confidence, valid_from, valid_until, entities (JSON array of {name, type}), parent_version_id (FK to memories.id for procedural versioning), is_current (boolean for version chain filtering), timestamps (created_at, updated_at, last_accessed).

- **Memory versions** -- Historical snapshots of memory content.

- **Memory edges** -- Typed relationships between memories (updates, extends, derives, contradicts, caused_by, related_to) with weight and confidence.

- **Memory sources** -- Provenance records linking memories to their origin session and agent.

- **Summary blocks** -- Precomputed context summaries per scope level, rewritten during reflection. Each has: id, scope, label, content, char_limit, tier (static/dynamic), updated_at. Unique on (scope, label).

- **Enrichment log entries** -- Records of async enrichment operations.

- **Recall audit entries** -- Records of every recall operation for debugging retrieval quality.

- **Tasks** -- Async work items. Each has: ID, project, description, schedule (now, tonight, weekly), status (pending, running, completed, failed), session_reference, timestamps.

- **Bootstrap configuration** -- Cross-cutting settings governing project bootstrap that are not bound to a single type — currently the **archive path root** (where archived projects are moved during cleanup). Per-type bootstrap behavior (default directory, git-init flag, template directory) lives on the **project type** entity itself, not in this configuration. Bootstrap requires at least one project type to exist before `bootstrap_project` can be used; the legacy `area_of_focus` path-roots key is removed.

- **Project digests** -- Free-form text summaries of what a project is about, suitable for embedding, semantic matching, or drop-in context for cross-project questions. Complementary to structured capability declarations — capabilities describe *per-tool* schema, digests describe *project essence* as prose. Each digest has a kind (currently only `essence`), the digest text itself, a source-version stamp, the producer that generated it (provider + model + optional extractor, or `manual`), a generation timestamp, and an advisory token count. The version stamp is the project's source spec version when a spec is available, or a deterministic hash of the project's supported-document tree (path + mtime + size) when the project is non-code. One digest per (project, kind); refresh replaces the prior row. Digests are derived, not canonical — the source content remains authoritative, and digests become stale when the source version advances past the digest's stored version.

### 3.3 Rules and Logic {#rules}

- Every project entry must have the seven core identity fields populated: name, display_name, type, status, description, goals, area. Display_name, description, and goals may be minimal for migration entries but must be present or explicitly empty. Area may be null.
- Name must be unique within the registry. Duplicate name results in a clear error or recognized update, never a silent duplicate.
- Display_name defaults to name if not provided. Does not need to be unique. Always present in query responses at all depth levels.
- Type is a reference to a row in the user-managed `project_types` table. The legacy `area_of_focus` type was retired in the v10→v11 migration. As of schema v13 the `projects.type` CHECK constraint is replaced by a foreign key into `project_types(id)`, enforced via `project_type_id`. Writes referencing a non-existent type are rejected with `Error [INVALID_PROJECT_TYPE]`.
- Status values for projects: idea, draft, active, paused, archived, complete.
- Area must reference an existing row in the live `areas` table, or be null. The set of valid area values is computed at write time from the current state of `areas` — it is not a literal closed set. Any value not present in `areas` is rejected at write time with `Error [INVALID_AREA]`. Agents and users may create, rename, recolor, and delete areas through the Settings panel.
- Area name uniqueness is enforced against the live `areas` table at insert and rename time. Two areas cannot share a name. Renames that would collide are rejected with `Error [DUPLICATE_AREA_NAME]`.
- Renaming an area or a project type is a label-only update: the underlying row id stays the same, and every join (project assignments, memory scope routing, the Type column on Home) keeps resolving correctly without data rewrites.
- Deletion of an area is blocked when projects are attached to it. The user must reassign those projects to a different area (or to "Unassigned") before the area becomes deletable. The Settings panel surfaces the count and a reassignment picker; programmatic deletion fails with `Error [AREA_HAS_PROJECTS]` and the count.
- Deletion of a project type is blocked when projects are attached to it. The user must reassign those projects to a different type before the type becomes deletable. The Settings panel surfaces the count and a reassignment picker; programmatic deletion fails with `Error [TYPE_HAS_PROJECTS]` and the count.
- Area colors are chosen from a curated palette of 12 contrast-safe presets shared with the Chorus design system. Custom hex colors outside the palette are rejected with `Error [INVALID_AREA_COLOR]`. The palette is the same set the lane headers, area badges, and chip row render against, so every choice is guaranteed to read correctly on both light and dark surfaces.
- Area assignment is nullable forever. There is no deadline, no migration cutoff, and no status change forces assignment. Unassigned projects work identically to assigned projects for every operation except area-filtered queries and memory scope inheritance. `get_registry_stats` surfaces an unassigned count.
- A project cannot be its own parent. Setting `parent_project_id` to a project's own id is rejected.
- A project cannot be assigned a parent that is already a descendant of it. Cycle detection walks the parent chain at write time; on violation, `set_parent_project` and `register_project`/`update_project` fail with `Error [PARENT_CYCLE]` and the exact message: "Cannot set parent: {child-name} is a descendant of {project-name}. Moving it would create a cycle."
- A project's parent is another project, never an area. Areas are not part of the parent-child graph.
- Archiving a parent project does not cascade to children. Children remain active; their `parent_project_id` is preserved. In detail views, an archived parent is rendered with an "(archived)" tag alongside the link. Deleting a parent (via `ON DELETE SET NULL` on the foreign key) clears the link on children without affecting them otherwise.
- Producers write to their own field domains. A field write from producer A does not alter fields from producer B. The registry tracks which producer last wrote each field.
- Fields not in the default catalog are accepted and stored without error. The catalog is advisory.
- Queries at summary depth return only: name, display_name, type, status, one-line description. Standard depth adds template-relevant extended fields. Full depth returns everything.
- Filtering by type and status is precise -- no cross-contamination. Both filters compose.
- Multiple filesystem paths per project are stored as equal members. No path is designated primary.
- Tasks must have a description and a schedule. Project is optional.
- Task status transitions follow a strict lifecycle: pending → running → completed (or failed). No backward transitions. Failed tasks can be re-queued as new tasks.
- The async worker only transitions a task to "running" when it is about to spawn the CC session.
- Cross-project queries: scope="registry" searches fields; scope="memories" delegates to recall; scope="all" searches fields + recall + CC auto-memory files. Missing memory files are silently skipped.
- Cross-project query results ranked by composite score: relevance, freshness (time-decay on `updated_at`), and importance (high-signal keyword boost). Core identity fields are evergreen (exempt from time decay). Scoring is deterministic within SQLite.
- Weekly tasks are re-queued as new pending tasks after completion. Original preserved for history.
- Port numbers must be integers in range 3000--9999.
- Port numbers are strictly unique globally. Attempting to claim a held port fails with owner identification.
- Auto-allocation assigns the lowest available port in 3000--9999.
- Releasing a port not claimed by the specified project is a no-op (idempotent).
- A project can claim multiple ports. A port can only be held by one project.
- Port claims persist until explicitly released. Not ephemeral or session-scoped.
- Port assignments included in standard and full depth queries. Summary depth does not include ports.
- Port discovery scans: `vite.config.ts`, `vite.config.js`, `vite.config.mts`, `vite.config.mjs`, `package.json` (scripts with `--port`), `docker-compose.yml`, `docker-compose.yaml`, `.env`, `next.config.js`, `next.config.mjs`, `next.config.ts`, `angular.json`, `webpack.config.js`, `nuxt.config.ts`, `.env.local`, `.env.development`.
- Port extraction uses pattern matching appropriate to each file type.
- During port discovery, ports already claimed by the same project are silently skipped (idempotent). Ports claimed by a different project are skipped and reported.
- Service labels during discovery derived from context (config file type, service name, variable name).
- Port discovery requires the project to be registered with at least one filesystem path.
- Archiving a project preserves all metadata but releases port claims and clears capability declarations. Status transitions to "archived." Archived projects remain queryable.
- `update_project` only modifies fields explicitly provided. Name and type are not updatable through `update_project`. Name is updatable only through the dedicated `rename_project` operation, which atomically rewrites all references. Type is never updatable.
- `batch_update` is atomic: all matching projects are updated in a single transaction, or none are. Requires at least one filter criterion.
- `batch_update` with `dry_run=true` returns match list and proposed changes without committing.
- Cross-project task dispatch via `queue_task` with a project filter fans out into independent tasks. Requires at least one filter criterion.
- Fanned-out tasks execute independently. One failure does not affect others.
- Capability writes use replace semantics. Absent capabilities from new writes are removed.
- Each capability must have at minimum a name, type, and description. Inputs, outputs, and invocation metadata are optional.
- Capability types are open-ended strings, not a closed enum.
- `query_capabilities` with no filters returns all capabilities across all projects. Filters compose.
- A project with no capabilities returns an empty set, not an error.
- Capabilities queryable at standard and full depth. Summary depth excludes capabilities.
- The MCP server self-registers setlist's own capabilities on every startup via code introspection across three surfaces (MCP tools, CLI commands, `@setlist/core` library exports). The operation is idempotent — a no-op when the registry already matches the running code — and silent when a no-op. If the `setlist` project row is missing, it is created first with `area: Infrastructure` and `type: project`. Failure to introspect one surface does not block the other two; the server logs a warning and continues.
- Memory content-hash dedup: `sha256(type + ":" + normalized_content)[:16]`. Matching hash → reinforce, not duplicate.
- Reinforcement: reinforcement_count starts at 1. Repeat observation increments by 1. Boost in recall via `log(reinforcement_count + 1)`.
- Triple-gate archival: ALL three conditions must hold: quality/importance < 0.3 AND access count < 2 AND age > 90 days.
- EMA outcome scoring: `outcome_score = outcome_score + alpha * (signal - outcome_score)`, alpha = 0.1, signal = 1.0 (success) or 0.0 (failure).
- Budget-controlled recall: response never exceeds caller's token budget. Memories in score order, L0 first, expanding to L1/L2.
- FTS5-first retrieval: FTS5 always available regardless of embedding provider. All other features work identically without embeddings.
- Four-level scope isolation with area inheritance: recall for a project returns memories at project + area + portfolio + global scope. The area level resolves via the project's `area_id`: an area-scoped memory is visible to every project sharing that `area_id`. Without project context, portfolio + global only. Project A memories never leak to project B recall unless both projects share an area and the memory is area-scoped. A project with `area_id = NULL` sees only project + portfolio + global memories — it has no area tier. The `area_of_focus` memory scope value from schema v10 has been retired; existing area_of_focus-scoped memories are migrated to `area` scope in v11 and rekeyed to the relevant canonical area id.
- Recall audit logging: every recall logged with query, scope, budget, results, scores. Append-only, pruned during reflection.
- Corrections create type `correction` with importance >= 0.9, `contradicts` edge. Corrected memory archived immediately. Corrections never subject to triple-gate archival.
- Reflection runs on internal schedule, separate from async task worker. Triggers: cumulative importance threshold, periodic schedule, or manual invocation.
- Embedding provider is runtime configuration. Changing does not invalidate existing embeddings. Dual-column pattern supports gradual migration.
- Memory types are a closed set: decision, outcome, pattern, preference, dependency, correction, learning, context, procedural, observation. Unknown types rejected at retain time. The `skill` type is retired as of schema v10 — existing skill memories are migrated to `procedural` during the v9→v10 upgrade.
- Per-type decay rates multiply the time-decay exponent: correction=0.25, preference=0.25, procedural=0.5, observation=0.5, decision=1.0, dependency=1.0, learning=1.0, outcome=1.5, pattern=1.5, context=2.0. Lower rate = slower fade.
- Belief classification is optional. When provided, must be one of: fact, opinion, hypothesis. Null is valid and means unclassified.
- Temporal validity: valid_from and valid_until are optional ISO timestamps. Memories with valid_until in the past receive a scoring penalty in recall but are not automatically archived. Reflection may archive memories whose valid_until is more than 90 days in the past.
- Entity field is optional JSON. When provided, must be an array of objects with `name` (string) and `type` (string, one of: person, organization, project, topic). Stored denormalized for fast reads.
- Procedural versioning: parent_version_id must reference an existing memory of type `procedural`. When set, the referenced memory's is_current is set to false. Recall filters to is_current=true by default for procedural types. inspect_memory shows the full version chain.
- Context-type memories are exempt from pinning (is_pinned is always false for context type). They exist for cross-session bridging, not permanent reference.
- Query intent classification is implemented as a no-op pending the retrieval legs (vector, graph) required for weight fusion. See §2.12 `#deferred-aspirations`.
- Type-priority budget allocation across memory types is a studied future behavior, not a current rule. See §2.12 `#deferred-aspirations`.
- Proactive contradiction detection runs during retain for preference, correction, and learning types. Auto-resolves when embeddings available (similarity > 0.85 with different conclusion). Flags for review in FTS5-only mode.
- Every memory must have content and type. Project, scope, tags, session_id, agent_role are optional. Scope defaults to "project" when project provided, "global" when not.

**Project digest rules:**

- A digest is uniquely identified by `(project_id, digest_kind)`. One row per pair. v11 introduces a single canonical kind, `essence`; the schema admits future kinds without migration.
- `refresh_project_digest` writes replace the prior row for the `(project, kind)` pair. The prior row's `spec_version` is returned to the writer for drift logging.
- Every digest row carries: `digest_text` (free-form prose), `spec_version` (the source version stamp at generation time — either a spec-version string for code projects or a file-tree hash for non-code projects), `producer` (free-form identifier encoded as `<provider-tag>[+<extractor-tag>]`, or `manual`), `generated_at` (ISO 8601), and optional `token_count` (advisory).
- Digests are bounded: target is 500–800 tokens, hard ceiling 1200 tokens. Writes exceeding the ceiling are rejected with a trim-and-retry error. The ceiling is enforced per digest kind — configurable in code, not hard-coded into the MCP surface.
- Staleness is computed at read time, not stored. `get_project_digest` and `get_project_digests` set `stale: true` when the target project's current version stamp differs from the digest's stored stamp. The current stamp is resolved the same way it was at write time — spec-version for code projects, file-tree hash for non-code — so consumers never need to know which kind of project they're reading. Stale digests are still returned; consumers decide whether to use them.
- `get_project_digest` returns `null` for a project with no digest of the requested kind. `get_project_digests` omits such projects from its result map unless `include_missing: true` is set.
- Digest generation lives outside the MCP server — in `@setlist/cli` (`setlist digest refresh`). The MCP surface accepts whatever the CLI (or any other writer) provides; it does not call an LLM.
- Archiving a project cascades: `project_digests` rows are removed via `ON DELETE CASCADE` on the `project_id` foreign key. Re-registering a project with the same name yields a fresh digest slot.

**Digest generator rules (v0.21):**

- The generator resolves each project's source along a cascade: (1) `.fctry/spec.md` → (2) `CLAUDE.md` → (3) `README.md` → (4) document extraction from the project root. The first path to produce text wins; the remaining paths are not consulted.
- Code vs non-code is inferred, not declared. A project is treated as code when a spec-version can be extracted from YAML frontmatter in the resolved source file; otherwise it is treated as non-code and the version stamp becomes the file-tree hash.
- The file-tree hash is a deterministic sha256 over `"<relative_path>:<mtime>:<size>"` entries (sorted, supported-document types only, one level deep by default), truncated to 16 hex characters. Any supported file changing, being added, removed, moved, or resized flips the hash.
- Supported document types: `.md`, `.txt`, `.html` read natively by `@setlist/cli`; `.pdf`, `.docx`, `.pptx`, `.xlsx` extracted via a Python subprocess helper (`docling` by default). Extracted text is concatenated in alphabetical order and fed to the same LLM pipeline that handles code specs.
- Provider selection is controlled by `SETLIST_DIGEST_PROVIDER`. Default is `openrouter-flash-lite`; `openrouter-flash` is an opt-in upgrade for higher-capability runs; `local-mlx` is the explicit fallback. The OpenRouter branch requires `SETLIST_OPENROUTER_API_KEY`; absent that key, the generator transparently falls through to `local-mlx` and logs one INFO line. Two consecutive 5xx responses from OpenRouter on a single project also trigger a single-project fallback to `local-mlx` for that project; later projects in the batch retry OpenRouter first.
- Cost attribution headers on every OpenRouter call: `HTTP-Referer` identifying setlist as the app, `X-Title: setlist-digest-generator`. Setlist uses a dedicated OpenRouter key (separate from every other portfolio project's key) so that generator spend is attributable on a single billing row.
- Input size handling is provider-aware. The hosted providers (Flash-Lite, Flash) accept the full source without truncation — their 1M-token context window is larger than any realistic spec. The local MLX branch head-truncates at 400 000 characters (~100k tokens) before sending and logs one line when truncation fires.
- The `producer` tag encodes the full generation path as `<provider-tag>[+<extractor-tag>]`. Examples: `openrouter-google/gemini-2.5-flash-lite`, `openrouter-google/gemini-2.5-flash-lite+docling-2.18`, `local-mlx-community/Qwen3.6-35B-A3B-8bit`. Consumers that care about provenance have enough signal; consumers that only care about text ignore the tag.
- The generator enforces a client-side per-invocation cost ceiling (default $1.00 of estimated OpenRouter spend, counted from input + output token estimates at the current model's published rates). On breach, remaining projects in the batch skip the hosted path and go straight to `local-mlx` or skip entirely if local is unreachable.

**Digest generator rules (v0.22):**

- Multi-project refresh command. `setlist digest refresh <project-a> <project-b> ...` accepts one or more positional project names and processes every named project serially. The user sees per-project progress as each project begins and finishes (e.g., `Refreshing fam-estate-planning …`), and a single summary line at the end: `Done: N refreshed, M failed (of N total)`. `--all` continues to cover portfolio-wide refresh and is not combinable with positional arguments. The prior single-project form (`setlist digest refresh <project>`) is a natural subset of the N-project form and continues to work unchanged. **Silent drop of extra positional arguments is prohibited** — the user must never walk away believing three projects were refreshed when only one was touched. Parallelism across projects is out of scope in v0.22; serial processing is the contract.
- Document walker ignore patterns. For non-code projects, the document walker skips underscore-prefixed subdirectories (`_Duplicates/`, `_archive/`, `_old/`, `_drafts/`, etc.) by default. This is the baseline convention — zero configuration, catches the common case where a human has set folders aside to signal "not part of the canonical set." Projects may add a `.digestignore` file at the project root using gitignore-style syntax (line-based patterns, `#` for comments, leading `!` to re-include) for additional skip patterns or to override the underscore default. When both rules apply, the default underscore skip and `.digestignore` compose as a union — any file matched by either rule is excluded. Code projects are unaffected: the walker for code projects remains depth-1 only, so `node_modules/`, `.venv/`, `dist/`, and similar build-artifact directories are unreachable by construction and need no explicit rule. The file-tree hash (defined above) is computed over the post-ignore file set — adding a `.digestignore` entry for an existing file flips the hash on the next refresh, which is the intended staleness signal.

**TypeScript-specific rules:**

- better-sqlite3 provides synchronous database access. All database operations are synchronous calls. The library API may expose async wrappers for ergonomic consistency.
- WAL mode is enabled on database initialization.
- FTS5 extension is used for memory full-text search. better-sqlite3 bundles FTS5 support.

### 3.4 External Connections {#connections}

| Connects To | What Flows | Direction | If Unavailable |
|-------------|-----------|-----------|---------------|
| fctry | Project identity (core + technical fields), port claims, capability declarations after builds | fctry writes via MCP or library import | fctry continues; registry entry not created |
| Chorus | Project identity, memory CRUD (all 10 types), capability exchange, port management | Chorus imports @setlist/core as npm dependency (`file:` reference). Reads/writes memory via MemoryStore and MemoryRetrieval directly (in-process, synchronous). Chorus is the primary producer of learning, context, preference, decision, correction, and procedural types. Setlist is canonical store; Chorus maintains local vector/FTS5/graph indices for fast retrieval. | Chorus falls back to local-only memory (no cross-project awareness, no portfolio memories) |
| Ensemble | Memory retain/recall, library import of @setlist/core | Ensemble reads/writes via direct import | Ensemble continues without memory |
| Knowmarks | Project metadata (name, description, goals, keywords, tech stack) | Knowmarks reads from registry | Falls back to regex extraction |
| ctx | Project context (description, goals, status, tech stack) | ctx reads from registry | Operates without project context |
| Claude Code (via MCP) | All 39 tools | CC reads/writes via @setlist/mcp | CC has no project awareness; MCP server provides it |
| Async worker (launchd) | Task execution | Worker reads tasks, spawns CC sessions, writes results | Tasks remain pending until worker runs |
| CC auto-memory files | Per-project patterns and decisions (`MEMORY.md`) | cross_query reads from filesystem | Cross-project queries limited to registry fields + structured memories |
| Embedding provider (OpenAI / Ollama) | Vector embeddings for memory content | Registry sends content, receives embeddings | FTS5-only fallback. All other features work identically. |
| OpenRouter (digest generator, outbound from `@setlist/cli` only) | Project source text → digest summary, authenticated with a setlist-dedicated API key, tagged per-call for cost attribution | `@setlist/cli digest refresh` sends OpenAI-compatible chat completion requests; never called from `@setlist/core`, `@setlist/mcp`, or `@setlist/app` | Generator falls back to the local MLX endpoint. If local is also unreachable, the project is skipped with a clear message; existing digests are unaffected. |
| Local MLX endpoint (`http://m4-pro.local:8000/v1`, home M4 Pro) | Fallback digest generation when OpenRouter is unconfigured or returns repeated 5xx | `@setlist/cli digest refresh` sends OpenAI-compatible chat completion requests with head-truncated source on oversized inputs | Generator retries twice with exponential backoff, then skips the project with a clear message; existing digests are unaffected. |
| Docling (Python subprocess from `@setlist/cli`) | PDF / DOCX / PPTX / XLSX → markdown for non-code project digests | `@setlist/cli` spawns `python3 extract.py <file>` per supported document; stdout is captured as markdown | Non-code projects with Office/PDF inputs skip extraction for those formats; if plain-text sources (`.md` / `.txt` / `.html`) are present, extraction proceeds using those only. |
| fctry post-build hook | Build outcome (success/failure) + recalled memory IDs | fctry writes feedback to registry | Memory outcome scores not updated for explicit builds |
| chorus-ui package | Design tokens (CSS custom properties + TS constants) for colors, typography, easing | @setlist/app imports `chorus-ui/tokens.css` and `chorus-ui/tokens` | Tokens are the contract; chorus-ui is a direct dependency of @setlist/app |

**MCP tool validation at startup.** The MCP server validates its own tool definitions when it starts -- tool names, parameter schemas, and descriptions are checked for conformance before the server accepts connections. This catches configuration drift between @setlist/core and @setlist/mcp (e.g., a new tool added to core but not wired into the MCP wrapper). If validation fails, the server surfaces the specific tools that are non-conformant rather than silently starting with broken definitions.

**Progress reporting for long-running operations.** Long-running MCP operations -- reflect, batch operations, cross-project queries -- report progress through the MCP protocol's progress notification mechanism rather than blocking until completion. Callers see incremental status updates ("dedup pass complete, starting entity extraction...") instead of a silent wait followed by a large response.

**Direct library import.** Chorus and Ensemble import @setlist/core as an npm dependency. The library is consumed in-process -- no IPC, no MCP server, no subprocess.

**chorus-ui token package (new with @setlist/app).** The desktop app imports design tokens from `chorus-ui`, an extracted package providing CSS custom properties (`chorus-ui/tokens.css`) and TypeScript constants (`chorus-ui/tokens`). This is a direct dependency — @setlist/app lists `chorus-ui` in its `package.json`. There is no shared component library — each app implements its own UI components consuming the shared tokens. If the design language evolves, `chorus-ui` is updated and both apps follow.

### 3.5 Performance Expectations {#performance}

better-sqlite3 provides synchronous native SQLite bindings with no async wrapper overhead:

- A summary query across all 40+ projects completes in well under one second. This is startup-path performance.
- An individual project query at full depth completes near-instantly.
- Performance is characteristic of a local SQLite query, not a filesystem scan or network call.
- Query time does not degrade meaningfully as project count grows from 10 to 100.
- Task queue operations complete near-instantly.
- The async worker completes its check-and-spawn cycle in under 5 seconds when no tasks are pending.
- Cross-project queries with scope="registry" complete in under 1 second. scope="all" may take up to 5 seconds due to filesystem reads.
- Port operations complete near-instantly.
- Capability queries complete in under 1 second.
- Capability writes complete near-instantly (delete-and-insert within a single transaction).
- Memory retain completes in under 50ms (hot path). No LLM processing in synchronous path. Enrichment happens asynchronously.
- Memory recall completes within budget constraint in under 1 second for typical populations. FTS5-only recall is faster than hybrid. Bootstrap recall is optimized to return precomputed summary blocks.
- Memory reflection has no latency target. Typical cycle under 60 seconds for several thousand memories.
- Memory feedback completes near-instantly.

**Pattern study (deferred): wake-up context snapshot.** A pre-computed `portfolio_brief` bundle (pinned + recent decisions + active procedurals), cached and served cheaply rather than recomputed per call, is under study as a latency optimization for session-start flows. Cross-referenced from §2.3 `#querying` where the behavioral framing lives. Open question — cache-invalidation trigger — is load-bearing for whether this pattern is adopted. No current latency target is committed, and today's `portfolio_brief` remains a from-scratch assembly. Source: mindbank (§6.1).

---

## 4. Boundaries and Constraints

### 4.1 Scope {#scope}

**This spec covers:**

- Project identity: registration, fields, queries at variable depth, filtering, migration, archive
- Port allocation: claim, release, discovery, conflict resolution
- Capability declarations: per-project registration and cross-ecosystem query
- Portfolio memory: retain, recall, reflect, correct, feedback, forget across 10 memory types with belief classification, temporal validity, entity extraction, and procedural versioning
- Cross-project queries and batch operations
- Task dispatch and the async worker
- The npm monorepo structure (@setlist/core, @setlist/mcp, @setlist/cli, @setlist/app)
- TypeScript type system for the registry API (interfaces, enums, type guards)
- better-sqlite3 synchronous API patterns
- @modelcontextprotocol/sdk integration for the MCP server
- npm distribution and package.json configuration
- Schema v13 (current): adds the user-managed `project_types` table, replaces the `projects.type` CHECK with a foreign key into it, and reclassifies the `areas` table from system-owned to user-managed. Builds on v12's `project_digests` table, v11's structural `area_id` and `parent_project_id` columns, and v10's unified memory store. Migration history from v8 documented in §5.
- Per-project essence digests: free-form summaries versioned by spec version, generated out-of-process by `@setlist/cli digest refresh`, stored and served by `@setlist/core` and `@setlist/mcp`. Complementary to structured capability declarations.
- Testing discipline: scenarios as contract (see §4.5 `#testing-discipline`); vitest as optional unit-level canary
- Portfolio intelligence support: the `observation` memory type and `portfolio_brief` tool that enable external agents (orchestrator) to retain and recall cross-project findings
- Unified memory store: setlist as the canonical memory backend for Chorus. Chorus imports @setlist/core directly for in-process memory operations.
- Project bootstrap: end-to-end project creation (registration + folder scaffolding + template population + git init for code projects) with configurable path roots per type and template directory. Subsumes the manual `new-project.sh` script.
- Desktop control panel: Electron-based macOS application (@setlist/app) providing a project dashboard, tabbed project detail views, and project CRUD (register, edit, archive, rename). Memory, capabilities, and ports are read-only in v1. Shares Chorus's design system (Tailwind CSS 4, Radix UI, design tokens).

**This spec does NOT cover (deferred):**

- Consumer-driven schema composition
- Lifecycle propagation
- Notifications and self-healing
- Visibility and privacy boundaries
- Workspace launching beyond context switching
- Community template sharing
- Non-local project support
- Calendar integration
- Structured task result extraction

### 4.2 Platform and Environment {#platform}

| Dimension | Constraint |
|-----------|-----------|
| Platform | macOS (single machine, the user's personal workstation) |
| Runtime | Node.js (LTS). Local execution only. MCP server (stdio, CC-managed). Worker (launchd periodic job). Electron (desktop app). |
| Language | TypeScript, compiled to ESM |
| Storage | SQLite via better-sqlite3, single file on local filesystem |
| UI framework | React (renderer), Tailwind CSS 4, Radix UI primitives |
| Desktop shell | Electron (main process imports @setlist/core, renderer via IPC bridge) |
| Users | Single user, no authentication, no multi-tenancy |
| Connectivity | Works entirely offline; optional internet for OpenAI embeddings |
| Consumers | Programmatic: agents, scripts, tools, npm dependents (Chorus, Ensemble). Visual: the user via @setlist/app. |
| Package manager | npm workspaces |

### 4.3 Hard Constraints {#hard-constraints}

- **Producers write disjoint field sets.** Each structured field on a project has exactly one authoritative producer. Producers never overwrite each other. `register_project` / `update_project` own identity; `enrich_project` owns profile fields (goals, topics, entities); `write_fields` owns structured descriptive fields. Capability declarations are producer-attributed.

- **Registration, not discovery.** The registry never scans the filesystem. A project exists in the registry only because it was explicitly registered. If a project is missing from the registry, it's absent from the user's ecosystem from the registry's point of view, regardless of whether a directory exists on disk.

- **Single authoritative SQLite file.** The database at `~/.local/share/project-registry/registry.db` is the sole storage mechanism. No per-project manifest files. No distributed state. All consumers open this file (directly via `@setlist/core`, or indirectly via the MCP server).

- **SQLite via better-sqlite3, synchronous API.** The database binding is better-sqlite3, which provides synchronous, native SQLite access. This is a deliberate choice: synchronous calls are simpler, faster, and avoid the callback/promise complexity that async SQLite wrappers introduce for a local database. The library API may expose async signatures for ergonomic consistency, but the underlying operations are synchronous.

- **Schema v13 (current).** v13 introduces the user-managed `project_types` table (with seeded Code project and Non-code project defaults), replaces the `projects.type` CHECK constraint with a foreign key into `project_types`, and reclassifies the `areas` table from system-owned to user-managed. Builds on v12 (`project_digests`) and v11 (canonical `areas` table, `projects.area_id`, `projects.parent_project_id`, retired `area_of_focus` project type, area-scope memory remap). Migration history from v8 is documented in §5. Schema migrations are incremental and non-destructive; existing data is never lost during upgrades.

- **39 MCP tools.** The MCP server exposes 39 tools covering identity, capabilities, memory (agent and admin), ports, tasks, bootstrap, and health. Tool names, parameter shapes, and response shapes are defined in this spec and stable across patch releases.

- **ESM-only.** All packages produce ESM output. No CommonJS dual-publishing.

- **Electron security: no nodeIntegration in renderer.** The renderer process must not have direct access to Node.js APIs. All communication between the renderer and main process flows through Electron's `contextBridge` with explicitly exposed IPC methods. The main process imports @setlist/core and exposes a defined set of operations; the renderer calls these through the preload script. This is a hard security boundary.

- **Single-instance Electron app.** Only one instance of the desktop app may run at a time. Attempting to launch a second instance activates the existing window. This prevents database contention and user confusion.

- **Signed and notarized release builds.** Release builds must be signed with a Developer ID certificate and notarized by Apple. The auto-update feature depends on this for binary delivery to pass Gatekeeper — without notarization, auto-updated binaries are quarantined by macOS on first delivery and the update surface is effectively broken. The build pipeline must wire Apple credentials into the electron-builder configuration; any `notarize: false` override in `packages/app/electron-builder.yml` is incorrect and must be reversed before a release channel ships to users.

### 4.4 Anti-Patterns {#anti-patterns}

- **Setlist must not scan the filesystem to discover projects.** Registration is explicit. A project exists in the registry only because something called `register_project`.

- **Setlist must not allow multiple producers to write the same field.** Atomized identity means each field has one authoritative producer. Overlapping producers create drift.

- **Setlist must not silently accept inconsistent state.** If a query cannot be served (project not found, port already claimed, capability conflict), the registry surfaces the inconsistency rather than papering over it.

- **Setlist must not add async where sync suffices.** better-sqlite3 is synchronous. Wrapping every call in async/await adds complexity without benefit for a local database. Use async only where genuinely needed (embedding API calls, file system operations, worker process management).

- **Schema evolution must be incremental and non-destructive.** Each version upgrade must handle the full migration path. Existing data must never be lost during upgrades. New columns use nullable defaults or sensible initial values. The `skill` → `procedural` type migration in v10 and the `area_of_focus` → `project` + canonical-area reclassification in v11 are data migrations within the table-recreate pattern.

- **Setlist must not re-invent MCP tool semantics.** The 39 tools have defined parameter names, types, and response shapes. Setlist implements them; it does not redesign them.

### 4.5 Testing Discipline {#testing-discipline}

**Load-bearing invariant.** Scenarios are the contract. The holdout set in `.fctry/scenarios.md` (118 scenarios as of spec 0.25), evaluated by LLM-as-judge, is the only true signal that the system is correct. Every other check in the test stack — type checking, unit tests (vitest), end-to-end tests (Playwright), the pre-flight ABI check, and the automated Electron security check — is a canary: an early-warning system that catches drift before it reaches the scenario evaluator. Canaries are necessary, but none of them is sufficient. A passing PR signals "the canaries sing." Scenario satisfaction signals "the system is actually correct." The reader should feel the difference.

**CI scope is narrow by design.** Continuous integration runs exactly three gates on every pull request: type checking, unit tests, and build. Nothing else. The end-to-end Playwright suite and the pre-flight ABI check are deliberately local-only — both are too expensive and too flaky to run reliably in a hosted CI environment, and their failure modes are more informative when a human or an Observer agent is watching the local output. This asymmetry is an intentional design decision, not a coverage gap. The spec commits to keeping CI fast and high-signal; the heavier checks run where they work well, which is on the user's own machine.

**Electron security posture is a hard guarantee.** The renderer process must never have direct access to Node.js APIs. Two settings enforce this: `nodeIntegration: false` and `contextIsolation: true`, both configured in the Electron `BrowserWindow` constructor in the main-process entry file. These values are non-negotiable. An automated check fires at edit time against any file in `packages/app/src/main/` or the renderer tree — an edit that attempts to introduce `nodeIntegration: true` or `contextIsolation: false` is refused before it can land. The check is enforced by a local hook; its refusal surface is the edit tool itself. This is the enforcement mechanism that makes the security rule in §4.3 `#hard-constraints` ("Electron security: no nodeIntegration in renderer") observable — without it, the constraint is only a promise.

**Pre-flight ABI check is release-blocking for packaged builds.** Before the Electron app is packaged into a distributable `.app` bundle, the build pipeline verifies that the `better-sqlite3` native binding on disk matches the Electron ABI (not the standalone Node ABI used by the Claude Desktop integration). A wrong-ABI state at package time halts the release in the same severity class as a missing Developer ID certificate or a missing Apple notarization credential (§4.3 `#hard-constraints`) — the release does not proceed, and the failure names the recovery command. During local development, the same check is advisory: a wrong-ABI state produces a visible warning but the local build continues, because developers routinely swap the binary back and forth and a hard fail would be noisy and wrong. The asymmetry — advisory during dev, blocking at packaging — is the point: local development tolerates drift; release builds do not. See §5.4 `#native-binding-hygiene` for why dual ABIs exist and how the swap mechanism works.

**What each layer protects against.**

| Layer | Runs where | Catches |
|------|-----------|---------|
| Scenarios (truth) | LLM judge (local or scheduled) | Behavioral drift against the spec |
| Type checking | CI + local | Type-level contract violations across @setlist/core, @setlist/mcp, @setlist/cli, @setlist/app |
| Unit tests (vitest) | CI + local | Regressions in targeted @setlist/core logic |
| Build | CI + local | Packaging or module-resolution failures |
| E2E (Playwright) | Local only | Desktop UI regressions end-to-end |
| Pre-flight ABI check | Local only — advisory in dev, blocking at packaging | Wrong-ABI `better-sqlite3` binding in the packaged app (see §5.4 `#native-binding-hygiene`) |
| Electron security check | Edit time (local hook) | `nodeIntegration: true` or `contextIsolation: false` introduced into main-process or renderer files |

Everything above the scenario row is a canary. Everything below needs to be readable and actionable — when a canary fails, a human or agent should be able to tell, in one glance, which layer caught it and what to do.

---

## 5. Implementation Architecture

### 5.1 Monorepo Structure {#monorepo}

```
setlist/
├── packages/
│   ├── core/                        # @setlist/core
│   │   ├── src/
│   │   │   ├── index.ts             # Public API exports
│   │   │   ├── registry.ts          # Core Registry class (identity, fields, ports, capabilities, tasks, batch)
│   │   │   ├── db.ts                # Schema init, migrations, connections, templates, field catalog
│   │   │   ├── models.ts            # Interfaces, enums, type definitions
│   │   │   ├── fields.ts            # Field serialization and producer-scoped writes
│   │   │   ├── errors.ts            # Structured errors with fuzzy match suggestions
│   │   │   ├── migration.ts         # Filesystem scan and bootstrap (4 richness tiers)
│   │   │   ├── port-discovery.ts    # Config file port scanning
│   │   │   ├── yaml-parse.ts        # Minimal YAML parser for NLSpec frontmatter
│   │   │   ├── memory.ts            # Memory store (retain, feedback, correct, forget, inspect, configure)
│   │   │   ├── memory-retrieval.ts  # Hybrid retrieval (recall, FTS5, budget control)
│   │   │   ├── memory-reflection.ts # Background consolidation (reflect, triple-gate archival)
│   │   │   ├── cross-query.ts       # Cross-project search (3 scopes)
│   │   │   ├── migrate-memories.ts  # Memory migration (CC auto-memory + fctry memory → registry)
│   │   │   ├── bootstrap.ts         # Project bootstrap (folder creation, templates, git init)
│   │   │   ├── health.ts            # Composite project health assessment (activity, completeness, outcomes)
│   │   │   └── project-version.ts   # Digest staleness source-of-truth (spec version + file-tree hash, .digestignore)
│   │   ├── scripts/                 # One-shot data-migration utilities (not part of shipped surface)
│   │   ├── tests/                   # Unit tests (vitest)
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── mcp/                         # @setlist/mcp
│   │   ├── src/
│   │   │   ├── index.ts             # MCP server entry point
│   │   │   └── server.ts            # 39 tool definitions
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── cli/                         # @setlist/cli
│   │   ├── src/
│   │   │   ├── index.ts             # CLI entry point (subcommands inlined as a switch statement)
│   │   │   ├── digest.ts            # Digest refresh runner (provider cascade, cost ceiling, fallback)
│   │   │   └── worker.ts            # Async worker (launchd target)
│   │   ├── python/
│   │   │   └── extract.py           # Docling subprocess helper for non-code document extraction (see §3.3)
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── app/                         # @setlist/app
│       ├── src/
│       │   ├── main/                # Electron main process
│       │   │   ├── index.ts         # App entry point, window management, single-instance enforcement
│       │   │   ├── ipc.ts           # IPC handlers (bridges @setlist/core to renderer)
│       │   │   ├── auto-update.ts   # electron-updater integration (stable/beta channels)
│       │   │   ├── menu.ts          # Application menu (includes "Check for Updates…" item)
│       │   │   ├── prefs.ts         # User preferences persistence (channel, lane collapse, etc.)
│       │   │   └── quit-prompt.ts   # "Install update on quit?" confirmation flow
│       │   ├── preload/
│       │   │   └── index.ts         # contextBridge API exposure
│       │   └── renderer/            # React application
│       │       ├── App.tsx           # Root component, routing
│       │       ├── views/            # HomeView, ProjectDetailView, SettingsView
│       │       ├── components/       # Cards, tabs, forms, shared UI
│       │       ├── hooks/            # Custom React hooks
│       │       ├── lib/              # Renderer utilities and helpers
│       │       └── styles/           # Tailwind config, design tokens
│       ├── build/                    # Build-time assets (icons, entitlements)
│       ├── e2e/                      # End-to-end tests (Playwright harness)
│       ├── scripts/                  # Helper scripts (e.g. with-electron-abi.sh)
│       ├── native-cache/             # Local cache of Node vs Electron better-sqlite3 binaries (gitignored)
│       ├── electron-builder.yml      # Packaging + signing + notarization + update-channel config
│       ├── package.json
│       └── tsconfig.json
├── scripts/                         # Top-level helpers (e.g. verify-mcp-abi.sh — MCP/Electron ABI preflight)
├── package.json                     # Workspace root
├── tsconfig.json                    # Base TypeScript config
├── CLAUDE.md                        # Project instructions
└── .fctry/                          # Factory specification
```

### 5.2 Schema Compatibility {#schema}

The SQLite schema v13 is the current schema. Evolution history: v8 was the initial schema carried over at the port point from `project-registry-service` (see §1.5); v9 added the `observation` memory type; v10 added unified memory types and chorus-compatible fields; v11 introduced canonical areas, first-class structural columns on `projects`, and retired the `area_of_focus` project type; v12 added the `project_digests` table for free-form project essence summaries; **v13 introduces the `project_types` table, replaces the `projects.type` CHECK constraint with a foreign key into `project_types`, and reclassifies the `areas` table from system-owned to user-managed.**

**Tables (20):**
- `projects` — core identity columns (name PK, display_name, project_type_id INTEGER NOT NULL REFERENCES project_types(id), status, description, goals, area_id INTEGER REFERENCES areas(id), parent_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL, created_at, updated_at). `area_id` and `parent_project_id` are nullable forever. (Implementation note: the agent may keep the legacy `type TEXT` column populated as a denormalized convenience or remove it entirely — the canonical type lookup is the FK.)
- `areas` — user-managed organizational buckets (id INTEGER PK, name TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, description TEXT, color TEXT). Seeded at v10→v11 migration with seven rows (Work, Family, Home, Health, Finance, Personal, Infrastructure) and reclassified to user-managed in v13. The seven seeds hold no special status after install — they may be edited or deleted (subject to the deletion-when-projects-attached rule in `#rules` (3.3)). The legacy "no INSERT/UPDATE/DELETE from tools" constraint is removed.
- `project_types` — user-managed project kinds governing bootstrap behavior (id INTEGER PK, name TEXT UNIQUE NOT NULL, default_directory TEXT NOT NULL, git_init INTEGER NOT NULL DEFAULT 0, template_directory TEXT, color TEXT, created_at TEXT). Seeded in v12→v13 migration with two rows: **Code project** (default_directory `~/Code`, git_init = 1, template_directory NULL) and **Non-code project** (default_directory `~/Projects`, git_init = 0, template_directory NULL). Both are user-editable and user-deletable once detached from any projects.
- `project_paths` — filesystem paths (project_id FK, path, added_at, added_by)
- `project_fields` — EAV table for extended fields (project_id FK, field_name, field_value, producer, updated_at)
- `field_catalog` — master list of known fields (name PK, type, category, description). Advisory — fields not in the catalog are still accepted.
- `templates` — project type templates (name PK, description). Two canonical templates as of schema v11: code_project, non_code_project. The legacy `area_of_focus` template was retired in the v10→v11 migration.
- `template_fields` — maps templates to field names (template_name FK, field_name FK). Governs which fields appear at standard depth.
- `schema_meta` — schema version tracking (key PK, value). Stores `schema_version = 13`. Legacy keys related to the retired `area_of_focus` bootstrap type (notably `bootstrap_path_root_area_of_focus`) are removed in the v13 migration.
- `project_ports` — port allocations (id PK, project_id FK, port UNIQUE, service_label, protocol, claimed_by, claimed_at)
- `project_capabilities` — capability declarations (id PK, project_id FK, name, capability_type, description, inputs, outputs, producer, requires_auth, invocation_model, audience, UNIQUE(project_id, name))
- `tasks` — async work queue (id PK, project_name TEXT, description, schedule, status, session_reference, error_message, created_at, started_at, completed_at)
- `memories` — knowledge entries (id TEXT PK, content, content_l0, content_l1, type CHECK(decision|outcome|pattern|preference|dependency|correction|learning|context|procedural|observation), importance, confidence, status, project_id TEXT, scope, agent_role, session_id, tags, content_hash, embedding BLOB, embedding_model, embedding_new BLOB, embedding_model_new, reinforcement_count, outcome_score, is_static, is_inference, is_pinned, belief TEXT CHECK(fact|opinion|hypothesis), extraction_confidence REAL, valid_from TEXT, valid_until TEXT, entities TEXT, parent_version_id TEXT, is_current INTEGER DEFAULT 1, created_at, updated_at, last_accessed, forget_after, forget_reason, UNIQUE(content_hash, project_id, scope))
- `memory_versions` — version history (id PK, memory_id FK, previous_content, author CHECK(agent|user|system), change_type CHECK(created|updated|corrected|archived|superseded), timestamp)
- `memory_edges` — inter-memory relationships (id PK, source_id FK, target_id FK, relationship_type CHECK(updates|extends|derives|contradicts|caused_by|related_to), weight, confidence, observation_count, created_at)
- `memory_sources` — provenance records (id PK, memory_id FK, project_id, session_id, agent_role, context_snippet, timestamp)
- `summary_blocks` — precomputed context summaries (id PK, scope, label, content, char_limit, tier, updated_at, UNIQUE(scope, label))
- `enrichment_log` — enrichment operation records (id PK, memory_id FK, engine_kind, engine_version, created_at)
- `recall_audit` — recall operation log (id PK, query, mode CHECK(search|bootstrap|profile), budget_tokens, scope, project_id, memory_ids_returned, scores, timestamp)
- `memory_fts` — FTS5 virtual table for memory full-text search
- `project_digests` — per-project free-form essence summaries (project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, digest_kind TEXT NOT NULL DEFAULT 'essence', digest_text TEXT NOT NULL, spec_version TEXT NOT NULL, producer TEXT NOT NULL, generated_at TEXT NOT NULL, token_count INTEGER, PRIMARY KEY (project_id, digest_kind)). One row per (project, digest_kind); refresh replaces.

**Indexes, constraints, and triggers** are defined by the v13 schema. v11 added indexes on `projects(area_id)` and `projects(parent_project_id)` to support area-filtered and parent/child lookups. v12 added an index on `project_digests(project_id)` to support per-project digest lookups. v13 adds an index on `projects(project_type_id)` to support type-filtered lookups (the Home view's Type filter dropdown reads through this index).

**v12 → v13 migration plan:**

1. Create the `project_types` table with the schema above, including `name TEXT UNIQUE NOT NULL`, `default_directory TEXT NOT NULL`, `git_init INTEGER NOT NULL DEFAULT 0`, `template_directory TEXT`, `color TEXT`, `created_at TEXT`.
2. Seed `project_types` with two rows derived from the prior bootstrap configuration: **Code project** (`default_directory = '~/Code'`, `git_init = 1`, `template_directory = NULL`) and **Non-code project** (`default_directory = '~/Projects'`, `git_init = 0`, `template_directory = NULL`). If the prior bootstrap configuration carried a different path-root for the `project` key, use that value instead of the literal default.
3. Add `project_type_id INTEGER REFERENCES project_types(id)` to `projects` (nullable initially during the rebuild).
4. For each existing project, set `project_type_id` by path heuristic: if any of the project's `project_paths` contains the segment `/Code/`, assign the Code project type; otherwise assign the Non-code project type. This matches the heuristic the desktop app's Home view used in v12 to render the Type column, so users see no behavioral change after migration.
5. Replace the `projects.type` CHECK constraint with the new foreign key. SQLite requires a table-rebuild step (copy-into-new-table pattern) to drop a CHECK; the rebuild copies all rows preserving identifiers, paths, fields, ports, capabilities, memories, and digests. The new schema makes `project_type_id` `NOT NULL`. (The legacy `type TEXT` column may be dropped during the rebuild or kept as a denormalized cache — agent's choice.)
6. Create `CREATE INDEX idx_projects_project_type ON projects(project_type_id)`.
7. Delete any `schema_meta` rows with key `bootstrap_path_root_area_of_focus`. Other `bootstrap_path_root_*` rows are no longer the source of truth (per-type defaults moved to `project_types.default_directory`); the migration may either delete them or leave them as orphan rows — the bootstrap flow ignores them in v13.
8. Relax the `areas` table classification: no schema change is required (the table already has the right shape), but the spec contract changes from "system-owned" to "user-managed" — see `#entities` (3.2) and `#rules` (3.3). The seven seeded rows remain seeded; users may now edit or delete them.
9. Bump `schema_meta.schema_version` to 13.

The migration is non-destructive: no project data is deleted; existing projects acquire a `project_type_id` via the path heuristic, and the `area_of_focus` legacy plumbing is the only thing removed.

**v11 → v12 migration plan:**

1. Create the `project_digests` table with the schema above, including the `ON DELETE CASCADE` foreign key and the (project_id, digest_kind) composite primary key.
2. Create `CREATE INDEX idx_project_digests_project ON project_digests(project_id)`.
3. Bump `schema_meta.schema_version` to 12.

No data migration required — the table starts empty. Digests are generated on demand via `@setlist/cli digest refresh`, not produced by migration.

**v10 → v11 migration plan:**

1. Create the `areas` table and seed seven rows (Work, Family, Home, Health, Finance, Personal, Infrastructure) with display names, one-sentence descriptions, and distinct accent colors.
2. Add `area_id INTEGER REFERENCES areas(id)` and `parent_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL` columns to `projects` (both nullable, default NULL).
3. Rewrite existing `area_of_focus`-typed rows as `project`-typed rows and assign them a canonical area: `msq-advisory-board` → area `Work`; `fam-estate-planning` → area `Family`. Any other surviving area_of_focus rows are reclassified as projects with `area_id = NULL` and surfaced in the unassigned nudge.
4. Narrow the `projects.type` CHECK constraint to `('project')` via a table-rebuild step (copy-into-new-table pattern required for SQLite CHECK narrowing). Existing paths, fields, ports, capabilities, and memories follow the project rowids.
5. Migrate the `knowmarks` ↔ `knowmarks-ios` soft entity link: if `knowmarks-ios` exists as a project and lists `knowmarks` in its `entities` array, set `parent_project_id` on `knowmarks-ios` to point at `knowmarks`. The `entities` field itself is left intact — removing the reference is out of scope.
6. Remap the `memories.scope` value `area_of_focus` to `area`. For memories previously scoped to a specific area_of_focus project, rekey the scope association to the corresponding canonical area id. The `MemoryScope` enum drops `area_of_focus` and gains `area`. Existing memories with no resolvable area target are downgraded to `portfolio` scope with a `forget_reason` note.
7. Retire the `area_of_focus` template row and its template_fields entries.
8. Bump `schema_meta.schema_version` to 11.

The migration is incremental and non-destructive: no project data is deleted; only classifications and scope labels change.

### 5.3 TypeScript-Specific Decisions {#ts-decisions}

**better-sqlite3 synchronous API.** The Registry class uses synchronous database calls internally. The public API may offer both sync and async signatures where useful:

```typescript
// Sync (direct, used internally and by performance-sensitive callers)
const projects = registry.listProjectsSync({ depth: 'summary' });

// Async (convenience wrapper, used by MCP server and callers in async contexts)
const projects = await registry.listProjects({ depth: 'summary' });
```

The async wrappers are trivial (they just return the sync result) but allow callers to use consistent async/await patterns.

**Type system.** TypeScript interfaces define the shape of every entity:

```typescript
interface Project {
  name: string;
  displayName: string;
  type: string;                        // resolved name from project_types (v13)
  projectTypeId: number;               // v13 — FK into project_types
  status: ProjectStatus;
  description: string;
  goals: string;
  paths: string[];
  area: string | null;                 // resolved name from areas, or null
  areaId: number | null;               // v11 — FK into areas (now user-managed)
  parentProjectId: string | null;      // v11 — structural sub-project edge
  children?: string[];                 // populated on get_project at standard+
  // Extended fields at standard/full depth
  fields?: Record<string, FieldValue>;
  ports?: PortClaim[];
  capabilities?: Capability[];
}

// Areas and project types are user-managed open sets resolved at runtime,
// not closed unions. The seven seeded area defaults and two seeded type
// defaults are install-time data, not type-level constants.
type ProjectStatus = 'idea' | 'draft' | 'active' | 'paused' | 'archived' | 'complete';
type MemoryType = 'decision' | 'outcome' | 'pattern' | 'preference' | 'dependency' | 'correction' | 'learning' | 'context' | 'procedural' | 'observation';
type MemoryBelief = 'fact' | 'opinion' | 'hypothesis';
type MemoryScope = 'project' | 'area' | 'portfolio' | 'global';
type QueryDepth = 'minimal' | 'summary' | 'standard' | 'full';
```

**MCP server with @modelcontextprotocol/sdk.** The MCP server uses the official SDK:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({ name: 'setlist', version: '0.1.0' }, { capabilities: { tools: {} } });
// Register 39 tools...
const transport = new StdioServerTransport();
await server.connect(transport);
```

The self-registration contract in §2.11 `#capability-declarations` is satisfied by introspecting the in-memory tool-registration array on startup (no separate `capabilities.json` seed ships with the package). CLI commands and `@setlist/core` library exports are introspected from their respective registration structures — the running code is the source of truth on every start.

**Electron with contextBridge IPC.** The desktop app uses Electron's recommended security model: the main process imports @setlist/core and registers IPC handlers for each operation the renderer needs. The preload script exposes these through `contextBridge.exposeInMainWorld()`, giving the renderer a typed API object (e.g., `window.setlist.listProjects()`) without any direct Node.js access. The renderer is a standard web application that happens to call IPC instead of HTTP.

**React + Tailwind CSS 4 + Radix UI + chorus-ui.** The renderer uses React for component architecture, Tailwind CSS 4 for styling, `chorus-ui` for design tokens (imported as CSS custom properties, referenced via Tailwind's `@theme` or directly in CSS), and Radix UI for accessible primitive components (dialogs, tabs, dropdown menus, etc.). This matches Chorus's frontend stack, ensuring visual consistency and reducing the learning curve for maintenance across both applications.

**Electron Forge or electron-builder for packaging.** The desktop app is packaged as a standalone macOS `.app` bundle. The specific packaging tool is an agent decision. The `setlist ui` CLI command launches the Electron process from the installed npm package.

**Auto-update via electron-updater against GitHub Releases.** The auto-update experience in `#auto-update` (2.14.1) is delivered by `electron-updater` (the updater shipped with electron-builder) consuming GitHub Releases as the update feed. The two user-visible channels map to release tag prerelease flags — `stable` serves non-prerelease tags, `beta` serves prerelease tags. Polling cadence, download staging, and on-disk update paths are electron-updater defaults unless a specific scenario overrides them.

**Testing.** Correctness is carried by the scenario holdout set in `.fctry/scenarios.md` (118 scenarios as of spec 0.25), evaluated by LLM-as-judge — see §4.5 `#testing-discipline` for the full testing invariant and CI posture. Vitest is available as a unit-test canary for @setlist/core where a targeted, fast signal helps during development; it is not a parity suite, not a coverage gate, and not the truth about whether the system is correct.

### 5.4 Native Binding Hygiene {#native-binding-hygiene}

**Load-bearing invariant.** Claude Desktop's integration with setlist never silently breaks. When it does break — through an abnormal exit or a native-module rebuild gone sideways — the next session opens with a visible warning that names the one-line recovery command. The guarantee is not "nothing ever breaks." It is "when it breaks, you see it immediately and fix it in a second."

**Why dual ABIs exist.** `better-sqlite3` is a native module — it compiles against exactly one Node/V8 ABI at a time. Setlist needs it to work in two different runtimes: standalone Node 22 (how the Claude Desktop integration runs `@setlist/mcp`) and Electron's embedded Node (how `@setlist/app` runs). Because the monorepo hoists dependencies to a single root `node_modules` (see §5.1 `#monorepo`), only one compiled binary of `better-sqlite3` exists on disk at any moment. Whichever ABI it was last rebuilt against is the only runtime it can serve. If the binary is in Electron-ABI state and Claude Desktop tries to load it, the load fails and the integration goes dark. If it is in Node-ABI state and the desktop app tries to load it, the app crashes at startup. The two runtimes cannot share a single compiled copy.

**The swap-and-restore mechanism.** A helper script (`packages/app/scripts/with-electron-abi.sh`) wraps every app-side npm script — `dev`, `build`, `preview`, `start` — and every command that exercises the Electron ABI end-to-end. On entry, the script swaps the on-disk `better-sqlite3` binary to the Electron-compiled copy. When the wrapped command finishes — whether by success, failure, SIGINT (Ctrl-C), or SIGTERM — a trap handler swaps the Node-compiled copy back into place. Both compiled binaries live in `packages/app/native-cache/` (gitignored); the swap is a file copy, not a rebuild, so it takes milliseconds. Between sessions the Claude Desktop integration sees the Node-ABI binary and works; during an app session the Electron ABI is in place and the app works. Under normal conditions the user never notices.

**Codesign re-signing on every swap.** macOS's hardened runtime rejects the ad-hoc linker signatures that `@electron/rebuild` and `npm rebuild` produce by default. Without re-signing, the app crashes with `EXC_BAD_ACCESS` on first database call, and vitest workers that load `better-sqlite3` exit with `ERR_IPC_CHANNEL_CLOSED` or a bare exit code 137. The swap script therefore re-signs the swapped binary with `codesign --force -s -` on each entry. This is a hard requirement on current macOS versions, not optional hardening.

**The startup warning is a first-class guarantee.** When the user opens a session — a terminal, a Claude Desktop conversation, any context where the integration matters — a startup check verifies that the `better-sqlite3` binary on disk matches the Node ABI. If it does not, the user sees a warning at session open that states the problem in plain language and names the recovery command `npm run sqlite:node -w packages/app`. The warning is not buried in a log file and it is not skippable. Without the warning, the "never silently breaks" invariant reduces to "usually doesn't break"; removing or suppressing the warning would weaken the contract. The warning is what makes the invariant observable. It is implemented by a `SessionStart` hook (`.claude/hooks/mcp-abi-session-warn.sh`), and an Observer or human can invoke the same check on demand via `npm run verify:mcp-abi` — recommended after any build step that touches `packages/app/**` or the native dependency tree.

**Recovery is one command.** When the warning fires, the fix is `npm run sqlite:node -w packages/app`. This restores the Node-ABI binary to the hoisted `node_modules` location and the integration works on next session open. The command is documented in the warning message itself, in `packages/app/CLAUDE.md`, and cross-referenced from this section. No further configuration, rebuild, or restart is required. The recovery path was validated in the 2026-04-19 session: the integration broke mid-conversation (details below under "Known limitation"), the startup warning surfaced the broken state, and a single invocation of the recovery command restored normal operation. The invariant held because detection plus recovery existed, not because automatic restoration was in place.

**Known limitation: SIGKILL, OOM, and power loss.** The restore-on-exit trap fires on graceful termination paths — SIGINT, SIGTERM, normal completion. It does not fire on SIGKILL (`kill -9`), out-of-memory kills by the kernel, or hard power loss. In those cases the Electron-ABI binary is left in place and the Claude Desktop integration opens its next session against the wrong ABI. The spec names this explicitly rather than hiding behind the swap mechanism: automatic restore is not guaranteed, and a sufficiently abnormal exit will leave the system in a broken state. The invariant still holds because the next session will detect the wrong-ABI state and surface the warning, and the user will fix it in one command. Detection and recovery together carry the guarantee. Automatic restoration across all possible exit paths is explicitly out of scope — the engineering effort to cover kernel-level terminations is not worth the incremental reliability given that detection plus recovery already handle these cases cleanly.

**Cross-references.** §5.3 `#ts-decisions` names the two choices that make dual ABIs necessary (better-sqlite3 as the SQLite binding, Electron as the desktop shell). §5.1 `#monorepo` describes the hoist behavior that forces single-binary exclusivity. §4.5 `#testing-discipline` describes the pre-flight ABI check that makes this invariant release-blocking at packaging time and advisory during local development. §4.3 `#hard-constraints` describes the signed-and-notarized release requirement that the Electron build depends on — the swap and re-sign mechanisms here keep the packaged output signable.

---

## 6. Reference and Prior Art

### 6.1 Inspirations {#inspirations}

Inspirations:

- **better-sqlite3** — The chosen SQLite binding. Synchronous API, native compilation, FTS5 support out of the box. The synchronous model matches SQLite's nature as a local, embedded database — async wrappers add complexity without benefit.

- **@modelcontextprotocol/sdk** — The official MCP SDK for TypeScript. Provides Server, StdioServerTransport, and tool registration patterns. The Setlist MCP server follows the SDK's conventions.

- **vitest** — Test runner. Fast, native ESM support, compatible with the test patterns needed to port pytest-style tests.

- **npm workspaces** — Monorepo management. Simple, no additional tooling (no Turborepo, no Nx). `npm install` at the root links all packages.

- **ghostwright/phantom** — Autonomous AI agent platform with three-tier vector memory (episodic/semantic/procedural). Informed Setlist's per-type decay rates, type-priority budget allocation, query-intent weight profiles, and proactive contradiction detection patterns. Phantom uses Qdrant for vector storage; Setlist adapts the conceptual patterns to its SQLite/FTS5 architecture. Not adopted as a dependency.

- **sqlite-vec** — Pure C SQLite extension for native in-database vector search via `vec0` virtual tables. Informed the fourth embedding storage tier -- native KNN queries within SQLite rather than application-level cosine computation.

- **hipocampus** — Hierarchical compaction tree for proactive agent memory. Informed reflect's multi-level topic tree summarization and the insight that search-based recall misses implicit connections when there is zero keyword overlap between query and stored memory.

- **frankensearch** — Two-tier progressive hybrid search with Reciprocal Rank Fusion. Informed recall's progressive delivery model -- fast FTS5 results first, refined vector re-ranking second.

- **hindsight** — Agent memory system distinguishing storage/retrieval from knowledge extraction/generalization. Informed reflect's knowledge distillation operation -- synthesizing higher-order patterns and preferences from clusters of related memories.

- **infranodus** — Knowledge graph with structural gap detection via network science. Informed reflect's gap detection in entity/relationship extraction -- identifying isolated topic clusters that lack connecting edges.

- **mcp-ts-core** — TypeScript MCP framework with startup tool validation and long-running operation lifecycle management. Informed the MCP server's self-validation at startup and progress reporting for long-running operations.

- **EngramMemory/engram-memory-community** (https://github.com/engrammemory/engram-memory-community) — Self-hosted three-tiered memory pipeline for AI agents (Qdrant + FastEmbed + MCP, MIT). Tier 1 is an in-memory hot cache driven by ACT-R activation math (strength grows on access, decays exponentially with elapsed time); tier 2 runs multi-head LSH over the first 64 dimensions of a Matryoshka-trained embedding for O(1) candidate lookup; tier 3 performs hybrid 768-dim cosine + BM25 re-ranking in Qdrant with Reciprocal Rank Fusion, and top results self-promote into the hot tier. Reported latencies on Apple Silicon: ~25ms for repeat queries (embedding floor), ~30ms for similar queries, ~190ms for novel queries with graph expansion. **Tier 2 pattern study, not adopted.** Informs setlist's open questions about expressing recall scoring as an explicit ACT-R activation curve, adding a hot-tier cache in front of the sqlite-vec / FTS5 layer, and using LSH-on-Matryoshka-prefix for candidate pre-filtering as the corpus grows. Cited inline in §2.12 Portfolio Memory.

- **nowledge-co/OpenKL** (https://github.com/nowledge-co/openkl) — Local-first open-source knowledge and memory layer for personal AI agents (Python + Kùzu DB, Apache 2.0; early-stage, knowmark 14312). Exposes a unified `ok` CLI over four surfaces: (1) a **memory store** for distilled insights, facts, and user notes with temporal organization; (2) a **grounding store** — a separate raw-corpus surface for external docs, media, logs, and transcripts with automatic chunking — explicitly distinct from memory; (3) a Kùzu-backed **knowledge graph** with provenance; and (4) **citations** as first-class objects with transient and persisted modes, retention classes, and `cite verify` / `cite open` operations. Hybrid search runs across memory and grounding store in a single call. Agent-facing **memory distillation prompts** are a first-class primitive (`ok distill get-prompt memory-synthesis`), letting agents share a standardized synthesis contract instead of each crafting its own retain content. **Tier 2 pattern study, not adopted.** Informs setlist's open questions about: (a) whether a separate raw-ingest grounding surface is warranted alongside the current flat memory model (10 types, all treated as distilled knowledge), or whether setlist's flatter model is intentional; (b) shipping a standardized distillation-prompt library alongside `retain` to reduce variance in retained content quality across agents; (c) introducing explicit retention-class tiers on citations/sources as a complement to the existing `reinforcement_count` / `importance` / decay model; and (d) extending recall's hybrid FTS5+vector search from single-surface (memory-only) to multi-surface if a grounding store is ever added. No spec behavior changes; pattern catalog entry only.

- **agentscreator/engram-memory** (https://github.com/agentscreator/engram-memory) — A second Engram-Memory-line project surfaced in this reference pass, companion to the `engrammemory/engram-memory-community` entry above. Source for the **contradiction-detection** pattern study cited inline in §2.12: surfacing conflicts proactively when two committed memories semantically disagree, extending the belief-classification / correction model with a pre-action detection signal. **Pattern study, not adopted as a dependency.** The contradiction-detection pattern is gated on the same unresolved embedding-tier decision that governs the rest of setlist's vector/RRF/progressive-delivery work — keyword/FTS5 overlap is insufficient to catch paraphrased contradictions. The related **workspace-shared memory model** (every agent in a workspace sees the same verified facts) was evaluated and **rejected** for setlist: setlist is single-user local-first, and multi-user workspace semantics are out of scope. No spec behavior changes; pattern catalog entry only.

- **lerim-dev/lerim-cli** (https://github.com/lerim-dev/lerim-cli) — Memory-agent CLI that structures the background worker as three named flows: **sync** (extract memory from session transcripts), **maintain** (consolidate, dedupe, summarize, archive on idle), **ask** (serve queries). Source for the **sync/maintain/ask job-catalog** pattern study cited inline in §2.8 — applied to setlist, a candidate shaping lens for the next evolve that touches the async worker, giving it a concrete job catalog beyond reflection. **Pattern study, not adopted.** The related **session-adapter abstraction** (pluggable adapters for Claude Code / Codex / Cursor / OpenCode that auto-extract memory from transcripts) was evaluated and **deferred** — speculative until the sync/maintain/ask worker shape is itself spec'd. The related **plain-markdown local storage with file-based fallback** pattern was evaluated and **rejected** — setlist's SQLite + FTS5 choice is deliberate in §5.3 `#ts-decisions`, and markdown-only storage contradicts the architecture. Scope TBD; no restructuring of the worker committed by this entry.

- **spfcraze/mindbank** (https://github.com/spfcraze/mindbank) — Memory/knowledge project that models every update as a new version row with `valid_from` / `valid_to` (soft-delete, non-destructive) and exposes an explicit history endpoint returning the full version chain, plus a **wake-up context snapshot** pattern: pre-compute a small "what matters right now" bundle (pinned + recent decisions + active procedurals) at session start, cached and served cheaply rather than recomputed per call. Source for two pattern studies cited inline in this spec: (a) **temporal versioning + history endpoint** in §2.12 — hardens setlist's already-declared `valid_from`/`valid_until` fields with a concrete endpoint-shape pattern (open question: dedicated `memory_history` MCP tool vs. extending `inspect_memory`); and (b) **wake-up context snapshot** in §2.3, cross-referenced from §3.5 — pre-baking `portfolio_brief` for session-start flows (open question: cache-invalidation trigger). **Both are pattern studies, not adopted.** Scope TBD for each.

- **chiefautism/claude-intel** (https://github.com/chiefautism/claude-intel) — A two-file Claude Code plugin (Haiku-based `intel` subagent plus a bash `PostToolUse` hook) that gives a single CC project persistent structured codebase knowledge across five markdown files — `architecture.md`, `commands.md`, `patterns.md`, `gotchas.md`, `decisions.md` — each with its own one-line editorial charter and surgical-edit discipline rather than append-only growth. The centerpiece is that fixed, named, bounded taxonomy: the subagent is prompted to read the existing files, tail the event delta since a cursor, and update the right file in place. The `PostToolUse` hook writes low-cost JSONL events (`{ts, tool, file}` for Edit/Write/NotebookEdit; `{ts, tool:"Bash", cmd, exit, err}` for Bash; Read/Glob/Grep skipped as noisy), rotated at 500 lines with the last 300 kept. The subagent's processing loop is stateless read + cursor-based incremental update — not event-stream-in-memory — which means the knowledge files survive agent restarts and the cursor is the only state carried across runs. A `rescan` command is modeled as a first-class reset rather than composed from primitives. **Not adopted as a dependency or as a runtime model** — it is CC-plugin-specific, bash-only, and setlist's SQLite + MCP + reflection architecture already covers the same conceptual territory with far more capability (typed memory, four-level scoping, belief classification, temporal validity, outcome-aware reinforcement, cross-project intelligence). What claude-intel contributes is five shaping lenses distilled into pattern studies across this spec: (1) the named-taxonomy catalog idea, hardening the open question of whether `project_digests` should grow from single-kind `essence` to a small named catalog (see §2.12 Portfolio Memory, "Pattern study: named digest-kind catalog"); (2) a typed event-feed ingest surface, as a shape for a potential `feed_event` verb or `feedback` extension (see §2.12 "Pattern study: typed event-feed ingest surface"); (3) separation of continuous cursor-driven incremental reinforcement from threshold-triggered deep consolidation (see §2.12 "Pattern study: stateless read + cursor-based incremental reflection"); (4) `rescan_project` as a single named admin reset rather than a compose-from-forget-and-refresh workflow (see Appendix C `#deferred-futures`); and (5) bounded-file discipline generalized as a cross-cutting principle, with the digest ceiling and any future free-form surface as its concrete manifestations (see §1.3 `#design-principles`, "Bounded-file discipline"). All five are catalog-only; none commit setlist to behavior.

### 6.2 Ecosystem Context {#ecosystem-context}

Setlist integrates with the broader ecosystem:

**Direct library consumers (new with Setlist):**
- **Chorus** — Imports @setlist/core for project identity at launch. No MCP server needed.
- **Ensemble** — Imports @setlist/core for memory retain/recall during agent orchestration.

**MCP consumers (unchanged):**
- **Claude Code** — Uses @setlist/mcp for all 39 tools.

**Producers (unchanged):**
- **fctry** — Writes project identity and capabilities via MCP or library import.
- **Chorus** — Writes non-code project identity.
- **Migration scripts** — One-time bootstrap.

### 6.3 Porting History {#porting}

**Status:** retrospective reference only. The Python `project-registry-service` is retired as a runtime — see §1.5 Origin and Port History. The tables below preserve the module and test file mappings for anyone tracing where a given Python module's behavior lives in the TypeScript tree.

**Module mapping:**

| Python module | TypeScript module | Notes |
|--------------|------------------|-------|
| db.py | db.ts | Schema, templates, field catalog consolidated |
| models.py | models.ts | Interfaces + enums |
| registry.py | registry.ts | Identity, fields, ports, capabilities, tasks, batch consolidated |
| fields.py | fields.ts | Serialization + producer-scoped writes |
| templates.py | db.ts | Consolidated into schema init |
| producers.py | registry.ts + fields.ts | Producer isolation via `updateFields(producer)` |
| consumers.py | registry.ts | Consumer queries via Registry methods directly |
| migration.py | migration.ts | 4 richness tiers + yaml-parse.ts helper |
| port_discovery.py | port-discovery.ts | Config file scanning |
| memory.py | memory.ts | retain, feedback, correct, forget, inspect, configure, status |
| memory_retrieval.py | memory-retrieval.ts | FTS5 recall, budget control, bootstrap |
| memory_reflection.py | memory-reflection.ts | Triple-gate archival, summary blocks |
| memory_embeddings.py | (deferred) | Embedding provider abstraction — FTS5-only for now |
| cross_query.py | cross-query.ts | 3 scopes, freshness+importance scoring |
| tasks.py | registry.ts | Task CRUD consolidated into Registry |
| scripts/migrate_memories.py | migrate-memories.ts | CC auto-memory + fctry memory migration |
| server.py | server.ts | 39 MCP tools via @modelcontextprotocol/sdk |
| cli.py | index.ts | CLI entry point |
| worker.py | worker.ts | Launchd integration |

**Test mapping:**

| Python test file | TypeScript test file |
|-----------------|---------------------|
| test_registry.py | registry.test.ts |
| test_server.py | server.test.ts |
| test_memory_schema.py | memory-schema.test.ts |
| test_memory_retrieval.py | memory-retrieval.test.ts |
| test_cross_query.py | cross-query.test.ts |
| test_capabilities.py | capabilities.test.ts |
| test_batch.py | batch.test.ts |
| test_worker.py | worker.test.ts |
| (etc. — 30 test files total) | (etc.) |

The test mapping is a translation reference only — it does not define a passing-tests contract. See §4.5 `#testing-discipline` for the actual correctness contract.

---

## 7. Satisfaction and Convergence

### 7.1 Satisfaction Definition {#satisfaction}

- @setlist/core is importable from any Node.js/TypeScript project as an npm dependency.
- @setlist/mcp exposes 39 MCP tools covering identity, capabilities, memory, ports, tasks, bootstrap, and health, with parameter shapes and response shapes stable across patch releases.
- @setlist/cli provides `setlist` as a terminal command covering project management, migration, worker installation, and diagnostics.
- Chorus can import @setlist/core and call `listProjects()`, `getProject()`, `switchProject()` directly.
- Ensemble can import @setlist/core and call `retain()`, `recall()`, `feedback()` directly.
- Satisfaction is measured by scenario pass rate against `.fctry/scenarios.md` (see §4.5 `#testing-discipline`); vitest coverage of @setlist/core is optional, not a satisfaction criterion.
- The npm packages build cleanly with `npm run build` from the workspace root.
- The monorepo installs with `npm install` — no special setup beyond Node.js LTS.
- The desktop app launches, displays all registered projects in a card grid, and supports navigating to project detail views with tabbed content.
- Project CRUD operations (register, edit, archive, rename) work from the desktop UI and produce the same database state as the equivalent library/MCP calls.
- The desktop app is packageable as a standalone macOS .app bundle.

### 7.2 Convergence Strategy {#convergence}

**Note:** This section reflects the original port-era build order. Setlist has been operational and past parity for multiple releases; the sequence below is preserved as historical reference for anyone revisiting the implementation order of new greenfield work. Current development drives through the scenario holdout set (§4.5) and the scenarios in `.fctry/scenarios.md`.

**Start with:** @setlist/core schema initialization (db.ts) producing the current schema. Verify by inspecting table definitions, indexes, and constraints.

**Then layer in:** Core identity — registration, querying at three depths, filtering. This is the foundation everything else builds on.

**Then layer in:** Field model, templates, producer-scoped writes, field enrichment.

**Then layer in:** Migration, port management, port discovery.

**Then layer in:** @setlist/mcp — wrap the core library as 39 MCP tools.

**Then layer in:** Portfolio memory — retain, recall, reflect. Content-hash dedup. FTS5 retrieval.

**Then layer in:** Capability declarations, batch operations, cross-project queries, task queue.

**Then layer in:** @setlist/cli — terminal commands, worker script, launchd integration.

**Then layer in:** @setlist/app — Electron shell, IPC bridge, React renderer with Tailwind CSS 4 and Radix UI. Start with the home view (card grid), then project detail (tabbed view), then CRUD forms.

**Finally:** Embedding provider integration (OpenAI, Ollama), outcome feedback, and background reflection. These are the most complex memory features and benefit from having the full test suite in place first.

### 7.3 Observability {#observability}

Signals that the registry is healthy and functioning:
- Project count matches the ecosystem the user actually has (~40 projects)
- Field completeness proportional to source richness
- Query coherence at each depth level
- Data richness exceeds what a naive regex extraction would produce
- All behavioral categories tested with full scenario coverage
- npm package sizes reasonable (core < 500KB, mcp < 100KB, cli < 100KB)
- No CommonJS output — ESM only
- Desktop app launches and renders project cards matching `list_projects` output
- CRUD operations through the UI produce identical database state to library calls
- Desktop app enforces single-instance behavior

### 7.4 What the Agent Decides {#agent-decides}

The agent has authority over implementation details within the constraints above:

- **Internal module organization** within each package (how files are split, helper functions, internal abstractions)
- **Error class hierarchy** — how structured errors are implemented in TypeScript
- **Database connection management** — singleton, pool, or per-call patterns for better-sqlite3
- **Build configuration** — tsconfig options, output directory structure, sourcemaps
- **CLI framework** — commander, yargs, or hand-rolled argument parsing
- **Worker process management** — how the launchd worker script is structured
- **Test organization** — how pytest patterns map to vitest (test.each, beforeEach, etc.)
- **Internal type patterns** — branded types, discriminated unions, Result types, etc.
- **Electron packaging tool** — Electron Forge, electron-builder, or alternatives
- **React component structure** — how pages, components, and hooks are organized within the renderer
- **State management in renderer** — React context, Zustand, Jotai, or plain props
- **Tailwind configuration details** — utility class patterns, component extraction

The agent does NOT decide:
- Schema shape (defined by v10, evolved from v8 compatibility)
- MCP tool surface (defined by the 36-tool contract)
- Package boundaries (core/mcp/cli/app as specified)
- SQLite binding (better-sqlite3)
- MCP SDK (@modelcontextprotocol/sdk)
- Module format (ESM)
- Desktop shell (Electron)
- UI framework (React + Tailwind CSS 4 + Radix UI)
- Design tokens (consumed from `chorus-ui` package)
- IPC security model (contextBridge, no nodeIntegration)

---

## Appendix A: Decision Rationale

Load-bearing design choices:

- **SQLite over YAML / JSON / per-project manifest files.** A single queryable file with structured fields beats filesystem scans or per-project scattered config. Enables cross-project queries, migrations, and FTS5 memory search without reinventing a query layer.
- **Atomized fields, one producer each.** Each structured field on a project has exactly one authoritative producer. Prevents overlapping writers and drift.
- **Registration over discovery.** Projects exist because something explicitly registered them. The registry never scans the filesystem.
- **Registry below fctry.** Setlist holds identity and memory; fctry holds specs and scenarios. The registry does not interpret specs; it stores pointers and observations.
- **Canonical areas as first-class.** The seven-area closed set is the organizing dimension for the user's ecosystem and governs memory scope inheritance.

**Why TypeScript?** Chorus is Electron + React (TypeScript). Ensemble orchestrates agents in TypeScript. Both needed the registry as a library import, not a subprocess. A TypeScript implementation lets them import `@setlist/core` directly. (For history of the port from the prior Python implementation, see §1.5.)

**Why better-sqlite3 over other SQLite bindings?** better-sqlite3 provides synchronous native bindings, which match SQLite's embedded nature. sql.js (WASM) is slower and lacks FTS5. node-sqlite3 (async) adds unnecessary Promise overhead for a local database. better-sqlite3 is the standard choice for Node.js applications that use SQLite as an embedded database.

**Why monorepo with npm workspaces?** Four packages serve four audiences: @setlist/core for library consumers (Chorus, Ensemble), @setlist/mcp for Claude Code, @setlist/cli for terminal users, @setlist/app for direct human interaction. A single package would force all consumers to depend on Electron, @modelcontextprotocol/sdk, and CLI dependencies they don't need. npm workspaces is the simplest monorepo solution — no Turborepo, no Nx, no Lerna.

**Why ESM-only?** The ecosystem is ESM. @modelcontextprotocol/sdk is ESM. Chorus is ESM. Dual CJS/ESM publishing adds build complexity for no consumer benefit.

**Why a desktop app?** The registry was designed as invisible infrastructure, but the user also wants to see and manage their project landscape directly — not just through agents. A desktop control panel makes the registry a product, not just a service. Electron is the natural choice: the main process imports @setlist/core directly (same as Chorus), and the React/Tailwind/Radix stack matches Chorus's frontend, keeping the ecosystem consistent.

**Why use chorus-ui?** Setlist and Chorus are sibling products in the same ecosystem. The `chorus-ui` package extracts design tokens (CSS custom properties + TypeScript constants) into a single source of truth. Both apps import the same tokens, ensuring visual cohesion without coupling their component implementations. When the design language evolves, one package update propagates to both apps.

## Appendix B: Glossary

| Term | Meaning |
|------|---------|
| Registry | The structured, queryable record of every project in the user's ecosystem — identity, fields, capabilities, memory, ports, health |
| Setlist | The TypeScript implementation of the Project Registry |
| @setlist/core | npm package providing the library API — all registry logic |
| @setlist/mcp | npm package providing the MCP server — 39 tools via @modelcontextprotocol/sdk |
| @setlist/cli | npm package providing the CLI — terminal commands and worker script |
| @setlist/app | npm package providing the desktop control panel — Electron app with React renderer |
| better-sqlite3 | Synchronous native SQLite binding for Node.js |
| Producer | The component (tool, agent, or user action) authoritative for writing a given field. Each field has exactly one producer |
| Consumer | Any component that reads from the registry — agents, scripts, UI renderers, other projects |
| Atomized identity | Project identity composed of independent, typed fields; each with one producer; producers write disjoint field sets |
| Schema v10 | A prior SQLite schema version, superseded by v11. Introduced unified memory types and chorus-compatible fields. Kept in the migration path for databases created before v11 landed |
| Schema v11 | A prior SQLite schema version, superseded by v12. Added the canonical `areas` table, `projects.area_id` and `projects.parent_project_id` columns, retired the `area_of_focus` project type, and remapped the `area_of_focus` memory scope to `area` |
| Schema v12 | A prior SQLite schema version, superseded by v13. Added the `project_digests` table for free-form per-project essence summaries |
| Schema v13 | The current SQLite schema version. Adds the user-managed `project_types` table, replaces the `projects.type` CHECK constraint with a foreign key into `project_types`, and reclassifies the `areas` table from system-owned to user-managed |
| Area | A user-managed organizational bucket. Stored in the `areas` table (seeded at install with seven defaults — Work, Family, Home, Health, Finance, Personal, Infrastructure — and editable via Settings thereafter) and attached to projects via a first-class nullable `area_id` foreign key. A structural column, not a profile field. Governs grouping, filtering, and memory scope inheritance. Renames are label-only updates against the stable id; deletion is blocked while projects are attached |
| Project type | A user-managed project kind governing bootstrap behavior and the Type column on Home. Stored in the `project_types` table (seeded at install with two defaults — Code project and Non-code project — and editable via Settings thereafter). Each row carries a default directory, a git-init flag, and an optional template directory. Projects reference a type via `project_type_id`. Renames are label-only; deletion is blocked while projects of that type exist |
| `area_of_focus` (retired) | A legacy project *type* that represented an ongoing concern with no completion criteria. Retired in schema v11: former area_of_focus entries were reclassified as projects and assigned to canonical areas (`msq-advisory-board` → Work, `fam-estate-planning` → Family). Schema v13 removes any remaining bootstrap plumbing for it. Not to be confused with the current `Area` concept, which is structural rather than a type |
| Sub-project | A project whose `parent_project_id` references another project. A structural parent-child edge only — area, status, goals, and memory scope do not inherit. Archiving a parent does not cascade to children |
| @setlist/app | npm package providing the desktop control panel — Electron app with React renderer |
| IPC bridge | The contextBridge-based communication layer between Electron's main process (@setlist/core) and the renderer (React UI) |
| Experience-port | A spec derived from an existing implementation where the experience stays identical and only the implementation changes |

## Appendix C: Deferred Futures {#deferred-futures}

- **Consumer-driven schema composition.** Consumers declaring the fields they need, with the registry composing a view rather than enforcing a schema up front.
- **Lifecycle propagation.** Automatic reactions to project state changes (archive cascade, dependency notifications, cross-project triggers).
- **Notifications and self-healing.** Proactive alerts when the registry detects drift, stale ports, or broken capability declarations.
- **Visibility and privacy boundaries.** Per-project or per-field visibility controls for multi-user or shared-workspace scenarios.
- **Workspace launching beyond context switching.** Opening editors, terminals, and tools with the right working directory and environment.
- **Community template sharing.** A registry of project templates contributed by others.
- **Non-local project support.** Projects that live on remote machines or in cloud services.
- **Calendar integration.** Projects linked to time-bound events, deadlines, or scheduled work.
- **Structured task result extraction.** Parsing task output into structured fields rather than free-form text.

- **Desktop app: memory write operations.** The Memory tab is read-only in v1. Future versions may allow creating memories, correcting memories, and triggering reflection from the UI.

- **Desktop app: capability write operations.** The Capabilities tab is read-only in v1. Future versions may allow registering and updating capability declarations from the UI.

- **Desktop app: port management.** The Ports tab is read-only in v1. Future versions may allow claiming, releasing, and discovering ports from the UI.

- **Desktop app: task management.** Queuing, monitoring, and reviewing async tasks from the UI is deferred. Tasks remain a programmatic-only surface.

- **Desktop app: project bootstrap from UI.** Creating new projects with folder scaffolding from the UI is deferred. Bootstrap remains CLI/programmatic.

- **Desktop app: web version.** A browser-based version of the control panel (without Electron) is not planned for v1. The desktop app is macOS-native.

- **Memory admin: `rescan_project` as first-class reset.** A single admin operation that soft-deletes (archives, never destroys) all memories scoped to a project, refreshes the project's digest, and clears reinforcement history — useful after major refactors where incremental reinforcement has gone stale enough that scattered corrections are less honest than a clean restart. The current alternative is N separate `forget` calls plus `refresh_project_digest`. CRITICAL: the operation must be soft-delete, not destructive — setlist's correction flow, contradiction audit trail, and `inspect_memory` debugging path all depend on memories remaining queryable in `archived` status rather than being removed from the row store. Informed by `chiefautism/claude-intel` (see §6.1), whose rescan command is a single named reset operation rather than a compose-from-primitives workflow. Deferred; no tool shape or scope committed.

## Appendix D: MCP Tool Reference {#appendix-d-mcp-tool-reference}

Complete tool reference for the 39 MCP tools.

**Project Identity:**

| Tool | Parameters | Returns |
|------|-----------|---------|
| list_projects | detail?, type_filter?, status_filter?, area? | Project[] at requested depth. `area` accepts a canonical area name or the sentinel `__unassigned__` |
| get_project | name, detail? | Project at requested depth, including `area`, `parent_project`, and `children[]` |
| switch_project | name | Paths, status, description, ports, workspace metadata |
| search_projects | query, type_filter?, status_filter?, area? | Matching projects with relevance. Area filter is literal (no descendant inheritance) |
| get_registry_stats | (none) | Count, type distribution, status distribution, per-area distribution, unassigned count |
| register_project | name, display_name?, type, status, description, goals, paths?, area?, parent_project? | Confirmation. Invalid area rejected with `Error [INVALID_AREA]`; cycle-producing parent rejected with `Error [PARENT_CYCLE]` |
| update_project | name, display_name?, status?, description?, goals?, area?, parent_project? | Updated project summary. Passing `area=null` clears the assignment; passing `parent_project=null` clears the parent link |
| archive_project | name | Confirmation (ports released, capabilities cleared). Children of the archived project are NOT cascaded — they stay active with their parent link intact |
| rename_project | name, new_name | Confirmation (all references updated, including parent_project_id references from children) |
| batch_update | type_filter?, status_filter?, area?, fields, dry_run? | Count and names of affected projects |
| write_fields | project_name, fields, producer? | Count of fields written |
| enrich_project | name, goals?, topics?, entities?, concerns? | Updated profile (union merge). Does NOT accept `area` — use `set_project_area` |
| set_project_area | name, area | Confirmation. `area` must be a name present in the user's current `areas` table, or null (to clear). Unknown value → `Error [INVALID_AREA]` |
| set_parent_project | name, parent_name | Confirmation. `parent_name` may be null (to clear the link). Cycle detection runs at write time: rejecting with exact message "Cannot set parent: {child-name} is a descendant of {project-name}. Moving it would create a cycle." |

**Capabilities:**

| Tool | Parameters | Returns |
|------|-----------|---------|
| register_capabilities | project_name, capabilities[] | Count of capabilities registered |
| query_capabilities | project_name?, type?, keyword? | Matching capabilities grouped by project |

**Memory — Agent:**

| Tool | Parameters | Returns |
|------|-----------|---------|
| retain | content, type, project?, scope?, tags?, session_id?, agent_role?, belief?, extraction_confidence?, valid_from?, valid_until?, entities?, parent_version_id? | Memory ID, created vs reinforced |
| recall | query?, project?, token_budget | Scored memories with tiered content |
| feedback | result, memory_ids[] | Count updated, direction |
| memory_status | (none) | Counts by type/scope, provider status |
| portfolio_brief | (none) | Active projects, portfolio memories, health indicators, pending observations |

**Memory — Admin:**

| Tool | Parameters | Returns |
|------|-----------|---------|
| reflect | (none) | Merged, edges created, archived, duration |
| correct | memory_id, correction | New correction memory ID |
| forget | memory_id | Confirmation |
| inspect_memory | memory_id | Full memory details |
| configure_memory | embedding_provider?, reflect_schedule?, reflect_threshold? | Updated config |

**Ports:**

| Tool | Parameters | Returns |
|------|-----------|---------|
| claim_port | project_name, service_label, port?, protocol? | Claimed port number |
| release_port | project_name, port | Confirmation |
| check_port | port | Available or owner details |
| discover_ports | project_name | Claimed, skipped, summary |

**Tasks:**

| Tool | Parameters | Returns |
|------|-----------|---------|
| queue_task | description, project_name?, schedule, type_filter?, status_filter? | Task ID (or count + names for dispatch) |
| list_tasks | status_filter?, project_name? | Task entries with session references |
| cross_query | query, scope?, area? | Synthesized answer with sources. Area filter, when provided, restricts the project-field scan to projects whose area matches (literal, no descendant inheritance) |

**Bootstrap:**

| Tool | Parameters | Returns |
|------|-----------|---------|
| bootstrap_project | name, type, display_name?, status?, description?, goals?, area?, parent_project?, path_override? | Registered project name, created folder path, and side-effect flags `git_initialized`, `templates_applied`, `parent_gitignore_updated`. `area` and `parent_project` are validated the same as in `register_project`. |
| configure_bootstrap | path_roots, template_dir?, archive_path_root? | Updated bootstrap configuration |

**Health:**

| Tool | Parameters | Returns |
|------|-----------|---------|
| assess_health | name?, fresh? | Per-project (name given) or portfolio-wide (no arg) health assessment: overall tier, dimension tiers, reasons. `fresh=true` bypasses cache to force recomputation |

**Project digests:**

| Tool | Parameters | Returns |
|------|-----------|---------|
| get_project_digest | project_name, digest_kind? | `{ digest_text, spec_version, producer, generated_at, token_count?, stale }` or `null` if no digest exists. `digest_kind` defaults to `"essence"`. `stale` is `true` when the project's current spec version differs from the digest's source version |
| get_project_digests | project_names?, digest_kind?, include_missing?, include_stale? | `{ [project_name]: { digest_text, spec_version, stale } }`. Omits projects with no digest unless `include_missing=true`, in which case they appear with `digest_text: null`. Stale digests included by default; set `include_stale=false` to exclude |
| refresh_project_digest | project_name, digest_kind?, digest_text, spec_version, producer, token_count? | `{ project_name, digest_kind, written: true, prior_spec_version?: string }`. Replace semantics: one row per (project, kind). Rejects writes exceeding the per-kind token ceiling (1200 for `essence`) with a trim-and-retry error |
