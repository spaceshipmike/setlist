# Proposal: Project Essence Digest

**Date:** 2026-04-22
**Status:** ACCEPTED — incorporated into spec 0.20 (2026-04-22). See changelog entry for enumerated edits. Retained for historical reasoning.
**Affects:** Schema (v11 → v12), Section 3.2 (Entities), Section 3.3 (Rules and Logic), MCP tool surface (36 → 39)
**Related:** §2.12.1 (embedding-tier decision) — the digest is a natural future input to any embedding path but does not require one
**Sequencing:** `retire-python-registry-references.md` should land first. The "current-state only" instruction in this proposal's generator flow is belt-and-suspenders; having a clean spec to read from is the primary defense against stale claims landing in digests.

## Problem

Setlist is the keeper of project identity across the portfolio. It already holds:

- **Per-project structured fields** — name, area, parent, goals, responsibilities, tech-stack, patterns
- **Per-capability declarations** — `project_capabilities` rows with name, type, description, inputs, outputs, audience

What it does **not** hold is a **free-form project essence blob** — a ~500–1000 token summary of what a project *is about* in a form suitable for embedding, semantic matching, or drop-in context for a cross-project question.

The orchestrator skill's ref flow (Step R2, queue-first) needs exactly this. Its `score_saves` call requires a `project_texts` map of `{project_name: free_form_text}` to run cosine similarity against knowmark content. With no digest available in setlist, the SKILL.md reaches around setlist entirely:

> *"For each active portfolio project, read its `.fctry/spec.md` (fallback: `CLAUDE.md`). Prefer the `#capabilities` section; otherwise use the first ~2000 characters."*
> — `.claude/skills/orchestrator/SKILL.md:300–303`

This is drift. Every `/orchestrator ref` scan reads 9 spec files from disk into Claude's context (~15–20k tokens per scan), bypassing the registry that's supposed to be the source of project identity. It also means no other consumer — chorus, fctry, ensemble — can ask setlist "what is project X about?" and get a usable answer.

## Design Decisions

1. **Digest as a first-class setlist surface.** Setlist gains a per-project `essence_digest` — a free-form text blob, 500–1500 tokens typical, suitable for embedding or drop-in context use. This sits alongside (not replacing) the structured `project_capabilities` table.

2. **Generation lives outside setlist.** Setlist stores digests and tracks their provenance (producer, source spec version, generation timestamp). It does not generate them. A separate generator — initially a CLI script that reads `.fctry/spec.md` and calls the home local LLM endpoint (`http://m4-pro.local:8000/v1`, `Qwen3.6-35B-A3B-8bit`) — writes the digest back via MCP. This preserves setlist's "pure data" posture and keeps LLM choice swappable.

3. **Versioned by spec version, not timestamp.** The digest carries the `spec_version` of the source spec at generation time. Consumers can detect staleness deterministically: if the project's current spec version differs from the digest's source version, the digest is stale. No arbitrary TTL.

4. **Explicit refresh, lazy stale signaling.** v1 ships explicit refresh only — `refresh_project_digest` is called by a generator CLI (`setlist digest refresh <project>` or `setlist digest refresh --all`). Reads return a `stale: bool` flag when source spec version has moved, but do not auto-regenerate. Automatic refresh on spec-version bump can come later if usage warrants.

5. **Single digest kind in v1; table shape allows future kinds.** One digest per project in v1 (kind `"essence"`). Schema allows multiple kinds per project (e.g., `"capabilities-focus"`, `"goals-focus"`) without further migration if demand emerges. YAGNI on day one.

6. **Consumer change lands in the orchestrator skill.** Step R2 of the ref flow stops reading spec files and calls `get_project_digests` instead. The SKILL.md edit is in scope of this proposal's acceptance but lives in the orchestrator skill repo, not setlist.

## Schema Impact (v11 → v12)

New table:

```sql
CREATE TABLE IF NOT EXISTS project_digests (
  project_id    INTEGER NOT NULL,
  digest_kind   TEXT NOT NULL DEFAULT 'essence',
  digest_text   TEXT NOT NULL,
  spec_version  TEXT NOT NULL,
  producer      TEXT NOT NULL,            -- e.g., "local-qwen3.6-35b-a3b", "manual"
  generated_at  TEXT NOT NULL,            -- ISO 8601
  token_count   INTEGER,                  -- advisory, for caller budgeting
  PRIMARY KEY (project_id, digest_kind),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_project_digests_project ON project_digests(project_id);
```

Migration:
- v11 → v12: create `project_digests` table (empty). No data migration — digests are generated on demand.
- `archive_project` already cascades via FK; no change needed.
- Reset behavior: dropping/recreating a project clears its digest row (cascade).

**Why a separate table, not columns on `projects`:**
- Keeps `projects` table lean; digest text can be multi-KB
- Allows multiple digest kinds per project without schema churn later
- Clean separation: `projects` = identity, `project_capabilities` = structured features, `project_digests` = free-form summaries

## MCP Tool Changes

**New tools (3):**

