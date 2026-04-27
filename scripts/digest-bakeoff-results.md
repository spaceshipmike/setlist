# Setlist Digest Model Bake-Off

**Run:** 2026-04-27T13:36:12.273Z
**Method:** N=3 samples per (project × config). Recall = % of hand-labeled named features mentioned in the digest (case-insensitive substring match). Length is approximate token count vs the 500–800 target / 1200 ceiling defined in setlist's digest.ts.

**Fixtures:** knowmarks (10 features), fctry (10 features), orchestrator (10 features), ensemble (10 features)

## Per-Config Aggregate

| config | recall μ | recall σ | length compliance | errors |
|---|---|---|---|---|
| glm-4.7-flash@t0.2 (current prod) | 63.3% | 39.4pp | 5/12 | 3 |
| glm-4.7-flash@t0.0 | 83.3% | 14.4pp | 7/12 | 0 |
| flash-lite@t0.0 | 89.2% | 7.9pp | 0/12 | 0 |
| flash@t0.0 | 80.0% | 21.3pp | 3/12 | 0 |
| glm-4.7-flash@t0.0+propernoun | 84.2% | 18.3pp | 8/12 | 0 |
| glm-4.7-flash@t0.0+canary | 50.0% | 45.1pp | 5/12 | 5 |

## Per-Project × Config

Each cell shows mean recall (σ across 3 samples) and length range.

| project | glm-4.7-flash@t0.2 | glm-4.7-flash@t0.0 | flash-lite@t0.0 | flash@t0.0 | glm-4.7-flash@t0.0+propernoun | glm-4.7-flash@t0.0+canary |
|---|---|---|---|---|---|---|
| knowmarks | 26.7% (σ46.2pp) 0–539t | 80.0% (σ17.3pp) 496–635t | 80.0% (σ0.0pp) 421–421t | 83.3% (σ5.8pp) 771–878t | 100.0% (σ0.0pp) 601–672t | 96.7% (σ5.8pp) 797–884t |
| fctry | 76.7% (σ15.3pp) 473–682t | 73.3% (σ20.8pp) 388–564t | 86.7% (σ5.8pp) 4066–7631t | 46.7% (σ5.8pp) 865–1048t | 60.0% (σ20.0pp) 342–804t | ERR ×3 |
| orchestrator | 93.3% (σ5.8pp) 571–848t | 86.7% (σ5.8pp) 544–860t | 90.0% (σ0.0pp) 1596–1596t | 100.0% (σ0.0pp) 771–927t | 83.3% (σ5.8pp) 382–671t | 53.3% (σ47.3pp) 0–707t |
| ensemble | 56.7% (σ49.3pp) 0–489t | 93.3% (σ5.8pp) 367–581t | 100.0% (σ0.0pp) 1180–1180t | 90.0% (σ0.0pp) 847–1195t | 93.3% (σ5.8pp) 603–897t | 50.0% (σ43.6pp) 0–669t |

## Per-Project Feature-Level Recall (best to worst per project)

### knowmarks

| feature | glm-4.7-flash@t0.2 | glm-4.7-flash@t0.0 | flash-lite@t0.0 | flash@t0.0 | glm-4.7-flash@t0.0+propernoun | glm-4.7-flash@t0.0+canary |
|---|---|---|---|---|---|---|
| `Milkdown` | 0/3 | 1/3 | 0/3 | 1/3 | 3/3 | 3/3 |
| `MCP` | 1/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| `Companion` | 1/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| `Spaces` | 1/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| `Wiki` | 1/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| `Graph` | 1/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| `FTS5` | 1/3 | 1/3 | 0/3 | 0/3 | 3/3 | 3/3 |
| `fastembed` | 0/3 | 2/3 | 3/3 | 3/3 | 3/3 | 2/3 |
| `Notes` | 1/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| `citation` | 1/3 | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 |

### fctry

| feature | glm-4.7-flash@t0.2 | glm-4.7-flash@t0.0 | flash-lite@t0.0 | flash@t0.0 | glm-4.7-flash@t0.0+propernoun | glm-4.7-flash@t0.0+canary |
|---|---|---|---|---|---|---|
| `NLSpec` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 |
| `Claude Code plugin` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 |
| `scenarios` | 2/3 | 2/3 | 3/3 | 2/3 | 1/3 | 0/3 |
| `Executor` | 3/3 | 2/3 | 3/3 | 0/3 | 2/3 | 0/3 |
| `Observer` | 3/3 | 3/3 | 3/3 | 0/3 | 2/3 | 0/3 |
| `Voice Translator` | 1/3 | 0/3 | 0/3 | 0/3 | 0/3 | 0/3 |
| `Spec Writer` | 1/3 | 1/3 | 3/3 | 0/3 | 1/3 | 0/3 |
| `State Owner` | 3/3 | 2/3 | 3/3 | 1/3 | 0/3 | 0/3 |
| `viewer` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 |
| `kanban` | 1/3 | 3/3 | 2/3 | 2/3 | 3/3 | 0/3 |

### orchestrator

