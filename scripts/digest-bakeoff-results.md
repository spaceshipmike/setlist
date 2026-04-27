# Setlist Digest Model Bake-Off

**Run:** 2026-04-27T14:07:55.391Z
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
| glm-4.7-flash@t0.0+lean | 75.0% | 26.8pp | 4/12 | 1 |

## Per-Project × Config

Each cell shows mean recall (σ across 3 samples) and length range.

| project | glm-4.7-flash@t0.2 | glm-4.7-flash@t0.0 | flash-lite@t0.0 | flash@t0.0 | glm-4.7-flash@t0.0+propernoun | glm-4.7-flash@t0.0+canary | glm-4.7-flash@t0.0+lean |
|---|---|---|---|---|---|---|---|
| knowmarks | 26.7% (σ46.2pp) 0–539t | 80.0% (σ17.3pp) 496–635t | 80.0% (σ0.0pp) 421–421t | 83.3% (σ5.8pp) 771–878t | 100.0% (σ0.0pp) 601–672t | 96.7% (σ5.8pp) 797–884t | 70.0% (σ10.0pp) 335–403t |
| fctry | 76.7% (σ15.3pp) 473–682t | 73.3% (σ20.8pp) 388–564t | 86.7% (σ5.8pp) 4066–7631t | 46.7% (σ5.8pp) 865–1048t | 60.0% (σ20.0pp) 342–804t | ERR ×3 | 80.0% (σ17.3pp) 310–487t |
| orchestrator | 93.3% (σ5.8pp) 571–848t | 86.7% (σ5.8pp) 544–860t | 90.0% (σ0.0pp) 1596–1596t | 100.0% (σ0.0pp) 771–927t | 83.3% (σ5.8pp) 382–671t | 53.3% (σ47.3pp) 0–707t | 90.0% (σ10.0pp) 552–605t |
| ensemble | 56.7% (σ49.3pp) 0–489t | 93.3% (σ5.8pp) 367–581t | 100.0% (σ0.0pp) 1180–1180t | 90.0% (σ0.0pp) 847–1195t | 93.3% (σ5.8pp) 603–897t | 50.0% (σ43.6pp) 0–669t | 60.0% (σ52.0pp) 0–758t |

## Per-Project Feature-Level Recall (best to worst per project)

### knowmarks

| feature | glm-4.7-flash@t0.2 | glm-4.7-flash@t0.0 | flash-lite@t0.0 | flash@t0.0 | glm-4.7-flash@t0.0+propernoun | glm-4.7-flash@t0.0+canary | glm-4.7-flash@t0.0+lean |
|---|---|---|---|---|---|---|---|
| `Milkdown` | 0/3 | 1/3 | 0/3 | 1/3 | 3/3 | 3/3 | 0/3 |
| `MCP` | 1/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| `Companion` | 1/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| `Spaces` | 1/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| `Wiki` | 1/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| `Graph` | 1/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| `FTS5` | 1/3 | 1/3 | 0/3 | 0/3 | 3/3 | 3/3 | 0/3 |
| `fastembed` | 0/3 | 2/3 | 3/3 | 3/3 | 3/3 | 2/3 | 1/3 |
| `Notes` | 1/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| `citation` | 1/3 | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 |

### fctry

| feature | glm-4.7-flash@t0.2 | glm-4.7-flash@t0.0 | flash-lite@t0.0 | flash@t0.0 | glm-4.7-flash@t0.0+propernoun | glm-4.7-flash@t0.0+canary | glm-4.7-flash@t0.0+lean |
|---|---|---|---|---|---|---|---|
| `NLSpec` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 |
| `Claude Code plugin` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 |
| `scenarios` | 2/3 | 2/3 | 3/3 | 2/3 | 1/3 | 0/3 | 3/3 |
| `Executor` | 3/3 | 2/3 | 3/3 | 0/3 | 2/3 | 0/3 | 2/3 |
| `Observer` | 3/3 | 3/3 | 3/3 | 0/3 | 2/3 | 0/3 | 2/3 |
| `Voice Translator` | 1/3 | 0/3 | 0/3 | 0/3 | 0/3 | 0/3 | 0/3 |
| `Spec Writer` | 1/3 | 1/3 | 3/3 | 0/3 | 1/3 | 0/3 | 2/3 |
| `State Owner` | 3/3 | 2/3 | 3/3 | 1/3 | 0/3 | 0/3 | 3/3 |
| `viewer` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 |
| `kanban` | 1/3 | 3/3 | 2/3 | 2/3 | 3/3 | 0/3 | 3/3 |

### orchestrator

| feature | glm-4.7-flash@t0.2 | glm-4.7-flash@t0.0 | flash-lite@t0.0 | flash@t0.0 | glm-4.7-flash@t0.0+propernoun | glm-4.7-flash@t0.0+canary | glm-4.7-flash@t0.0+lean |
|---|---|---|---|---|---|---|---|
| `portfolio` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 |
| `Claude Code skill` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 |
| `insight cards` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 |
| `knowmarks` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 |
| `reference routing` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 |
| `waves` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/3 | 3/3 |
| `SQLite` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 |
| `registry` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 |
| `speculation` | 3/3 | 2/3 | 3/3 | 3/3 | 1/3 | 1/3 | 2/3 |
| `facet` | 1/3 | 0/3 | 0/3 | 3/3 | 0/3 | 0/3 | 1/3 |

