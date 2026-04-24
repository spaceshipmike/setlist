# Setlist — Scenario Holdout Set

These scenarios define the behavioral contract for Setlist. Each scenario is an end-to-end
user story with LLM-evaluable satisfaction criteria. Scenarios are evaluated against the
running system, not the code — they test experience, not implementation.

Setlist is a TypeScript project; the Python project-registry-service was retired as a runtime
in spec 0.19 and remains only as historical provenance for the scenario set itself. Scenarios
marked `[TS]` cover packaging, import, and native-binding concerns specific to this implementation.

---

## S01: Schema Initialization {#s01}
**Given** a fresh system with no registry database
**When** @setlist/core initializes the database
**Then** the SQLite file is created at `~/.local/share/project-registry/registry.db` with schema v10,
all 18 tables exist with correct columns and indexes, WAL mode is enabled, and FTS5 virtual table
for memory search is created.

**Satisfaction criteria:**
- Table list matches: projects, project_paths, project_fields, field_catalog, templates, template_fields, schema_meta, tasks, project_ports, project_capabilities, memories, memory_versions, memory_edges, memory_sources, summary_blocks, enrichment_log, recall_audit, memory_fts
- Schema version stored as 10
- Memories table CHECK constraint includes all 10 types (decision, outcome, pattern, preference, dependency, correction, learning, context, procedural, observation)
- Memories table includes columns: belief, extraction_confidence, valid_from, valid_until, entities, parent_version_id, is_current
- WAL mode confirmed via `PRAGMA journal_mode`
- FTS5 table responds to `SELECT * FROM memory_fts WHERE memory_fts MATCH 'test'` without error

---

## S02: Schema Compatibility [TS] {#s02}
**Given** a registry.db created by the Python implementation (schema v8)
**When** @setlist/core opens the database
**Then** it reads and writes correctly without migration, error, or data loss.

**Satisfaction criteria:**
- Projects registered by Python are queryable from TypeScript at all three depths
- Fields, paths, ports, capabilities, memories written by Python are intact
- New projects registered by TypeScript are queryable from Python
- No schema migration triggered — version is already 8

---

## S03: Project Registration {#s03}
**Given** an initialized registry with the canonical area seed table populated
**When** a producer registers a project with name, display_name, type, status, description, goals, paths, and optional `area` and `parent_project` parameters
**Then** the project is immediately queryable at all three depth levels with correct values, including area and parent linkage when provided.

**Satisfaction criteria:**
- `getProject('my-project', 'summary')` returns name, displayName, type, status, one-line description, and area (when assigned)
- `getProject('my-project', 'standard')` additionally returns goals, paths, parent_project, template-relevant extended fields
- `getProject('my-project', 'full')` returns everything including children list, all fields from all producers
- `registerProject({ ..., area: 'Work' })` succeeds when 'Work' exists in the canonical areas seed table; invalid area name is rejected
- `registerProject({ ..., parent_project: 'knowmarks' })` succeeds and establishes the parent link when the named project exists
- Area and parent_project are both optional — a project may have neither, either, or both
- Duplicate name registration fails with a clear error

---

## S04: Progressive Disclosure Querying {#s04}
**Given** a registry with 20+ projects of mixed types and statuses
**When** a consumer queries at each depth level with various filters
**Then** responses are correctly scoped to the requested depth and filter.

**Satisfaction criteria:**
- Summary depth returns only: name, displayName, type, status, one-line description
- Standard depth adds goals, paths, and template-relevant extended fields
- Full depth omits nothing
- `type_filter='project'` returns only projects (areas are no longer a peer project type — they live in a separate seed table)
- `status_filter='active'` excludes paused/archived projects
- `area_filter='Work'` returns only projects literally assigned to the Work area — no descendant inheritance (sub-projects under a Work-scoped parent are NOT included unless they themselves carry `area='Work'`)
- `area_filter='__unassigned__'` (or equivalent sentinel) returns projects with no area assigned
- Filters compose: `type_filter='project', status_filter='active', area_filter='Work'` returns only active Work-scoped projects

---

## S05: Field Enrichment and Producer Isolation {#s05}
**Given** a project registered by producer A with core identity fields
**When** producer B writes additional extended fields to the same project
**Then** both producers' fields coexist without conflict, and neither overwrites the other.

**Satisfaction criteria:**
- After both writes, full-depth query returns union of all fields
- Producer A's original fields are unchanged
- Producer B's fields are present alongside
- Producer attribution is tracked per field

---

## S06: Fuzzy Match Error Suggestions {#s06}
**Given** a registry with a project named "project-registry-service"
**When** a consumer queries for "project-registy" (typo)
**Then** the error includes a "did you mean: project-registry-service?" suggestion.

**Satisfaction criteria:**
- Error code is NOT_FOUND
- Error message includes the closest matching project name
- Exact match queries do not trigger suggestions

---

## S07: Migration {#s07}
**Given** a filesystem with projects in `~/Code/` (some with fctry specs) and `~/Projects/` (some with brief.md)
**When** `setlist migrate` runs
**Then** all discoverable projects are proposed as registrations with metadata richness proportional to source,
and port discovery proposes port claims from config files.

**Satisfaction criteria:**
- Projects with fctry specs get rich entries (description, goals, tech_stack, patterns from synopsis)
- Projects with brief.md get extracted descriptions
- Projects with only directories get sparse entries (name, type, path)
- Display names derived from spec titles or directory slugs
- Port patterns found in config files are proposed as claims
- Clashing ports are skipped with notes, not errors

---

## S08: Port Management {#s08}
**Given** an initialized registry
**When** ports are claimed, released, checked, and auto-allocated
**Then** all port operations behave correctly with globally unique enforcement.

**Satisfaction criteria:**
- `claimPort('my-project', 'dev server', 3000)` succeeds and returns 3000
- Claiming the same port for another project fails with owner identification
- `releasePort('my-project', 3000)` frees the port
- `checkPort(3000)` reports availability or owner details
- `claimPort('my-project', 'api')` without port number auto-allocates from 3000-9999
- Releasing a port not held by the project is a no-op (not an error)
- Port claims appear in `switchProject()` responses

---

## S09: Port Discovery {#s09}
**Given** a registered project with filesystem paths containing config files with port patterns
**When** `discoverPorts('my-project')` runs
**Then** ports found in config files are claimed with derived service labels.

**Satisfaction criteria:**
- Ports in vite.config.ts → labeled "vite dev server"
- `--port` flags in package.json scripts → labeled with script context
- Port mappings in docker-compose.yml → labeled with service name
- `PORT=` in .env → labeled "env PORT"
- Clashing ports are skipped with notes, not errors
- Already-claimed ports for the same project are silently skipped (idempotent)

---

## S10: Capability Declarations {#s10}
**Given** a registered project
**When** a producer writes capability declarations with replace semantics
**Then** capabilities are immediately discoverable and a second write replaces the first entirely.

**Satisfaction criteria:**
- `registerCapabilities('my-project', [cap1, cap2, cap3])` succeeds
- `queryCapabilities({ project: 'my-project' })` returns all three
- `queryCapabilities({ type: 'mcp-tool' })` returns matching capabilities across all projects
- `queryCapabilities({ keyword: 'search' })` matches against names and descriptions
- A second `registerCapabilities` call with [cap1, cap4] removes cap2/cap3 and adds cap4
- Archiving the project clears its capabilities

---

## S11: Memory Retain and Dedup {#s11}
**Given** an initialized memory store
**When** an agent retains a memory and then retains the same content again
**Then** the first retain creates a new memory and the second reinforces it.

**Satisfaction criteria:**
- First `retain({ content: 'Use SQLite for storage', type: 'decision', project: 'my-project' })` returns a new memory ID
- Second `retain()` with identical content returns the same memory ID with `reinforced: true`
- `reinforcement_count` incremented from 1 to 2
- Content hash matches: `sha256('decision:use sqlite for storage')[:16]`
- Hot path completes in under 50ms (no LLM processing)

---

## S12: Memory Recall with Budget {#s12}
**Given** a memory store with 50+ memories across multiple projects and scopes
**When** an agent recalls with a query, project scope, and token budget
**Then** the response fits within the budget using tiered content.

**Satisfaction criteria:**
- Recall with a tight budget returns L0 summaries (one-sentence abstracts) for many memories
- Recall with a generous budget returns L2 full content for top memories
- Project-scoped recall returns project + area + portfolio + global memories (not other projects), where "area" now means memories scoped to the canonical area the project is assigned to (from the seed area table), not a peer project
- Area-scoped memories from sibling projects in the same area bubble up into a project's recall (e.g., a project in "Work" sees area-scoped memories retained by other Work-area projects)
- A project with no area assignment does not see any area-scoped memories — only project + portfolio + global
- Bootstrap recall (no query) returns the project's memory profile
- Pinned memories appear at the top of bootstrap recall regardless of score
- Score cliff stops retrieval when scores drop sharply

---

## S13: Memory Outcome Feedback {#s13}
**Given** memories that were recalled during a build session
**When** the build succeeds and feedback is reported
**Then** outcome scores for those memories trend toward success.

**Satisfaction criteria:**
- `feedback({ result: 'success', memoryIds: [id1, id2] })` updates both memories
- Outcome scores move toward 1.0 using EMA (alpha = 0.1)
- After multiple success feedbacks, scores converge near 1.0
- After a failure feedback, scores move toward 0.0
- Memories not in the feedback list are unaffected

---

## S14: Memory Correction {#s14}
**Given** a memory store with an active memory
**When** a correction is applied
**Then** the corrected memory is archived and the correction persists with high importance.

**Satisfaction criteria:**
- `correct({ memoryId: originalId, correction: 'Actually use Postgres' })` creates a new memory
- New memory has type 'correction' and importance >= 0.9
- A `contradicts` edge links correction to original
- Original memory status transitions to 'archived'
- Future recalls surface the correction, not the original
- Corrections are never subject to triple-gate archival

---

## S15: Memory Reflection {#s15}
**Given** a memory store with duplicate and stale memories
**When** reflection runs
**Then** duplicates are merged, stale memories archived, and summary blocks updated.

**Satisfaction criteria:**
- Memories with cosine similarity > 0.95 are merged (reinforcement counts combined)
- Triple-gate archival: only memories with quality < 0.3 AND access < 2 AND age > 90 days
- A low-quality but frequently-accessed memory survives (access count protects it)
- Summary blocks for each scope are rewritten
- Enrichment log records what reflection did

---

## S16: FTS5-Only Mode {#s16}
**Given** no embedding provider configured
**When** memories are retained and recalled
**Then** the system works fully on FTS5 keyword matching plus graph traversal.

**Satisfaction criteria:**
- `retain()` succeeds without embedding generation
- `recall({ query: 'SQLite storage' })` returns relevant memories via FTS5 matching
- `reflect()` succeeds (skips semantic dedup, performs other operations)
- `memoryStatus()` reports embedding_provider: 'none'
- All other features (dedup, feedback, correction) work identically

---

## S17: Batch Operations {#s17}
**Given** a registry with 10 active projects and 5 paused projects
**When** `batchUpdate({ statusFilter: 'paused', fields: { status: 'archived' } })` runs
**Then** all 5 paused projects are archived atomically.

**Satisfaction criteria:**
- Response reports count: 5 and lists all 5 project names
- All 5 projects now have status 'archived'
- The 10 active projects are unchanged
- `dryRun: true` returns the same list without modifying anything
- A database error mid-batch rolls back all changes (atomic)
- At least one filter criterion is required (no unfiltered batch)

---

## S18: Cross-Project Task Dispatch {#s18}
**Given** 5 active projects matching a filter
**When** `queueTask({ description: 'Update CLAUDE.md', typeFilter: 'project', statusFilter: 'active', schedule: 'now' })` runs
**Then** 5 independent tasks are created, one per project.

**Satisfaction criteria:**
- Response reports count: 5 and lists all project names
- Each task is independently queryable via `listTasks()`
- Each task has its own ID, scoped to its project
- One task's failure does not affect the others

---

## S19: Cross-Project Queries {#s19}
**Given** a populated registry with memories across multiple projects
**When** `crossQuery({ query: 'What authentication patterns have I used?', scope: 'all' })` runs
**Then** the response synthesizes relevant information from registry fields, structured memories, and CC auto-memory.

**Satisfaction criteria:**
- Results include matches from registry fields (tech_stack, descriptions, etc.)
- Results include scored memory matches (via recall delegation)
- Results include matches from CC auto-memory files (when scope='all')
- Results are ranked by relevance + freshness + importance
- Core identity fields are evergreen (exempt from time decay)
- Sources are cited (registry field vs. memory vs. auto-memory)
- `crossQuery({ ..., area: 'Work' })` narrows matching to projects assigned to the Work area (literal match, no descendant inheritance)

---

## S20: Archive Cleanup {#s20}
**Given** a project with port claims and capability declarations
**When** the project is archived
**Then** ports are released, capabilities cleared, but all other metadata preserved.

**Satisfaction criteria:**
- `archiveProject('my-project')` sets status to 'archived'
- Port claims for the project are released (ports available for other projects)
- Capability declarations are cleared
- All other metadata (fields, paths, task history) preserved intact
- Project remains queryable by name and appears in `status_filter='archived'` queries

---

## S21: MCP Server Drop-In [TS] {#s21}
**Given** the @setlist/mcp server running via stdio
**When** an agent sends the same MCP tool calls it would send to the Python server
**Then** responses are identical in structure and semantics.

**Satisfaction criteria:**
- All 36 tool names are registered and callable (including the new `set_project_area` and `set_parent_project` tools added in this evolve)
- Startup validation asserts the registered tool count matches 36 and fails fast if a tool is missing or unexpectedly added
- Parameter names and types match the Python server exactly
- Response shapes match (same field names, same nesting)
- Error codes match (NOT_FOUND, EMPTY_REGISTRY, INVALID_INPUT, NO_RESULTS)
- Fuzzy-match suggestions in NOT_FOUND errors work identically

