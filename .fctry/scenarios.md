# Setlist — Scenario Holdout Set

These scenarios define the behavioral contract for Setlist. Each scenario is an end-to-end
user story with LLM-evaluable satisfaction criteria. Scenarios are evaluated against the
running system, not the code — they test experience, not implementation.

All scenarios preserve the identical experience defined by the Python project-registry-service.
TypeScript-specific scenarios (marked with `[TS]`) test packaging, import, and compatibility
concerns unique to the Setlist implementation.

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
**Given** an initialized registry
**When** a producer registers a project with name, display_name, type, status, description, goals, and paths
**Then** the project is immediately queryable at all three depth levels with correct values.

**Satisfaction criteria:**
- `getProject('my-project', 'summary')` returns name, displayName, type, status, one-line description
- `getProject('my-project', 'standard')` additionally returns goals, paths, template-relevant extended fields
- `getProject('my-project', 'full')` returns everything including all fields from all producers
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
- `type_filter='project'` excludes areas of focus
- `status_filter='active'` excludes paused/archived projects
- Filters compose: `type_filter='project', status_filter='active'` returns only active projects

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
- Project-scoped recall returns project + portfolio + global memories (not other projects)
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
- All 27 tool names are registered and callable
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
- Type and status filters compose with keyword search
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
- Type distribution (projects vs. areas of focus) is accurate
- Status distribution (active, paused, archived, etc.) is accurate

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
**When** the user calls `configure_bootstrap` with type-to-path mappings (e.g., `project → ~/Code`, `area_of_focus → ~/Areas`) and a template directory path (e.g., `~/Resources/System/Templates/`)
**Then** the configuration is stored persistently and the user can verify it was saved by calling the tool again to see current settings.

**Satisfaction criteria:**
- `configure_bootstrap` accepts a mapping of project types to default path roots
- `configure_bootstrap` accepts a template directory path
- Configuration persists across registry restarts (stored in the database, not in-memory)
- Calling `configure_bootstrap` with no arguments returns the current configuration
- Partial updates merge with existing configuration rather than replacing it entirely
- Invalid paths (e.g., nonexistent template directory) produce a clear error, not a silent save

---

## S39: Bootstrap a Code Project {#s39}
**Given** bootstrap is configured with `project → ~/Code` and a template directory containing project scaffolding files
**When** the user calls `bootstrap_project` with name "my-new-app", type "project"
**Then** the project folder exists at `~/Code/my-new-app/` with template files populated, a git repository initialized with an initial commit, and the project is registered in the registry.

**Satisfaction criteria:**
- A folder is created at the configured path root for the type (`~/Code/my-new-app/`)
- Template files from the configured template directory are copied into the new folder
- `git init` is run inside the folder and an initial commit is created
- The project appears in `list_projects` with the correct name, type, and path
- `get_project('my-new-app')` returns the project with all registration fields populated
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

## S41: Bootstrap an Area of Focus {#s41}
**Given** bootstrap is configured with `area_of_focus → ~/Areas` and a template directory
**When** the user calls `bootstrap_project` with name "health", type "area_of_focus"
**Then** the folder exists at `~/Areas/health/` with area-appropriate templates, no git, and the area is registered.

**Satisfaction criteria:**
- A folder is created at `~/Areas/health/`
- Template files appropriate to the area type are populated
- No `.git` directory exists (areas live in iCloud-synced paths where git is forbidden)
- The area is registered and queryable with type `area_of_focus`
- The area appears in `list_projects` alongside regular projects

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
**Given** the registry contains 8 projects of mixed types (code projects, non-code projects, areas of focus) with varying statuses
**When** the user is on the home view
**Then** all projects appear as cards in a responsive grid, each card showing the project's essential identity at a glance.

**Satisfaction criteria:**
- Every registered, non-archived project has a card in the grid
- Each card displays: project name, type badge (visually distinguishing code project from area), status indicator, and last-updated timestamp
- Cards are arranged in a grid that reflows as the window resizes
- The visual hierarchy makes it easy to scan — project name is the most prominent element on each card
- Type badges use distinct visual treatments (color, icon, or label) so the user can tell project types apart without reading text

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
- Editable fields include at minimum: display_name, description, goals, and status
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