- **`get_project_digest`** — read a single project's digest.
  - Input: `{ project_name: string, digest_kind?: string = "essence" }`
  - Output: `{ digest_text, spec_version, producer, generated_at, token_count?, stale: bool }` or `null` if no digest exists.
  - `stale` is `true` when the project's current spec version (read from `projects.spec_version` or equivalent) differs from the digest's `spec_version`.

- **`get_project_digests`** — batch read for the common "gather project_texts map" use case.
  - Input: `{ project_names?: string[], digest_kind?: string = "essence", include_missing?: bool = false, include_stale?: bool = true }`
  - Output: `{ [project_name]: { digest_text, spec_version, stale } }` — missing projects omitted unless `include_missing=true`, in which case they appear with `digest_text: null`.

- **`refresh_project_digest`** — write path. Generator-only.
  - Input: `{ project_name, digest_kind?: "essence", digest_text, spec_version, producer, token_count? }`
  - Output: `{ project_name, digest_kind, written: true, prior_spec_version?: string }`
  - Replace semantics: one row per (project, kind); prior row is overwritten. Prior spec version returned so the generator can log drift.

**No changes to existing tools.** `query_capabilities` continues to serve structured capability queries; the two surfaces are complementary, not overlapping.

**Tool count:** 36 → 39.

## Generation Flow (out-of-setlist)

The generator is a separate concern — proposed as a CLI in `@setlist/cli` that any agent or script can invoke:

```
setlist digest refresh <project>     # regenerate one project
setlist digest refresh --all         # regenerate all active projects
setlist digest refresh --stale       # only projects whose digest's spec_version is outdated
```

Under the hood:
1. Read the project's `.fctry/spec.md` (fallback: `CLAUDE.md`, then project `README.md`).
2. Read current spec version from the spec's YAML frontmatter.
3. POST to `http://m4-pro.local:8000/v1/chat/completions` with a fixed prompt template. Minimum content requirements:
   - **Target 500–800 tokens.** Hard ceiling 1200 tokens; `refresh_project_digest` rejects writes above this with a trim-and-retry error.
   - **Describe current state only.** Omit historical context, port origins, retired peer implementations, and claims about deprecated or archived components unless they constrain current behavior. If the spec's synopsis contains port-era framing, the digest should reflect what the project *is today*, not what it *came from*.
   - **Factual and dense; no marketing voice.** Strip phrases like "at the center of the user's personal ecosystem," "directly operable," "invisible infrastructure" — claims should be concrete and capability-specific.
   - **Name unbuilt sections explicitly.** Refs are most valuable for unbuilt work (per the orchestrator SKILL.md), so the digest must call out what's specced-but-not-built.

   Prompt template lives in `@setlist/cli` and is versioned alongside the CLI.
4. Call `refresh_project_digest` with the returned text.

The LLM endpoint, prompt template, and token budget live in the CLI, not the MCP server. Swapping to a different local model or to Claude for a quality comparison is a CLI-side change.

## Consumer Changes (outside setlist)

- **orchestrator SKILL.md** — Step R2 (queue-first) replaces the "read every project's `.fctry/spec.md` ... build a map" block with a single `get_project_digests({include_stale: true})` call. Stale entries are still usable for scoring; the orchestrator surfaces a "N digests are stale — consider running `setlist digest refresh --stale`" advisory in its completion summary.
- Future consumers (chorus, fctry:ref, ensemble) inherit the same surface for free.

## Risks / Tradeoffs

- **Digest quality depends on the generator's LLM.** If Qwen3.6-35B-A3B misses a key capability, `score_saves` match quality suffers. Mitigation: `producer` field captures which model generated a digest, so A/B quality comparison is feasible. Upgrading the generator is a CLI change, not a schema change.
- **Drift between digest and spec.** Mitigated by `spec_version` tracking and the `stale` flag. Consumers can choose to tolerate stale digests (fast path) or require fresh (refresh first).
- **Three places to find "facts about a project"** (spec, capabilities table, digest). Clear separation of concerns (identity / structured features / free-form summary) keeps this from being an anti-pattern; single write path for each keeps them consistent.
- **Migration is additive** (new empty table). No rollback risk beyond dropping the table.
- **Scenario coverage.** The 96-scenario holdout set needs additions for digest read/write/stale paths. Estimated +3–5 scenarios.

## Non-Goals

- Not replacing `project_capabilities` — structured rows remain for dependency tracing and capability-typed queries.
- Not replacing spec.md — digest is derived; spec stays canonical.
- Not automatic generation on spec commit — explicit refresh in v1.
- Not defining embedding strategy — the digest is a natural input to any embedding path (see §2.12.1) but embedding choice remains that section's open question.
- Not a generalized "project card" — digest is free-form text, not a rendered view surface.

## Open Questions

1. **Should `get_project_digest` fall back to an on-the-fly generation if no row exists?** v1 answer: no. Read-only reads are predictable; generation is opt-in. Revisit if consumers complain.
2. **Should `refresh_project_digest` be writer-restricted?** v1 answer: no ACL; the tool is available to any MCP client. Low risk since digest is derivable and overwrites are cheap.
3. **Should digests have a content hash for dedup on refresh?** v1 answer: no — overwrite unconditionally. Caller logs prior spec version for audit.