---

## S22: Library Import [TS] {#s22}
**Given** a TypeScript project with @setlist/core as an npm dependency
**When** the project imports and uses the library
**Then** all registry operations work via direct function calls without MCP or subprocess.

**Satisfaction criteria:**
- `import { Registry } from '@setlist/core'` works
- `registry.listProjects({ depth: 'summary' })` returns projects
- `registry.registerProject({ ... })` creates a project
- `registry.retain({ content: '...', type: 'decision' })` stores a memory
- `registry.recall({ query: '...', tokenBudget: 1000 })` retrieves memories
- No MCP server or subprocess needed for any operation

---

## S23: npm Package Build [TS] {#s23}
**Given** the setlist monorepo
**When** `npm install && npm run build` runs at the workspace root
**Then** all three packages build successfully and are importable.

**Satisfaction criteria:**
- `npm install` resolves all workspace dependencies
- `npm run build` compiles all packages without errors
- Each package produces ESM output (no CJS)
- @setlist/core is importable from @setlist/mcp and @setlist/cli
- Type declarations (.d.ts) are generated for all packages

---

## S24: Test Parity [TS] {#s24}
**Given** a TypeScript test suite (vitest) covering all behavioral categories from the Python implementation
**When** `npm test` runs
**Then** all tests pass, confirming behavioral parity with the Python implementation.

**Satisfaction criteria:**
- All behavioral categories covered with equivalent rigor: schema, registry CRUD, progressive disclosure, fields, producer isolation, ports, port discovery, capabilities, memory (retain/feedback/correct/forget/inspect/configure/status), recall, reflection, cross-query, migration, memory migration, batch operations, tasks, edge cases, and Python DB compatibility
- Every scenario S01-S30 has at least one corresponding test
- No Python behavioral surface left untested (coverage is by behavior, not by raw test count)
- Test run completes in under 60 seconds

---

## S25: Async Worker (launchd) {#s25}
**Given** pending tasks in the queue
**When** the launchd worker runs
**Then** eligible tasks are executed via spawned CC sessions with results stored.

**Satisfaction criteria:**
- Worker script (`node packages/cli/dist/worker.js`) starts and emits startup sentinel
- Pre-deploy validation checks Node.js, @setlist/core importability, and database access
- Eligible tasks (now → always, tonight → quiet hours, weekly → always) are picked up
- Tasks transition: pending → running → completed (or failed)
- Session references stored for completed tasks
- Worker exits after processing (not a persistent daemon)
- Crash recovery: launchd restarts on unexpected termination

---

## S26: Update and Administration {#s26}
**Given** a registered project
**When** core identity fields are updated via `updateProject()`
**Then** changes are immediately reflected in queries at all depth levels.

**Satisfaction criteria:**
- `updateProject('my-project', { displayName: 'New Name' })` succeeds
- Only specified fields change; unspecified fields preserved
- Name and type are not updatable via `updateProject()`
- Changes appear in summary, standard, and full queries immediately

---

## S27: Context Switching {#s27}
**Given** a registered project with paths, ports, and metadata
**When** `switchProject('my-project')` is called
**Then** the response includes everything needed to orient in the project.

**Satisfaction criteria:**
- Response includes filesystem paths (execution and thinking surfaces)
- Response includes project type, status, description, goals
- Response includes port assignments with service labels
- Response includes workspace-relevant extended fields (MCP servers, IDE, terminal profile)
- Single call provides complete workspace context

---

## S28: Search {#s28}
**Given** a populated registry
**When** `searchProjects({ query: 'authentication' })` runs
**Then** matching projects are returned with relevance ranking.

**Satisfaction criteria:**
- Searches across name, description, goals, and extended fields (tech stack, patterns)
- Results ranked by match quality
- Type, status, and area filters compose with keyword search
- Unassigned-area filter (`area='__unassigned__'`) returns projects without an area
- Empty results return an empty array, not an error

---

## S29: Task Queue Lifecycle {#s29}
**Given** an initialized registry
**When** tasks are queued, listed, executed, and completed
**Then** the full lifecycle works correctly.

**Satisfaction criteria:**
- `queueTask({ description: 'Research pricing', project: 'knowmarks', schedule: 'tonight' })` returns a task ID
- `listTasks({ status: 'pending' })` includes the queued task
- Task is not eligible until quiet hours (tonight schedule)
- After execution, task status is 'completed' with a session reference
- Failed tasks have status 'failed' with exit code and error message
- Weekly tasks are re-queued as new pending tasks after completion

---

## S30: Registry Stats {#s30}
**Given** a populated registry with mixed project types and statuses
**When** `getRegistryStats()` is called
**Then** correct counts are returned.

**Satisfaction criteria:**
- Total project count is accurate
- Type distribution is accurate (areas are no longer a project type — they are tracked separately via the canonical area seed table)
- Status distribution (active, paused, archived, etc.) is accurate
- Response includes an `area_breakdown` map with a count per canonical area plus an explicit `unassigned` count reflecting projects with no area
- The unassigned count is a first-class statistic — nullable area is a permanent, supported state, not a migration artifact

---

## S31: Project Rename {#s31}
**Given** a registered project with ports, capabilities, tasks, and memories
**When** `renameProject('old-name', 'new-name')` is called
**Then** the project is immediately queryable under the new name with all associated data intact.

**Satisfaction criteria:**
- `renameProject('old-name', 'new-name')` succeeds and the project is queryable as 'new-name'
- `getProject('old-name')` returns NOT_FOUND after rename
- All port claims now reference the new name
- All capability declarations now reference the new name
- All tasks (pending, completed, failed) now reference the new name
- All memories with the old project_id now reference the new name
- All filesystem paths are preserved under the new name
- All extended fields and producer attributions are preserved
- Renaming to an existing project name fails with a clear error
- The rename is atomic: if any step fails, no changes are committed
- The old name becomes available for re-registration after rename

---

## S32: Schema v10 Migration {#s32}
**Given** a registry.db at schema v9 (with observation type, without unified memory fields)
**When** @setlist/core opens the database and detects v9
**Then** the schema is upgraded to v10 non-destructively.

**Satisfaction criteria:**
- Memories table CHECK constraint accepts all 10 types: decision, outcome, pattern, preference, dependency, correction, learning, context, procedural, observation
- Existing memories with `type = 'skill'` are migrated to `type = 'procedural'`
- New nullable columns exist: belief, extraction_confidence, valid_from, valid_until, entities, parent_version_id, is_current
- `is_current` defaults to 1 for all existing memories
- All existing memory data (content, scores, embeddings, edges) is preserved exactly
- schema_meta stores schema_version = 10
- FTS5 triggers still function after migration

---

## S33: Unified Memory Types {#s33}
**Given** a schema v10 database
**When** memories are retained with each of the 10 types
**Then** all types are accepted, stored, and recallable with correct decay behavior.

**Satisfaction criteria:**
- `retain({ content: '...', type: 'learning' })` succeeds and returns a memory ID
- `retain({ content: '...', type: 'context' })` succeeds
- `retain({ content: '...', type: 'procedural' })` succeeds
- `retain({ content: '...', type: 'skill' })` is rejected (type no longer valid)
- Recall applies correct decay rates: context decays fastest (2.0), procedural/observation slowest after corrections (0.5), learning at baseline (1.0)
- Type-priority budget allocation orders: corrections/preferences → outcomes/learnings → patterns/procedural → decisions/dependencies/observations → context

---

## S34: Belief Classification and Temporal Validity {#s34}
**Given** a schema v10 database with memories
**When** memories are retained with belief, extraction_confidence, and temporal validity fields
**Then** these fields are stored, returned in recall, and affect scoring.

**Satisfaction criteria:**
- `retain({ content: '...', type: 'learning', belief: 'hypothesis', extraction_confidence: 0.7 })` stores both fields
- `retain({ content: '...', type: 'decision', valid_from: '2026-01-01', valid_until: '2026-06-01' })` stores temporal bounds
- `inspect_memory` returns all new fields
- Recall returns memories with expired `valid_until` but applies a temporal penalty in scoring
- Belief field accepts only 'fact', 'opinion', 'hypothesis', or null
- Null belief and null temporal bounds are valid (no penalty, treated as unclassified/unbounded)

---

## S35: Entity Extraction Storage {#s35}
**Given** a schema v10 database
**When** memories are retained with entity metadata
**Then** entities are stored as JSON and returned in queries.

**Satisfaction criteria:**
- `retain({ content: '...', type: 'learning', entities: [{ name: 'Alice', type: 'person' }, { name: 'Acme', type: 'organization' }] })` stores the entities JSON
- `inspect_memory` returns the entities array with correct structure
- Recall results include the entities field
- Invalid entity JSON (missing name or type) is rejected at retain time
- Null entities field is valid (no entities extracted)

---

## S36: Procedural Memory Versioning {#s36}
**Given** a schema v10 database with an existing procedural memory (version 1)
**When** a refined version is retained with parent_version_id pointing to version 1
**Then** the version chain is maintained and recall surfaces only the current version.

**Satisfaction criteria:**
- Retaining a procedural memory with `parent_version_id` pointing to an existing procedural memory succeeds
- The referenced parent memory's `is_current` is set to false
- `recall` returns only `is_current = true` procedural memories by default
- `inspect_memory` on the current version shows `parent_version_id` linking to its predecessor
- `inspect_memory` on the superseded version shows `is_current = false`
- Setting `parent_version_id` on a non-procedural type is rejected
- Setting `parent_version_id` to a non-existent memory ID is rejected

---

## S37: Chorus Direct Import [TS] {#s37}
**Given** a Node.js project with `@setlist/core` as a file dependency
**When** the project imports MemoryStore and MemoryRetrieval
**Then** all unified memory operations work in-process without MCP.

**Satisfaction criteria:**
- `import { MemoryStore, MemoryRetrieval } from '@setlist/core'` resolves successfully
- `MemoryStore.retain()` accepts all 10 types and all new fields (belief, entities, etc.)
- `MemoryRetrieval.recall()` returns memories with new fields populated
- Operations are synchronous (better-sqlite3) — no async overhead for basic retain/recall
- The same registry.db is readable by both the direct import and the MCP server simultaneously (WAL mode)
- Type exports include: MemoryType (10-member union), MemoryBelief, Memory (with all new fields)

---

## S38: Bootstrap Configuration {#s38}
**Given** a running registry with no bootstrap configuration
**When** the user calls `configure_bootstrap` with a default project path root (e.g., `project → ~/Code`) and a template directory path (e.g., `~/Resources/System/Templates/`)
**Then** the configuration is stored persistently and the user can verify it was saved by calling the tool again to see current settings.

**Satisfaction criteria:**
- `configure_bootstrap` accepts a default path root for projects (areas are no longer bootstrapped — they are canonical seeds, not project-type bootstraps)
- `configure_bootstrap` accepts a template directory path
- Configuration persists across registry restarts (stored in the database, not in-memory)
- Calling `configure_bootstrap` with no arguments returns the current configuration
- Partial updates merge with existing configuration rather than replacing it entirely
- Invalid paths (e.g., nonexistent template directory) produce a clear error, not a silent save

---

## S39: Bootstrap a Code Project {#s39}
**Given** bootstrap is configured with `project → ~/Code` and a template directory containing project scaffolding files
**When** the user calls `bootstrap_project` with name "my-new-app", type "project", and optionally `area` and `parent_project`
**Then** the project folder exists at `~/Code/my-new-app/` with template files populated, a git repository initialized with an initial commit, and the project is registered in the registry with the supplied area/parent linkage.

**Satisfaction criteria:**
- A folder is created at the configured path root for the type (`~/Code/my-new-app/`)
- Template files from the configured template directory are copied into the new folder
- `git init` is run inside the folder and an initial commit is created
- The project appears in `list_projects` with the correct name, type, path, and (when provided) area and parent_project
- `get_project('my-new-app')` returns the project with all registration fields populated, including area and parent where set
- `bootstrap_project({ ..., area: 'Work', parent_project: 'knowmarks' })` stores both linkages atomically; invalid area or missing parent aborts the bootstrap before any filesystem changes
- The bootstrap is atomic from the user's perspective: if folder creation succeeds but registration fails, the folder is cleaned up (no orphaned directories)

---

## S40: Bootstrap a Non-Code Project {#s40}
**Given** bootstrap is configured with `project → ~/Code` as the default code path and an additional path root for non-code projects (e.g., `project` type with a path override to `~/Projects`), and a template directory
**When** the user calls `bootstrap_project` with name "q2-planning", type "project", and a path override to `~/Projects/q2-planning`
**Then** the project folder exists at `~/Projects/q2-planning/` with template files but no git repository (because the path is outside the code root), and the project is registered in the registry.

**Satisfaction criteria:**
- A folder is created at `~/Projects/q2-planning/`
- Template files are copied into the new folder
- No `.git` directory exists inside the folder (git init is skipped when `skip_git: true` is passed)
- The project is registered and queryable via `get_project('q2-planning')`
- The project type is stored as `project` (the standard type — there is no separate `non_code_project` type)

---

## S41: Area Type Retired — Seed Table Only {#s41}
**Given** a post-evolve registry where `area_of_focus` is no longer a valid project type
**When** any producer attempts to register, bootstrap, or update a project with type `area_of_focus`
**Then** the operation is rejected with a clear error, and the user is directed to the canonical area seed table for area assignment instead.

