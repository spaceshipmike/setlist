# Setlist — Natural Language Specification

```yaml
---
title: Setlist
spec-version: "0.9"
date: 2026-04-11
status: active
author: Mike (via fctry interview, experience-ported from project-registry-service)
spec-format: nlspec-v2
experience-source: project-registry-service/.fctry/spec.md (v1.3)
---
synopsis:
  short: "TypeScript project registry — intelligence hub with desktop control panel, 33 MCP tools, unified memory, and direct library import"
  medium: "TypeScript monorepo (@setlist/core, @setlist/mcp, @setlist/cli, @setlist/app) implementing the project registry as both invisible infrastructure and a directly operable desktop surface. Local SQLite (better-sqlite3) + MCP server + Electron control panel sharing Chorus's design system (Tailwind 4, Radix UI). Provides project identity, capability declarations, unified portfolio memory (10 types with hierarchical compaction, progressive retrieval, knowledge distillation, and graph gap detection), project bootstrap, port allocation, batch operations, and cross-project intelligence. Schema v10, 33 MCP tools, importable as @setlist/core by Chorus and Ensemble."
  readme: "Setlist is the TypeScript implementation of the Project Registry — both invisible infrastructure at the center of the user's personal ecosystem and a directly operable desktop control panel. As infrastructure, it provides structured, queryable identity for every project and area of focus, with programmatic administration, capability declarations, unified portfolio memory (10 types with belief classification, temporal validity, entity extraction, and procedural versioning), budget-controlled hybrid retrieval, port allocation, project bootstrap, batch operations, and cross-project intelligence via 33 MCP tools and direct library import. As a desktop application, it presents a card-grid dashboard of all projects with multiselect status filtering (archived hidden by default), tabbed project detail views (overview, memory, capabilities, ports), and full project CRUD — register, edit, archive, rename — through a native macOS Electron app sharing Chorus's design language (Tailwind CSS 4, Radix UI, terracotta accent, warm charcoal surfaces). The main process imports @setlist/core directly; no API layer sits between the UI and the registry. Distributed as four npm packages (@setlist/core, @setlist/mcp, @setlist/cli, @setlist/app), Setlist is directly consumable by Chorus, Ensemble, and any Node.js tool in the ecosystem, while also standing alone as a full-featured project management surface."
  tech-stack: [typescript, better-sqlite3, "@modelcontextprotocol/sdk", node, npm-monorepo, electron, react, tailwindcss-v4, radix-ui]
  patterns: [atomized-fields, progressive-disclosure, producer-consumer, registration-not-discovery, invisible-infrastructure, operable-surface, config-file-scanning, hub-and-spoke, capability-declaration, definition-is-truth, fuzzy-match-suggestions, archive-triggered-cleanup, producer-attribution, summary-compactness, freshness-importance-scoring, invocation-metadata, retain-recall-reflect, outcome-aware-reinforcement, content-hash-dedup, embedding-provider-abstraction, budget-controlled-recall, four-level-scoping, hybrid-retrieval, belief-classification, temporal-validity, entity-extraction, procedural-versioning, unified-memory-store, template-driven-bootstrap, configure-then-use, shared-design-system, ipc-bridge, native-vector-search, hierarchical-compaction, progressive-retrieval, knowledge-distillation, graph-gap-detection, mcp-startup-validation, progress-notification]
  goals: [unified-project-identity, capability-discovery, programmatic-project-administration, batch-operations, cross-project-task-dispatch, conflict-free-port-allocation, automatic-port-discovery, async-task-execution, cross-project-intelligence, crash-resilient-worker, ranked-cross-project-results, capability-invocation-awareness, portfolio-memory, outcome-reinforcement, hybrid-retrieval, npm-packageable-distribution, canonical-memory-store, chorus-memory-unification, project-bootstrap-and-scaffolding, desktop-control-panel, project-dashboard, project-crud-ui, implicit-connection-surfacing, fast-first-pass-recall, synthesized-knowledge-from-memory-clusters, memory-graph-blind-spot-detection]
plugin-version: 0.77.3
```

Setlist is the TypeScript implementation of the Project Registry — the active intelligence hub at the center of the user's personal ecosystem. Originally a direct port of the Python project-registry-service, it has since evolved beyond parity: schema v10 (unified memory types, belief classification, temporal validity, entity extraction, procedural versioning), 33 MCP tools (the original 29 plus `enrich_project`, `rename_project`, `bootstrap_project`, and `configure_bootstrap`), an expanded portfolio memory subsystem, and a native desktop control panel for direct human interaction. The .db file is the shared contract — both implementations read and write the same database, though the Python implementation remains at schema v8.

