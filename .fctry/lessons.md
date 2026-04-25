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

---

### 2026-04-16T18:50:00Z | #auto-update (2.14.1)

**Status:** active | **Confidence:** 1
**Helpful:** 0 | **Harmful:** 0
**Agent:** executor
**Trigger:** tech-stack-pattern
**Component:** app/main
**Severity:** medium
**Tags:** electron, electron-updater, github-releases, prereleases
**Rule:** For electron-updater with GitHub provider, set BOTH `autoUpdater.channel` (filename lever: `'latest'` vs `'beta'`) AND `autoUpdater.allowPrerelease` (boolean: true allows prereleases, false skips them). Using channel alone does not gate prereleases.
**Evidence:** Setlist auto-update build 2026-04-16, chunk 2 (S84 channel → tag mapping)
**Anti-pattern:** Setting only `autoUpdater.channel = 'beta'` and assuming prereleases will be selected. The channel controls which YAML manifest is fetched; `allowPrerelease` controls whether prerelease tags are honored at all.
**Context:** Wiring spec language 'stable'/'beta' to electron-updater's API for scenario S84 (Beta → prereleases, Stable → non-prereleases only).
**Outcome:** Using both `channel` + `allowPrerelease` at the boundary correctly mapped both channels to their expected GitHub tag subsets.

---

### 2026-04-16T18:51:00Z | #auto-update (2.14.1)

**Status:** active | **Confidence:** 1
**Helpful:** 0 | **Harmful:** 0
**Agent:** executor
**Trigger:** tech-stack-pattern
**Component:** app/main
**Severity:** low
**Tags:** electron, about-panel, version
**Rule:** In `app.setAboutPanelOptions({ applicationVersion, version, ... })`, `applicationVersion` is the app's semantic version; the `version` field maps to the "Version" label in the native About panel, which Apple convention uses for the BUILD number/date — not the semver.
**Evidence:** Setlist auto-update build 2026-04-16, chunk 4 (S86 About shows version + build date + channel)
**Anti-pattern:** Putting the semver in `version` and leaving `applicationVersion` empty — the About panel will render an awkward label.
**Context:** Satisfying S86 (About dialog shows version, build date, active channel) without a custom dialog.
**Outcome:** Using `applicationVersion` for "vX.Y.Z (Stable)" and `version` for the YYYY-MM-DD build date produces the expected layout.

---

### 2026-04-16T18:52:00Z | #auto-update (2.14.1)

**Status:** active | **Confidence:** 1
**Helpful:** 0 | **Harmful:** 0
**Agent:** executor
**Trigger:** tech-stack-pattern
**Component:** app/main
**Severity:** medium
**Tags:** electron, electron-updater, quit-prompt, auto-install
**Rule:** For an interactive "Install or Skip?" prompt on quit with a staged electron-updater download, set `autoUpdater.autoInstallOnAppQuit = false` and handle the install path explicitly via `app.on('before-quit', ...)` + `quitAndInstall()`. Leaving auto-install enabled races the prompt.
**Evidence:** Setlist auto-update build 2026-04-16, chunk 5 (S89 install-or-skip prompt)
**Anti-pattern:** Keeping `autoInstallOnAppQuit = true` and showing a prompt — the library will silently install once the app exits regardless of user choice.
**Context:** Satisfying S89 where the user must be given a real choice to skip a staged install.
**Outcome:** Disabling auto-install, using `event.preventDefault()` in before-quit, and calling `quitAndInstall()` only on confirm gives a clean install-or-skip UX; skip uses `app.exit(0)` so the staged update remains on disk for the next prompt cycle.

### 2026-04-23T21:20:00Z | #capability-declarations (2.11)

**Status:** candidate | **Confidence:** 1
**Helpful:** 0 | **Harmful:** 0
**Agent:** executor
**Trigger:** tech-stack-pattern
**Component:** cli + mcp
**Severity:** medium
**Tags:** npm-workspaces, subpath-exports, side-effecting-entrypoint, esm, nodenext
**Rule:** When a workspace package has a side-effecting entrypoint (like a CLI with top-level `switch(process.argv[2])`), cross-package consumers must import via a **subpath export** that points at a pure-data or pure-function module — not the main entrypoint. Declare the subpath in the producer's `package.json` exports map (e.g. `"./introspect": { "import": "./dist/introspect-commands.js" }`) and import as `@setlist/cli/introspect`. Importing the main entrypoint would run the CLI dispatcher.
**Evidence:** Setlist capability self-registration build 2026-04-23, chunk 3 (CLI command introspection).
**Anti-pattern:** Adding `@setlist/cli` to mcp's dependencies and importing from `@setlist/cli` directly — node will execute the shebang-prefixed index.js and trigger process.exit paths inside createServer() when it sees no command argument.
**Context:** The MCP server's startup orchestrator needs to introspect the CLI's command list from inside createServer(). Option (a) from the build plan was "have @setlist/cli export the introspector" — this works cleanly only because the CLI already separates commands.ts (data) from index.ts (dispatcher).
**Outcome:** Introducing packages/cli/src/commands.ts + introspect-commands.ts + subpath exports "./introspect" and "./commands" lets MCP consume the CLI's surface without side effects. Node16 module resolution in the root tsconfig honors the exports map natively.

