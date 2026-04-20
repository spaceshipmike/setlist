# Setlist — Changelog

## 2026-04-20T00:00:00Z — /fctry:review (structural renumbering: §5.5 → §5.4, porting demoted to §6.3) (0.17 → 0.18)
- Frontmatter: [modified] spec-version 0.17 → 0.18
- TOC: [structural] §5.5 `#native-binding-hygiene` promoted to §5.4; §5.4 `#porting` demoted to §6.3 `#porting` (renamed "Porting Strategy" → "Porting History"); aliases preserved
- `#native-binding-hygiene` (5.4, was 5.5): [structural] Renumbered only; content unchanged
- `#porting` (6.3, was 5.4): [structural+modified] Demoted from §5 Implementation Architecture to §6 Reference and Prior Art. Opening prose reframed: the Python→TypeScript port is complete and has evolved beyond parity; the module/test mapping tables remain as code-organization reference, not as an active "every Python test must pass" contract. Removed "every Python test, translated to TypeScript, must pass against @setlist/core" — contradicted §4.5 `#testing-discipline` which already replaced the 786-parity claim with the scenario holdout set. Closing note added: the test mapping is a translation reference only, not a passing-tests contract; see §4.5 for the actual correctness contract. Alias `#porting` preserved so prior cross-refs still resolve.
- Internal cross-refs: [modified] Two in-spec references to §5.5 `#native-binding-hygiene` (§4.5 `#testing-discipline` body + layer-protects-against table) updated to §5.4.
- Scenario cross-refs: [verified] S91-S96 cite `(5.4)` for `#native-binding-hygiene`; with the renumber, `(5.4)` is now correct. No scenario cites `#porting` or points at §5.4 in a porting context. No scenarios.md edits needed.
- Non-goals: no new normative claims added to the porting section; no content changes to `#native-binding-hygiene`; no other sections renumbered; all other aliases preserved.
(0 added, 3 modified, 0 removed, 2 structural)

