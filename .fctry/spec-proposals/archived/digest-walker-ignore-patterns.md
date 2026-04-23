---
name: Digest doc walker should respect ignore patterns
description: Walker traverses _Duplicates/, .venv/, node_modules/ etc., wasting docling OCR passes on copies and build artifacts
type: proposal
status: proposed
created: 2026-04-23
---

# Proposal: Ignore patterns for the digest document walker

**Affects:** `@setlist/cli` `extractProjectDocuments()` walker, possibly §3.3 (Digest generator rules) in spec

## Observed behavior

Refreshing `fam-estate-planning` ran docling OCR against every PDF under `~/Projects/fam-estate-planning/`, including `_Duplicates/DOCS-#953133-v1-(Copy)-…PDF` and similar archive folders. Total runtime ~17 minutes for ~80 PDFs, a meaningful fraction of which were known duplicates the human had already set aside.

For code projects the walker is one-level-deep and doesn't reach into `node_modules/` or `.venv/` by construction, so the problem is concentrated in non-code projects — but the underlying gap (no ignore mechanism) is general.

## Why it matters

- **Cost.** Each skipped PDF is a fresh `python3` subprocess + docling model load + OCR pass. At ~15 sec/PDF, duplicates directly extend wall-clock time and CPU on the host.
- **Signal.** Duplicates pad the concatenated source text with repeats of the same content. Flash-Lite's 1M window tolerates this, but the LLM weighs repeated content as more salient — a bias we didn't intend.
- **Generality.** The same problem exists for any folder the human has set aside: `_archive/`, `_old/`, `drafts/`, `_Duplicates/`, `backup/`, etc. A case-by-case skip list would fight convention.

## Resolution options

1. **Respect `.gitignore` when present.** Projects in `~/Code/` already carry one and it captures `node_modules`, `.venv`, `dist/`, build caches, etc. Reuse it as the filter. Natural fit for code projects; non-code projects typically don't have one, so this covers zero of the observed cases.
2. **Always skip underscore-prefixed folders** (`_Duplicates/`, `_archive/`, `_old/`). Convention in non-code projects; zero config. Doesn't help the `drafts/`, `backup/` cases. Recommended as the baseline — lowest-friction, highest-hit-rate rule.
3. **Project-local `.digestignore` file.** Gitignore-syntax file at project root, read by the walker. Most expressive; requires the human to author it per project. Better as a follow-up to (2), not a replacement.
4. **Combine: (2) by default + optional `.digestignore` for overrides.** Underscore-prefixed skip covers most archive folders; `.digestignore` handles the long tail without forcing every project to have one.

## Out of scope

- Content-hash dedup across extracted text (harder; may lose legitimate near-duplicates like "v1" and "v2" drafts).
- Per-file size caps on extraction (separate problem — not what surfaced here).
