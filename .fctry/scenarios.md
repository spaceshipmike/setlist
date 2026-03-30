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
**Then** the SQLite file is created at `~/.local/share/project-registry/registry.db` with schema v8,
all 18 tables exist with correct columns and indexes, WAL mode is enabled, and FTS5 virtual table
for memory search is created.

**Satisfaction criteria:**
- Table list matches: projects, project_paths, project_fields, field_catalog, templates, template_fields, schema_meta, tasks, project_ports, project_capabilities, memories, memory_versions, memory_edges, memory_sources, summary_blocks, enrichment_log, recall_audit, memory_fts
- Schema version stored as 8
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
**Given** the 786 Python tests translated to TypeScript (vitest)
**When** `npm test` runs
**Then** all tests pass, confirming behavioral parity with the Python implementation.

**Satisfaction criteria:**
- Test count matches or exceeds 786
- All test categories covered: registry, server, memory, retrieval, cross-query, capabilities, batch, worker, ports, migration
- No Python-specific test logic silently dropped during translation
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
