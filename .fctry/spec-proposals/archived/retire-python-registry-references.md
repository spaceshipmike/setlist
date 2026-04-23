# Proposal: Retire Python Project-Registry-Service References

**Date:** 2026-04-22
**Status:** ACCEPTED — incorporated into spec 0.19 (2026-04-22). See changelog entry for enumerated edits. Retained for historical reasoning.
**Affects:** Synopsis block, §1 (Why This Exists), §2.1–2.3 (package layout), §2.4 (storage contract), §3 (interface and behavior), §4 (constraints), §5 (schema and migration), §Appendix A (module mapping)
**Depends on / blocks:** Should land before `project-essence-digest.md` so the first generated digest doesn't inherit stale Python-co-implementation claims

## Problem

Setlist's spec still treats the Python `project-registry-service` as a live co-implementation — a second process that reads and writes the same SQLite database. That was true during the port. It is no longer true.

**Observed current state (2026-04-22):**
- Only `setlist` (the TypeScript MCP server) is wired in `~/.claude.json` for any active environment.
- `~/Code/project-registry-service/` still exists on disk (730 Python files, last touched 2026-04-04) but nothing invokes it.
- No process is reading or writing the shared `.db` file other than Setlist.
- Setlist has evolved 3 schema versions (v9, v10, v11) beyond the Python implementation's v8. The "shared contract" is one-way in practice — forward-only, with no reader on the Python side.

**The spec hasn't caught up to this.** Claims like "both implementations read and write the same database," "drop-in replacement for the Python server," and "27 Python-compatible tools plus 9 Setlist additions" frame the Python registry as an active peer. They're load-bearing *nowhere* (nothing downstream depends on Python compatibility) and mislead anyone reading the spec about what Setlist is today.

This also leaked into derivative work: the first generated project essence digest (see companion proposal `project-essence-digest.md`) carried forward "the Python implementation remains at schema v8" as if it were a current operational constraint. It isn't.

## Design Decisions

1. **Declare the Python registry retired in-spec.** A single short section (proposed: §1.5 or a tail note in §1) states that the Python `project-registry-service` is retired as a runtime. Setlist is the sole active implementation of the registry. The shared-database contract no longer has a second party.

2. **Keep one short History subsection, prune everywhere else.** The port-from-Python origin is legitimate provenance and worth preserving in one place — a named subsection like §1.5 "Origin and Port History" or §6 "History." Every other mention in the spec body treats "Python" as active operational context and gets pruned or rephrased.

3. **Simplify tool counting.** Framings like "the original 27 Python-compatible tools plus 9 Setlist additions" collapse to "36 MCP tools." The breakdown by Python-parity was useful during the port; it carries no ongoing meaning. A short enumeration of the 9 tools that came with the TypeScript rewrite (enrich_project, write_fields, portfolio_brief, rename_project, bootstrap_project, configure_bootstrap, assess_health, set_project_area, set_parent_project) can live in the History subsection if worth keeping at all.

4. **Schema lineage condenses.** "Setlist's schema extends Python's v8 through v9 (observation), v10 (unified memory types), v11 (canonical areas)" → "Schema is at v11 (canonical areas)." Earlier versions are migration history, not identity. Migration steps already live in §5 and can keep their version numbers without leaning on "Python was at v8" as the anchor.

5. **Keep the module-mapping appendix.** Appendix A's Python→TypeScript module table is already labeled as retrospective reference material. It stays as-is. Anyone reading Python source to understand the TS layout will still find it useful. (No wasted cleanup work.)

6. **"Same as Python spec" compound references.** Phrases like "All design principles from the Python spec apply identically" and "Same as Python spec" under Anti-Patterns and Inspirations push the reader to a document that is no longer the source of truth. These should be **inlined** — the actual constraint/anti-pattern/inspiration makes it into Setlist's spec as a first-class entry. This is the largest surgery in the proposal and the one most likely to expand scope; see Open Question 1.

7. **Archive-on-disk is out of scope for this proposal.** Whether to move `~/Code/project-registry-service/` to `~/Archive/` is a user decision (per root CLAUDE.md: "Never archive, delete, or move project folders without explicit human confirmation"). This proposal only changes Setlist's spec; any disk-level archival is a separate, explicit action.

## Specific Edits

### Synopsis block (lines 8–22)
- **Remove** `experience-source: project-registry-service/.fctry/spec.md (v1.3)` — keep `experience-ported from project-registry-service` in `author:` as origin provenance, OR move provenance into the new History subsection and drop from frontmatter.
- **Rewrite** the `readme:` sentence ending "though the Python implementation remains at schema v8" — drop the subclause.

### Line 23 opening paragraph
- **Rewrite** "Originally a direct port of the Python project-registry-service, it has since evolved beyond parity: schema v11 ..." → "Setlist is the TypeScript implementation of the Project Registry. Schema v11 ..." Origin and port history move to §1.5.
- **Remove** "The .db file is the shared contract — both implementations read and write the same database, though the Python implementation remains at schema v8."

### §1 (Why This Exists), line 96
- **Rewrite** "The Python project-registry-service solved this problem. But the ecosystem has moved toward Node.js-based tools..." → either drop (the "why Setlist exists" is now obvious without the contrast) or compress to one sentence acknowledging origin. Add new §1.5 "Origin and Port History" with the one-paragraph narrative of where Setlist came from.

### §2.1–2.3 (package layout), line 106
- **Rewrite** "The original 27 tools match the Python server identically" → "The 9 tools introduced with the TypeScript rewrite are `enrich_project`, ..." (or drop the breakdown entirely).

### §2.4 (storage contract), line 112
- **Rewrite** "The database file is the shared contract between Setlist, the Python implementation, and any tool that opens it directly." → "The database file is Setlist's canonical storage at `~/.local/share/project-registry/registry.db`. Library consumers (Chorus, Ensemble) import `@setlist/core` rather than opening the file directly."

