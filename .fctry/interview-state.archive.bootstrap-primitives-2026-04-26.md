# Interview State — Setlist

- **Command:** `/fctry:evolve`
- **Target:** `bootstrap-primitive-composition` (new) — generalizes `#project-bootstrap` (2.13)
- **Spec version at start:** 0.27
- **External version:** 0.4.0
- **Started:** 2026-04-26
- **Mode:** Targeted evolve, scoped to bootstrap composability

## User's Framing (verbatim)

> could we create a series of project bootstrap primitives that users could "drag" into their project settings in SL? eg create new folder, create markdown doc from template, create new project in todoist, etc? would be great if it was easy for anyone to create new primitives

## Sections in Scope

- `#project-bootstrap` (2.13) — primary, the fixed-shape flow being generalized
- `#project-types` (3.2 entities + 5.2 schema) — primary, natural composition surface
- `#desktop-app` (2.14) — primary, Settings panel ProjectTypesSection
- `#entities` (3.2) — secondary, new `bootstrap_primitives` entity
- `#rules` (3.3) — secondary, validation/ordering/idempotence/partial-failure
- `#connections` (3.4) — secondary, first outbound third-party API in bootstrap
- `#capability-declarations` (2.11) — speculative, primitives as capability type
- `#hard-constraints` (4.3) — speculative, security of user-authored primitives
- `#scope` (4.1) — secondary, opens previously closed-shape bootstrap

## Pre-Interview Context (from State Owner)

- Current bootstrap is 5 hardcoded steps in `packages/core/src/bootstrap.ts:282-329`
  (create-folder, copy-template, git-init, register-in-registry, update-parent-gitignore)
- Two are already parameterized via project_types fields (`git_init`, `template_directory`)
- ProjectTypesSection edit dialog is the obvious surface for "drag into settings"
- A Todoist primitive would be the first outbound third-party API call from `@setlist/core`
- No spec/code drift; the drift is between the closed-shape spec and the open-shape
  the user is now asking for

## Phases

### Phase 1: What Are We Building? — COMPLETE

**Forcing question:** Where do primitives attach? Per project type (1),
per call (2), or both (3)?

**User answer (verbatim):**
> 1 to start without boxing ourselves out of 3 in the future

**Decision captured:**
- **Per-project-type recipes** [CONFIRMED] — v1 model. A project type owns
  an ordered recipe of primitive invocations. Bootstrapping a project of
  that type runs the recipe in order. This is the only attachment point
  in v1.
- **Per-call overrides** [CONFIRMED — DEFERRED] — explicitly out of scope
  for v1, explicitly in-scope as a future extension. The spec must call
  this out as a planned future capability so the data model and UI don't
  structurally rule it out.
- **Per-primitive-and-per-call** [CONFIRMED — REJECTED] — option 2 (per
  call only, no per-type defaults) is rejected; recipes belong to types.

**Implications for the data model and UI (to be enforced in later phases):**
- Recipes attach to a project type (`project_types.recipe`-shaped column
  or a related table — Phase 4 decides shape) but must NOT be modeled as
  *globally immutable for that type*. A future per-call override layer
  needs to be able to overlay on top of the type's recipe. So: recipes
  are the *default* for their type, not the *only possible* recipe.
- The bootstrap call signature (`bootstrap_project` MCP tool, `bootstrap`
  CLI, app dialog) takes a type identifier today. In a future phase it
  will optionally take per-call overrides; today it does not. Don't
  design the call shape so that adding an override parameter would be a
  breaking change.