## 2026-04-19T18:00:00Z — /fctry:evolve (testing discipline + native binding hygiene) (0.16 → 0.17)
- Frontmatter: [modified] spec-version 0.16 → 0.17; synopsis patterns augmented with `scenarios-as-contract`, `canaries-not-gates`, `narrow-ci-wide-local`, `edit-time-security-check`, `release-blocking-preflight`, `dual-abi-swap-and-restore`, `detect-and-recover-over-prevent`
- TOC: [structural] Added §4.5 "Testing Discipline" entry under §4; added §5.5 "Native Binding Hygiene" entry under §5
- `#testing-discipline` (4.5): [added] New subsection documenting the load-bearing invariant that scenarios are the contract and everything else in the test stack is an early-warning canary. CI scope narrowness is framed as intentional design, not drift (typecheck + unit + build on every PR; E2E and pre-flight ABI check deliberately local-only). Electron security posture (`nodeIntegration: false`, `contextIsolation: true`) documented as a hard guarantee with automated edit-time enforcement, cross-referenced to §4.3 `#hard-constraints`. Pre-flight ABI check documented as release-blocking for packaged builds (same severity class as missing signing credentials in §4.3) and advisory during local development. Layer-protects-against table added to make canary/truth distinction legible. Cross-references §5.5 `#native-binding-hygiene` for the dual-ABI backstory.
- `#native-binding-hygiene` (5.5): [added] New subsection documenting the load-bearing invariant that Claude Desktop's setlist integration never silently breaks. Explains why dual ABIs are necessary (standalone Node 22 vs. Electron's embedded Node; monorepo hoist forces single-binary exclusivity). Swap/cache mechanism documented (`packages/app/scripts/with-electron-abi.sh` wraps dev/build/preview/start; trap-based restore on EXIT/INT/TERM; `native-cache/` holds both binaries; swap is a copy, not a rebuild). Codesign re-signing documented as a hard macOS requirement (`codesign --force -s -` on every swap to avoid `EXC_BAD_ACCESS` and vitest `ERR_IPC_CHANNEL_CLOSED` / exit 137). Startup ABI warning framed as a first-class first-class guarantee — detection is what makes the invariant observable; the warning names the one-line recovery command `npm run sqlite:node -w packages/app`. Known limitation called out explicitly: SIGKILL, OOM kills, and power loss bypass the trap; invariant still holds because detection + recovery exist, not because automatic restore does. 2026-04-19 session named as live evidence of the recovery path working. Cross-references §5.3 `#ts-decisions`, §5.1 `#monorepo`, §4.5 `#testing-discipline`, §4.3 `#hard-constraints`.
- `#what-this-is` (1.2) intro paragraph (line 25): [modified] Removed the stale "786 Python tests define the behavioral contract to port against" claim. Replaced with honest framing: behavioral contract is carried by the 96-scenario holdout set in `.fctry/scenarios.md` (evaluated by LLM-as-judge); vitest is available for targeted unit tests against @setlist/core but is not the truth signal.
- `#success` (1.4): [modified] "TypeScript tests (vitest) cover all behavioral categories from the 786 Python tests" bullet replaced with honest framing pointing to the scenario holdout set and §4.5 `#testing-discipline`; vitest reframed as optional unit-level canary.
- `#scope` (4.1): [modified] "Porting strategy from the 786 Python tests" bullet updated to "Porting strategy from the Python implementation's behavioral surface (scenarios as contract; vitest as optional unit-level canary — see §4.5 `#testing-discipline`)".
- `#ts-decisions` (5.3): [modified] **Testing.** paragraph rewritten. Old text asserted vitest covers all 786 Python tests with S01-S30 scenario coverage. New text names scenarios as the correctness carrier (96 as of 0.17, LLM-as-judge), reframes vitest as a targeted canary, retains the pytest-to-vitest translation guidance without implying a 1:1 port is required.
- `#satisfaction` (7.1): [modified] Satisfaction bullet for TypeScript tests updated — scenarios are now the satisfaction criterion; vitest coverage of @setlist/core is optional.
- Appendix C (deferred futures): [modified] Python implementation deprecation bullet updated — "full parity" now refers to scenario holdout set pass rate (per §4.5 `#testing-discipline`) rather than "786 tests passing"; "34 MCP tools" corrected to "36 MCP tools" (stale count from pre-v0.13 state).
- Scenario set size: references to the holdout set's size (previously "80 scenarios" implicit, surfaced in intro and §5.3) now say "96 scenarios" (S91-S96 added by the Scenario Crafter in the same evolve; S81-S90 added in a prior pass).
- Numbering note: the user's instructions named the new subsections §4.5 and §5.4 `#native-binding-hygiene`. §5.4 `#porting` already exists and the preserve-aliases constraint forbids renumbering, so `#native-binding-hygiene` was placed at §5.5. The alias is as requested; only the numeric prefix differs from the instruction. All existing aliases preserved; no sections removed.
- Non-goals (out of scope for this evolve): changing the CI configuration itself; changing the swap-script implementation; covering the pre-flight check in new scenarios beyond S91-S96; introducing automatic ABI restoration across SIGKILL/OOM/power-loss paths (explicitly named as deferred limitation, not a future); adding a Windows/Linux dual-ABI story.
(2 added, 7 modified, 0 removed)

## 2026-04-19T12:00:00Z — /fctry:review apply (consolidate memory aspirations, editorial fixes, D14 capability self-registration gap) (0.15 → 0.16)
<!--
review-trace:
  findings_applied: 3 lead-recommendation clusters (aspirations consolidation, editorial fixes, D14 capability gap)
  orphans_deferred: 2 (native-ABI/security tooling, E2E harness)
  orphans_dropped: 1 (data-migration scripts; user elected to leave out of spec)
  drift_resolved: FTS5-only vs. vector-aspirations framing; v8→v9→v10 narrative brought to v11; monorepo tree brought back to reality; §2.4 TOC gap; setlist self-registration acknowledged as known gap