**Satisfaction criteria:**
- `registerProject({ type: 'area_of_focus' })` is rejected with an error naming the retired type and pointing to `set_project_area` + the canonical seed table
- `bootstrap_project({ type: 'area_of_focus' })` is rejected with the same error shape
- `updateProject({ type: 'area_of_focus' })` is rejected (type is immutable anyway, but the specific retired-type error is preferred for clarity)
- The canonical area seed table contains exactly the 7 canonical areas after initialization and cannot be mutated via project-creation tools
- Existing projects that previously had type `area_of_focus` have been demoted via the v10→v11 migration (see S71) and no longer exist as project-typed areas

---

## S42: Bootstrap Without Configuration {#s42}
**Given** a registry with no bootstrap configuration (configure_bootstrap has never been called)
**When** the user calls `bootstrap_project` with any arguments
**Then** the tool returns a clear error explaining that bootstrap must be configured first, with guidance on how to do so.

**Satisfaction criteria:**
- The call fails with an error, not a silent fallback to a guessed path
- The error message names `configure_bootstrap` explicitly as the tool to call
- The error message explains what needs to be configured (path roots and template directory)
- No folder is created on the filesystem
- No project is registered in the registry
- The error is actionable: a user reading it knows exactly what to do next

---

## S43: Bootstrap with Path Override {#s43}
**Given** bootstrap is configured with `project → ~/Code`
**When** the user calls `bootstrap_project` with name "special-project", type "project", and a path override of `~/Code/experiments/special-project`
**Then** the project is created at the overridden path instead of the default, and registered with that path.

**Satisfaction criteria:**
- The folder is created at `~/Code/experiments/special-project`, not at `~/Code/special-project`
- The registered project's path points to the overridden location
- Templates are still populated from the configured template directory
- Git init still occurs (type is project, regardless of path override)
- `get_project('special-project')` returns the overridden path

---

## S44: Bootstrap When Folder Already Exists {#s44}
**Given** bootstrap is configured and a folder already exists at the target path (e.g., `~/Code/existing-project/` with files in it)
**When** the user calls `bootstrap_project` with name "existing-project", type "project"
**Then** the tool refuses to proceed, protecting the existing folder contents.

**Satisfaction criteria:**
- The call fails with a clear error indicating the folder already exists
- No files in the existing folder are modified, overwritten, or deleted
- No project is registered in the registry (the operation is fully aborted, not half-done)
- The error message suggests the user either choose a different name or remove the existing folder manually
- If a project with that name is already registered, the error mentions this separately from the folder conflict

---

## S45: App Launch and Window Creation [App] {#s45}
**Given** the @setlist/app Electron package is built and the registry database exists with projects
**When** the user launches the app (either via the macOS .app bundle or `setlist ui` from the CLI)
**Then** a single application window appears showing the home view — a card grid of all registered projects — within a reasonable startup time.

**Satisfaction criteria:**
- The Electron main process starts and creates a BrowserWindow
- The main process imports @setlist/core directly (no HTTP API, no spawned server)
- An IPC bridge connects the renderer to the main process so the UI can call registry operations
- The home view renders and displays project cards populated from the live registry
- Window title or chrome identifies the app as Setlist
- The app window is usable within 3 seconds of launch on a modern Mac

Difficulty: medium

---

## S46: IPC Bridge Isolation [App] {#s46}
**Given** the Electron app is running with the IPC bridge active
**When** the renderer process requests project data via the IPC bridge
**Then** the data flows through well-defined IPC channels — the renderer never imports @setlist/core directly or accesses the database file.

**Satisfaction criteria:**
- The renderer process communicates with the main process exclusively through `contextBridge`-exposed IPC methods
- The preload script exposes a typed API object (e.g., `window.setlist`) that the renderer calls
- Direct `require('@setlist/core')` or `import` from the renderer process does not work (contextIsolation is enabled)
- Node integration is disabled in the renderer for security
- All registry read/write operations go through IPC handlers registered in the main process

Difficulty: medium

---

## S47: Home View Card Grid [App] {#s47}
**Given** the registry contains 12+ projects distributed across several canonical areas, some projects assigned to parents, and some with no area at all
**When** the user is on the home view
**Then** projects are grouped into area lanes (one lane per canonical area present) plus a dedicated "Unassigned" lane, with sub-projects visually nested under their parent when the parent shares the same area.

**Satisfaction criteria:**
- Every registered, non-archived project appears as a card under the lane for its assigned area, or under the "Unassigned" lane when no area is set
- The "Unassigned" lane is always visible when at least one unassigned project exists, with a clearly distinct visual treatment so it reads as a real group, not an error state
- Sub-projects whose parent lives in the same area are indented under the parent with a connector glyph (e.g., "↳") indicating the parent relationship
- Sub-projects whose parent lives in a DIFFERENT area appear as top-level cards in their own area lane, annotated with a small "↳ parent-name" caption that names the cross-area parent
- Each card displays: project name, status indicator, health dot, and last-updated timestamp
- Cards reflow responsively within each lane as the window resizes
- Areas themselves are never rendered as cards — they are lane headers only (areas are no longer a project type)

Difficulty: medium

---

## S48: Home View Filtering and Sorting [App] {#s48}
**Given** the home view is showing 15+ project cards
**When** the user types a search term in the filter input, or changes the sort order
**Then** the grid immediately narrows to matching projects or reorders, with no perceptible delay.

**Satisfaction criteria:**
- A search/filter input is visible on the home view without scrolling
- Typing filters cards by project name (substring match, case-insensitive)
- The grid updates as the user types (no submit button required)
- A sort control lets the user choose between at least: alphabetical, last updated, and project type
- Area filter chips are visible on the home view — one chip per canonical area plus an "Unassigned" chip — and support multi-select with OR semantics (selecting Work + Family shows projects in either area)
- When area chips are active, lanes for unselected areas are hidden; when no chip is selected, all lanes are visible
- Area chip filtering composes with the text filter and sort control
- Clearing the filter restores all cards
- When no cards match the filter, a helpful empty state is shown (not a blank area)

Difficulty: medium

---

## S49: Project Detail Navigation [App] {#s49}
**Given** the home view is displayed with project cards
**When** the user clicks on a project card
**Then** the view transitions to that project's detail view with a persistent header and tabbed content, and the user can navigate back to the home view.

**Satisfaction criteria:**
- Clicking a card navigates to the project detail view (not a modal — a full view transition)
- The detail view shows a persistent project header with the project name, type badge, and status
- The header remains visible regardless of which tab is active
- A back button or breadcrumb returns the user to the home view
- The transition between home and detail views is smooth (no flash of empty content)
- Browser-style back navigation (if the app supports it) also returns to the home view

Difficulty: medium

---

## S50: Project Detail Tabs [App] {#s50}
**Given** the user is viewing a project's detail view
**When** the user switches between the Overview, Memory, Capabilities, and Ports tabs
**Then** each tab displays its content without reloading the header, and the selected tab is visually indicated.

**Satisfaction criteria:**
- Four tabs are visible: Overview, Memory, Capabilities, Ports
- Switching tabs updates the content area without a full-page reload or navigation event
- The currently selected tab is visually distinct from unselected tabs
- The project header (name, type, status) remains stable when switching tabs
- Each tab loads its content promptly (no spinner for more than 1 second on a populated project)

Difficulty: easy

---

## S51: Overview Tab Content [App] {#s51}
**Given** the user is viewing a project's Overview tab for a project with rich data (description, goals, paths, extended fields)
**When** the tab content renders
**Then** the user sees the project's full identity: description, goals, filesystem paths, and all extended fields in a readable layout.

**Satisfaction criteria:**
- Description is displayed as readable text (not truncated or requiring expansion)
- Goals are listed individually (not as a single blob of text)
- Filesystem paths are shown and visually distinct from prose text
- Extended fields from all producers are displayed with field names as labels
- The layout uses clear visual grouping (sections or cards) rather than a flat list of key-value pairs
- Fields with empty values are either omitted or shown as a gentle placeholder — not as "null" or "undefined"
- The Overview tab surfaces the project's area assignment (or "Unassigned") as a distinct field near the top of the identity section
- When the project has a parent, the parent is rendered as a clickable link showing the parent's display name (and "(archived)" if the parent has been archived — the child link remains intact regardless)
- When the project has children, a "Sub-projects" section lists each child with a clickable link; an empty children list hides the section entirely

Difficulty: easy

---

## S52: Memory Tab Read-Only View [App] {#s52}
**Given** the user is viewing the Memory tab for a project that has 20+ memories of mixed types
**When** the tab content renders
**Then** the user sees a browsable list of memories with type badges, content previews, and timestamps — but no controls to create, edit, or delete memories.

**Satisfaction criteria:**
- Memories are listed with: content preview (first ~100 characters), type badge, importance score, and creation timestamp
- Memory types are visually distinguishable (color-coded badges or icons for decision, pattern, learning, etc.)
- The list is scrollable when memories exceed the visible area
- No "Add Memory," "Edit," or "Delete" buttons or controls are present (V1 is read-only)
- The user can distinguish between high-importance and low-importance memories through visual treatment
- If the project has no memories, a graceful empty state is shown (e.g., "No memories recorded yet")

Difficulty: easy

---

## S53: Capabilities Tab Read-Only View [App] {#s53}
**Given** the user is viewing the Capabilities tab for a project that has declared capabilities
**When** the tab content renders
**Then** the user sees a list of capability declarations with names, types, descriptions, and input/output schemas.

**Satisfaction criteria:**
- Each capability is displayed with: name, capability_type, and description
- Input and output schemas are shown in a readable format (not raw JSON blobs)
- The producer who declared each capability is visible
- Capabilities requiring auth are visually flagged
- If the project has no capabilities, an empty state indicates this clearly
- No controls for adding, editing, or removing capabilities are present (V1 is read-only)

Difficulty: easy

---

## S54: Ports Tab Read-Only View [App] {#s54}
**Given** the user is viewing the Ports tab for a project with claimed ports
**When** the tab content renders
**Then** the user sees the project's port allocations with port numbers, service labels, and protocols.