| feature | glm-4.7-flash@t0.2 | glm-4.7-flash@t0.0 | flash-lite@t0.0 | flash@t0.0 | glm-4.7-flash@t0.0+propernoun | glm-4.7-flash@t0.0+canary |
|---|---|---|---|---|---|---|
| `portfolio` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 |
| `Claude Code skill` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 |
| `insight cards` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 |
| `knowmarks` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 |
| `reference routing` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 |
| `waves` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/3 |
| `SQLite` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 |
| `registry` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 |
| `speculation` | 3/3 | 2/3 | 3/3 | 3/3 | 1/3 | 1/3 |
| `facet` | 1/3 | 0/3 | 0/3 | 3/3 | 0/3 | 0/3 |

### ensemble

| feature | glm-4.7-flash@t0.2 | glm-4.7-flash@t0.0 | flash-lite@t0.0 | flash@t0.0 | glm-4.7-flash@t0.0+propernoun | glm-4.7-flash@t0.0+canary |
|---|---|---|---|---|---|---|
| `Claude Code` | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/3 |
| `MCP` | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 |
| `skills` | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 |
| `plugins` | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 |
| `subagents` | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 |
| `hooks` | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 |
| `settings.json` | 1/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/3 |
| `multi-client` | 0/3 | 1/3 | 3/3 | 0/3 | 1/3 | 0/3 |
| `library` | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 |
| `snapshot` | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/3 |

## Errors

- knowmarks / glm-4.7-flash@t0.2 / s1: glm-4.7-flash@t0.2 returned empty content (finish=length, reasoning=27970 chars)
- knowmarks / glm-4.7-flash@t0.2 / s3: glm-4.7-flash@t0.2 returned empty content (finish=length, reasoning=28160 chars)
- ensemble / glm-4.7-flash@t0.2 / s3: glm-4.7-flash@t0.2 returned empty content (finish=length, reasoning=28285 chars)
- fctry / glm-4.7-flash@t0.0+canary / s1: glm-4.7-flash@t0.0+canary returned empty content (finish=length, reasoning=23241 chars)
- ensemble / glm-4.7-flash@t0.0+canary / s1: glm-4.7-flash@t0.0+canary returned empty content (finish=length, reasoning=23604 chars)
- fctry / glm-4.7-flash@t0.0+canary / s2: glm-4.7-flash@t0.0+canary returned empty content (finish=length, reasoning=31617 chars)
- orchestrator / glm-4.7-flash@t0.0+canary / s2: glm-4.7-flash@t0.0+canary returned empty content (finish=unknown, reasoning=3734 chars)
- fctry / glm-4.7-flash@t0.0+canary / s3: glm-4.7-flash@t0.0+canary returned empty content (finish=length, reasoning=29772 chars)

## Recommendation

**Already shipped (a9c171d, 5b40797):** GLM-4.7-flash @ temp=0 replaced GLM @ temp=0.2 in `packages/cli/src/digest.ts:145`. The temp=0.2 config was silently failing on 25% of calls with `finish=length, ~28k reasoning chars`. Temperature 0 fixes it cleanly: 0 errors, recall 63%→83%, variance 39pp→14pp. 25 portfolio digests refreshed on the new config.

### Prompt iteration: don't ship v2 or v3. Pursue option B (source-side elevation) next.

V2 (proper-noun nudge): aggregate +0.9pp, but knowmarks +20pp / fctry −13pp. The model heard "tools, libraries, products" narrowly and dropped named agent roles (`State Owner` 2/3 → 0/3, `scenarios` 2/3 → 1/3, `Observer` 3/3 → 2/3). 60% absolute recall on fctry is below v1 (73%) and below the prior temp=0.2 production (77%). Net: knowmarks wins, fctry quality drops.

V3 (widened to include named agents/roles/components): hard regression. Aggregate **50% recall, 45pp variance, 5 errors in 12 cells**. The longer v3 prompt pushed GLM back over the thinking-budget cliff that the temp=0 fix solved — fctry errored on all 3 samples, ensemble and orchestrator each lost one. This is the same failure mode as the original temp=0.2 bug, recreated by prompt elaboration.

**The mechanical lesson:** prompt elaboration consumes GLM's reasoning budget. v2 was at the edge of GLM's tolerance for prompt length; v3 went over. Larger specs (fctry: 191k tokens) hit the cliff first. The Milkdown problem cannot be solved by making the prompt more elaborate — that just trades one failure mode for another.

**Option B is the right structural fix.** Modify `digest.ts` to detect `tech-stack` / `patterns` / `goals` / similar frontmatter arrays and prepend their items as prose paragraphs at the top of the source content, before the model sees it. This:
- Doesn't bloat the system prompt → preserves GLM's thinking budget.
- Surfaces buried names into the part of the source the model is most likely to read carefully (the start).
- Generalizes across projects without per-project tuning.
- Doesn't help names buried deep in main prose (Voice Translator, facet, multi-client) — those need a different intervention, but they're a smaller class of misses.

### Persistent miss across all six configs

`Voice Translator` (fctry), `facet` (orchestrator), `multi-client` (ensemble) remain stuck at 0–1/3 across every config tested, including v2 and v3. These names appear deep in long-form prose, not in frontmatter arrays, so option B won't reach them either. Tolerable for v1 of the digest pipeline; revisit only if ref-routing quality on these specific names becomes a load-bearing complaint.