-->
- Frontmatter: [modified] spec-version 0.15 → 0.16
- TOC: [structural] Added §2.4 "Structured Project Profile" entry (was missing); added §2.12.1 "Deferred Aspirations" entry under §2.12 Portfolio Memory
- `#portfolio-memory` (2.12): [modified] Rewrote main body to describe **what ships today** accurately: FTS5 full-text search, `retain`/`recall`/`feedback` three-verb API, triple-gate stale-memory archival, belief classification, temporal validity fields, entity storage, procedural versioning, four-level scoping with area bubble-up. Recall-legs paragraph retracted from "three parallel legs + RRF" to "FTS5 keyword match today, fuller picture is aspirational." Query-intent classifier explicitly marked as no-op (wired in code, but weight fusion requires legs that do not exist). Reflection operations count adjusted from six to five shipping operations; gap detection, hierarchical compaction trees, and knowledge distillation moved out of the reflection body into the new deferred-aspirations subsection. sqlite-vec fourth-tier paragraph retracted from "when loaded, runs native KNN" to a forward-reference only. All pre-existing pattern studies (EngramMemory / mindbank / lerim-cli / Phantom) remain as-is — they were already honestly framed.
- `#deferred-aspirations` (2.12.1): [added] New subsection consolidating all 7 studied-not-built memory behaviors into a single explicit home, each tagged with `Status: studied, not built. Gated on: embedding-tier decision.` Items: progressive delivery (D2), query-intent weight fusion (D3), type-priority budget allocation (D4), sqlite-vec fourth tier (D5), gap detection (D6), hierarchical compaction trees (D7), knowledge distillation (D8). Closes with an explicit "What ships today" summary reiterating the current FTS5-only, no-vector, no-graph, no-RRF posture and noting the dual-column embedding schema is prepositioned.
- `#capability-declarations` (2.11): [modified] Added **Known gap: setlist does not self-register** paragraph acknowledging setlist's own 36 MCP tools are not declared via `register_capabilities` (no capabilities.json seed, no bootstrap call, no post-build hook). Framed as recognized gap, resolution deferred. (D14)
- `#rules` (3.3): [modified] Two rules rewritten from assertions-as-if-built to honest forward-references: query-intent classifier is now a no-op pending legs; type-priority budget allocation is a studied future behavior, not a current rule. Both point to §2.12 `#deferred-aspirations`.
- `#scope` (4.1): [modified] Schema-evolution line brought from "v8 through v9 to v10" up to v11 (adds canonical areas table, area_id, parent_project_id, area_of_focus retirement). Resolves internal inconsistency with §4.3 and §5.2 which already named v11.
- `#anti-patterns` (4.4): [modified] Schema-evolution path string updated from "v8→v9→v10" to "v8→v9→v10→v11"; v11 area_of_focus → project + canonical-area reclassification added alongside v10's skill → procedural migration as examples of incremental table-recreate data migrations.
- `#monorepo` (5.1): [modified] `packages/app/src/main/` tree expanded from 2 files (index, ipc) to the actual 6 (adds auto-update.ts, menu.ts, prefs.ts, quit-prompt.ts) with one-line descriptions; `packages/cli/src/worker.ts` was already present and confirmed; added `packages/app/build/`, `packages/app/e2e/`, `packages/app/scripts/`, `packages/app/electron-builder.yml`, and `packages/app/native-cache/` (gitignored) to the @setlist/app subtree to match what is actually in the repo.
- Honesty guardrail: [structural] Main §2.12 body no longer narrates any of the 7 deferred behaviors as current. Every forward-reference explicitly calls out "studied, not built." Deferred-aspirations block uses the same "Status / Gated on" format already established for EngramMemory and OpenKL pattern studies in §6.1. Drift does not deepen: the aspirations are now collected in one place where the user can audit, prune, or promote them as a block when the embedding-tier decision is made.
- Non-goals (out of scope for this review-apply): resolving the embedding-tier decision itself; committing to any of the 7 deferred aspirations; evolving §5.x to cover native-ABI/security tooling (deferred to future evolve); evolving §4.x to cover the E2E harness (deferred to future evolve); adding data-migration-script coverage (user elected to leave out).
- Deferred-alias inventory (for future agents): `#deferred-aspirations` (2.12.1) is the new canonical home for memory aspirations; future evolves should add to this block rather than re-scattering items through §2.12.
(1 added, 8 modified, 0 removed)

## 2026-04-19T00:00:00Z — /fctry:ref (4 pattern studies: contradiction detection, sync/maintain/ask, temporal versioning endpoint, wake-up snapshot) (0.14 → 0.15)
<!--
research-trace:
  sources_visited: 4
  patterns_extracted: 4
  patterns_adopted: 4
  patterns_rejected: 3  (workspace-shared memory, session-adapter abstraction [deferred], markdown-only storage)
  discard_rate: 25%  (3 rejected out of 12 patterns considered across the 4 sources per state.json refPatterns; adopted here = 4 confirmed pattern studies)
  sources:
    - https://github.com/agentscreator/engram-memory
    - https://github.com/lerim-dev/lerim-cli
    - https://github.com/spfcraze/mindbank  (2 patterns sourced from same repo)