**Satisfaction criteria:**
- Each port allocation shows: port number, service label, protocol, and who claimed it
- Port numbers are visually prominent (they're the primary identifier)
- If the project has no port claims, an empty state indicates this
- No controls for claiming or releasing ports are present (V1 is read-only)

Difficulty: easy

---

## S55: Register New Project via UI [App] {#s55}
**Given** the user is on the home view
**When** the user initiates "new project" creation, fills in name, display name, type, and description, then confirms
**Then** the new project appears in the card grid and is immediately accessible in the detail view.

**Satisfaction criteria:**
- A clear affordance to create a new project is visible on the home view (button, card, or similar)
- The creation form collects at minimum: name, display_name, type (from valid types), and description
- The creation form includes an optional Area picker populated from the canonical area seed table (plus an explicit "Unassigned" choice that maps to null)
- The creation form includes an optional Parent project picker (searchable list of existing projects); leaving it blank creates a top-level project
- Neither picker is required — a project may be created with no area and no parent
- The name field validates in real-time (no spaces, no duplicates)
- After submission, the new project card appears in the grid without a manual refresh
- The new project is also visible to the MCP server and CLI (it's in the registry database, not just the UI state)
- Submitting with a duplicate name shows a clear inline error

Difficulty: medium

---

## S56: Edit Project Fields via UI [App] {#s56}
**Given** the user is viewing a project's detail view on the Overview tab
**When** the user clicks Edit, modifies the description and goals, then saves
**Then** the changes are persisted to the registry and reflected in the UI immediately.

**Satisfaction criteria:**
- An Edit action is accessible from the project header or Overview tab
- Editable fields include at minimum: display_name, description, goals, status, area, and parent_project
- Changing area goes through `set_project_area` under the hood (invalid area name surfaces as an inline error)
- Changing parent_project goes through `set_parent_project` under the hood (cycle attempts surface as an inline error, see S76)
- The area field offers the same picker used in registration, including the "Unassigned" choice
- Clearing the parent field detaches the project from its parent without affecting other fields
- The edit state is clearly distinct from the view state (the user knows they're editing)
- Saving returns to the view state with updated content visible
- Canceling discards changes and returns to the view state with original content
- Changes are persisted to the SQLite database (not just UI state) — the MCP server sees them too

Difficulty: medium

---

## S57: Archive Project via UI [App] {#s57}
**Given** the user is viewing a project's detail view
**When** the user clicks Archive and confirms the action
**Then** the project is archived, the user returns to the home view, and the archived project no longer appears in the default card grid.

**Satisfaction criteria:**
- An Archive action is accessible from the project header
- Archiving requires confirmation (not a single-click destructive action)
- After archiving, the home view no longer shows the project in the default card grid
- The archive operation calls the registry's archive function (the project is archived in the database, not just hidden in the UI)
- The user can still find archived projects if a filter or view toggle exists for them

Difficulty: medium

---

## S58: Rename Project via UI [App] {#s58}
**Given** the user is viewing a project's detail view
**When** the user triggers a rename, enters a new name, and confirms
**Then** the project header updates to the new name, the home view card updates, and all associated data (ports, capabilities, memories) follows the rename.

**Satisfaction criteria:**
- A Rename action is accessible from the project header
- The rename input validates in real-time (no spaces, no duplicates, same rules as registration)
- After confirming, the project detail header reflects the new name without navigating away
- Returning to the home view shows the renamed card
- The rename goes through @setlist/core's `renameProject` (atomic, all associations updated)
- Attempting to rename to an existing project name shows an inline error

Difficulty: medium

---

## S59: Chorus Design System Applied [App] {#s59}
**Given** the app is running and displaying any view (home or detail)
**When** the user looks at the interface
**Then** the visual design follows the Chorus design system: warm charcoal surfaces, terracotta accent color, Inter font, and Radix UI component patterns.

**Satisfaction criteria:**
- Background surfaces use warm charcoal tones (not pure black or cold gray)
- Accent color is terracotta (warm orange-brown) used for interactive elements and highlights
- Text is rendered in the Inter typeface (or a configured fallback)
- Interactive components (buttons, tabs, inputs) use Radix UI primitives with consistent styling
- The overall feel is warm and calm — not clinical or high-contrast
- Tailwind 4 utility classes are used for styling (no competing CSS framework)

Difficulty: medium

---

## S60: CLI Launcher Opens App [App] {#s60}
**Given** the app is built and installed as a macOS .app bundle, and the CLI package includes the `setlist ui` command
**When** the user runs `setlist ui` from the terminal
**Then** the app launches (or focuses the existing window if already running).

**Satisfaction criteria:**
- `setlist ui` launches the Electron app if it's not running
- If the app is already running, `setlist ui` brings its window to the front (does not spawn a second instance)
- The command exits immediately after launching/focusing (does not block the terminal)
- If the .app bundle is not found at the expected location, the command prints a helpful error

Difficulty: medium

---

## S61: Empty Registry Greeting [App] {#s61}
**Given** the registry database exists but contains zero projects
**When** the user opens the app
**Then** the home view shows a welcoming empty state that guides the user to register their first project, rather than displaying a blank grid.

**Satisfaction criteria:**
- The empty state is visually intentional (an illustration, icon, or message) — not just an empty grid container
- A clear call to action invites the user to create their first project
- The call to action leads directly to the project creation flow
- The empty state feels encouraging, not broken (the user understands the app works, it just has no data yet)

Difficulty: easy

---

## S62: Failed Operation Feedback [App] {#s62}
**Given** the user is performing a CRUD operation (register, edit, archive, rename) via the UI
**When** the operation fails (duplicate name, invalid input, database error)
**Then** the user sees a clear error message near the point of failure, and can recover without losing their work.

**Satisfaction criteria:**
- Validation errors (duplicate name, empty required field) appear inline near the offending field, not as a generic toast
- Database-level errors (constraint violation, locked database) surface as a user-friendly message, not a raw error trace
- After a failed save, the user's edits are preserved in the form (they don't have to re-enter everything)
- After a failed registration, the form remains populated with the user's input
- Error messages describe what went wrong and suggest what to do (e.g., "A project with this name already exists. Choose a different name.")

Difficulty: medium

---

## S63: Stale Data Refresh [App] {#s63}
**Given** the app is open showing the home view, and an external consumer (MCP server, CLI, or another agent) registers a new project or updates an existing one
**When** the user returns focus to the app or navigates to the home view
**Then** the card grid reflects the current state of the registry, including the externally-made change.

**Satisfaction criteria:**
- Changes made outside the app are visible in the UI without requiring the user to manually refresh or restart
- The refresh happens automatically when the app gains focus, or on navigation, or via polling (mechanism is flexible)
- The refresh does not cause a jarring full-page flash — updated cards appear smoothly
- If a project the user was viewing was archived externally, navigating to it shows a meaningful state (redirect to home or "project not found" message)

Difficulty: hard

---

## S64: App Package Build [App] [TS] {#s64}
**Given** the monorepo with @setlist/app as a workspace package alongside core, mcp, and cli
**When** `npm run build` is executed from the workspace root
**Then** the app package compiles successfully and produces a runnable Electron application.

**Satisfaction criteria:**
- @setlist/app is declared as a workspace package in the root package.json
- The package declares @setlist/core as a workspace dependency
- TypeScript compilation succeeds with no errors
- The build produces an Electron main process bundle that can be launched
- The renderer build (Tailwind 4, Radix UI components) produces valid HTML/CSS/JS assets
- Electron, Tailwind 4, and Radix UI are declared as dependencies (not globally assumed)

Difficulty: medium

---

## S65: Health Assessment Composite Tier {#s65}
**Given** a portfolio with projects at various levels of activity, completeness, and outcome history
**When** the user or an agent requests a health assessment for a project
**Then** the project receives one of four tiers — Healthy, At risk, Stale, or Unknown — computed as the worst tier across three dimensions: activity, completeness, and outcomes.

**Satisfaction criteria:**
- Every non-archived project can be assessed and receives exactly one overall tier
- The overall tier is the worst of the three dimension tiers (if activity is At risk and completeness is Stale, the overall is Stale)
- Archived projects return tier Unknown with a reason noting they are not evaluated
- A project with too little data to evaluate any dimension returns Unknown with a reason explaining what's missing
- The response includes the overall tier, a list of plain-language contributing reasons, and the per-dimension tiers

Difficulty: medium

---

## S66: Activity Staleness Buckets {#s66}
**Given** a project whose last meaningful update happened some time ago
**When** its activity dimension is evaluated
**Then** it is bucketed into Healthy (≤7 days), At risk (8–30 days), Stale (31–90 days), or Stale (>90 days) based on the most recent meaningful touch.

**Satisfaction criteria:**
- A project touched within the last 7 days is Healthy on the activity dimension
- A project last touched 8–30 days ago is At risk on activity
- A project last touched more than 30 days ago is Stale on activity
- "Touch" includes any registry update to core fields, any memory retain scoped to the project, and (if the project has a path with a git repository) any commit within the project folder
- The reason string names the exact age in days, e.g., "no activity in 45 days"

Difficulty: medium

---

## S67: Completeness Criteria {#s67}
**Given** projects with varying levels of profile enrichment
**When** the completeness dimension is evaluated
**Then** a project is Healthy when its description, at least one goal, at least one path, and (for code projects) tech_stack and patterns, plus topics and entities, are all present.

**Satisfaction criteria:**
- Missing description or no goals moves completeness to Stale with reasons naming the missing fields
- Missing path moves completeness to At risk (projects without a filesystem anchor are less actionable but not fundamentally broken)
- For code projects, missing tech_stack or patterns moves completeness to At risk
- Missing topics or entities moves completeness to At risk (not Stale — they are enrichment, not basic identity)
- Non-code projects are not penalized for missing tech_stack or patterns
- The reason string lists specific missing fields, e.g., "description missing; no goals"

Difficulty: medium

---

## S68: Outcome-Based Health {#s68}
**Given** a project with memory feedback history (successful builds, corrections, contradictions)
**When** the outcomes dimension is evaluated
**Then** projects with recent positive outcomes and no unresolved contradictions are Healthy; projects with recent negative outcomes or unresolved contradictions are At risk or Stale.

**Satisfaction criteria:**
- A project with no memory feedback history evaluates as Healthy on outcomes (absence of signal is not a negative signal)
- A project with recent positive build feedback is Healthy on outcomes
- A project with recent negative build feedback (failure outcomes) is At risk on outcomes
- A project with active unresolved contradictions in its memories is At risk on outcomes
- A project with a high ratio of corrections to original decisions is Stale on outcomes
- The reason string names the specific signal, e.g., "3 unresolved contradictions in project memories"

Difficulty: hard

---

## S69: assess_health MCP Tool {#s69}
**Given** a user or agent invoking the MCP interface
**When** they call `assess_health` with or without a project name argument
**Then** they receive a structured health assessment — per-project when a name is provided, portfolio-wide when called without arguments.

**Satisfaction criteria:**
- `assess_health(name)` returns the overall tier, dimension tiers, and reasons for the named project
- `assess_health()` with no arguments returns an array of assessments across all active projects plus a portfolio summary (counts per tier)
- The portfolio-wide response is ordered worst-to-best so the most concerning projects surface first
- Calls within a short TTL window return cached assessments; calls after the TTL recompute
- The tool is exposed from @setlist/mcp and callable from the desktop app via the IPC bridge
- Calling for an unknown project name returns a helpful NotFoundError with a fuzzy-match suggestion, consistent with other project tools

Difficulty: hard

---

## S70: Health Indicator on Home View and Detail View [App] {#s70}
**Given** the desktop app is open showing the home view or a project detail view
**When** the user looks at a project
**Then** a health indicator is visible — a colored dot on the home view list row, and a Health section on the Overview tab of the detail view showing the tier, per-dimension breakdown, and reasons.

**Satisfaction criteria:**
- Each home view row shows a colored dot representing the project's overall health tier alongside the existing status indicator
- The dot uses a distinct color per tier (green Healthy, amber At risk, red Stale, gray Unknown) and is accessible via a hover tooltip naming the tier
- Clicking into a project's detail view shows a Health section on the Overview tab with the overall tier, the three dimension tiers, and the list of reasons
- The Health section updates when the project is re-assessed (e.g., after editing fields that affect completeness)
- Archived projects do not show a health dot on the home view
- Health computation for the home view is batched so scrolling a large portfolio stays smooth

Difficulty: medium

---

## S71: Area Seed Table Initialization {#s71}
**Given** a fresh registry database (or a pre-v11 database being migrated upward)
**When** @setlist/core opens the database and runs the v10→v11 migration
**Then** the canonical area seed table exists and is populated with exactly 7 canonical areas, and the seed table is the sole source of truth for valid area names.

**Satisfaction criteria:**
- A dedicated `areas` (or equivalently named) table exists in schema v11 with a stable primary key
- The seed table contains exactly 7 canonical areas after migration: Work, Family, Home, Health, Finance, Personal, Infrastructure
- Schema version is 11 after migration; schema version is 10 before
- The seed table is idempotent — running migration twice does not duplicate rows
- Area names in the seed table are the ONLY valid values for `set_project_area` and for the `area` parameter on register/bootstrap/update
- The seed table is not mutated by any user-facing tool in v11 (it is system-owned)

Difficulty: medium

---

## S72: Retire area_of_focus Type in v10→v11 Migration {#s72}
**Given** a pre-migration registry containing projects with `type = 'area_of_focus'`, including specifically `msq-advisory-board` and `fam-estate-planning`
**When** the v10→v11 migration runs
**Then** every `area_of_focus`-typed row is demoted to a regular `project`, reassigned to an appropriate canonical area, and remains queryable by its original name with all associated data intact.

**Satisfaction criteria:**
- `msq-advisory-board` becomes `type = 'project'`, `area = 'Work'` after migration
- `fam-estate-planning` becomes `type = 'project'`, `area = 'Family'` after migration
- Any other pre-existing `area_of_focus` rows are demoted to `project` with a best-effort area assignment or `area = null` when no clear canonical match exists
- All memories, ports, capabilities, tasks, and extended fields attached to the demoted rows are preserved unchanged
- Producer attributions on fields are preserved
- The migration is atomic: a failure mid-migration rolls back to v10 with no partial demotion
- After migration, `getProject('msq-advisory-board').type` returns `'project'`, not `'area_of_focus'`

Difficulty: hard

---

## S73: knowmarks Entity Soft Link Migrated to parent_project_id {#s73}
**Given** a pre-migration registry where `knowmarks` and `knowmarks-ios` are linked via an entity soft link (entities array reference) rather than a structured parent relationship
**When** the v10→v11 migration runs
**Then** the soft link is detected and promoted to a structured `parent_project_id` relationship, with `knowmarks` as the parent and `knowmarks-ios` as the child.

**Satisfaction criteria:**
- After migration, `getProject('knowmarks-ios')` returns `parent_project: 'knowmarks'`
- After migration, `getProject('knowmarks')` includes `knowmarks-ios` in its children list
- The original entity reference is either removed or preserved alongside the new structured link (whichever the spec prescribes — the structured link is authoritative)
- The migration detects the link heuristically (entity name match + reciprocal reference) and only promotes when confidence is high
- A migration report surfaces which soft links were promoted, for user audit
- If the migration cannot determine a clear parent/child direction, it leaves the soft link in place and emits an observation memory flagging the ambiguity

Difficulty: hard

---

## S74: Assign an Area via set_project_area {#s74}
**Given** a registered project with no area assignment and the canonical area seed table populated
**When** the producer calls `set_project_area('my-project', 'Work')`
**Then** the project is immediately queryable with `area = 'Work'`, and subsequent recall/filter operations honor the new assignment.

**Satisfaction criteria:**
- `set_project_area('my-project', 'Work')` succeeds and returns the updated project
- `getProject('my-project').area` returns `'Work'`
- `listProjects({ area_filter: 'Work' })` now includes the project
- `set_project_area('my-project', null)` clears the area and returns the project to the Unassigned state
- Calling with an area name that does not exist in the seed table fails with a clear error (see S77)
- The assignment is atomic and does not touch any other field
- A memory retained against the project after reassignment is scoped to the new area for bubble-up purposes

Difficulty: easy

---

## S75: Set Parent Project via set_parent_project {#s75}
**Given** two registered projects with no parent/child relationship
**When** the producer calls `set_parent_project('child-name', 'parent-name')`
**Then** the child project is linked to the parent, the parent's children list includes the child, and the link is immediately visible in both directions.

**Satisfaction criteria:**
- `set_parent_project('knowmarks-ios', 'knowmarks')` succeeds and returns the updated child
- `getProject('knowmarks-ios').parent_project` returns `'knowmarks'`
- `getProject('knowmarks').children` includes `'knowmarks-ios'`
- `set_parent_project('child', null)` detaches the child from its current parent
- Setting a parent that does not exist fails with a NOT_FOUND error including a fuzzy-match suggestion
- The child and parent may belong to different areas — cross-area parenting is explicitly allowed
- The link is a single structured field, not an entity reference, and survives rename of either project

Difficulty: easy

---

## S76: Cycle Prevention on set_parent_project {#s76}
**Given** three projects A, B, and C with A as parent of B, and B as parent of C
**When** the producer calls `set_parent_project('A', 'C')` — which would create a cycle A → B → C → A
**Then** the operation is rejected with a clear error explaining the cycle, and no changes are committed.

**Satisfaction criteria:**
- `set_parent_project('A', 'C')` fails with an error containing the literal message "Setting parent would create a cycle" (or the specific cycle-prevention message defined by the spec) and naming the projects involved
- The existing parent/child relationships for A, B, and C are unchanged after the failed call
- Self-parenting (`set_parent_project('X', 'X')`) is rejected with the same cycle-prevention error
- The cycle check walks the ancestor chain from the proposed parent upward and terminates in bounded time even on pathological input
- A separate batch edit that would produce a cycle is also rejected atomically (no partial application)

Difficulty: medium

---

## S77: Invalid Area Name Rejection {#s77}
**Given** the canonical area seed table containing 7 canonical areas
**When** a producer calls `set_project_area('my-project', 'NotARealArea')` or registers a project with an area name not in the seed table
**Then** the call fails with a clear error naming the invalid input and listing the valid canonical areas.

**Satisfaction criteria:**
- The error code is `INVALID_INPUT` (or the spec's equivalent)
- The error message names the rejected area string verbatim
- The error message lists the valid canonical areas so the caller can correct their input without a second round trip
- The project's existing area assignment is unchanged after the failed call
- Case-insensitive matching to canonical names is NOT automatic — exact match is required (or the spec's chosen canonicalization, applied consistently)
- Passing `null` is always valid and clears the area

Difficulty: easy

---

## S78: Memory Scope Bubble-Up Through Area {#s78}
**Given** three projects assigned to the Work area — `project-a`, `project-b`, `project-c` — each with area-scoped memories retained
**When** an agent calls `recall({ query: '...', project: 'project-a' })`
**Then** the recall results include area-scoped memories retained by `project-b` and `project-c` (the siblings in the same area), alongside `project-a`'s own project-scoped memories.

**Satisfaction criteria:**
- A memory retained by `project-b` with scope `area` and area `Work` appears in `project-a`'s recall results when `project-a` is also in Work
- A memory retained by `project-b` with scope `project` (not area-scoped) does NOT appear in `project-a`'s recall results
- A memory retained by a project in a DIFFERENT area does not bubble up into Work-area projects' recall
- When a project is reassigned to a new area, its recall immediately sees the new area's pool of area-scoped memories and no longer sees the old area's pool
- A project with no area assignment sees no area-scoped memories — only project + portfolio + global
- The four-level scope hierarchy is: project (own) → area (sibling area-scoped) → portfolio → global

Difficulty: hard

---

## S79: Parent Archive Does Not Cascade to Children {#s79}
**Given** a parent project `knowmarks` with child `knowmarks-ios`
**When** the user archives `knowmarks`
**Then** `knowmarks-ios` remains active, the parent link is preserved, and the child's detail view displays the parent as "(archived)" while the link itself remains intact and navigable.

**Satisfaction criteria:**
- `archiveProject('knowmarks')` sets `knowmarks.status = 'archived'` but does not touch any child's status
- `getProject('knowmarks-ios').status` remains `'active'` (or whatever it was before)
- `getProject('knowmarks-ios').parent_project` still returns `'knowmarks'`
- The child's detail view renders the parent link with the suffix "(archived)" so the user understands the parent's state without losing the connection
- Clicking the parent link still navigates to the (archived) parent's detail view — it is not a dead link
- Unarchiving the parent restores the normal link presentation in the child view

Difficulty: medium

---

## S80: get_project Returns Area, Parent, and Children {#s80}
**Given** a project `knowmarks` assigned to the Work area, with parent `portfolio-root` and children `knowmarks-ios` and `knowmarks-web`
**When** a consumer calls `getProject('knowmarks', 'full')`
**Then** the response includes the area name, the parent project name, and a complete list of child project names.

**Satisfaction criteria:**
- The response includes a top-level `area` field with the value `'Work'` (or `null` when unassigned)
- The response includes a top-level `parent_project` field with the value `'portfolio-root'` (or `null` when unparented)
- The response includes a top-level `children` array listing `['knowmarks-ios', 'knowmarks-web']` (or an empty array when childless)
- The `children` array contains names only at summary depth; standard/full depth may include richer child summaries
- Area, parent, and children are consistent in both directions: querying a child returns the same parent name that the parent's children array contains
- A project with no area, no parent, and no children returns `area: null`, `parent_project: null`, `children: []` (empty array, not missing key)

Difficulty: easy

---

## S81: Auto-Update Disabled in Development [App] {#s81}
**Given** the Electron app is launched in development mode (e.g. `npm run dev` with `ELECTRON_RENDERER_URL` set to a local Vite server)
**When** the main process starts up and initializes its subsystems
**Then** the auto-update subsystem is not wired in and no update checks are performed against the GitHub Releases feed.

Validates: `#auto-update` (2.14.x)

**Satisfaction criteria:**
- When `ELECTRON_RENDERER_URL` is set (dev mode), `autoUpdater.checkForUpdatesAndNotify` (or equivalent) is never invoked during app startup
- No outbound network request is made to the GitHub Releases update feed during dev launches
- The Settings > Updates section either indicates "Updates disabled in development" or hides check-related controls entirely — it does not display a stale/failed status from a dev run
- The "Check for Updates…" menu item is either absent in dev or shows a clear "not available in development" message when invoked
- In a packaged production build (no `ELECTRON_RENDERER_URL`), the auto-update subsystem initializes and performs its normal check on launch
- The dev/prod branch is determined by environment inspection at startup, not by a hardcoded feature flag that could drift

Difficulty: easy

---

## S82: Release Build Signed and Notarized [App] {#s82}
**Given** a release build produced by the project's packaging pipeline with Developer ID credentials configured (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` or equivalent CSC env vars) and `notarize: true` in `packages/app/electron-builder.yml`
**When** the `.app` bundle and `.dmg`/`.zip` artifacts are inspected on a Gatekeeper-enforced macOS machine
**Then** the bundle is signed with a valid Developer ID certificate and stapled with an Apple notarization ticket, and Gatekeeper permits launch and auto-install without prompting.

Validates: `#auto-update` (2.14.x)

**Satisfaction criteria:**
- `codesign -dv --verbose=4 /path/to/Setlist.app` reports a valid signature with Authority chain including "Developer ID Application: ..." and the configured Team ID
- `codesign --verify --deep --strict /path/to/Setlist.app` exits 0 with no warnings
- `spctl -a -vv /path/to/Setlist.app` reports "accepted" with source "Notarized Developer ID"
- `stapler validate /path/to/Setlist.app` confirms a stapled notarization ticket is present
- Gatekeeper permits first launch of the downloaded artifact without the "cannot be opened because Apple cannot check it for malicious software" dialog
- A deliberately-unsigned-or-unnotarized build, when handed to Squirrel.Mac for auto-install, fails to complete the install handoff on a Gatekeeper-enforced machine — this establishes why signing and notarization are not optional for the update path
- The packaging pipeline refuses to produce a release build when signing/notarization credentials are missing (hard failure, not a silent skip)

Difficulty: hard

---

## S83: Update Channel Persists Across Launches [App] {#s83}
**Given** the app is running and the user opens Settings > Updates
**When** the user switches the channel from Stable to Beta (or vice versa) and then quits and relaunches the app
**Then** the newly-selected channel is remembered and used for the next update check — the toggle does not revert to a default.

Validates: `#auto-update` (2.14.x)

**Satisfaction criteria:**
- The Settings > Updates section contains a channel toggle with exactly two options labeled Stable and Beta
- Switching the toggle takes effect immediately — subsequent update checks in the same session use the new channel
- The selected channel is persisted to durable storage (preferences file, registry, or equivalent) — not held only in memory
- After a full app quit and relaunch, Settings > Updates displays the previously-selected channel with no user action required
- First-launch default is Stable when no prior preference exists
- Switching to Stable while a Beta update is already downloaded does not auto-install the Beta build — the user's channel intent is respected on next check

Difficulty: medium

---

## S84: Beta Channel Receives Prereleases, Stable Does Not [App] {#s84}
**Given** the GitHub repository has a non-prerelease tag `v1.2.0` and a prerelease tag `v1.3.0-beta.1`, both published with full release assets and update metadata
**When** an app on channel Stable and an app on channel Beta each perform an update check
**Then** the Stable app sees `v1.2.0` as the latest available, and the Beta app sees `v1.3.0-beta.1`.

Validates: `#auto-update` (2.14.x)

**Satisfaction criteria:**
- An app on channel Stable, currently at `v1.1.0`, reports an available update to `v1.2.0` and does not offer `v1.3.0-beta.1`
- An app on channel Beta, currently at `v1.1.0`, reports an available update to `v1.3.0-beta.1` (the newer prerelease)
- The channel-to-tag mapping is: Stable → latest non-prerelease tag; Beta → latest prerelease-or-stable tag (whichever is newer)
- A user who switches from Beta back to Stable while running a prerelease build does not get an automatic downgrade — they continue on their current version until Stable ships a newer non-prerelease tag
- The update metadata feed honored by the app matches electron-updater's channel convention (stable.yml vs beta.yml, or the project's equivalent naming)
- A draft or unpublished GitHub release is never offered on either channel

Difficulty: medium

---

## S85: Check For Updates Menu Item Triggers Immediate Check [App] {#s85}
**Given** the app is running and the macOS app menu (Setlist > ...) is available
**When** the user selects "Check for Updates…" from the app menu
**Then** an update check runs immediately — without waiting for the next scheduled interval — and the user sees feedback that a check is in progress and what the result was.

Validates: `#auto-update` (2.14.x)

**Satisfaction criteria:**
- The macOS app menu includes a "Check for Updates…" item in a conventional location (near About, per macOS convention)
- Selecting the item triggers an immediate check against the currently-selected channel's update feed
- The user sees a clear "Checking for updates…" indication (in Settings, a menu state, or a modal — implementation flexible) while the check is in flight
- If an update is available, the normal download and install-on-quit flow begins
- If no update is available, the user sees a brief confirmation ("You're up to date" or equivalent) — no silent no-op
- If the check fails, the failure is surfaced in Settings > Updates (per S90) and optionally in a brief user-facing acknowledgment — not swallowed silently
- Invoking the menu item while a check is already in flight does not fire a duplicate request

Difficulty: easy

---

## S86: About Dialog Shows Running Version [App] {#s86}
**Given** the app is running
**When** the user selects "About Setlist" from the macOS app menu
**Then** a standard About dialog appears displaying the exact version of the running app.

Validates: `#auto-update` (2.14.x)

**Satisfaction criteria:**
- The macOS app menu includes a standard "About Setlist" item (provided by Electron's default app menu role or an explicit equivalent)
- Selecting the item opens an About dialog — not a full Settings view
- The dialog displays the app name and the current version string (matching `app.getVersion()` and the `version` field in the packaged `package.json`)
- The version displayed is the version of the currently-running binary, not a value baked into the renderer at a different build time
- After an auto-update install completes and the app relaunches, the About dialog displays the new version
- The dialog is dismissible via the standard macOS window close affordances

Difficulty: easy

---

## S87: Silent Background Download [App] {#s87}
**Given** the app is running, an update is available on the user's selected channel, and the app has begun downloading it
**When** the download is in progress
**Then** the user experiences no interruption — there is no modal, no progress bar stealing focus, and no toast spam — the download happens silently in the background.

Validates: `#auto-update` (2.14.x)

**Satisfaction criteria:**
- During the download phase, no modal dialog appears
- No system notification or in-app toast fires while bytes are transferring
- The user's current work (viewing cards, editing a project, etc.) is not interrupted by the download
- Download progress is not shown as a blocking UI element — at most, it may be reflected subtly in Settings > Updates if the user chooses to look
- Bandwidth use is limited to what electron-updater's background download does by default — no aggressive retries that saturate the connection
- If the download fails mid-transfer, the failure is recorded to Settings > Updates status (per S90) but produces no user-facing toast or modal
- The only user-visible signal tied to the download is the `update-downloaded` toast at completion (per S88) — nothing before then

Difficulty: medium

---

## S88: Update Downloaded Toast With Install Action [App] {#s88}
**Given** the app is running and a background download has just completed (`update-downloaded` event fired)
**When** the download completes
**Then** the user sees a single, non-intrusive toast notification announcing the update is ready, with an action offering to install on next quit or quit now.

Validates: `#auto-update` (2.14.x)

**Satisfaction criteria:**
- A toast appears exactly once per downloaded update — duplicate `update-downloaded` events do not stack toasts
- The toast message clearly states that an update has been downloaded and is ready to install (naming the new version is preferable but not required)
- The toast includes an actionable control labeled something like "Install on next quit (or quit now)" — a single control with that dual-option semantics, not a separate modal
- Choosing "quit now" initiates an app quit that proceeds into the install handoff (per S89)
- Dismissing the toast (without action) defers install to the next natural quit — the downloaded update remains staged and is not re-downloaded
- The toast is non-blocking — it does not steal focus or prevent continued work
- If the user ignores the toast and it auto-dismisses, the update still installs on next quit per the quit-prompt flow (S89)

Difficulty: medium

---

## S89: Install Prompt on Quit With Update Ready [App] {#s89}
**Given** an update has been downloaded and staged, and the user initiates a quit (Cmd-Q, App > Quit Setlist, or closing the last window on a quit-on-close configuration)
**When** the quit is initiated
**Then** the user sees an install prompt offering "Install now" or "Skip" — choosing install completes the quit and applies the update on relaunch; choosing skip quits without installing and leaves the update staged for a future quit.

Validates: `#auto-update` (2.14.x)

**Satisfaction criteria:**
- When quit is initiated and an update is staged, a prompt appears with clear "Install now" and "Skip" choices before the app exits
- Choosing "Install now" allows the app to exit and Squirrel.Mac (or electron-updater's macOS path) applies the update before the next launch
- On relaunch after install, the About dialog shows the new version (per S86)
- Choosing "Skip" quits the app normally without applying the update — the staged update file is retained, not discarded
- On the next launch after a skip, the update is still staged; the app does not re-download the same version
- On the next quit after a skip, the install prompt appears again (the user is not trapped into skipping forever, but skip is always honored for the current quit)
- The prompt is suppressed when no update is staged — users with no pending update quit normally with no extra dialog
- If a newer update has arrived since the last skip, the staged version is superseded by the newer one and the prompt reflects the newer version

Difficulty: hard

---

## S90: Update Status Line In Settings [App] {#s90}
**Given** the app has performed at least one update check (successful, no-update-available, or failed) since launch
**When** the user opens Settings > Updates
**Then** a persistent, glanceable status line shows the timestamp of the last check and its outcome, with enough detail to diagnose a failure without opening logs.

Validates: `#auto-update` (2.14.x)

**Satisfaction criteria:**
- Settings > Updates always shows a "Last checked" timestamp in a human-readable relative or absolute form (e.g., "2 minutes ago" or "2026-04-16 14:32")
- The status line reflects one of: success with update available, success with up-to-date, or failed with a short error message
- A failure message is plain-language and surfaces the cause (e.g., "No network connection", "GitHub feed returned 404", "Signature verification failed") — not a raw exception string or stack trace
- Failed update checks do NOT fire a toast — the Settings status line is the only failure surface, so the user is not spammed by transient network hiccups
- The status line updates in place when a new check runs — it does not accumulate a history list
- The timestamp survives across app launches (persisted) so a user returning to the app can see when the last check ran even if none has happened yet this session
- stderr logging of check activity continues for debugging purposes but is not surfaced in the UI beyond the status line — no telemetry leaves the machine

Difficulty: medium

---

## S91: Wrong-ABI State Surfaces a Startup Warning {#s91}
**Given** the desktop app was previously run and exited abnormally (hard-kill, OOM, power loss, or any path that prevented the normal exit cleanup), leaving the native SQLite binary in the Electron-ABI variant instead of the Node-ABI variant
**When** the user opens a new Claude Desktop session and the setlist integration initializes
**Then** the user sees a clear startup warning that the setlist integration is in a wrong-ABI state and that names the exact one-line command to recover.

Validates: `#native-binding-hygiene` (5.4), `#testing-discipline` (4.5)

**Satisfaction criteria:**
- At Claude Desktop session open, an automated check detects the mismatch between the in-place native binary and the Node runtime the setlist integration expects
- When a mismatch is detected, a warning is surfaced through a user-visible channel (session-open notice, stderr that Claude Desktop reports, or equivalent) — not silent
- The warning message states plainly that the setlist integration will not work until recovery runs
- The warning names the literal recovery command `npm run sqlite:node -w packages/app` so the user can copy-paste without hunting through docs
- When the binary is in the correct Node-ABI variant, no warning fires — the check is quiet on healthy state
- Running the named recovery command restores the Node-ABI binary, and the next session open shows no warning
- The warning is the sole first-class signal carrying the "never silently breaks" invariant — removing or silencing it would weaken the contract

Difficulty: medium

---

## S92: Release Build Refuses to Proceed on ABI Mismatch {#s92}
**Given** a packaged release build is being produced (the production packaging pipeline, not a local dev build) and the native SQLite binary is in the wrong ABI variant for the release target
**When** the packaging pipeline runs its pre-flight ABI check
**Then** the pipeline halts with a hard failure — the same severity class as missing code-signing credentials — and no release artifact is produced.

Validates: `#testing-discipline` (4.5), `#native-binding-hygiene` (5.4)

**Satisfaction criteria:**
- The packaging pipeline performs a pre-flight ABI check before producing any release artifact
- On mismatch, the pipeline exits non-zero with a message identifying the ABI failure and naming the recovery command
- The halt severity is equivalent to missing signing credentials — no partial artifact is written, no warning-only path, no silent skip
- The failure message distinguishes ABI mismatch from other halt causes so an operator can act without reading full logs
- A release build started with a correctly-aligned binary proceeds normally and produces the expected signed, notarized artifact
- The pre-flight check runs once per release build and does not retry silently — a single mismatch fails the build
- Release pipelines never ship an artifact whose bundled native binary does not match the runtime it will load under

Difficulty: medium

---

## S93: Local Build Proceeds With Advisory Warning on ABI Mismatch {#s93}
**Given** a developer runs a local, non-release build (e.g. `npm run build` during iteration) and the native SQLite binary is in a different ABI variant than the local runtime expects
**When** the build runs its ABI check
**Then** the build prints an advisory warning naming the mismatch and the recovery command, but proceeds to completion — it does not halt.

Validates: `#testing-discipline` (4.5), `#native-binding-hygiene` (5.4)

**Satisfaction criteria:**
- During a local build, an ABI mismatch produces a visible advisory warning in the build output
- The warning names the recovery command `npm run sqlite:node -w packages/app` so the developer can fix it at their convenience
- Despite the warning, the build continues through to its normal completion and exits zero on an otherwise successful build — ABI is advisory in this context, not blocking
- The advisory wording makes clear the setlist integration with Claude Desktop may not work until recovery runs, even though this build itself succeeded
- A local build with a correctly-aligned binary produces no ABI warning — the advisory only fires on actual mismatch
- The asymmetry between local (advisory) and release (blocking) is intentional and visible in behavior, not a configuration that could silently flip
- No false positive on fresh checkouts where the binary has not yet been built — the check distinguishes "wrong variant" from "no binary yet"

Difficulty: medium

---

## S94: Electron Security Check Rejects Unsafe Main-Process Edits {#s94}
**Given** the app's main-process code currently constructs its browser window with `nodeIntegration: false` and `contextIsolation: true` — the secure defaults that the spec treats as non-negotiable
**When** a developer or agent introduces an edit to the main-process or renderer configuration that sets `nodeIntegration: true` or `contextIsolation: false`
**Then** the automated Electron security check fails on that change and the unsafe configuration does not reach a shipped build.

Validates: `#testing-discipline` (4.5)

**Satisfaction criteria:**
- An automated check inspects the main-process browser-window construction whenever relevant files are edited
- An edit that sets `nodeIntegration: true` anywhere in the main-process or renderer bootstrap is flagged as a failure by the check
- An edit that sets `contextIsolation: false` anywhere in the main-process or renderer bootstrap is flagged as a failure by the check
- The failure message names the specific violation (which flag, which file, which line) so it can be fixed without searching
- An edit that preserves `nodeIntegration: false` and `contextIsolation: true` passes the check
- The check runs automatically on edits to `packages/app/src/main/**` and related bootstrap files — a developer cannot merge or ship an unsafe change by bypassing the check accidentally
- The guarantee is framed as a hard spec constraint — these two settings are not tunable knobs, and there is no documented path that allows shipping with them flipped

Difficulty: easy

---

## S95: Normal App Exit Restores the Default Binary {#s95}
**Given** the desktop app is running (the native binary was swapped to the Electron-ABI variant at launch so the app could load SQLite under Electron's runtime)
**When** the user quits the app through any normal exit path — menu quit, Cmd-Q, window close on a quit-on-close configuration, or the app's own update-triggered relaunch
**Then** the binary is automatically restored to the Node-ABI variant before the process fully exits, and the next Claude Desktop session opens without any ABI warning.

Validates: `#native-binding-hygiene` (5.4)

**Satisfaction criteria:**
- After a normal app quit, the native SQLite binary in the expected on-disk location is the Node-ABI variant, not the Electron-ABI variant
- Opening a new Claude Desktop session immediately after a normal quit produces no wrong-ABI startup warning
- The restore happens unconditionally on normal exit — it does not depend on whether the app ran successfully, crashed during a user flow, or was quit mid-task
- Repeated launch-and-quit cycles leave the system in a clean, Node-ABI state each time — no accumulation of residue
- The Electron-ABI binary used during app runtime is preserved (cached) so the next launch does not have to rebuild it — only the active slot is restored to Node-ABI on exit
- Abnormal termination (SIGKILL, OOM, power loss) is a known limitation — the restore is best-effort through normal exit paths, and S91's startup warning is the safety net when restore could not run

Difficulty: medium

---

## S96: Continuous Integration Runs Only the Fast, Reliable Gates {#s96}
**Given** a continuous-integration run is triggered (e.g. by a pull request or a push) against the setlist repository
**When** the CI job executes
**Then** it runs typecheck, unit tests, and the build, and it deliberately does not run the end-to-end suite or the ABI pre-flight check — this narrowness is intentional, not a gap.

Validates: `#testing-discipline` (4.5)

**Satisfaction criteria:**
- A CI run executes the typecheck step across all workspaces and fails the run if typecheck fails
- A CI run executes the unit test suite across all workspaces and fails the run if any unit test fails
- A CI run executes the production build and fails the run if the build fails
- A CI run does not launch Electron, does not execute the end-to-end suite, and does not invoke the pre-flight ABI check — these are local-only by design
- The CI configuration frames the excluded checks as intentional (comment, documented rationale, or equivalent signal) so a future reader does not "fix" the supposed gap by adding them back
- A pull request that passes CI but would fail local E2E or ABI pre-flight is still considered mergeable from CI's perspective — scenarios, not CI, are the behavioral contract
- CI wall-clock time stays within the budget the narrow scope enables — adding E2E or Electron launch would inflate cost and flake, which is why they are excluded

Difficulty: easy

---

## S97: First Digest Write Round-Trips With Full Provenance {#s97}
**Given** a registered code project at a known spec version (e.g. `chorus-app` at spec 0.22) with no row in `project_digests`
**When** the CLI generator writes an essence digest via `refresh_project_digest`, then a consumer reads it back with `get_project_digest`
**Then** the consumer receives the digest text the generator produced, tagged with the spec version it was generated against, the producer that wrote it, and a generation timestamp — and the staleness flag is `false` because the project's spec has not advanced.

Validates: `#rules` (3.3) Project digest rules, `#entities` (3.2) Project digests, Appendix D (Project digests)

**Satisfaction criteria:**
- After the write, `get_project_digest({ project_name: 'chorus-app' })` returns a non-null result (not `null`)
- The returned `digest_text` matches what the generator wrote byte-for-byte
- The returned `spec_version` matches the spec version the generator read from the project's `.fctry/spec.md` frontmatter at write time
- The returned `producer` is a non-empty string encoding the generation path (e.g. `openrouter-google/gemini-2.5-flash-lite`) — not a blank or `"unknown"` sentinel
- The returned `generated_at` is an ISO 8601 timestamp within a few seconds of when the write occurred
- The returned `stale` flag is `false` — the consumer knows this digest reflects the project's current source version
- The write's response payload includes `written: true` and no `prior_spec_version` field (there was no prior row)
- `digest_kind` defaults to `"essence"` when not specified by either the writer or the reader

Difficulty: easy

---

## S98: Refresh Replaces the Prior Row and Surfaces the Prior Spec Version {#s98}
**Given** a code project with an essence digest already stored at spec version `0.20`, and the project's spec has since evolved to `0.22`
**When** the CLI generator refreshes the digest against the new spec source
**Then** the new digest replaces the prior row in place (one row per `(project, essence)` remains), and the write response hands the prior version back to the generator so drift can be logged.

Validates: `#rules` (3.3) Project digest rules (replace semantics, prior_spec_version return)

**Satisfaction criteria:**
- After refresh, exactly one essence digest exists for the project (not two rows, no duplicate history row)
- The stored `digest_text` is the newly written prose, not the prior version
- The stored `spec_version` is the new version (`0.22`), not the prior one
- The `refresh_project_digest` response includes `prior_spec_version: "0.20"` so the caller can log the drift
- A subsequent `get_project_digest` read returns the new row with `stale: false`
- A first-time refresh on a project with no existing digest (covered in S97) does not include a `prior_spec_version` field in the response — prior_spec_version is present only on true replacement
- The replacement is atomic — a reader cannot observe an in-between state where the row is missing or partially written

Difficulty: easy

---

## S99: Staleness Flag Flips When the Project's Source Version Advances {#s99}
**Given** a code project with a fresh essence digest stored at spec version `0.21`
**When** the project's `.fctry/spec.md` is evolved to `0.22` without refreshing the digest, and a consumer reads the digest via `get_project_digest` or `get_project_digests`
**Then** the digest is still returned, but it carries `stale: true` so the consumer knows the text predates the project's current source.

Validates: `#rules` (3.3) Project digest rules (deterministic stale flag computed at read time)

**Satisfaction criteria:**
- Before the spec bump, `get_project_digest` returns `stale: false`
- Immediately after the spec bump and before any refresh, `get_project_digest` returns `stale: true` on the same digest row with no other field changed
- The returned `digest_text` is the unchanged stored prose — stale digests are not withheld, they are flagged
- The returned `spec_version` still reflects the version the digest was written against (`0.21`), not the project's current version — the stamp on the row is the proof of drift
- `get_project_digests({ project_names: ['this-project'], include_stale: false })` omits the project from the result map when the digest is stale
- `get_project_digests({ project_names: ['this-project'] })` with default arguments includes the stale digest (stale included by default)
- Running `refresh_project_digest` against the new spec version flips the flag back to `false` on the next read

Difficulty: medium

---

## S100: Archiving a Project Cascades to Its Digest Rows {#s100}
**Given** a registered project with an essence digest stored in `project_digests`
**When** the project is archived via `archive_project`
**Then** the digest row is removed via the `ON DELETE CASCADE` foreign key, and a later re-registration of a project with the same name starts with a clean digest slot.

Validates: `#rules` (3.3) Project digest rules (cascade on archive), `#schema` (5.2) project_digests FK

**Satisfaction criteria:**
- Before archive, `get_project_digest({ project_name })` returns a non-null digest
- After archive, `get_project_digest({ project_name })` returns `null` — the row is gone, not just marked stale or hidden
- Port claims and capability declarations are also cleared (existing S20 behavior) — archive remains the single sweeping cleanup hook, now extended to digests
- If the project is later re-registered under the same name, its digest slot starts empty — a stale digest from the prior incarnation cannot leak through
- The cascade happens through the schema-level foreign key, not through ad-hoc application-layer cleanup — removing or disabling the `ON DELETE CASCADE` clause would make this scenario fail
- No other project's digest is affected by archiving one project — cascade is scoped to the archived project's `project_id`

Difficulty: medium

---

## S101: Token-Ceiling Breach Rejects the Write With Trim-and-Retry Guidance {#s101}
**Given** a digest generator that has produced prose for a project that is unusually long — more than 1200 tokens for the `essence` kind
**When** it calls `refresh_project_digest` with the oversized text
**Then** the write is rejected with an error that names the ceiling and tells the caller to trim and retry, and no partial row is left in the store.

Validates: `#rules` (3.3) Project digest rules (bounded size, hard ceiling 1200 tokens, trim-and-retry error), Appendix D (refresh_project_digest)

**Satisfaction criteria:**
- A write with `digest_text` whose token count exceeds 1200 for `digest_kind: "essence"` fails — no row is created or updated
- The error message names the ceiling (1200 tokens for `essence`) and the observed size so the caller can decide how aggressively to trim
- The error explicitly tells the caller to trim the text and retry — not a generic "validation failed" string
- A subsequent `refresh_project_digest` call with a trimmed `digest_text` within the ceiling succeeds and the response carries `written: true`
- If an earlier successful digest already existed, it remains untouched after the failed write — the ceiling breach must not silently delete or replace the prior digest
- A write at the exact target band (500–800 tokens) succeeds normally — the ceiling is 1200, not 800
- A write between 800 and 1200 tokens succeeds (advisory target is not a hard limit; the ceiling is)

Difficulty: easy

---

## S102: Default Generator Path Uses OpenRouter Flash-Lite With Cost Attribution {#s102}
**Given** a workstation where `SETLIST_OPENROUTER_API_KEY` is configured and `SETLIST_DIGEST_PROVIDER` is unset (defaulting to `openrouter-flash-lite`)
**When** the user runs `setlist digest refresh <code-project>` on a normal-sized code project
**Then** the generator sends the project's spec source to Gemini 2.5 Flash-Lite over OpenRouter with setlist-identifying cost attribution, and the resulting digest records Flash-Lite as its producer.

Validates: `#rules` (3.3) Digest generator rules v0.21 (provider selection, cost attribution), `#connections` (3.4) OpenRouter row

**Satisfaction criteria:**
- The HTTP request to OpenRouter carries an `HTTP-Referer` header identifying setlist as the calling app
- The HTTP request carries an `X-Title: setlist-digest-generator` header so spend appears attributed on the OpenRouter dashboard under a single, obvious title
- The API key used is the setlist-dedicated OpenRouter key, not a key belonging to any other portfolio project — a single billing row on OpenRouter reflects generator spend
- The `producer` written into `project_digests` contains the hosted-provider tag (e.g. `openrouter-google/gemini-2.5-flash-lite`) so a consumer can see which model produced the text
- No local MLX call is made on the happy path — the hosted provider is the default, not a last-resort
- Console output names the provider used per project (e.g. `… via openrouter-google/gemini-2.5-flash-lite`) so the user can confirm the happy path was taken
- Only `@setlist/cli` makes the OpenRouter call — `@setlist/core`, `@setlist/mcp`, and `@setlist/app` never issue outbound requests to OpenRouter during a refresh or a read

Difficulty: medium

---

## S103: Missing API Key Transparently Falls Back to Local MLX {#s103}
**Given** a workstation where `SETLIST_OPENROUTER_API_KEY` is unset or empty, `SETLIST_DIGEST_PROVIDER` is unset (would default to `openrouter-flash-lite`), and the local MLX endpoint (`http://m4-pro.local:8000/v1`) is reachable
**When** the user runs `setlist digest refresh <project>`
**Then** the generator silently falls through to the local MLX path, logs one INFO line naming the fallback, and produces a digest tagged with the local-MLX producer string — the run does not abort and does not prompt.

Validates: `#rules` (3.3) Digest generator rules v0.21 (missing-key transparent fallback), `#connections` (3.4) Local MLX row

**Satisfaction criteria:**
- The refresh completes successfully and writes a digest even though no OpenRouter key is present
- Exactly one INFO-level log line names the fallback reason (e.g. `No SETLIST_OPENROUTER_API_KEY set; falling back to local-mlx`) — not a silent swap, not a loud warning every line
- The stored `producer` for the written digest starts with `local-mlx-` (e.g. `local-mlx-community/Qwen3.6-35B-A3B-8bit`) so a consumer can see this digest came from the fallback path
- No OpenRouter HTTP request is attempted — the generator recognizes the missing key before opening a connection
- The same fallback path fires when OpenRouter returns two consecutive 5xx responses on a single project mid-run — that project completes via local MLX while later projects in the same batch retry OpenRouter first
- If both OpenRouter and local MLX are unreachable, the project is skipped with a clear per-project message, not a crash, and any existing digest row is left untouched

Difficulty: medium

---

## S104: Non-Code Project Digest Extracts From PDF and Office Documents {#s104}
**Given** a registered non-code project (e.g. `fam-estate-planning`) whose project root contains a mix of supported documents — `.md` notes, a `.pdf` will draft, a `.docx` meeting summary, no `.fctry/spec.md` and no `CLAUDE.md`
**When** the user runs `setlist digest refresh fam-estate-planning`
**Then** the generator walks the project root, extracts markdown from the PDF and DOCX via the docling subprocess helper, concatenates everything with the native-read `.md` in alphabetical order, and produces a digest whose text reflects the combined source material.

Validates: `#rules` (3.3) Digest generator rules v0.21 (source cascade, supported document types, non-code detection), `#connections` (3.4) Docling row

**Satisfaction criteria:**
- The resulting digest text references content drawn from at least one of the extracted documents — a human reading the digest can tell the PDF and the DOCX were actually read, not just the `.md` notes
- The stored `producer` tag encodes the extractor as well as the provider (e.g. `openrouter-google/gemini-2.5-flash-lite+docling-<version>`) so a consumer can tell extraction ran
- The stored `spec_version` is a 16-character hex file-tree hash, not a spec-version string — the generator correctly inferred this as a non-code project because no spec frontmatter was found anywhere in the source cascade
- Extraction happens in alphabetical filename order — a renamed file that changes its sort position produces a detectably different concatenated input on the next refresh
- Files outside the supported document set (`.zip`, `.mov`, etc.) are ignored — the file-tree hash and the concatenated source both reflect only the supported set
- A re-run of the refresh on the same files (no content changes) produces the same file-tree hash, keeping the prior digest `stale: false` on read

Difficulty: hard

---

## S105: Docling Not Installed Degrades Gracefully for Non-Code Projects {#s105}
**Given** a non-code project whose project root contains both plain-text sources (`.md`, `.txt`) and Office/PDF sources (`.pdf`, `.docx`), running on a workstation where docling is not installed (the Python subprocess cannot be spawned or fails with an import error)
**When** the user runs `setlist digest refresh <project>`
**Then** the run does not crash — the generator falls back to using only the natively-readable plain-text sources, surfaces a clear message that the Office/PDF files were skipped, and still produces a digest.

Validates: `#rules` (3.3) Digest generator rules v0.21 (supported document types), `#connections` (3.4) Docling row (graceful skip when unavailable)

**Satisfaction criteria:**
- The refresh completes and writes a digest even though docling is unavailable
- The console output names which files were skipped and why, at a granularity a user can act on (e.g. "Skipped 2 files (docling not installed): will.pdf, meeting.docx")
- The `producer` tag does NOT include a `+docling-...` suffix on this run — the extractor only appears in the tag when it actually ran
- The file-tree hash on this digest covers only the files that were actually read, so installing docling later and re-running produces a different hash and refreshes the digest automatically
- If a non-code project has only Office/PDF sources and docling is unavailable, the project is skipped with a clear message — no empty-content digest is written, and any existing digest is left untouched
- The absence of docling is detected once per run (or once per project), not repeatedly per file — the user is not spammed with identical errors

Difficulty: medium

---

## S106: File-Tree Hash Flips When a Non-Code Project's Documents Change {#s106}
**Given** a non-code project with an essence digest stored at a known file-tree hash (version stamp = 16-character hex)
**When** one of the source documents is edited (content change), renamed, added, removed, or resized — and a consumer reads the digest without re-running refresh
**Then** the staleness flag flips to `true` because the current file-tree hash no longer matches the stored stamp, and running refresh recomputes the hash and clears the flag.

Validates: `#rules` (3.3) Digest generator rules v0.21 (file-tree hash definition and staleness trigger)

**Satisfaction criteria:**
- Immediately after a document's content is edited, `get_project_digest` returns `stale: true` on the next read — no explicit invalidation call is required
- Adding a new supported document at the project root flips the hash even if no existing file changed
- Removing a supported document flips the hash even if remaining files are untouched
- Renaming a supported document (same content, different path) flips the hash — the hash is over `path:mtime:size`, so paths matter
- Editing an unsupported file type (e.g. a `.zip` or a `.mov`) does NOT flip the hash — the walker only considers supported document types
- Running `setlist digest refresh <project>` recomputes the hash from the current file set, writes the new stamp, and the next read returns `stale: false`
- The hash remains exactly 16 hex characters across all these transitions — a truncated sha256, not a full 64-char digest

Difficulty: medium

---

## S107: Portfolio-Wide Refresh Processes Every Active Project Serially {#s107}
**Given** a registry containing a mix of active code projects, active non-code projects, and archived projects
**When** the user runs `setlist digest refresh --all`
**Then** every active project is processed once serially, with per-project progress visible, and a single summary line at the end reporting totals — archived projects are skipped.

Validates: `#rules` (3.3) Digest generator rules v0.22 (portfolio-wide refresh), Appendix D (refresh_project_digest)

**Satisfaction criteria:**
- Every active project (code and non-code) appears in the progress output exactly once, with a "Refreshing <name> …" line as it starts and a completion or failure line when it finishes
- Archived projects are not touched — no digest write, no progress line for them
- A final summary line reports `Done: N refreshed, M failed (of N total)` where N equals the number of active projects considered
- Processing is serial — at no point do two project refreshes overlap — the contract is serial processing in v0.22
- A failure on one project (e.g. unreachable LLM, missing source) is logged and counted into `M failed` but does not halt the run — later projects still process
- `--all` and positional project arguments are not combinable — invoking them together is rejected with a clear usage error, not a silent merge
- The exit code reflects overall success: zero if every project succeeded, non-zero if any project failed, so a scripted wrapper can detect portfolio drift

Difficulty: medium

---

## S108: Multi-Project Refresh Processes Every Named Project With No Silent Drop {#s108}
**Given** a user who runs `setlist digest refresh project-a project-b project-c` naming three existing, active projects as positional arguments
**When** the command runs
**Then** all three projects are refreshed serially — the third positional argument is processed exactly as thoroughly as the first, not silently dropped — and the summary line reports the total.

Validates: `#rules` (3.3) Digest generator rules v0.22 (multi-project refresh, silent-drop prohibition)

**Satisfaction criteria:**
- Each of the three named projects receives a "Refreshing <name> …" progress line in the order given, followed by a completion or failure line
- After the run, `get_project_digest` on each of the three projects returns a digest whose `generated_at` is within the command's execution window — confirming the third project was actually touched, not skipped
- The final summary line reads `Done: 3 refreshed, 0 failed (of 3 total)` on the happy path — the denominator matches the number of positional arguments
- A typo or unknown project name among the positional arguments produces a clear per-project error in the run and is counted into the `failed` tally — not silently dropped before the run begins
- Extra positional arguments beyond the first are NEVER silently ignored — a regression where only the first project is refreshed while later ones are treated as no-ops fails this scenario
- The prior single-project form (`setlist digest refresh <project>`) is a natural subset — supplying one positional argument still works and reports `Done: 1 refreshed, 0 failed (of 1 total)`
- Processing is strictly serial across the three projects — the contract in v0.22 is serial, and parallelism is explicitly out of scope

Difficulty: medium

---

## S109: Document Walker Skips Underscore-Prefixed Subdirectories By Default {#s109}
**Given** a non-code project whose project root contains a canonical set of documents alongside an `_Duplicates/` subdirectory holding older copies and a `_archive/` subdirectory holding superseded material — neither has any explicit configuration
**When** the user runs `setlist digest refresh <project>`
**Then** the document walker skips both underscore-prefixed subdirectories entirely — their contents are neither extracted, concatenated into the generator input, nor included in the file-tree hash.

Validates: `#rules` (3.3) Digest generator rules v0.22 (walker ignore defaults)

**Satisfaction criteria:**
- The resulting digest text shows no evidence of material unique to the `_Duplicates/` or `_archive/` folders — identifying phrases present only in those files do not appear in the digest
- The stored file-tree hash is computed over the post-ignore file set only — adding a new file inside `_Duplicates/` does NOT flip the hash on the next refresh
- The skip applies without any configuration — no `.digestignore` is required for the common underscore convention to work
- The walker skips any underscore-prefixed subdirectory at the project root — `_drafts/`, `_old/`, `_anything/` all behave the same way as `_Duplicates/`
- Underscore-prefixed FILES (not directories) at the root are NOT skipped by default — the convention is directory-level, and a file named `_notes.md` is still read
- Code projects are unaffected by this rule — the code-project walker remains depth-1 only, so `node_modules/`, `.venv/`, and similar are unreachable by construction without any underscore logic
- A user who wants `_Duplicates/` to be included despite the default can re-enable it via `.digestignore` (covered in S110) — the default is a convention, not a hard block

Difficulty: medium

---

## S110: `.digestignore` Composes With the Underscore Default as a Union {#s110}
**Given** a non-code project whose root contains a `.digestignore` file declaring `drafts/` and `scratch-*.md` to be skipped, alongside a default-skipped `_Duplicates/` subdirectory
**When** the user runs `setlist digest refresh <project>`
**Then** the walker excludes files matched by EITHER the default underscore rule OR the `.digestignore` patterns — the rules compose as a union — and `.digestignore`'s gitignore-style syntax supports comments and re-include (`!`) patterns.

Validates: `#rules` (3.3) Digest generator rules v0.22 (walker ignore, `.digestignore` override composition)

**Satisfaction criteria:**
- Content from `_Duplicates/` is absent from the digest (default underscore rule still fires)
- Content from `drafts/` and any `scratch-*.md` file is absent from the digest (`.digestignore` rule fires)
- A file that neither rule matches (e.g. a top-level `notes.md`) IS included — the ignore rules are additive skips, not a whitelist
- Gitignore-style syntax is honored: `#`-prefixed lines are treated as comments, blank lines are tolerated, leading `!` re-includes a file that a prior pattern would skip
- A leading `!` rule can override the default underscore skip (e.g. `!_Duplicates/canonical.md` re-includes that one file) — the default is a convention the project can override explicitly
- Adding a new entry to `.digestignore` that matches an existing file flips the file-tree hash on the next refresh, because the hash is computed over the post-ignore file set — a consumer reading the digest before refresh sees `stale: true`
- The `.digestignore` file itself is not part of the digest source and is not hashed into the file-tree stamp — editing only the ignore file while no actual sources change still flips the hash (because the post-ignore set changes) but does not pollute the digest text with `.digestignore` contents
- A project with no `.digestignore` behaves exactly as S109 describes — the underscore default alone applies

Difficulty: hard

---

## S111: Generator Handles a Very Large Code Spec Without Context Overflow {#s111}
**Given** a code project whose `.fctry/spec.md` is more than 100 KB (roughly 25–30k tokens), running through the default hosted-provider path (OpenRouter Flash-Lite), and a separate run of the same project forced through the local MLX fallback
**When** the user runs `setlist digest refresh <project>` in each mode
**Then** the hosted path succeeds without truncating the spec (Flash-Lite's 1M-token context absorbs it), and the local fallback head-truncates the input at 400 000 characters, logs one truncation line, and still produces a digest — neither path crashes on input size.

Validates: `#rules` (3.3) Digest generator rules v0.21 (provider-aware input-size handling)

**Satisfaction criteria:**
- On the hosted path, the full spec is sent to OpenRouter without client-side truncation — a spec that is under the model's context window is not pre-emptively chopped
- On the hosted path, no "input truncated" log line fires — the generator distinguishes "didn't need to truncate" from "truncated silently"
- On the local-MLX path, inputs over ~400 000 characters are head-truncated and exactly one INFO-level line names the truncation (e.g. `Input exceeded 400000 chars; head-truncated for local-mlx`)
- The digest produced on either path is a coherent summary of the spec — a human reader can tell the generator successfully ingested the large input, not just the opening section
- The `producer` tag on each write distinguishes which path ran — a consumer comparing two digests can see one came from OpenRouter and one from local MLX even when the project is the same
- A spec comfortably under the limits (e.g. 20 KB) produces no truncation log line on either path — the truncation signal only fires on actual truncation
- If the hosted path would estimate a per-invocation cost above the client-side ceiling ($1.00 default), the remainder of the batch skips the hosted path and goes straight to local-mlx — the ceiling is enforced even for a single large project

Difficulty: hard

---

## S112: MCP Server Self-Registers All Three Capability Surfaces on Startup {#s112}
**Given** a registry in which `setlist` is already registered as a project row and the MCP server binary is launched via its standard entrypoint
**When** the server completes its startup sequence and an agent immediately calls `query_capabilities --project setlist`
**Then** the response lists the full cross-surface capability set — all 39 MCP tools, every top-level CLI command, and the public `@setlist/core` library exports — each with the correct `type` field and a human-meaningful description, with no manual bootstrap step required by the operator.

Validates: `#capability-declarations` (2.11) self-registration, `#capabilities` (3.1) MCP tool surface

**Satisfaction criteria:**
- `query_capabilities --project setlist --type tool` returns exactly 39 rows whose names match the set of tools actually registered in the MCP server's tool-registration array — not a static list that could drift
- `query_capabilities --project setlist --type cli-command` returns one row for every top-level subcommand in `packages/cli/src/index.ts` (e.g. `digest refresh`, `ui`, `worker`, and the others) — the count equals the number of commands the CLI actually dispatches, no more and no less
- `query_capabilities --project setlist --type library` returns one row for every public export from `packages/core/src/index.ts` — internal helpers not listed in the package's public surface do not appear
- Each registered capability carries a non-empty `description` field — bare-name registrations (name only, no description) fail this scenario because they defeat discovery
- Self-registration happens with no operator action — the user never runs `setlist capabilities register` or edits a JSON seed; simply launching the MCP server is sufficient
- The three surfaces use the type strings specified in §2.11 (`tool`, `cli-command`, `library`) verbatim — not pluralized, not capitalized, not `mcp-tool` or `cli`
- The self-registration call produces no user-visible output on stdout/stderr during a normal startup — it is a silent idempotent step, not an event the operator needs to acknowledge

Difficulty: medium

---

## S113: Repeated Startups Produce an Identical Capability Set With No Drift {#s113}
**Given** a registry against which the MCP server has already completed one self-registration startup, leaving setlist's capability rows in a known state
**When** the server is stopped and restarted one or more times without any code change between runs
**Then** the capability set for setlist after each subsequent startup is byte-identical to the set after the first startup — no duplicates are introduced, no rows disappear, and the row count remains stable across N restarts.

Validates: `#capability-declarations` (2.11) idempotent self-registration, replace semantics

**Satisfaction criteria:**
- After the second startup, `query_capabilities --project setlist` returns exactly the same row count as after the first startup — idempotence is observable at the count level
- The set of capability names returned is identical across startups — no `tool_name` appears twice, no name drops between runs
- Each row's `description`, `type`, and any invocation metadata fields are unchanged across startups — the replace write is deterministic given the same code surface
- A contrived 10-restart loop produces the same capability set on every read between restarts — no slow accumulation, no slow leakage
- The `project_capabilities` table row count for `project = setlist` after N startups equals the row count after 1 startup — the write genuinely replaces rather than appending
- No startup logs a warning about duplicate-capability detection on a clean restart — the no-op idempotent path is the silent path

Difficulty: medium

---

## S114: Code Changes to the Tool Surface Are Reflected on the Next Startup {#s114}
**Given** a running setlist system whose last MCP server startup registered the then-current tool surface, and a subsequent code change that adds one new MCP tool and removes one existing MCP tool before a restart
**When** the MCP server is restarted against the same registry after the code change
**Then** the stored capability set for setlist on the next `query_capabilities` read reflects code reality exactly — the new tool appears, the removed tool is gone, and no tombstone of the removed tool lingers — consistent with the §2.11 replace-semantics contract.

Validates: `#capability-declarations` (2.11) replace semantics + code-reality reflection

**Satisfaction criteria:**
- After restart, the added tool appears in `query_capabilities --project setlist --type tool` with its new name and description — the addition is observable without any manual registration step
- After restart, the removed tool no longer appears in the capability set — a consumer searching for it gets an empty result, not a stale hit
- The total `tool`-typed row count shifts by the net delta (one added minus one removed = zero net change in the illustrative case) — the write genuinely replaces the prior set rather than layering over it
- The same reflection path applies to CLI commands and library exports — adding a new subcommand in `packages/cli/src/index.ts` or a new public export in `packages/core/src/index.ts` causes the corresponding row to appear on the next restart, and removing one causes its row to disappear
- Unrelated capability rows (the ones that did not change in code) retain their descriptions and metadata byte-identically — replace semantics operate on the setlist project's capability set as a whole, not selectively, but the outcome is stable for untouched entries
- No code path requires editing a checked-in `capabilities.json` or similar hand-maintained manifest — the only source of truth is the code itself (tool-registration array, CLI dispatcher, library export list)

Difficulty: medium

---

## S115: First-Run Against a Fresh Registry Auto-Creates the Setlist Project Row {#s115}
**Given** a brand-new registry database in which no `setlist` project row exists — e.g. a clean install where schema migrations have run but no projects have been registered yet
**When** the MCP server is launched for the first time against this database
**Then** the startup sequence creates a `setlist` project row (with correct `name`, `type`, and `description`, and placed in the appropriate area) before writing capabilities, so that the foreign-key-bound capability rows land cleanly — the server does not crash with a "project not found" error, and does not silently skip self-registration.

Validates: `#capability-declarations` (2.11) first-run bootstrap, `#registration` (2.2) self-registration safety

**Satisfaction criteria:**
- After the first startup, `get_project --name setlist` returns a row — the project row was auto-created, not left missing
- The auto-created row carries a sensible `description` (one paragraph naming setlist as the registry itself) — not an empty string, not a placeholder like "TODO"
- The auto-created row is placed in the appropriate canonical area (e.g. `infrastructure`) — not orphaned with a null area
- Capability rows for setlist exist after the first startup — the bootstrap order is "create project row, then register capabilities," not the reverse
- A second startup against the same registry does NOT create a duplicate setlist project row — the auto-create path checks for existence and is idempotent, matching the S113 idempotence contract at the project-row level
- If the operator has manually registered setlist as a project row before ever launching the MCP server, the first startup updates capabilities without overwriting user-visible fields like `description` or `area` — auto-registration is a safety net, not an authority over operator-chosen metadata
- The MCP server never crashes on first launch against an empty registry — "fresh registry" is a supported state, not an error path

Difficulty: medium

---

## S116: Cross-Surface Discovery by Type Returns the Correct Surface {#s116}
**Given** a registry in which setlist has completed self-registration (via the S112 happy path) and another portfolio project (e.g. `chorus-app`) has separately registered a smaller set of capabilities of mixed types
**When** an agent issues `query_capabilities --type tool`, then `query_capabilities --type cli-command`, then `query_capabilities --type library` across the whole registry (no project filter)
**Then** each type filter returns the union of rows for that type across all projects — setlist's 39 tools appear in the `tool` query, setlist's CLI commands appear in the `cli-command` query, setlist's library exports appear in the `library` query, and each surface is independently discoverable.

Validates: `#capability-declarations` (2.11) discoverability by type, `#capabilities` (3.1) `query_capabilities`

**Satisfaction criteria:**
- `query_capabilities --type tool` returns a result set that includes all 39 setlist tools by name — plus any tools registered by other projects, making the cross-project union observable
- `query_capabilities --type cli-command` returns setlist's CLI commands alongside any CLI commands registered by other projects — setlist's commands are not hidden inside a different type bucket
- `query_capabilities --type library` returns setlist's library exports — agent consumers (e.g. chorus-app importing `@setlist/core`) can discover the public API without reading setlist's source
- A type filter that matches no capability returns an empty result, not an error — e.g. `--type api-endpoint` returning nothing is valid when no project registers API endpoints
- Combining filters works additively: `query_capabilities --project setlist --type cli-command` narrows to setlist's CLI commands only, not a union with chorus-app's — the filters AND, they do not OR
- A keyword search (`query_capabilities --keyword digest`) matches capabilities across all three setlist surfaces where the word appears (e.g. the `refresh_project_digest` tool, the `digest refresh` CLI command, and any digest-related library export) — cross-surface discovery is keyword-navigable, not type-siloed

Difficulty: medium

---

## S117: Partial Introspection Failure Does Not Crash Self-Registration {#s117}
**Given** a startup where one of the three introspection paths throws (e.g. the CLI-command introspector raises because `packages/cli/src/index.ts` cannot be resolved at runtime, or the library-exports enumeration fails with a module-load error), while the other two paths succeed
**When** the MCP server completes startup self-registration despite the partial failure
**Then** the server does not crash — it registers the surfaces that did introspect successfully, leaves the failing surface unwritten, logs exactly one clear warning naming which surface failed and why, and remains responsive to `query_capabilities` requests for the surfaces that did register.

Validates: `#capability-declarations` (2.11) failure-isolation, `#observability` (7.3) self-registration warnings

**Satisfaction criteria:**
- The MCP server completes startup and accepts MCP requests — a partial introspection failure never prevents the server from becoming available
- `query_capabilities --project setlist --type tool` still returns the 39 tools in the illustrative case where only the CLI introspector failed — the surfaces that succeeded are fully written
- `query_capabilities --project setlist --type cli-command` returns either the last-known-good set (if replace-semantics skipped the failing surface entirely) or an empty set — the contract is "do not write a partial/empty replacement over a previously-good set when the introspector itself failed," so a stale previous set is preferred over a destructive overwrite
- Exactly one WARN-level log line names the failed surface and the underlying cause (e.g. `Capability self-registration: cli-command introspection failed (<reason>); other surfaces registered`) — not a stack-trace dump, not a silent swallow, not a repeated spam per-tool
- A subsequent restart after the code issue is fixed heals the gap on the next startup — the failing surface rewrites successfully and the capability set converges to code reality (same mechanism as S114)
- A failure in a single tool's description computation (not in the introspector as a whole) still registers the other 38 tools and flags the problematic one with a WARN — one bad description does not take the entire tool surface offline
- The warning is emitted to stderr (or the MCP server's structured log channel), not to stdout — it does not interfere with MCP protocol framing on stdio transports

Difficulty: hard