### 2026-04-23T21:20:00Z | #capability-declarations (2.11)

**Status:** candidate | **Confidence:** 1
**Helpful:** 0 | **Harmful:** 0
**Agent:** executor
**Trigger:** retry-success
**Component:** test
**Severity:** low
**Tags:** vitest, spyOn, prototype-patching, bound-method
**Rule:** When using `vi.spyOn(Class.prototype, 'method').mockImplementation(fn)` and `fn` needs to call through to the real method for some code paths, capture `const real = Class.prototype.method` BEFORE calling `spyOn` and invoke it via `real.call(this, ...)` inside the mock. The spy replaces the prototype method in place, so trying to read `Class.prototype.method` inside the impl returns the mock (infinite loop).
**Evidence:** Setlist capability self-registration build 2026-04-23, chunk 6 (S117 integration test).
**Anti-pattern:** Relying on `spy.wrappedMethod` or `spy.getMockImplementation()` to recover the original — these are not part of vitest's stable API and return undefined in vitest 3.x.
**Context:** S117 integration test simulates a write failure for `capability_type === 'cli-command'` while letting the other two types go through. Needs both mock behavior (throw) and passthrough (call real).
**Outcome:** Capturing `const realMethod = Registry.prototype.registerCapabilitiesForType` before `spyOn` and using `realMethod.call(this, ...)` inside the mock impl works reliably.

### 2026-04-25T09:24:00Z | #schema (5.2)

**Status:** candidate | **Confidence:** 1
**Helpful:** 0 | **Harmful:** 0
**Agent:** executor
**Trigger:** tech-stack-pattern
**Component:** core
**Severity:** medium
**Tags:** schema-migration, sqlite, idempotent-seed, spec-evolve
**Rule:** When promoting a hardcoded constant (CANONICAL_AREAS) to a user-managed table, keep the constant name as a re-export alias from the new module — search-and-replace then becomes optional and migration tests don't break on a single rename.
**Evidence:** Spec 0.25 → 0.26 schema v13 build. CANONICAL_AREAS retained as `export const CANONICAL_AREAS = SEED_AREAS` so existing migration code referencing it kept working.
**Anti-pattern:** Deleting the legacy constant in the same commit that introduces the table — forces a wider blast radius and breaks any in-flight migration logic still calling it by name.
**Context:** Schema v12 → v13 migration, areas relax from system-owned to user-managed.
**Outcome:** Migration ran clean on fresh + existing v12 databases; tests passed in one shot after only adjusting the literal version-number assertions.

### 2026-04-25T09:24:00Z | #desktop-app (2.14)

**Status:** candidate | **Confidence:** 1
**Helpful:** 0 | **Harmful:** 0
**Agent:** executor
**Trigger:** tech-stack-pattern
**Component:** app
**Severity:** medium
**Tags:** electron, ipc, preload, contextBridge, accelerator
**Rule:** When wiring a new menu accelerator (Cmd-,) → IPC → renderer listener, expose `onNavigateToSettings(handler)` from the preload bridge that returns an unsubscribe function — same shape as the existing `onUpdateEvent`. App.tsx's useEffect can return the unsubscribe directly as cleanup, no manual removeListener call needed.
**Evidence:** Step 8 of spec 0.26 build: Cmd-, → BrowserWindow.getFocusedWindow().webContents.send('navigate-to-settings') → preload.onNavigateToSettings → App.tsx setView({kind:'settings'}).
**Anti-pattern:** Subscribing in the renderer without returning an unsubscribe — accumulates listeners across hot reloads and causes ghost navigations.
**Context:** New menu item with global accelerator on macOS + cross-process IPC + contextBridge.
**Outcome:** Pattern is consistent with existing UpdateToast wiring; typecheck clean on first try.

### 2026-04-25T09:24:00Z | #desktop-app (2.14)

**Status:** candidate | **Confidence:** 1
**Helpful:** 0 | **Harmful:** 0
**Agent:** executor
**Trigger:** tech-stack-pattern
**Component:** app
**Severity:** low
**Tags:** react, dynamic-grid, column-visibility, css-grid
**Rule:** For toggleable table columns, build a single `gridTemplateColumns` string from the visibility map (e.g., `'1fr 90px 100px ...'`) and apply it via `style={{ gridTemplateColumns }}`. Skip the `<span>` for hidden columns. The grid auto-collapses; no per-row branching.
**Evidence:** Step 7 of spec 0.26 build: ColumnVisibility{status,health,type,updated_at,area}, buildGridTemplate() helper, ProjectRows component.
**Anti-pattern:** Rendering all columns and hiding via `display: none` — wastes layout work and complicates header alignment.
**Context:** Project list with 5 toggleable columns.
**Outcome:** Headers and rows stay aligned with no extra plumbing.