### ensemble

| feature | glm-4.7-flash@t0.2 | glm-4.7-flash@t0.0 | flash-lite@t0.0 | flash@t0.0 | glm-4.7-flash@t0.0+propernoun | glm-4.7-flash@t0.0+canary | glm-4.7-flash@t0.0+lean |
|---|---|---|---|---|---|---|---|
| `Claude Code` | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/3 | 2/3 |
| `MCP` | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 2/3 |
| `skills` | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 2/3 |
| `plugins` | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 2/3 |
| `subagents` | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 2/3 |
| `hooks` | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 2/3 |
| `settings.json` | 1/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/3 | 2/3 |
| `multi-client` | 0/3 | 1/3 | 3/3 | 0/3 | 1/3 | 0/3 | 0/3 |
| `library` | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 2/3 |
| `snapshot` | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/3 | 2/3 |

## Errors

- knowmarks / glm-4.7-flash@t0.2 / s1: glm-4.7-flash@t0.2 returned empty content (finish=length, reasoning=27970 chars)
- knowmarks / glm-4.7-flash@t0.2 / s3: glm-4.7-flash@t0.2 returned empty content (finish=length, reasoning=28160 chars)
- ensemble / glm-4.7-flash@t0.2 / s3: glm-4.7-flash@t0.2 returned empty content (finish=length, reasoning=28285 chars)
- fctry / glm-4.7-flash@t0.0+canary / s1: glm-4.7-flash@t0.0+canary returned empty content (finish=length, reasoning=23241 chars)
- ensemble / glm-4.7-flash@t0.0+canary / s1: glm-4.7-flash@t0.0+canary returned empty content (finish=length, reasoning=23604 chars)
- fctry / glm-4.7-flash@t0.0+canary / s2: glm-4.7-flash@t0.0+canary returned empty content (finish=length, reasoning=31617 chars)
- orchestrator / glm-4.7-flash@t0.0+canary / s2: glm-4.7-flash@t0.0+canary returned empty content (finish=unknown, reasoning=3734 chars)
- fctry / glm-4.7-flash@t0.0+canary / s3: glm-4.7-flash@t0.0+canary returned empty content (finish=length, reasoning=29772 chars)
- ensemble / glm-4.7-flash@t0.0+lean / s2: glm-4.7-flash@t0.0+lean returned empty content (finish=length, reasoning=28989 chars)

## Recommendation

**Already shipped (a9c171d, 5b40797, 58e9669):** GLM-4.7-flash @ temp=0 + `project_digests.named_terms` (schema v15). The temp=0 fix solved the 25%-empty-content bug. The named_terms column carries spec-frontmatter canary phrases (Milkdown, FTS5, fastembed, etc.) for hybrid retrieval, freeing the digest prose from having to pack every named entity.

### v4 (lean): mixed signal — don't ship

The lean prompt drops TARGET_MIN/MAX from 500–800 to 300–600 and removes the "name unbuilt sections explicitly" bullet. Hypothesis: with named_terms now carrying canary recall, the digest can be tighter and the freed token budget might improve embedding centroid coherence.

Result vs v1 (the current ship):

| project | v1 | v4 lean | δ |
|---|---|---|---|
| knowmarks | 80% | 70% | −10pp |
| fctry | 73% | 80% | **+7pp** |
| orchestrator | 87% | 90% | +3pp |
| ensemble | 93% | 60% | **−33pp** + 1 error |
| **aggregate** | **83.3%** | **75.0%** | −8.3pp |

The lean prompt produced shorter digests (310–605 vs 388–860 tokens) — that part worked. But ensemble's error (one cell hit `finish=length, ~29k reasoning chars`) and knowmarks' recall drop (Milkdown back to 0/3) are real costs. The lean prompt was supposed to free GLM's thinking budget on rich specs, but ensemble's 65k-token spec with deeply-nested frontmatter still tripped it.

### The deeper insight from v4

**With named_terms in place, feature recall against fixture lists is no longer the right metric for evaluating digest models.** The digest's only remaining job is embedding centroid quality for cosine retrieval. v4's 70% recall on knowmarks looks bad next to v1's 80%, but most of the missed features (Milkdown, FTS5) are now stored in `named_terms` and findable via FTS5 regardless. The digest losing them is irrelevant for actual retrieval performance.

Whether the leaner digest produces a *better* embedding centroid is unmeasured — feature recall doesn't capture that. To know if v4 (or any future lean variant) is actually better, we'd need a retrieval-quality harness: hand-labeled queries per project, distractor queries, embed everything, measure recall@k / nDCG.

### Final recommendation

**Stop iterating on the digest prompt until we have a retrieval-quality harness.** The current ship (GLM @ temp=0 + named_terms) addresses the original Milkdown/canary-recall complaint. Further prompt tuning without a meaningful metric is overfitting to a fixture-recall score that's now decoupled from actual user value.

Followups, in priority order:
1. Build the retrieval-quality harness (real metric for digest quality).
2. Wire `named_terms` into downstream consumers (knowmarks `score_saves`, orchestrator ref-routing) so the new column actually gets read.
3. Revisit Voice Translator / facet / multi-client (the prose-buried misses) only if ref-routing complaints surface — option B (source-side frontmatter elevation) is the path if needed.
