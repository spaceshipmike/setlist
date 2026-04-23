---
name: Digest refresh — accept multiple projects per invocation
description: CLI command silently drops extra positional args; should process all or error loudly
type: proposal
status: proposed
created: 2026-04-23
---

# Proposal: `digest refresh` should accept multiple projects

**Affects:** `@setlist/cli` `digest refresh` command, possibly §3.3 (Digest generator rules) in spec

## Observed behavior

Invoked as `node dist/index.js digest refresh fam-estate-planning 41m-apartment-renovation msq-employment-contract` — CLI refreshed **only the first project** and reported `Done: 1 refreshed … (of 1 total)`. The two trailing names were silently dropped. Had to re-invoke for each remaining project.

## Why it matters

The `--all` flag covers every-project refreshes. The single-project form covers the common case. The **N-project form** — "refresh just these three that changed" — is the natural middle ground and is what someone would type after seeing the CLI accept a single positional arg. Silent drop is the worst failure mode: the user thinks they refreshed three things and walked away with one.

## Resolution options

1. **Accept multiple positional args.** Loop over them, surface per-project progress, sum in the "Done: N refreshed …" line. Matches how `git add`, `npm update`, etc. handle their positional args. Recommended.
2. **Error on extra args.** `Error: digest refresh takes one project name; use --all for portfolio-wide`. Makes the intended single-project contract explicit but costs the ergonomics of the first option.

Either is better than the current silent drop.

## Out of scope

- Parallelism across projects (docling is CPU/GPU-bound; hosted calls are rate-limited; serial is fine).
- A `--projects a,b,c` flag in addition to positional args.
