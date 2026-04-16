# Build Trace — run-20260414-areas

**Spec version:** 0.13
**Started:** 2026-04-14T20:40:00Z
**Completed:** 2026-04-16T01:13:00Z
**Status:** completed
**Chunks:** 8/8 completed
**Test suite:** 300/300 green (core 252, mcp 36, cli 12)

## Plan

Build spec 0.13 — canonical areas + sub-projects — replacing the retired
`area_of_focus` project type with a structural `area_id` attribute and a
`parent_project_id` self-reference. Eight chunks: schema migration,
core models + registry, MCP server, IPC + renderer types, register/edit
forms, home-view lanes, sub-project visuals, verification sweep.

## Chunk outcomes

| # | Name | Gate | Status | Commit | Notes |
|---|------|------|--------|--------|-------|
| 1 | Schema v11 migration | ✓ | completed | 0b7f2d2 | v11 areas table + canonical seed; projects.area_id + parent_project_id; projects.type CHECK narrowed to ('project'); memories.scope remap |
| 2 | Core models + Registry methods | ✓ | completed | bf96704 | setProjectArea/setParentProject + cycle walker; area_filter on list/search; by_area + unassigned stats; memory bubble-up (S78); 14 failing tests rewritten + 19 new |
| 3 | MCP server tools + params | ✓ | completed | 6812ba0 | 34→36 tools; area_filter on list/search/batch/queue; retain scope enum updated |
| 4 | IPC bridge + renderer types | — | completed | 94d1e8d | setProjectArea/setParentProject handlers; preload + lib/api.ts threading |
| 5 | RegisterProjectDialog + EditProjectForm | — | completed | ba46925 | area picker + parent combobox + validation |
| 6 | HomeView grouped lanes | ✓ | completed | 707ccb4 | 8 lanes, filter chips, localStorage persistence |
| 7 | Sub-project visuals + OverviewTab | — | completed | 85ad11f | same-area indent+connector, cross-area caption, Structure section |
| 8 | Verification sweep | — | completed | (this) | 300/300 green, all builds clean |

## Build smoothness

**Rating: 4/5 (Smooth).** One stagnation point at the start (Chunk 1
verification was blocked on native better-sqlite3 signature) was
resolved at the protocol level rather than per-chunk — swap-sqlite-abi.sh
now re-signs unconditionally, so the failure mode can't recur. Chunks
2-8 executed without retries. Observer confidence held high across the
sweep. No spec-level interruptions surfaced.

## What went well

- **Adapter-boundary discipline.** Memory retrieval bubble-up (S78) was
  the highest-risk change. Isolating it behind one
  `buildProjectVisibilityFilter` helper let the three query paths (FTS,
  LIKE, bootstrap) absorb it as a three-line edit each. First-run green.
- **Test-suite fidelity.** The 14 core failures Chunk 1 handed off were
  all legitimate schema-contract violations. Rewriting them to the new
  area-assignment model (no area_of_focus fixtures) produced a clean
  baseline without silently weakening assertions.
- **Cycle walker correctness.** Wrote the walker with a hop ceiling
  (project count + 1) instead of a visited set. Tests for A→B→C cycle
  rejection, self-parent rejection, and bounded termination all passed
  on first run.
- **Incremental lane rendering.** The same-area child reorder pass
  preserves the sort field's order among top-level rows, so the sort
  headers still do the right thing even after children are spliced
  beneath their parents.

## What was hard

- **Compatibility test rehydration.** The v0→v11 test hit "no such column
  area_id" because SCHEMA_SQL declared the new index before ensureColumns
  had a chance to ALTER the column in. Straightforward fix (move the
  index into ensureColumns) but diagnostically expensive without the
  lesson captured in lessons.md. Future SCHEMA evolution: any index on
  a column that's added via ensureColumns must live in ensureColumns
  too, not in SCHEMA_SQL.
- **Legacy area_of_focus references.** Six distinct renderer files and
  three core files had hard-coded references to the retired type.
  Chunks 4-7 cleaned the subset that affected the new flows; a few
  display-only conditionals in ProjectCard / ProjectHeader / SettingsView
  / RegisterProjectDialog path_roots legacy fallback remain as dead
  branches (they don't fire at runtime since type is always 'project'
  now). They should be pruned in a follow-up sweep but don't block
  the build.
- **Renderer pre-existing errors.** tsconfig.renderer.json flags 6
  pre-existing errors (JSX namespace, RegisterProjectDialog/RenameDialog
  arg mismatches, OverviewTab Record casts). They're unrelated to this
  spec and predate this build. Noted for future cleanup.

## What didn't work

Nothing abandoned. All planned deliverables landed. The deferred insight
from the prior build (auto-resign in swap-sqlite-abi.sh) was delivered
as part of Chunk 2 rather than deferred again.

## Deferred insights

- **Runtime-dead legacy branches.** ProjectCard.tsx, ProjectHeader.tsx,
  useProjects.ts display-type conditionals, SettingsView.tsx path_roots
  UI, and the RegisterProjectDialog TYPE_TO_PATH_KEY 'area_of_focus' key
  all still reference the retired type. They don't fire (type is always
  'project' post-Chunk 2) but clutter the codebase. One-sweep cleanup
  is good work for a future chunk.
- **Renderer pre-existing TS errors.** tsconfig.renderer.json has 6
  unrelated errors that predate this build. Fixing them would let us
  add a strict typecheck gate to the build command.
- **Empty lanes visibility.** Spec 0.13 says "8 collapsible lanes" which
  could be interpreted as always-show-all. Current implementation hides
  empty lanes to reduce visual noise. If users expect the Health lane
  visible even when zero projects live there, we'll need to revisit.
- **Area filter chips vs. area lanes overlap.** Both exist; chips filter,
  lanes group. This works, but users may find it redundant. Consider
  whether clicking a lane header should auto-apply the corresponding chip.

## Wins

1. S78 bubble-up semantics — including the four-level hierarchy and
   the unassigned-project short-circuit — landed as a single helper
   called from three places, with five tests covering sibling recall,
   cross-area isolation, live reassignment, and unassigned scope
   enforcement. All green on first run.
2. The cycle walker for set_parent_project is the exact error message
   the spec prescribes, including self-parent rejection and A→B→C
   cycle rejection, with bounded termination guarded by hop count.
3. HomeView grouped lanes + area filter chips + sub-project visuals
   (indent/connector for same-area, caption for cross-area) shipped
   in two chunks with localStorage persistence — reloads don't blow
   away the user's layout.
4. swap-sqlite-abi.sh now re-signs unconditionally after any swap or
   rebuild, closing the `ERR_IPC_CHANNEL_CLOSED` / exit-137 class of
   failure that blocked Chunk 1 verification at build start.

## Relationship rule check

- Registry types → MCP server → IPC bridge → preload → renderer api
  → UI components: all five layers threaded area + parent_project +
  area_filter in the same order. No layer skipped. ProjectSummary's
  new fields carry through from `rowToRecord` in core to the JSX
  rendering in HomeView without any `as any` escape hatches.
- Memory retention and retrieval share a single scope enum. Both
  accept 'area' now; both reject 'area_of_focus'.
- The cycle-prevention error message is defined once in Registry
  and surfaces verbatim through MCP and IPC.

## Test health

- Core: 252 tests, 12 files, 100% pass
- MCP: 36 tests, 1 file, 100% pass
- CLI: 12 tests, 1 file, 100% pass

No new flake introduced. No test suppressed or skipped.