The rewrite exists because Chorus (Electron + React) and Ensemble need the registry as a direct npm dependency, not a subprocess or MCP-only integration. @setlist/core provides the library API importable from any Node.js process. @setlist/mcp wraps it as an MCP server. @setlist/cli exposes it from the terminal. @setlist/app provides a desktop control panel — an Electron app that imports @setlist/core directly, giving the user a visual surface for project management alongside the programmatic interfaces. The 786 Python tests define the behavioral contract to port against.

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
   - 2.4 [Field Enrichment](#24-field-enrichment) `#enrichment`
   - 2.5 [What Happens When Things Go Wrong](#25-what-happens-when-things-go-wrong) `#error-handling`
   - 2.6 [The Details That Matter](#26-the-details-that-matter) `#details`
   - 2.7 [Task Queue](#27-task-queue) `#task-queue`
   - 2.8 [Async Execution](#28-async-execution) `#async-worker`
   - 2.9 [Cross-Project Queries](#29-cross-project-queries) `#cross-project`
   - 2.10 [Port Registry](#210-port-registry) `#port-registry`
   - 2.11 [Capability Declarations](#211-capability-declarations) `#capability-declarations`
   - 2.12 [Portfolio Memory](#212-portfolio-memory) `#portfolio-memory`
   - 2.13 [Project Bootstrap](#213-project-bootstrap) `#project-bootstrap`
   - 2.14 [Desktop Control Panel](#214-desktop-control-panel) `#desktop-app`
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
5. [Implementation Architecture](#5-implementation-architecture)
   - 5.1 [Monorepo Structure](#51-monorepo-structure) `#monorepo`
   - 5.2 [Schema Compatibility](#52-schema-compatibility) `#schema`
   - 5.3 [TypeScript-Specific Decisions](#53-typescript-specific-decisions) `#ts-decisions`
   - 5.4 [Porting Strategy](#54-porting-strategy) `#porting`
6. [Reference and Prior Art](#6-reference-and-prior-art)
   - 6.1 [Inspirations](#61-inspirations) `#inspirations`
   - 6.2 [Ecosystem Context](#62-ecosystem-context) `#ecosystem-context`
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

The Python project-registry-service solved this problem. But the ecosystem has moved toward Node.js-based tools -- Chorus is Electron + React, Ensemble orchestrates agent workflows in TypeScript -- and these tools need the registry as a direct library import, not a subprocess call or MCP-only integration. The Python implementation is correct and complete (786 tests, schema v8, 27 MCP tools), but it cannot be `import`ed from a TypeScript codebase.

Setlist is the same system, re-implemented in TypeScript, distributed as npm packages, and directly consumable by the Node.js ecosystem. The .db file is the shared contract: both implementations read and write the same SQLite database with the same schema.

### 1.2 What This System Is {#what-this-is}

Setlist is a TypeScript monorepo providing the Project Registry as four npm packages:

- **@setlist/core** -- The library. All registry logic: project identity, field model, variable-depth querying, filtering, migration, port management, capability declarations, portfolio memory (retain/recall/reflect), task queue, cross-project queries, batch operations. Importable from any Node.js process. This is what Chorus, Ensemble, and the desktop app consume directly.

- **@setlist/mcp** -- The MCP server. A thin translation layer wrapping @setlist/core as 33 MCP tools via @modelcontextprotocol/sdk, using stdio transport managed by Claude Code's lifecycle. The original 29 tools match the Python server identically; `enrich_project`, `bootstrap_project`, `configure_bootstrap`, and `rename_project` are Setlist-specific additions.

- **@setlist/cli** -- The CLI. Terminal commands for project management, migration, worker installation, and diagnostics. Entry point: `setlist`.

- **@setlist/app** -- The desktop control panel. An Electron application providing a visual surface for project management: a card-grid dashboard of all projects, tabbed project detail views, and project CRUD operations. The main process imports @setlist/core directly via an IPC bridge to the renderer. Consumes design tokens from the `chorus-ui` package (Tailwind CSS 4, Radix UI). Launchable as a standalone macOS .app bundle or via `setlist ui` from the CLI.

The four packages share the same SQLite database (schema v10) at `~/.local/share/project-registry/registry.db`. The database file is the shared contract between Setlist, the Python implementation, and any tool that opens it directly.

### 1.3 Design Principles {#design-principles}

All design principles from the Python spec apply identically. They are the experience, not the implementation.

**Invisible infrastructure, operable surface.** The registry is both a data layer that producers and consumers use without the user's awareness, and a directly operable control panel when the user wants to see and manage their project landscape. During normal agent-driven work, the registry is invisible — agents read and write through MCP tools and library imports without surfacing the registry itself. But the user can open the desktop app at any time to browse projects, edit metadata, archive old work, or simply see the state of their ecosystem. These two modes coexist: the control panel reads and writes the same database the agents use, and changes from either surface are immediately visible to the other.

**Filesystem-first.** The database is a durable file on the local filesystem. No cloud service required. Any tool that can open a SQLite database can read the registry.

**Visible, stoppable, self-managing.** Background processes (MCP server, async worker) are acceptable when they meet three criteria: visible, stoppable, and self-managing.

**Progressive disclosure.** Data is available at variable depth. Summary for ambient context, standard for reasoning, full for deep context.

**Elasticity over prediction.** The field model accommodates fields that do not yet exist without schema changes, code modifications, or restarts.

**Atomized identity.** Project identity is composed of independent, typed fields. Each field has one authoritative producer. Producers write to disjoint field sets.

**Registration, not discovery.** Projects exist because something explicitly registered them. The registry does not scan the filesystem looking for projects.

**Definition is truth.** Producers define project identity; consumers derive from it. The registry is the authoritative source.

**Additional principle for Setlist:**

**Library-first, server-second.** @setlist/core is the primary interface. The MCP server, CLI, and desktop app are thin wrappers. Any capability available through MCP, CLI, or the UI must first be available as a library function. Chorus and Ensemble import @setlist/core directly; they never spawn subprocesses or connect to servers for registry operations.

**Shared design language.** The desktop app consumes `chorus-ui`, an extracted design token package providing CSS custom properties and TypeScript constants for the shared visual language (terracotta accent, warm charcoal surfaces, Inter typeface). Setlist and Chorus are separate products that coexist in the same ecosystem — sharing design tokens from a single source makes them feel like siblings, not strangers. The tokens are imported as `chorus-ui/tokens.css` (CSS custom properties on `:root`) or `chorus-ui/tokens` (TypeScript constants).

### 1.4 What Success Looks Like {#success}

Everything from the Python spec's success criteria, plus:

- Chorus imports `@setlist/core` and calls `listProjects()` at launch. No subprocess, no MCP server needed.
- Ensemble imports `@setlist/core` and retains/recalls memories during agent orchestration.
- The MCP server (`@setlist/mcp`) is a drop-in replacement for the Python MCP server -- same tool names, same parameters, same response shapes.
- The CLI (`setlist`) provides the same commands as `project-registry`.
- Both Python and TypeScript implementations can read and write the same .db file without migration or conversion.
- TypeScript tests (vitest) cover all behavioral categories from the 786 Python tests, confirming equivalent parity against @setlist/core.
- The desktop app launches as a standalone macOS .app and via `setlist ui`. It displays a card grid of all registered projects, allows navigating to project detail tabs, and supports registering, editing, archiving, and renaming projects through the UI.
- Changes made through the desktop app are immediately visible to agents via MCP and library import. Changes made by agents are visible in the desktop app on next render.
- The desktop app enforces single-instance: launching a second instance activates the existing window.

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

A producer provides the six core identity fields: name, display_name, type (project or area of focus), status, description, and goals. Display_name, description, and goals may be empty strings for sparse entries but are always present in the record. If display_name is not provided, it defaults to name. The producer also typically provides at least one filesystem path where the project lives. Extended fields (tech stack, patterns, stakeholders, timeline, domain) are provided if the producer has them.

The registration completes and the project is immediately queryable. No manual step, no approval, no configuration. A subsequent query for the project by name returns all fields that were provided.

In TypeScript, the library call is:

```typescript
import { Registry } from '@setlist/core';
const registry = new Registry();
registry.registerProject({ name, displayName, type, status, description, goals, paths });
```

**Registration from fctry:**

When a user runs `fctry:init` for a new code project, fctry's interview process produces structured identity: descriptions, tech stack, patterns, goals. fctry registers the project in the registry, writing core identity fields (name, display_name, type=project, status=active, description, goals) and code-specific extended fields (tech stack, patterns). The display_name is typically derived from the spec's title field.

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

Consumers can filter queries by type (project vs. area of focus) and by status (active, paused, archived, etc.). Filtering combines with depth levels -- a consumer can request "summary of all active projects" and receive a compact, filtered result.

**Pull model:**

The registry does not push data to consumers. Consumers read on demand at their chosen depth. There are no notifications, no subscriptions, no webhooks.

### 2.4 Structured Project Profile {#project-profile}

Every project carries a **structured profile** — a machine-readable fingerprint that agents and tools use for association, routing, and discovery. The profile sits alongside the human-readable description and replaces the old comma-separated goals string.

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

### 2.5 What Happens When Things Go Wrong {#error-handling}

| What Went Wrong | What the Consumer/Producer Sees | What It Can Do |
|----------------|-------------------------------|----------------|
| Registry database does not exist | A clear error indicating the database has not been initialized | Run migration or create an empty registry |
| Query for a project that does not exist | Library API: an empty result (null/undefined), not an error. MCP server: a structured `Error [NOT_FOUND]` with a suggestion for next steps. When the queried name is close to an existing project name (e.g., "project-registy" vs. "project-registry-service"), the error includes a "did you mean?" suggestion with the closest match. | Distinguish "not found" from "registry broken"; retry with the suggested name if appropriate |
| Query when registry is empty | An empty collection, not an error or crash | The consumer knows the registry is working but unpopulated |
| Producer writes a field not in the default catalog | The field is accepted and stored | Query at full depth to see the custom field |
| Duplicate registration (same name or same path) | The system handles this gracefully -- either rejects with a clear reason or recognizes it as the same project | Existing data is never silently overwritten or duplicated |
| Registered path no longer exists on disk | The orphaned path remains in the registry (does not self-heal) | Manual cleanup; future versions will detect orphaned data |

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

### 2.12 Portfolio Memory {#portfolio-memory}

The registry maintains a structured memory store that transforms it from a static project phone book into a learning system. Agents retain decisions, outcomes, patterns, preferences, dependencies, corrections, and skills as typed memories. These memories are recalled via budget-controlled hybrid retrieval, reinforced by build outcomes, and consolidated through background reflection.

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

An agent calls `recall` with a query (natural language or structured), an optional project scope, and a token budget. The memory system searches across three parallel retrieval legs -- FTS5 keyword matching, vector similarity (when embeddings are available), and graph traversal (following memory edges) -- and fuses the results using Reciprocal Rank Fusion. The fused results are then reranked by a composite score that balances similarity, reinforcement strength, temporal recency, and outcome history.

**Progressive delivery:** Recall supports a two-pass retrieval model. FTS5 keyword results are returned immediately as the first pass, providing usable results with minimal latency. Vector similarity re-ranking proceeds asynchronously and produces a refined, fully fused ranking in the second pass. Callers that need fast answers work from the first pass; the full fused ranking arrives shortly after. This is especially valuable for bootstrap mode, where agents need to start working quickly and can absorb improved rankings as they arrive.

The recall response fills the caller's token budget with the highest-scored memories, using tiered content: L0 summaries (one-sentence abstracts) first, expanding to L1 overviews and then full L2 content as budget allows. An adaptive cutoff stops retrieval when scores drop sharply (a "score cliff").

**Bootstrap mode:** An agent starting a new session calls recall with no query and a project scope. This returns the project's memory profile -- its key decisions, active patterns, preferences, and recent outcomes -- suitable for injection into the agent's context at session start. Pinned memories (memories with `is_pinned` set) always surface at the top of bootstrap recall regardless of score.

**Query intent classification:** The recall system classifies incoming queries by intent -- temporal, relational, factual, or exploratory -- and adjusts retrieval weights accordingly. Each intent maps to a weight profile that shifts emphasis across retrieval legs: temporal queries boost recency weight, factual queries boost FTS5/exact-match weight, relational queries boost graph traversal weight, exploratory queries use balanced weights. This ensures that "what did we decide last week?" emphasizes time while "do we use Postgres or MySQL?" emphasizes precision.

**Type-priority budget allocation:** When filling a caller's token budget, the recall system allocates in priority order across memory types: corrections and preferences claim budget first (they directly shape agent behavior), then recent outcomes and learnings (they prevent repeated mistakes and surface discoveries), then patterns and procedural memories (they save time), then decisions, dependencies, and observations (they provide context). Context-type memories are lowest priority -- they fill remaining budget only. Within each priority tier, memories expand from L0 to L2 as budget allows. This ensures that a tight budget always contains the knowledge most likely to affect the agent's next action.

**Reflect: background consolidation.**

Reflection is a background process that maintains the health and quality of the memory store. It runs on its own schedule -- triggered when cumulative new memory importance exceeds a threshold, on a periodic schedule, or via explicit admin invocation.

Reflection performs six operations:

1. **Semantic dedup** -- Finds memories with cosine similarity above 0.95 and merges them.
2. **Entity and relationship extraction** -- Identifies entities mentioned in memories and creates or updates graph edges. Also performs **gap detection** -- identifying structural holes in the memory graph where topic clusters exist in isolation without connecting edges. Gaps represent potential blind spots: knowledge areas that should relate but lack documented connections. Gap findings are surfaced as observations (memory type `observation`) so portfolio intelligence can act on them.
3. **Summary block rewriting** -- Maintains hierarchical compaction trees for each scope level. Rather than flat per-scope summaries, reflection produces multi-level topic hierarchies that capture cross-topic relationships. These compaction trees enable proactive surfacing of relevant context even when a recall query has zero keyword overlap with the stored memory -- the hierarchy bridges topics that search alone cannot connect. Compaction trees are consumed by recall's bootstrap mode as the "holistic view" of a project's or portfolio's accumulated knowledge.
4. **Stale memory archival** -- Archives memories that pass the triple gate: low quality score (below 0.3) AND low access count (fewer than 2 retrievals) AND old age (more than 90 days). All three conditions must be true.
5. **Knowledge distillation** -- Examines clusters of related memories (outcomes, decisions, learnings) and extracts higher-order knowledge. Recurring outcomes become patterns, repeated decisions become preferences, sequences of corrections become procedural memories. Distillation is distinct from dedup (which merges near-identical content) -- it synthesizes new knowledge from related but distinct memories. Distilled memories link back to their source memories via edges, preserving provenance.
6. **Enrichment log update** -- Records what reflection did.

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

A fourth tier -- **native vector search** -- accelerates similarity queries when available. When the sqlite-vec extension is loaded, vector similarity queries execute entirely within SQLite as KNN operations on a virtual table, rather than requiring application-level cosine computation. This is faster and more memory-efficient for large memory stores. The three embedding generation tiers (OpenAI, Ollama, FTS5-only) remain unchanged -- sqlite-vec optimizes how vectors are stored and queried, not how they are produced. When sqlite-vec is unavailable, the system falls back to application-level similarity computation with no loss of functionality.

The embedding provider is a runtime configuration. Changing providers does not invalidate existing memories. The dual-column pattern (embedding + embedding_new) supports gradual migration between providers. When the provider is set to "none", recall degrades to FTS5-only. When a provider is re-enabled, vector similarity resumes immediately.

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

### 2.13 Project Bootstrap {#project-bootstrap}

The registry can create a new project end-to-end: registering its identity, creating its folder on disk, populating it from templates, and optionally initializing version control. This subsumes the manual `new-project.sh` shell script entirely — the bootstrap is now a first-class registry operation available through MCP, CLI, and library import.

**Before bootstrap works: configuration.**

Bootstrap requires knowing where projects live on disk. An agent or user calls `configure_bootstrap` to map project types to default path roots, set the template directory, and set the archive path root. For example: `project → ~/Code`, `area_of_focus → ~/Areas`, templates at `~/Resources/System/Templates/`, archive at `~/Archive/`. This configuration is stored in the registry database and persists across sessions. The desktop app provides a Settings view for configuring these paths visually.

If an agent calls `bootstrap_project` before any bootstrap configuration exists, the call fails with a clear error: "Bootstrap is not configured. Call configure_bootstrap first to set path roots for your project types and a template directory." The error includes the exact next step — no silent fallbacks, no guessing at paths.

**Bootstrapping a code project:**

An agent or user calls `bootstrap_project` with a project name, type (`project`), and optionally a path override. The registry:

1. Registers the project in the registry (internally calls the same registration logic as `register_project` — core identity fields are created).
2. Creates the project folder at the configured path root for the `project` type (e.g., `~/Code/my-new-project`).
3. Copies the contents of the template directory into the new folder, applying any template-specific scaffolding.
4. Initializes a git repository in the new folder and creates an initial commit.

The caller receives confirmation with the registered project name and the created path. The project is immediately queryable in the registry and ready for development.

**Bootstrapping a non-code project or area of focus:**

An agent or user calls `bootstrap_project` with a name and type (`area_of_focus` or a non-code `project` variant). The registry:

1. Registers the project in the registry.
2. Creates the folder at the configured path root for that type (e.g., `~/Areas/my-area`).
3. Copies template contents into the new folder — folder structure and template files only.
4. Does NOT initialize git. Non-code projects and areas of focus typically live in iCloud-synced paths where git repositories are forbidden.

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

**Home view: the project dashboard.**

On launch, the user sees a card grid of all registered projects. Each card shows the project name, a type badge (project or area of focus), a status indicator, and a last-updated timestamp. The grid is the user's panoramic view of their ecosystem.

Filter and sort controls sit at the top of the view. The user can filter by type (projects, areas of focus, or both), filter by status using a multiselect dropdown (multiple statuses can be active simultaneously — e.g., show only "active" and "paused" projects), and sort by name, status, or last updated. Archived projects are hidden by default; the user sees an "N archived projects" link below the grid that adds the archived filter with one click. Filtering and sorting are immediate — no loading states for a local database of this size.

**Project detail: the tabbed view.**

Clicking a project card opens a detail view with a persistent header showing the project name, type badge, status, description, and action buttons (Edit, Archive). Below the header, content is organized into tabs:

- **Overview tab** — Displays the project's fields, filesystem paths, and goals. For code projects, this includes tech stack, patterns, and tooling fields. For non-code projects, stakeholders, timeline, and domain. This is the project's identity card.

- **Memory tab** — A read-only browse of the project's memories: decisions, outcomes, patterns, preferences, and other retained knowledge. Memories are displayed in score order with type badges and timestamps. The user can see what agents have learned about this project but cannot create, edit, or delete memories from the UI in v1.

- **Capabilities tab** — A read-only list of the project's declared capabilities, grouped by type. Each capability shows its name, type, description, and invocation metadata where present. Read-only in v1.

- **Ports tab** — A read-only view of the project's port allocations: port number, service label, protocol, and claim timestamp. Read-only in v1.

**Project CRUD operations.**

The desktop app supports the full project identity lifecycle through the UI:

- **Register** — A form for creating a new project entry. Collects the six core identity fields (name, display name, type, status, description, goals) and optionally filesystem paths. Calls `registry.registerProject()` through the IPC bridge. The new project appears in the card grid immediately.

- **Edit** — From the project detail header, the user can edit the project's display name, status, description, and goals. Edits are committed individually or as a batch. Calls `registry.updateProject()` through the IPC bridge.

- **Archive** — From the project detail header, the user can archive a project. This triggers the same archive behavior as the programmatic `archive_project` — ports released, capabilities cleared, status set to archived. If an archive path root is configured, the project's folders are moved there (with `.git` stripped). The project disappears from the default card grid.

- **Rename** — The user can rename a project (change its slug identifier). This triggers the same atomic rename as `registry.renameProject()` — all references updated in a single transaction.

**Settings: bootstrap path configuration.**

The desktop app includes a Settings view accessible from the home view. Settings allows the user to configure the bootstrap path roots visually:

- **Project path root** — Where code projects are created (e.g., `~/Code`).
- **Area path root** — Where areas of focus are created (e.g., `~/Areas`).
- **Archive path root** — Where archived projects are moved (e.g., `~/Archive`).
- **Template directory** — Where project templates live (e.g., `~/Resources/System/Templates`).

Each path field shows the current configured value (or "Not configured") and allows the user to set or change it. Changes are saved immediately via `configure_bootstrap` through the IPC bridge.

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

**Capability declaration writing.** Accepts a project name and a complete set of capability declarations, replacing the project's previous capability set. Replace semantics ensure the registry reflects current code reality.

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

**MCP server access.** @setlist/mcp wraps @setlist/core as 33 MCP tools via @modelcontextprotocol/sdk using stdio transport managed by Claude Code's lifecycle. The 29 original tools match the Python server; `enrich_project`, `bootstrap_project`, `configure_bootstrap`, and `rename_project` are Setlist-specific additions. The server provides:

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
- `reflect` -- Trigger consolidation.
- `correct` -- Create correction memory.
- `forget` -- Archive a memory.
- `inspect_memory` -- View memory details.
- `configure_memory` -- Set memory configuration.
- `bootstrap_project` -- Register a project and create its folder from templates.
- `configure_bootstrap` -- Set path roots per project type and template directory.

See [Appendix D](#appendix-d-mcp-tool-reference) for the complete tool reference with parameters and return types.

**MCP tool surface design:**

- *Progressive detail:* Read tools accept a `detail` parameter (`minimal`, `summary`, `standard`, `full`).
- *Structured errors:* All errors follow `Error [CODE]: message. Suggestion: next action.` with codes: `NOT_FOUND`, `EMPTY_REGISTRY`, `INVALID_INPUT`, `NO_RESULTS`. `NOT_FOUND` errors include fuzzy-match "did you mean?" suggestions.
- *Workflow-aware descriptions:* Each tool's docstring suggests logical next tools.
- *Response minimization:* Empty fields are omitted, not rendered as blanks.

**Workspace context switching.** When an agent calls `switch_project`, the response includes all information needed to orient: filesystem paths, project type and status, description, goals, port assignments, and workspace-relevant extended fields (MCP servers, IDE, terminal profile).

### 3.2 Things the System Keeps Track Of {#entities}

- **Projects** -- Initiatives with completion criteria. They progress through a lifecycle: idea, draft, active, paused, archived, complete. Each project has core identity fields, zero or more extended fields, and one or more filesystem paths.

- **Areas of focus** -- Ongoing concerns with no end state. They have a status (active, paused) but no completion criteria. First-class citizens, queryable through the same interface.

- **Fields** -- The atomic units of project identity. Each field is typed (string, list, enum, text), categorized (identity, technical, context, tooling, lifecycle), and self-describing.

- **Core identity fields** -- The six fields every project and area of focus must have:
  - **Name** -- slug-style identifier for lookups (e.g., "project-registry-service")
  - **Display name** -- human-friendly label (e.g., "Project Registry Service"). Defaults to name. Does not need to be unique.
  - **Type** -- project or area of focus
  - **Status** -- lifecycle position
  - **Description** -- natural-language description suitable for semantic reasoning
  - **Goals** -- what the initiative is trying to achieve

- **Extended fields** -- Fields beyond core identity: technical (tech stack, patterns, IDE, terminal profile), context (stakeholders, timeline, domain), tooling (MCP servers, URLs, workspace preferences).

- **Filesystem paths** -- Known locations where a project has a presence on disk. A project may have multiple paths for dual-surface projects.

- **Field catalog** -- The registry's master list of known fields, each with a name, type (string, list, enum, text), category (identity, technical, context, tooling, lifecycle), and description. The catalog ships with a default set and is extensible -- fields not in the catalog are accepted and stored.

- **Templates** -- Configurations governing which fields are relevant for a given project type. Three canonical templates: code_project (includes tech_stack, patterns, mcp_servers, urls, keywords), non_code_project (includes stakeholders, timeline, domain, keywords), area_of_focus (subset of fields, no project-specific fields). Templates govern which fields appear at standard depth.

- **Schema meta** -- Version tracking for the database schema. Stores the current schema version (10) used by migration logic to determine whether upgrades are needed.

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

- **Bootstrap configuration** -- Settings governing project bootstrap behavior. Maps each project type (project, area_of_focus) to a default filesystem path root where new projects of that type are created. Also stores the template directory path from which scaffolding files are copied. Persisted in the registry database. Must be configured before `bootstrap_project` can be used.

### 3.3 Rules and Logic {#rules}

- Every project entry must have the six core identity fields populated. Display_name, description, and goals may be minimal for migration entries but must be present or explicitly empty.
- Name must be unique within the registry. Duplicate name results in a clear error or recognized update, never a silent duplicate.
- Display_name defaults to name if not provided. Does not need to be unique. Always present in query responses at all depth levels.
- Type is either "project" or "area of focus." First-class attribute, not inferred.
- Status values for projects: idea, draft, active, paused, archived, complete. For areas of focus: active, paused. An area of focus never has "complete" or "archived" status.
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
- Memory content-hash dedup: `sha256(type + ":" + normalized_content)[:16]`. Matching hash → reinforce, not duplicate.
- Reinforcement: reinforcement_count starts at 1. Repeat observation increments by 1. Boost in recall via `log(reinforcement_count + 1)`.
- Triple-gate archival: ALL three conditions must hold: quality/importance < 0.3 AND access count < 2 AND age > 90 days.
- EMA outcome scoring: `outcome_score = outcome_score + alpha * (signal - outcome_score)`, alpha = 0.1, signal = 1.0 (success) or 0.0 (failure).
- Budget-controlled recall: response never exceeds caller's token budget. Memories in score order, L0 first, expanding to L1/L2.
- FTS5-first retrieval: FTS5 always available regardless of embedding provider. All other features work identically without embeddings.
- Four-level scope isolation: recall for project returns project + area-of-focus + portfolio + global. Without project context, portfolio + global only. Project A memories never returned for project B recall (unless same area of focus and area-scoped).
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
- Query intent classification maps to retrieval weight profiles: temporal boosts recency, factual boosts FTS5/exact-match, relational boosts graph traversal, exploratory uses balanced weights.
- Type-priority budget allocation fills in order: corrections/preferences first, then outcomes/learnings, then patterns/procedural, then decisions/dependencies/observations, then context. Within each tier, L0 → L1 → L2 expansion.
- Proactive contradiction detection runs during retain for preference, correction, and learning types. Auto-resolves when embeddings available (similarity > 0.85 with different conclusion). Flags for review in FTS5-only mode.
- Every memory must have content and type. Project, scope, tags, session_id, agent_role are optional. Scope defaults to "project" when project provided, "global" when not.

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
| Claude Code (via MCP) | All 32 tools | CC reads/writes via @setlist/mcp | CC has no project awareness; MCP server provides it |
| Async worker (launchd) | Task execution | Worker reads tasks, spawns CC sessions, writes results | Tasks remain pending until worker runs |
| CC auto-memory files | Per-project patterns and decisions (`MEMORY.md`) | cross_query reads from filesystem | Cross-project queries limited to registry fields + structured memories |
| Embedding provider (OpenAI / Ollama) | Vector embeddings for memory content | Registry sends content, receives embeddings | FTS5-only fallback. All other features work identically. |
| fctry post-build hook | Build outcome (success/failure) + recalled memory IDs | fctry writes feedback to registry | Memory outcome scores not updated for explicit builds |
| chorus-ui package | Design tokens (CSS custom properties + TS constants) for colors, typography, easing | @setlist/app imports `chorus-ui/tokens.css` and `chorus-ui/tokens` | Tokens are the contract; chorus-ui is a direct dependency of @setlist/app |

**MCP tool validation at startup.** The MCP server validates its own tool definitions when it starts -- tool names, parameter schemas, and descriptions are checked for conformance before the server accepts connections. This catches configuration drift between @setlist/core and @setlist/mcp (e.g., a new tool added to core but not wired into the MCP wrapper). If validation fails, the server surfaces the specific tools that are non-conformant rather than silently starting with broken definitions.

**Progress reporting for long-running operations.** Long-running MCP operations -- reflect, batch operations, cross-project queries -- report progress through the MCP protocol's progress notification mechanism rather than blocking until completion. Callers see incremental status updates ("dedup pass complete, starting entity extraction...") instead of a silent wait followed by a large response.

**Direct library import (new with Setlist).** Chorus and Ensemble import @setlist/core as an npm dependency. This is the primary motivation for the TypeScript rewrite. The library is consumed in-process -- no IPC, no MCP server, no subprocess.

**chorus-ui token package (new with @setlist/app).** The desktop app imports design tokens from `chorus-ui`, an extracted package providing CSS custom properties (`chorus-ui/tokens.css`) and TypeScript constants (`chorus-ui/tokens`). This is a direct dependency — @setlist/app lists `chorus-ui` in its `package.json`. There is no shared component library — each app implements its own UI components consuming the shared tokens. If the design language evolves, `chorus-ui` is updated and both apps follow.

### 3.5 Performance Expectations {#performance}

better-sqlite3 is typically faster than Python's sqlite3 module due to synchronous native bindings and no GIL contention:

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

---

## 4. Boundaries and Constraints

### 4.1 Scope {#scope}

**This spec covers:**

Everything the Python spec covers (project identity, fields, queries, migration, ports, capabilities, memory, tasks, cross-project queries, batch operations), plus:

- The npm monorepo structure (@setlist/core, @setlist/mcp, @setlist/cli)
- TypeScript type system for the registry API (interfaces, enums, type guards)
- better-sqlite3 synchronous API patterns
- @modelcontextprotocol/sdk integration for the MCP server
- npm distribution and package.json configuration
- Schema evolution from Python's v8 through v9 (observation) to v10 (unified memory types + chorus-compatible fields)
- Porting strategy from the 786 Python tests
- Portfolio intelligence support: the `observation` memory type and `portfolio_brief` tool that enable external agents (orchestrator) to retain and recall cross-project findings
- Unified memory store: setlist as the canonical memory backend for Chorus (10 memory types, belief classification, temporal validity, entity extraction, procedural versioning). Chorus imports @setlist/core directly for in-process memory operations.
- Project bootstrap: end-to-end project creation (registration + folder scaffolding + template population + git init for code projects) with configurable path roots per type and template directory. Subsumes the manual `new-project.sh` script.
- Desktop control panel: Electron-based macOS application (@setlist/app) providing a project dashboard, tabbed project detail views, and project CRUD (register, edit, archive, rename). Memory, capabilities, and ports are read-only in v1. Shares Chorus's design system (Tailwind CSS 4, Radix UI, design tokens).

**This spec does NOT cover (deferred, same as Python spec):**

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

All Python spec hard constraints apply, plus:

- **SQLite via better-sqlite3, synchronous API.** The database binding is better-sqlite3, which provides synchronous, native SQLite access. This is a deliberate choice: synchronous calls are simpler, faster, and avoid the callback/promise complexity that async SQLite wrappers introduce for a local database. The library API may expose async signatures for ergonomic consistency, but the underlying operations are synchronous.

- **Schema evolution from v8.** The SQLite schema originated as v8, byte-compatible with the Python implementation. Setlist has since evolved the schema: v9 added the `observation` memory type, v10 adds unified memory types (learning, context, procedural), new fields (belief, extraction_confidence, valid_from, valid_until, entities, parent_version_id, is_current), and migrates `skill` → `procedural`. The Python implementation remains at v8; the shared .db file is forward-compatible (Python can read v10 databases but will not recognize new types or fields). Schema migrations are incremental and non-destructive.

- **33 MCP tools with Python-compatible core.** The original 29 tools are a drop-in replacement for the Python server — same names, parameters, and response shapes. Setlist adds `enrich_project`, `bootstrap_project`, `configure_bootstrap`, and `rename_project` as Setlist-specific tools (#30--#33). An agent that works with the Python MCP server works identically with Setlist's for the original 29.

- **ESM-only.** All packages produce ESM output. No CommonJS dual-publishing.

- **Electron security: no nodeIntegration in renderer.** The renderer process must not have direct access to Node.js APIs. All communication between the renderer and main process flows through Electron's `contextBridge` with explicitly exposed IPC methods. The main process imports @setlist/core and exposes a defined set of operations; the renderer calls these through the preload script. This is a hard security boundary.

- **Single-instance Electron app.** Only one instance of the desktop app may run at a time. Attempting to launch a second instance activates the existing window. This prevents database contention and user confusion.

- **No per-project manifest files.** Same as Python spec. The central SQLite database is the sole storage mechanism.

### 4.4 Anti-Patterns {#anti-patterns}

All Python spec anti-patterns apply, plus:

- **Setlist must not add async where sync suffices.** better-sqlite3 is synchronous. Wrapping every call in async/await adds complexity without benefit for a local database. Use async only where genuinely needed (embedding API calls, file system operations, worker process management).

- **Schema evolution must be incremental and non-destructive.** Each version upgrade (v8→v9→v10) must handle the full migration path. Existing data must never be lost during upgrades. New columns use nullable defaults or sensible initial values. The `skill` → `procedural` type migration in v10 is a data migration within the table-recreate pattern.

- **Setlist must not re-invent MCP tool semantics.** The 32 tools have defined parameter names, types, and response shapes. Setlist implements them; it does not redesign them.

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
│   │   │   └── bootstrap.ts        # Project bootstrap (folder creation, templates, git init)
│   │   ├── tests/                   # Behavioral parity tests (vitest)
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── mcp/                         # @setlist/mcp
│   │   ├── src/
│   │   │   ├── index.ts             # MCP server entry point
│   │   │   └── server.ts            # 32 tool definitions
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── cli/                         # @setlist/cli
│   │   ├── src/
│   │   │   ├── index.ts             # CLI entry point
│   │   │   ├── commands/            # Subcommands
│   │   │   └── worker.ts            # Async worker (launchd target)
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── app/                         # @setlist/app
│       ├── src/
│       │   ├── main/                # Electron main process
│       │   │   ├── index.ts         # App entry point, window management
│       │   │   └── ipc.ts           # IPC handlers (bridges @setlist/core to renderer)
│       │   ├── preload/
│       │   │   └── index.ts         # contextBridge API exposure
│       │   └── renderer/            # React application
│       │       ├── App.tsx           # Root component, routing
│       │       ├── pages/            # Home (dashboard), ProjectDetail
│       │       ├── components/       # Cards, tabs, forms, shared UI
│       │       └── styles/           # Tailwind config, design tokens
│       ├── package.json
│       └── tsconfig.json
├── package.json                     # Workspace root
├── tsconfig.json                    # Base TypeScript config
├── CLAUDE.md                        # Project instructions
└── .fctry/                          # Factory specification
```

### 5.2 Schema Compatibility {#schema}

The SQLite schema v10 is the current schema. It extends the Python implementation's v8 through two evolution steps: v9 added the `observation` memory type, v10 adds unified memory types and chorus-compatible fields:

**Tables (18):**
- `projects` — core identity columns (name PK, display_name, type, status, description, goals, created_at, updated_at)
- `project_paths` — filesystem paths (project_id FK, path, added_at, added_by)
- `project_fields` — EAV table for extended fields (project_id FK, field_name, field_value, producer, updated_at)
- `field_catalog` — master list of known fields (name PK, type, category, description). Advisory — fields not in the catalog are still accepted.
- `templates` — project type templates (name PK, description). Three canonical templates: code_project, non_code_project, area_of_focus.
- `template_fields` — maps templates to field names (template_name FK, field_name FK). Governs which fields appear at standard depth.
- `schema_meta` — schema version tracking (key PK, value). Stores `schema_version = 10`.
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

**Indexes, constraints, and triggers** must match the Python implementation exactly. The migration function in `db.ts` should be a faithful TypeScript translation of the Python `db.py` initialization.

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
  type: 'project' | 'area_of_focus';
  status: ProjectStatus;
  description: string;
  goals: string;
  paths: string[];
  // Extended fields at standard/full depth
  fields?: Record<string, FieldValue>;
  ports?: PortClaim[];
  capabilities?: Capability[];
}

type ProjectStatus = 'idea' | 'draft' | 'active' | 'paused' | 'archived' | 'complete';
type MemoryType = 'decision' | 'outcome' | 'pattern' | 'preference' | 'dependency' | 'correction' | 'learning' | 'context' | 'procedural' | 'observation';
type MemoryBelief = 'fact' | 'opinion' | 'hypothesis';
type MemoryScope = 'project' | 'area_of_focus' | 'portfolio' | 'global';
type QueryDepth = 'minimal' | 'summary' | 'standard' | 'full';
```

**MCP server with @modelcontextprotocol/sdk.** The MCP server uses the official SDK:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({ name: 'setlist', version: '0.1.0' }, { capabilities: { tools: {} } });
// Register 32 tools...
const transport = new StdioServerTransport();
await server.connect(transport);
```

**Electron with contextBridge IPC.** The desktop app uses Electron's recommended security model: the main process imports @setlist/core and registers IPC handlers for each operation the renderer needs. The preload script exposes these through `contextBridge.exposeInMainWorld()`, giving the renderer a typed API object (e.g., `window.setlist.listProjects()`) without any direct Node.js access. The renderer is a standard web application that happens to call IPC instead of HTTP.

**React + Tailwind CSS 4 + Radix UI + chorus-ui.** The renderer uses React for component architecture, Tailwind CSS 4 for styling, `chorus-ui` for design tokens (imported as CSS custom properties, referenced via Tailwind's `@theme` or directly in CSS), and Radix UI for accessible primitive components (dialogs, tabs, dropdown menus, etc.). This matches Chorus's frontend stack, ensuring visual consistency and reducing the learning curve for maintenance across both applications.

**Electron Forge or electron-builder for packaging.** The desktop app is packaged as a standalone macOS `.app` bundle. The specific packaging tool is an agent decision. The `setlist ui` CLI command launches the Electron process from the installed npm package.

**Testing.** Tests cover all behavioral categories from the 786 Python tests using vitest. Coverage is measured by behavioral surface (every scenario S01-S30 has corresponding tests), not raw test count. Python-specific patterns (pytest fixtures, parametrize) are translated to vitest equivalents (beforeEach, test.each).

### 5.4 Porting Strategy {#porting}

The port follows a strict behavioral contract: every Python test, translated to TypeScript, must pass against @setlist/core.

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
| server.py | server.ts | 33 MCP tools via @modelcontextprotocol/sdk |
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

---

## 6. Reference and Prior Art

### 6.1 Inspirations {#inspirations}

All inspirations from the Python spec apply. Additional TypeScript-specific references:

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

### 6.2 Ecosystem Context {#ecosystem-context}

Same ecosystem as the Python spec (Archibald, ctx, Chorus, fctry, McPoyle, Knowmarks), with updated integration model:

**Direct library consumers (new with Setlist):**
- **Chorus** — Imports @setlist/core for project identity at launch. No MCP server needed.
- **Ensemble** — Imports @setlist/core for memory retain/recall during agent orchestration.

**MCP consumers (unchanged):**
- **Claude Code** — Uses @setlist/mcp for all 32 tools.

**Producers (unchanged):**
- **fctry** — Writes project identity and capabilities via MCP or library import.
- **Chorus** — Writes non-code project identity.
- **Migration scripts** — One-time bootstrap.

---

## 7. Satisfaction and Convergence

### 7.1 Satisfaction Definition {#satisfaction}

All satisfaction criteria from the Python spec (section 6.1) apply identically, exercised against the TypeScript implementation. Additionally:

- @setlist/core is importable from any Node.js/TypeScript project as an npm dependency.
- @setlist/mcp is a drop-in replacement for the Python MCP server — same tool names, parameters, and response shapes.
- @setlist/cli provides `setlist` as a terminal command with the same subcommands as `project-registry`.
- Chorus can import @setlist/core and call `listProjects()`, `getProject()`, `switchProject()` directly.
- Ensemble can import @setlist/core and call `retain()`, `recall()`, `feedback()` directly.
- Both Python and TypeScript implementations read and write the same .db file without conflict.
- TypeScript tests (vitest) cover all behavioral categories from the 786 Python tests, with every scenario S01-S30 having corresponding test coverage.
- The npm packages build cleanly with `npm run build` from the workspace root.
- The monorepo installs with `npm install` — no special setup beyond Node.js LTS.
- The desktop app launches, displays all registered projects in a card grid, and supports navigating to project detail views with tabbed content.
- Project CRUD operations (register, edit, archive, rename) work from the desktop UI and produce the same database state as the equivalent library/MCP calls.
- The desktop app is packageable as a standalone macOS .app bundle.

### 7.2 Convergence Strategy {#convergence}

**Start with:** @setlist/core schema initialization (db.ts) producing the current schema (v10, evolved from Python's v8). Verify by comparing table definitions, indexes, and constraints.

**Then layer in:** Core identity — registration, querying at three depths, filtering. Port the corresponding Python tests. This is the foundation everything else builds on.

**Then layer in:** Field model, templates, producer-scoped writes, field enrichment. Port tests.

**Then layer in:** Migration, port management, port discovery. Port tests.

**Then layer in:** @setlist/mcp — wrap the core library as 33 MCP tools. Verify tool-by-tool against the Python server's behavior.

**Then layer in:** Portfolio memory — retain, recall, reflect. Content-hash dedup. FTS5 retrieval. Port memory tests.

**Then layer in:** Capability declarations, batch operations, cross-project queries, task queue. Port remaining tests.

**Then layer in:** @setlist/cli — terminal commands, worker script, launchd integration.

**Then layer in:** @setlist/app — Electron shell, IPC bridge, React renderer with Tailwind CSS 4 and Radix UI. Start with the home view (card grid), then project detail (tabbed view), then CRUD forms.

**Finally:** Embedding provider integration (OpenAI, Ollama), outcome feedback, and background reflection. These are the most complex memory features and benefit from having the full test suite in place first.

### 7.3 Observability {#observability}

Same signals as Python spec:
- Project count after migration matches ecosystem (~40 projects)
- Field completeness proportional to source richness
- Query coherence at each depth level
- Data richness exceeds regex extraction

Additional TypeScript-specific signals:
- Schema v8 byte-compatibility verified against Python-created .db files
- All behavioral categories tested with full scenario coverage (S01-S30)
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
- MCP tool surface (defined by the 32-tool contract)
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

All rationale from the Python spec applies (SQLite over YAML, atomized fields, registration over discovery, registry below fctry, areas of focus as first-class).

**Why TypeScript?** Chorus is Electron + React (TypeScript). Ensemble orchestrates agents in TypeScript. Both need the registry as a library import. Python cannot be imported from TypeScript. The choice is between: (a) IPC/subprocess overhead for every registry call, (b) maintaining a parallel REST/gRPC API, or (c) rewriting in the consumer's language. Option (c) is the cleanest — one .db file, two implementations, direct import.

**Why better-sqlite3 over other SQLite bindings?** better-sqlite3 provides synchronous native bindings, which match SQLite's embedded nature. sql.js (WASM) is slower and lacks FTS5. node-sqlite3 (async) adds unnecessary Promise overhead for a local database. better-sqlite3 is the standard choice for Node.js applications that use SQLite as an embedded database.

**Why monorepo with npm workspaces?** Four packages serve four audiences: @setlist/core for library consumers (Chorus, Ensemble), @setlist/mcp for Claude Code, @setlist/cli for terminal users, @setlist/app for direct human interaction. A single package would force all consumers to depend on Electron, @modelcontextprotocol/sdk, and CLI dependencies they don't need. npm workspaces is the simplest monorepo solution — no Turborepo, no Nx, no Lerna.

**Why ESM-only?** The ecosystem is ESM. @modelcontextprotocol/sdk is ESM. Chorus is ESM. Dual CJS/ESM publishing adds build complexity for no consumer benefit.

**Why a desktop app?** The registry was designed as invisible infrastructure, but the user also wants to see and manage their project landscape directly — not just through agents. A desktop control panel makes the registry a product, not just a service. Electron is the natural choice: the main process imports @setlist/core directly (same as Chorus), and the React/Tailwind/Radix stack matches Chorus's frontend, keeping the ecosystem consistent.

**Why use chorus-ui?** Setlist and Chorus are sibling products in the same ecosystem. The `chorus-ui` package extracts design tokens (CSS custom properties + TypeScript constants) into a single source of truth. Both apps import the same tokens, ensuring visual cohesion without coupling their component implementations. When the design language evolves, one package update propagates to both apps.

## Appendix B: Glossary

All terms from the Python spec glossary apply. Additional terms:

| Term | Meaning |
|------|---------|
| Setlist | The TypeScript implementation of the Project Registry |
| @setlist/core | npm package providing the library API — all registry logic |
| @setlist/mcp | npm package providing the MCP server — 32 tools via @modelcontextprotocol/sdk |
| @setlist/cli | npm package providing the CLI — terminal commands and worker script |
| better-sqlite3 | Synchronous native SQLite binding for Node.js |
| Schema v10 | The current SQLite schema version. Evolved from Python's v8 through v9 (observation type) and v10 (unified memory types + chorus-compatible fields) |
| @setlist/app | npm package providing the desktop control panel — Electron app with React renderer |
| IPC bridge | The contextBridge-based communication layer between Electron's main process (@setlist/core) and the renderer (React UI) |
| Experience-port | A spec derived from an existing implementation where the experience stays identical and only the implementation changes |

## Appendix C: Deferred Futures {#deferred-futures}

All deferred futures from the Python spec apply. The TypeScript implementation inherits the same roadmap.

Additional TypeScript-specific deferred future:

- **Python implementation deprecation.** Once Setlist reaches full parity (all 786 tests passing, all 33 MCP tools operational, migration tested), the Python implementation can be deprecated. The .db file continues as the shared contract during the transition period. Deprecation means: new features are added to Setlist first, the Python MCP server is replaced by @setlist/mcp in Claude Code config, and the Python package is archived. The database is never migrated or converted — both implementations read the same file.

- **Desktop app: memory write operations.** The Memory tab is read-only in v1. Future versions may allow creating memories, correcting memories, and triggering reflection from the UI.

- **Desktop app: capability write operations.** The Capabilities tab is read-only in v1. Future versions may allow registering and updating capability declarations from the UI.

- **Desktop app: port management.** The Ports tab is read-only in v1. Future versions may allow claiming, releasing, and discovering ports from the UI.

- **Desktop app: task management.** Queuing, monitoring, and reviewing async tasks from the UI is deferred. Tasks remain a programmatic-only surface.

- **Desktop app: project bootstrap from UI.** Creating new projects with folder scaffolding from the UI is deferred. Bootstrap remains CLI/programmatic.

- **Desktop app: web version.** A browser-based version of the control panel (without Electron) is not planned for v1. The desktop app is macOS-native.

## Appendix D: MCP Tool Reference {#appendix-d-mcp-tool-reference}

Complete tool reference for the 33 MCP tools. The original 29 have identical names, parameters, and response shapes to the Python implementation; `enrich_project`, `bootstrap_project`, `configure_bootstrap`, and `rename_project` are Setlist additions.

**Project Identity:**

| Tool | Parameters | Returns |
|------|-----------|---------|
| list_projects | detail?, type_filter?, status_filter? | Project[] at requested depth |
| get_project | name, detail? | Project at requested depth |
| switch_project | name | Paths, status, description, ports, workspace metadata |
| search_projects | query, type_filter?, status_filter? | Matching projects with relevance |
| get_registry_stats | (none) | Count, type distribution, status distribution |
| register_project | name, display_name?, type, status, description, goals, paths? | Confirmation |
| update_project | name, display_name?, status?, description?, goals? | Updated project summary |
| archive_project | name | Confirmation (ports released, capabilities cleared) |
| rename_project | name, new_name | Confirmation (all references updated) |
| batch_update | type_filter?, status_filter?, fields, dry_run? | Count and names of affected projects |
| write_fields | project_name, fields, producer? | Count of fields written |
| enrich_project | name, goals?, topics?, entities?, concerns? | Updated profile (union merge) |

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
| cross_query | query, scope? | Synthesized answer with sources |

**Bootstrap:**

| Tool | Parameters | Returns |
|------|-----------|---------|
| bootstrap_project | name, type, display_name?, status?, description?, goals?, path_override? | Registered project name + created folder path |
| configure_bootstrap | type_path_roots, template_dir? | Updated bootstrap configuration |