- The Settings UI today edits "the recipe for this project type." A
  future per-call override UI would be a *different* surface (e.g. the
  Bootstrap dialog's "Customize…" button), not this one. Phase 2's UI
  decision is scoped to the per-type editor only.

### Phase 2: Walk Me Through It — COMPLETE

**Forcing question:** What palette shape ships in v1? Closed built-in
registry, declarative built-in shapes, MCP-tool-as-primitive, or
plugin-style user code? And: do the existing 5 hardcoded steps refactor
into the same registry, or stay implicit and only new ones are
composable?

**User answers (verbatim, paraphrased to decisions):**
> Three primitive shapes: filesystem-op, shell-command, mcp-tool. No
> http-call. No secrets in setlist — auth lives where it already lives
> (MCP server credentials, CLI tool environment). Existing 5 steps
> refactor into the same registry — no special-case path. Except
> register-in-registry stays as a setlist-internal step, not a
> user-droppable primitive.

**Decisions captured:**
- **Three primitive shapes for v1** [CONFIRMED]:
  - `filesystem-op` — mkdir, cp, write file. Covers create-folder,
    copy-template, update-parent-gitignore.
  - `shell-command` — exec a local binary. Covers git-init and any
    user-defined CLI invocation. Auth lives in the shell environment
    (the same env the user's terminal sees).
  - `mcp-tool` — invoke a registered MCP tool by name with a parameter
    map. Covers Todoist (via `mcp__asst-tools__todoist_create_task` or
    similar) and any other third-party reach. Auth lives in the MCP
    server's own credential layer — setlist passes parameters, not
    secrets.
- **No `http-call` shape in v1** [CONFIRMED]. If the user wants to hit
  a REST API, they front it with an MCP server (or a shell command).
  This keeps setlist out of the secrets-management business entirely.
- **No secrets store in setlist** [CONFIRMED]. Setlist never stores or
  prompts for credentials. All authentication is delegated downward to
  the layer that already solved it.
- **Existing 5 steps refactor into the registry** [CONFIRMED]:
  - `create-folder` → `filesystem-op` (built-in)
  - `copy-template` → `filesystem-op` (built-in)
  - `git-init` → `shell-command` (built-in)
  - `update-parent-gitignore` → `filesystem-op` (built-in)
  - These four become first-class entries in the primitives registry,
    visible (read-only) in the Settings palette, and droppable into
    custom recipes.
- **`register-in-registry` stays internal** [CONFIRMED]. Always runs as
  part of the bootstrap engine, not as a user-droppable primitive. The
  user cannot remove it, reorder it relative to itself, or duplicate
  it. It is not exposed in the Settings palette.

**Implications for later phases:**
- Phase 3 (drag UX) needs to show: a palette of built-in + custom
  primitives, with shape badges (fs-op / shell / mcp-tool), and the
  existing 4 steps appearing as built-ins in that palette.
- Phase 4 (data model) needs: a `bootstrap_primitives` entity with
  `shape` discriminator and shape-specific param schemas; a recipe-
  ordering table linking project_types to ordered primitive
  invocations with bound parameters; `register-in-registry` modeled as
  an engine-step, not a primitive row.
- Phase 5 (failure semantics) needs to grapple with: an `mcp-tool`
  primitive that has already created a Todoist project when a later
  `filesystem-op` fails — what does rollback mean across primitive
  shapes? (Deferred to Phase 5.)
- Phase 6 (security): `shell-command` is the load-bearing surface — it
  runs arbitrary local binaries with the user's environment. Sandbox
  considerations belong in `#hard-constraints` (4.3).

### Phase 3: What Could Go Wrong? — COMPLETE

**Forcing question:** UX surface for primitives authoring — where does the
user actually live when composing a recipe? Same dialog as the type editor,
peer Settings panel, or modal palette overlay?

**User answers (verbatim, paraphrased to decisions):**
> Peer Settings panel for primitives authoring, sibling to Areas / Project
> types / View. Recipe list shows name + collapsed param summary per step.
> Drag handle on the left, remove on the right, `+ Add step` button at the
> bottom.

**Decisions captured:**
- **Peer Settings panel** [CONFIRMED] — Primitives authoring lives in its
  own Settings section, sibling to Areas / Project types / View / Bootstrap
  / Updates. Not nested inside the Type editor. Two surfaces: the
  Primitives panel (define and edit primitives themselves — name, shape,
  parameters), and the existing Project types panel (which now has a
  recipe-builder section that *uses* primitives from the Primitives panel).
- **Recipe row shape** [CONFIRMED] — Each step in a recipe renders as a
  single row: drag handle (left) + step name + collapsed parameter
  summary + remove button (right). Example: `[≡] Create folder · path:
  ~/Code/{project.name} [×]`. Click the row to expand and edit
  parameters; collapsed by default to keep the recipe scannable.
- **`+ Add step` button at the bottom** [CONFIRMED] — Adding a step opens
  a primitive picker (the catalog of available primitives, grouped by
  shape: Built-in / filesystem-op / shell-command / mcp-tool). Selecting
  one drops it as the new last row, ready for parameter editing.
- **Built-in vs custom distinction in the palette** [CONFIRMED implicit
  from Phase 2] — Built-ins (create-folder, copy-template, git-init,
  update-parent-gitignore) appear in the picker as read-only primitives:
  their *parameters* are editable per-recipe, but the primitive itself
  (its shape, its underlying command) cannot be modified. Custom
  primitives can be edited from the Primitives panel.

**Implications for later phases:**
- Phase 4 (failure semantics) — UX surface is settled, so failure
  reporting needs to map to the same recipe-row vocabulary the user
  composed in (e.g., "Step 4 of 5: Create Todoist project — failed").
- Phase 5 (data model + parameter binding) — collapsed param summary
  implies parameters need a stable, human-readable rendering. Template
  syntax (`{project.name}`) needs to be defined here, not deferred.
- Phase 6 (security) — `shell-command` editing UI must surface enough
  context (the actual command, its arguments) that the user can't
  accidentally compose a destructive primitive without seeing it.
- Phase 7 (validation) — pre-flight validation (Phase 4 territory) ties
  into the Primitives panel: a primitive that references an MCP tool
  not registered with the host should show a warning at edit time.

### Phase 4: What Does the User Expect? — COMPLETE

**Forcing question:** Failure handling when a step in a recipe fails mid-run
(atomic rollback / stop-and-report-resumable / continue-past-failures), plus
whether to add a dry-run capability.

**User answers (verbatim, paraphrased to decisions):**
> stop and report makes sense. worth having a dry run capability? combine them

**Decisions captured:**
- **(B) Stop and report, resumable** [CONFIRMED] — engine halts at failed
  step, leaves succeeded steps in place, surfaces "Step N of M failed:
  <step name>. <succeeded list>. The project is *not* yet registered in
  setlist." User options: **Retry** (re-run failed step + remaining),
  **Skip** (mark skipped, continue), **Abandon** (cleanup what setlist
  knows how to undo, never register).
- **Resume-from-failed-step on Retry** [CONFIRMED] — does not re-run
  succeeded shell-command / mcp-tool steps (would create duplicate
  Todoist projects, send duplicate API calls). Filesystem-op steps that
  succeeded are also not re-run.
- **Abandon cleanup is honest about scope** [CONFIRMED] — setlist undoes
  filesystem + git (the things it knows how to undo), explicitly leaves
  external side-effects (mcp-tool, shell-command) untouched, and shows
  the user a list: "Created folder X (cleaned up). Initialized git repo
  (cleaned up). Created Todoist project Y (left in place — clean up
  manually if needed)."
- **Pre-flight validation** [CONFIRMED] — runs before any step executes:
  required MCP servers reachable, referenced CLI commands on PATH,
  template paths exist, parameters resolve. Surfaces foreseeable
  failures before partial state.
- **Dry run + pre-flight combined** [CONFIRMED] — single capability,
  not two. Output is a per-step trace showing the resolved operation +
  pre-flight ✓/✗:
  ```
  Would create folder: ~/Code/space-tracker-v2 (pre-flight ✓)
  Would run shell-command: git init && ... (pre-flight ✓)
  Would call MCP tool mcp__asst-tools__todoist_create_task with: { name: "..." } (pre-flight ✗ — server not connected)
  ```
- **Two surfaces for dry run** [CONFIRMED] — `Dry run` button on the
  Bootstrap dialog (uses the project name typed into the form) and
  `Preview recipe` button on the Type editor's Steps section (uses
  `<example-name>` placeholder so authors can sanity-check after
  dragging in a step).

### Phase 5: Register-in-registry Visibility — COMPLETE

**Forcing question:** Should `register-in-registry` show as a
non-draggable trailer at the bottom of the Steps list, or be completely
hidden in the editor (surfaced only in dry-run output and bootstrap
traces)?

**User answer (verbatim):**
> A

**Decision captured:**
- **(A) Non-draggable trailer at the bottom of the Steps list**
  [CONFIRMED] — small differentiated row reading
  `[final, automatic] Register in setlist`. Cannot be moved or removed.
  Honest about what runs, consistent with the user's general preference
  for visible state.
- **Future hook deferred** — if post-register steps become desirable
  (e.g., "after registration, send a notification"), the trailer could
  become a *position* the user drags steps below. Not part of v1; the
  design does not structurally rule it out.

### Phase 6: Boundaries and References — captured implicitly

References shared: none. Implicit visual references the user did NOT
need (the conversation moved fast enough without them): iOS Shortcuts,
Raycast, Zapier. Boundaries / scope captured throughout phases 1–5.

### Phase 7: How Do We Know It's Done? — deferred to Scenario Crafter

The Scenario Crafter writes scenarios for: primitive authoring, recipe
composition, mcp-tool parameter mapping, shell-command primitives,
bootstrap-with-custom-recipe order, pre-flight validation surfacing
foreseeable failures, mid-run failure → stop and report → retry resume,
abandon cleanup honesty, dry run trace shape, register-trailer
visibility, recipe edits not affecting already-bootstrapped projects.

### Phase 8: Readiness Review — INTERVIEW COMPLETE

All five forcing questions resolved. No open decisions remain that the
Scenario Crafter or Spec Writer cannot answer from the captured context.
Status: **Complete**. Hand off to Scenario Crafter, then Spec Writer.

## Uncertainty Markers

### RESOLVED
- Failure semantics → (B) stop-and-report, resume-from-failed-step,
  honest abandon list. Phase 4.
- Pre-flight validation lives in the bootstrap engine and runs before
  any step. Combined with dry-run as a single capability. Phase 4.
- Register-in-registry visibility → non-draggable trailer at the bottom
  of the Steps list. Phase 5.

### OPEN (defer to Spec Writer / Scenario Crafter)
- Parameter-binding template syntax for `mcp-tool` and `shell-command`.
  Confirmed needed: `{project.name}`, `{project.path}` at minimum. Spec
  Writer pins down the full set and substitution rules.
- Sandboxing policy for `shell-command`. Spec Writer captures in
  `#hard-constraints` (4.3) — at minimum: runs as the user, in the
  project folder, with the user's shell environment, no privilege
  escalation; setlist does not sandbox.
- Idempotence semantics on Retry. Spec Writer's rules section spells
  out per-shape: `filesystem-op` SHOULD be idempotent (mkdir -p
  semantics, copy-template detects existing files); `shell-command`
  and `mcp-tool` are NOT re-run on retry-from-failed-step (only the
  failing step + remaining steps execute).
- MCP-tool palette source: enumerates tools registered with the *host
  MCP client* (Claude Code/Desktop), surfaced via the user's session.
  Spec Writer captures in `#connections` (3.4).

## References Shared
- (none yet)