### §3 (interface and behavior)
- **Line 116:** drop "All design principles from the Python spec apply identically" — inline the principles it refers to (see Open Question 1 for scope).
- **Line 142:** "Everything from the Python spec's success criteria, plus:" — inline the criteria; drop the reference.
- **Lines 146, 148:** drop the "drop-in replacement for the Python MCP server" and "Both Python and TypeScript implementations can read and write the same .db file" statements — they describe a contract that no longer has a second party.
- **Line 149:** "Behavioral parity with the Python predecessor is validated through the scenario holdout set" — drop "with the Python predecessor"; scenarios validate current behavior, not historical parity.

### §4 (constraints)
- **Line 1236:** "All Python spec hard constraints apply, plus:" — inline.
- **Line 1240–1242:** compress schema-lineage language; drop the claims about Python's forward-compatibility with v11 reads (they describe behavior that won't happen).
- **Line 1252:** "No per-project manifest files. Same as Python spec." → "No per-project manifest files. The central SQLite database is the sole storage mechanism."
- **Line 1256:** "All Python spec anti-patterns apply, plus:" — inline.

### §5 (schema and migration), line 1362
- **Rewrite** "The SQLite schema v11 is the current schema. It extends the Python implementation's v8 through three evolution steps..." → "Schema v11 is the current schema. Evolution history: v9 added `observation`, v10 added unified memory types and chorus-compatible fields, v11 introduces canonical areas. See §5.2 for migration details."
- **Line 1385:** drop "Indexes, constraints, and triggers from v8 must match the Python implementation exactly" — Python is no longer an active target. Keep the v11 additions note.
- **Line 1398:** drop "The Python implementation at v8 continues to read its own columns and ignores the new ones" — not operative.

### §6 or §1.5 (new) — "Origin and Port History"
Short subsection (~1 paragraph). Proposed content:
> Setlist originated as a TypeScript port of `project-registry-service`, a Python implementation that served the registry role through spec 1.3 and schema v8. The port landed at full behavioral parity (27 MCP tools, schema v8-compatible), then evolved: schema v11, 36 MCP tools, area-scoped memory inheritance, composite project health assessment, and the Electron control panel. The Python implementation is retired as a runtime as of this spec version; the Python→TypeScript module map remains as Appendix A for anyone tracing behavioral lineage. The shared-database claim in earlier spec versions (0.17 and prior) reflected the port period and no longer describes current operation.

### Appendix A (line 1540+)
- **No changes.** Already correctly framed as historical reference. Adding a one-line header note ("retained as retrospective reference; the Python runtime is retired — see §1.5") makes the status unambiguous.

### §Inspirations (line 1488)
- **Rewrite** "All inspirations from the Python spec apply. Additional TypeScript-specific references:" → "Inspirations:" with the actual list inlined. (Currently the Python-spec list is imported by reference; inlining makes Setlist's spec self-contained.)

### §Ecosystem (line 1524)
- **Rewrite** "Same ecosystem as the Python spec (Archibald, ctx, Chorus, fctry, McPoyle, Knowmarks), with updated integration model" → list the current ecosystem consumers directly.

## Risks / Tradeoffs

- **Inlining "same as Python spec" clauses could expand scope.** If the Python spec has constraint/anti-pattern/inspiration entries that Setlist's spec doesn't restate, this proposal will grow as those get inlined. If scope gets uncomfortable, punt the inlining to a follow-up proposal and leave the "same as Python spec" references with a TODO marker.
- **Loss of explicit provenance.** Pruning port-era framing means a reader who wants to understand "why does Setlist exist?" gets a thinner answer. Mitigated by the new §1.5 History subsection — one paragraph is enough.
- **Derivative documents may break references.** Anything that cited section numbers in the old spec (e.g., a fctry build-trace) may drift. Low risk since most build-traces reference behavior, not section numbers.
- **Scenarios holdout set.** The 96 scenarios don't test "Python compatibility" as a behavior (verified in spec §4.5 language), so this proposal doesn't invalidate any scenarios. No scenario additions or removals required.

## Non-Goals

- Not archiving `project-registry-service/` on disk — separate user decision per root CLAUDE.md.
- Not dropping Appendix A (Python→TS module map) — legitimate reference material.
- Not deleting migration code that handles v8 → v9/v10/v11 — the migrations remain load-bearing for anyone opening a pre-v9 database; only the spec's *description* of Python as an active peer changes.
- Not changing any code or tests — this is a spec-only edit.
- Not modifying the digest proposal to depend on this — the digest proposal's "current-state only" prompt instruction handles the generator side independently.

## Open Questions

1. **How much of the "same as Python spec" inlining should this proposal absorb?** Two shapes:
   - **(a) Full inlining** — every "Python spec says X" gets inlined as a first-class Setlist spec entry. Bigger edit; result is a fully self-contained spec.
   - **(b) Minimum viable** — inline only where the Python spec is load-bearing for *current* behavior; mark the rest with TODO and a follow-up proposal. Smaller edit; leaves some residue.
   - Recommendation: **(b)**, since the goal here is spec hygiene, not rewriting setlist's spec from scratch.

2. **Should `project-registry-service/` on disk be archived now or later?** Out of scope for this proposal, but worth a decision — leaving 730 Python files in `~/Code/` alongside the active projects adds noise. Proposal recommendation: leave it; revisit when cleaning up the `~/Code/` tree holistically.

3. **Does Chorus or any other consumer still reference the Python MCP by name in its own specs or code?** A quick `rg "project-registry-service"` across `~/Code/` before landing this proposal would catch any external references that also need updating. Low-effort check.