-->
- Frontmatter: [modified] spec-version 0.14 → 0.15, date 2026-04-19
- `#portfolio-memory` (2.12): [modified] Added **contradiction detection across the committed corpus** pattern study (source: agentscreator/engram-memory). Proactively surfacing semantic conflicts between committed beliefs before an agent acts on stale info; extends belief classification with a pre-action detection signal. Explicitly gated on the unresolved embedding-tier decision (vector/RRF/progressive-delivery). Not adopted; no implementation scope committed.
- `#portfolio-memory` (2.12): [modified] Added **temporal versioning with soft-delete and history endpoint** pattern study (source: spfcraze/mindbank). Every update becomes a new version row; `valid_to` on the superseded row (soft-delete, non-destructive); explicit history endpoint for the version chain. Hardens setlist's already-declared valid_from/valid_until fields with concrete endpoint shapes. Open question: dedicated `memory_history` MCP tool vs. extending `inspect_memory`. Scope TBD.
- `#async-worker` (2.8): [modified] Added **sync / maintain / ask job-catalog** pattern study (source: lerim-dev/lerim-cli). Three-flow split for the background worker — sync (extract from transcripts), maintain (consolidate/dedupe/archive on idle), ask (serve queries). Candidate shaping lens for the next evolve that touches the worker. Open question: overlap with the already-specified Chorus-populates-entities pattern, and whether `maintain` meaningfully differs from reflection. Scope TBD.
- `#querying` (2.3): [modified] Added **wake-up context snapshot** pattern study (source: spfcraze/mindbank). Pre-compute a small "what matters right now" bundle at session start rather than recomputing `portfolio_brief` from scratch each call. Open question: cache-invalidation trigger (on every retain / scheduled / explicit refresh). Cross-referenced from §3.5.
- `#performance` (3.5): [modified] Added brief cross-reference note pointing to the §2.3 wake-up-snapshot pattern study. No current latency target for `portfolio_brief` is committed; today's behavior (from-scratch assembly per call) stands unchanged.
- `#inspirations` (6.1): [modified] Added three new repo entries: `agentscreator/engram-memory` (contradiction detection; workspace-shared memory **rejected** as out of scope for single-user local-first setlist); `lerim-dev/lerim-cli` (sync/maintain/ask; session-adapter abstraction **deferred**; markdown-only storage **rejected** as contradicting §5.3 ts-decisions); `spfcraze/mindbank` (temporal versioning + history endpoint; wake-up snapshot). All three are pattern studies, not adopted as dependencies.
- Honesty guardrail: [structural] Every new entry explicitly frames itself as an open question, not a commitment. Pattern 1 (contradiction detection) is gated on the same embedding-tier decision as the existing aspirational vector/RRF/progressive-delivery drift in §2.12 — incorporation does **not** deepen that drift. Patterns 2–4 are scope-TBD pattern studies with named open questions. No implementation work is implied by this ref.
- Non-goals (out of scope for this ref): resolving the FTS5-only-vs-vector drift in §2.12; committing to any of the 4 patterns; restructuring the async worker; introducing a `memory_history` MCP tool or a `portfolio_brief` cache; adopting any of the 4 source repos as dependencies.
(0 added, 6 modified, 0 removed)

## 2026-04-16T12:00:00Z — /fctry:evolve auto-update (0.13 → 0.14)
- Frontmatter: [modified] spec-version 0.13 → 0.14; synopsis short/medium updated to call out auto-update + two channels; tech-stack adds `electron-updater`; patterns add `signed-notarized-builds`, `silent-download-prompt-before-install`, `two-channel-release`; goals add `auto-update-with-channels`
- `#auto-update` (2.14.1): [added] New subsection inside §2.14 describing the auto-update experience — two user-selectable channels (stable/beta, stable default), Settings › Updates section (channel toggle, current version, Check now button, status line), About dialog (version + build date + channel), Check for Updates… app menu item, silent background download, toast on update downloaded with Quit-and-install action, confirmation prompt on user-initiated quit (install or skip, never forced), failures surfaced only in the Settings status line, no telemetry
- `#hard-constraints` (4.3): [modified] New bullet requiring release builds to be signed with a Developer ID certificate and notarized by Apple; calls out that any `notarize: false` override in `packages/app/electron-builder.yml` is incorrect and must be reversed before a release channel ships
- `#ts-decisions` (5.3): [modified] New paragraph noting auto-update is delivered by `electron-updater` against GitHub Releases, with stable/beta channels mapping to prerelease tag flags
- TOC: [structural] Added 2.14.1 Auto-Update entry under 2.14 Desktop Control Panel
- Non-goals (out of scope for this evolve): Windows/Linux update flows; rollback UI; delta updates; a dedicated update log file; forced-install policy
(1 added, 4 modified, 0 removed)

