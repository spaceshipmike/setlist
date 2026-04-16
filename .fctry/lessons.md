# Setlist Build Lessons

Append-only structured lessons from builds. The State Owner manages maturation.

---

### 2026-04-14T20:25:00Z | #health-assessment (2.15)

**Status:** candidate | **Confidence:** 1
**Helpful:** 0 | **Harmful:** 0
**Agent:** executor
**Trigger:** tech-stack-pattern
**Component:** app
**Severity:** high
**Tags:** better-sqlite3, electron, abi, codesign, hardened-runtime
**Rule:** After `electron-rebuild` of better-sqlite3, the rebuilt `.node` binary must be re-signed for Electron's hardened runtime or the app crashes on launch. The `with-electron-abi.sh` swap must preserve (or re-apply) the signature on every binary switch.
**Evidence:** run-20260414-health — environmental hiccup required manual re-sign twice during Chunk 3 (IPC bridge) before the dev app would launch against the Electron ABI build.
**Anti-pattern:** Assume electron-rebuild produces a launch-ready binary. It produces the correct ABI but leaves the signature invalid under hardened runtime.
**Context:** Building assessHealth IPC bridge required switching packages/app from Node ABI to Electron ABI via `with-electron-abi.sh`. The swap succeeded but the Electron app crashed at startup with a codesign violation.
**Outcome:** Re-running `codesign --force --sign -` on the swapped binary fixed launch. Happened twice in one chunk because the script does not auto re-sign.

---

### 2026-04-16T01:13:00Z | #areas (2.x)

**Status:** candidate | **Confidence:** 1
**Helpful:** 0 | **Harmful:** 0
**Agent:** executor
**Trigger:** tech-stack-pattern
**Component:** db
**Severity:** high
**Tags:** sqlite, schema, migration, create-index, alter-table
**Rule:** `CREATE INDEX IF NOT EXISTS` inside a monolithic SCHEMA_SQL block cannot reference columns added by a subsequent migration — on v0→vN upgrades the existing `projects` table is a no-op for `CREATE TABLE IF NOT EXISTS`, so the new-column index fires against the old shape and fails with "no such column". Put column-dependent indexes inside `ensureColumns()` (after the `ALTER TABLE ADD COLUMN`) instead of SCHEMA_SQL.
**Evidence:** run-20260414-areas — v0→v11 compatibility test crashed inside `initDb` with "no such column: area_id" because SCHEMA_SQL held `CREATE INDEX idx_projects_area_id ON projects(area_id)` at module load.
**Anti-pattern:** Declaring indexes for newly-added columns in the same SQL blob as the original CREATE TABLE statements.
**Context:** Chunk 2 introduced area_id + parent_project_id via ensureColumns' ALTER path and then the SCHEMA_SQL tried to CREATE INDEX on area_id before ensureColumns had run.
**Outcome:** Moved the two v11 indexes into ensureColumns() after the ADD COLUMN statements. Migration from v0 now passes cleanly.

---

### 2026-04-16T01:13:00Z | #memory-system

**Status:** candidate | **Confidence:** 1
**Helpful:** 0 | **Harmful:** 0
**Agent:** executor
**Trigger:** retry-success
**Component:** memory-retrieval
**Severity:** medium
**Tags:** scope, bubble-up, sql-in, siblings
**Rule:** When a recall filter needs to walk a graph-like structure (project → siblings in same area → portfolio → global), compute the sibling ID list in one lookup and inline it as a prepared IN (...) clause — don't try to re-express the walk in SQL joins. Keep the visibility filter as a reusable `{sql, params}` fragment callable from every query path (FTS, LIKE, bootstrap).
**Evidence:** run-20260414-areas — S78 (bubble-up) needed project/area/portfolio/global precedence across three distinct query paths in memory-retrieval.ts. A single `buildProjectVisibilityFilter(db, projectId, alias)` helper made the change a three-line edit in each path with no duplicated logic.
**Anti-pattern:** Duplicating a multi-clause OR filter across FTS/LIKE/bootstrap paths. Drift is guaranteed.
**Context:** Spec 0.13 S78 requires area-scoped memories from sibling projects to bubble up into a project's recall results, but project-scoped memories from those same siblings must not.
**Outcome:** One helper, three call sites, all five bubble-up tests green on first run.

---

### 2026-04-16T01:13:00Z | #core-flow

**Status:** candidate | **Confidence:** 1
**Helpful:** 0 | **Harmful:** 0
**Agent:** executor
**Trigger:** failure-rearchitect
**Component:** bootstrap
**Severity:** medium
**Tags:** npm-rebuild, codesign, linker-signed, hardened-runtime
**Rule:** Both `electron-rebuild` and `npm rebuild better-sqlite3` produce linker-signed ad-hoc signatures (flags=0x20002) that macOS hardened runtime refuses to dlopen. Symptom on Node is `ERR_IPC_CHANNEL_CLOSED` from vitest workers or exit 137 from `node -e`. Always `codesign --force -s - <path>` after any rebuild or cache swap. Bake this into the swap script so it can't be forgotten.
**Evidence:** run-20260414-areas — Chunk 1 verification was blocked until the Node ABI binary was re-signed; swap-sqlite-abi.sh previously only re-signed on the Electron path.
**Anti-pattern:** Trusting npm rebuild / electron-rebuild to produce a launch-ready signature on macOS arm64.
**Context:** Running packages/core vitest after a prior Electron ABI swap returned to Node ABI produced silent worker deaths.
**Outcome:** Updated swap-sqlite-abi.sh to codesign --force -s - after every swap/build path (not just Electron). Noted that cache copies also discard signatures on some filesystems so re-sign is idempotent and safe.