## 2026-04-15T18:00:00Z — /fctry:evolve (canonical areas + sub-projects, schema v11)
- Frontmatter: [modified] spec-version 0.12 → 0.13; synopsis short/medium/readme updated; tech-stack and goals augmented
- `#registration` (2.2): [modified] Core identity fields 6 → 7 (adds `area`); optional `parent_project` declared as a structural edge; registerProject signature gains area + parentProject
- `#querying` (2.3): [modified] Filter set gains `area` (literal, no descendant inheritance); `__unassigned__` sentinel introduced; type filter notes `project`-only
- `#project-profile` (2.4): [modified] "Profile is not area" clarification — area is a structural column, written via set_project_area, not enrich_project
- `#error-handling` (2.5.1): [modified] Table adds INVALID_AREA, PARENT_CYCLE (with exact message), and parent-not-found rows
- `#project-bootstrap` (2.13): [modified] bootstrap_project accepts area + parent_project; area_of_focus bootstrap variant retired
- `#desktop-app` (2.14): [modified] Home view replaced with grouped lanes (7 canonical areas + Unassigned), collapsible; Unassigned lane visually distinct with inline "Assign an area" nudge; sub-project treatment (24px indent + 1px connector, cross-area `↳ parent-name` caption); multi-select filter chips per area
- `#entities` (3.2): [modified] Areas added as first-class entity with seeded 7-row `areas` table; sub-project relationships added as structural edge; core identity field count 6 → 7 (+ optional parent edge); Areas of focus entry rewritten as retired; templates reduced from 3 to 2
- `#rules` (3.3): [modified] Project type narrowed to `project` (area_of_focus retired); area must be one of 7 canonical values or null (nullable forever); cycle prevention rule with exact error message; parent-is-project-not-area rule; archive-parent-does-not-cascade rule; four-level memory scope rule updated to include area-based inheritance (area scope flows to all projects sharing an area_id); MemoryScope enum retires `area_of_focus` and gains `area`
- `#hard-constraints` (4.3): [modified] Schema evolution entry extended through v11; tool count 34 → 36 (adds set_project_area, set_parent_project)
- `#schema` (5.2): [modified] Schema bumped 10 → 11; 19 tables (adds `areas`); projects.area_id and projects.parent_project_id DDL documented; full v10→v11 migration plan added (8 steps: seed areas, add columns, reclassify msq-advisory-board → Work and fam-estate-planning → Family, narrow type CHECK, migrate knowmarks↔knowmarks-ios entity soft-link to parent_project_id, remap memories.scope, retire area_of_focus template, bump schema_meta)
- `#ts-decisions` (5.3): [modified] Project interface gains area/parentProjectId/children; new `AreaName` union type; `MemoryScope` retires `area_of_focus`, gains `area`
- Appendix B Glossary: [added] Area, Schema v11, Sub-project, Canonical area set, retired `area_of_focus` disambiguation entries
- Appendix D MCP Tool Reference: [modified] Header updated to 36 tools; `register_project`/`update_project`/`bootstrap_project` gain area + parent_project params; `list_projects`/`search_projects`/`cross_query`/`batch_update` gain area filter; `get_project` returns area + parent_project + children; `get_registry_stats` surfaces per-area distribution + unassigned count; `archive_project` clarifies no-cascade behavior; `rename_project` notes parent_project_id back-references are updated; `enrich_project` explicitly does NOT accept area; [added] `set_project_area` and `set_parent_project` rows
- Straggler tool-count references across §5.1, §3.1, §3.4, §5.4, §7.x, Appendix B normalized from 32/34 → 36
- Non-goals (out of scope for this evolve): todoist sync; renaming the `area_of_focus` identifier anywhere it's historically referenced (schema migration, memory scope) beyond the v11 retirement; removing the free-form `entities` profile field
(2 added, 14 modified, 0 removed)

## 2026-04-15T12:00:00Z — /fctry:review (v0.12 hygiene reconciliation)
- `#enrichment` (2.5) / `#error-handling`: [structural] Demoted duplicate §2.5 "What Happens When Things Go Wrong" to §2.5.1 as a subsection of Field Enrichment; TOC updated; alias `#error-handling` preserved
- `#anti-patterns` (4.4): [modified] Tool count reference 32 → 34
- `#monorepo` (5.1): [modified] `server.ts` comment 32 → 34 tool definitions; renderer tree updated from `pages/` (Home, ProjectDetail) to `views/` (HomeView, ProjectDetailView, SettingsView) with new `hooks/` and `lib/` entries
- `#appendix-d` (D): [modified] `assess_health` row adds `fresh?` parameter with cache-bypass note; `configure_bootstrap` row renames `type_path_roots` → `path_roots` and adds `archive_path_root?`
- `#health-assessment` (2.15): [modified] "How often it's computed" paragraph mentions `fresh=true` cache-bypass escape hatch
- Code: [modified] `packages/mcp/src/server.ts` exposes `archive_path_root` in `configure_bootstrap` schema and forwards it to `bootstrapManager.configureBootstrap` (was dropped between IPC handler and MCP surface)
- Hygiene drift fix only — no behavior change, no spec version bump beyond 0.12 already set by OpenKL ref
(0 added, 6 modified, 0 removed)

## 2026-04-15T00:00:00Z — /fctry:ref (OpenKL pattern study)
- `#inspirations` (6.1): [modified] Added nowledge-co/OpenKL reference (knowmark 14312, Tier 2 pattern study, not adopted). Catalogs four patterns relevant to setlist's memory layer: memory vs grounding-store separation, first-class memory-distillation prompts, citations with retention classes / verify+open ops, and multi-surface hybrid search. Framed as open questions only — no scope expansion.
- Frontmatter: [modified] spec-version 0.11 → 0.12, date 2026-04-15
- Scope guardrail: explicitly pattern study; setlist's flat 10-type memory model and single-surface hybrid recall remain unchanged
(0 added, 2 modified, 0 removed)

## 2026-04-14T16:30:00Z — /fctry:evolve (project health assessment)
- `#health-assessment` (2.15): [added] New section introducing composite project health assessment — four qualitative tiers (Healthy / At risk / Stale / Unknown), worst-tier-wins composition across three dimensions (activity, completeness, outcomes), on-demand computation with brief cache, and the `assess_health` MCP tool
- `#desktop-app` (2.14): [modified] Card grid now shows a colored health dot alongside the status indicator; Overview tab gains a Health section showing tier, per-dimension breakdown, and reasons
- `#appendix-d` (D): [modified] Added `assess_health` tool reference row and Health category; tool count 33 → 34
- Synopsis: [modified] Added health assessment to medium description and three new pattern/goal entries (worst-tier-wins, on-demand-assessment, qualitative-tiers / project-health-assessment, composite-tier-surfacing, glanceable-portfolio-health)
- Scenarios: [added] S65–S70 covering composite tier, activity buckets, completeness criteria, outcome-based health, `assess_health` tool, and home-view/detail-view surfacing
- Frontmatter: [modified] spec-version 0.10 → 0.11, date 2026-04-14
(1 added, 4 modified, 0 removed)

## 2026-04-13T00:00:00Z — /fctry:ref (EngramMemory pattern study)
- `#portfolio-memory` (2.12): [modified] Added "Pattern study: tiered recall and activation-based reinforcement" note — ACT-R activation curves, hot-tier cache, LSH-on-Matryoshka-prefix as open questions, not commitments
- `#inspirations` (6.1): [added] Engram Memory reference (Tier 2 pattern study) with latency characteristics and open questions informed
- Frontmatter: [modified] spec-version 0.9 → 0.10, date 2026-04-13
- Scope guardrail: explicitly framed as pattern study; setlist remains a project registry with memory, not a general-purpose memory engine
(1 added, 3 modified, 0 removed)

## 2026-04-11T20:50:00Z — /fctry:review (drift reconciliation)
- `#what-this-is` (1.2): [modified] Fixed tool count 32 → 33, added `enrich_project` to Setlist-specific additions
- `#desktop-app` (2.14): [modified] Documented multiselect status filtering and archived-by-default behavior
- `#appendix-d` (D): [modified] Added `enrich_project` to tool reference table, fixed tool count
- Synopsis: [modified] Updated readme description to mention multiselect filtering
- All references: [modified] "32 MCP tools" → "33 MCP tools" throughout spec
- CLAUDE.md: [modified] Fixed tool count (33), scenario count (64, S01-S64), added S45-S64 app scenario category, updated compact instructions
(0 added, 6 modified, 0 removed)

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
