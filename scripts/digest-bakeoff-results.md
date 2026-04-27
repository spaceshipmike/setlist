# Setlist Digest Model Bake-Off

**Run:** 2026-04-27T05:14:07.335Z
**Method:** N=3 samples per (project × config). Recall = % of hand-labeled named features mentioned in the digest (case-insensitive substring match). Length is approximate token count vs the 500–800 target / 1200 ceiling defined in setlist's digest.ts.

**Fixtures:** knowmarks (10 features), fctry (10 features), orchestrator (10 features), ensemble (10 features)

## Per-Config Aggregate

| config | recall μ | recall σ | length compliance | errors |
|---|---|---|---|---|
| glm-4.7-flash@t0.2 (current prod) | 63.3% | 39.4pp | 5/12 | 3 |
| glm-4.7-flash@t0.0 | 83.3% | 14.4pp | 7/12 | 0 |
| flash-lite@t0.0 | 89.2% | 7.9pp | 0/12 | 0 |
| flash@t0.0 | 80.0% | 21.3pp | 3/12 | 0 |

## Per-Project × Config

Each cell shows mean recall (σ across 3 samples) and length range.

| project | glm-4.7-flash@t0.2 | glm-4.7-flash@t0.0 | flash-lite@t0.0 | flash@t0.0 |
|---|---|---|---|---|
| knowmarks | 26.7% (σ46.2pp) 0–539t | 80.0% (σ17.3pp) 496–635t | 80.0% (σ0.0pp) 421–421t | 83.3% (σ5.8pp) 771–878t |
| fctry | 76.7% (σ15.3pp) 473–682t | 73.3% (σ20.8pp) 388–564t | 86.7% (σ5.8pp) 4066–7631t | 46.7% (σ5.8pp) 865–1048t |
| orchestrator | 93.3% (σ5.8pp) 571–848t | 86.7% (σ5.8pp) 544–860t | 90.0% (σ0.0pp) 1596–1596t | 100.0% (σ0.0pp) 771–927t |
| ensemble | 56.7% (σ49.3pp) 0–489t | 93.3% (σ5.8pp) 367–581t | 100.0% (σ0.0pp) 1180–1180t | 90.0% (σ0.0pp) 847–1195t |

## Per-Project Feature-Level Recall (best to worst per project)

### knowmarks

| feature | glm-4.7-flash@t0.2 | glm-4.7-flash@t0.0 | flash-lite@t0.0 | flash@t0.0 |
|---|---|---|---|---|
| `Milkdown` | 0/3 | 1/3 | 0/3 | 1/3 |
| `MCP` | 1/3 | 3/3 | 3/3 | 3/3 |
| `Companion` | 1/3 | 3/3 | 3/3 | 3/3 |
| `Spaces` | 1/3 | 3/3 | 3/3 | 3/3 |
| `Wiki` | 1/3 | 3/3 | 3/3 | 3/3 |
| `Graph` | 1/3 | 3/3 | 3/3 | 3/3 |
| `FTS5` | 1/3 | 1/3 | 0/3 | 0/3 |
| `fastembed` | 0/3 | 2/3 | 3/3 | 3/3 |
| `Notes` | 1/3 | 3/3 | 3/3 | 3/3 |
| `citation` | 1/3 | 2/3 | 3/3 | 3/3 |

### fctry

| feature | glm-4.7-flash@t0.2 | glm-4.7-flash@t0.0 | flash-lite@t0.0 | flash@t0.0 |
|---|---|---|---|---|
| `NLSpec` | 3/3 | 3/3 | 3/3 | 3/3 |
| `Claude Code plugin` | 3/3 | 3/3 | 3/3 | 3/3 |
| `scenarios` | 2/3 | 2/3 | 3/3 | 2/3 |
| `Executor` | 3/3 | 2/3 | 3/3 | 0/3 |
| `Observer` | 3/3 | 3/3 | 3/3 | 0/3 |
| `Voice Translator` | 1/3 | 0/3 | 0/3 | 0/3 |
| `Spec Writer` | 1/3 | 1/3 | 3/3 | 0/3 |
| `State Owner` | 3/3 | 2/3 | 3/3 | 1/3 |
| `viewer` | 3/3 | 3/3 | 3/3 | 3/3 |
| `kanban` | 1/3 | 3/3 | 2/3 | 2/3 |

### orchestrator

| feature | glm-4.7-flash@t0.2 | glm-4.7-flash@t0.0 | flash-lite@t0.0 | flash@t0.0 |
|---|---|---|---|---|
| `portfolio` | 3/3 | 3/3 | 3/3 | 3/3 |
| `Claude Code skill` | 3/3 | 3/3 | 3/3 | 3/3 |
| `insight cards` | 3/3 | 3/3 | 3/3 | 3/3 |
| `knowmarks` | 3/3 | 3/3 | 3/3 | 3/3 |
| `reference routing` | 3/3 | 3/3 | 3/3 | 3/3 |
| `waves` | 3/3 | 3/3 | 3/3 | 3/3 |
| `SQLite` | 3/3 | 3/3 | 3/3 | 3/3 |
| `registry` | 3/3 | 3/3 | 3/3 | 3/3 |
| `speculation` | 3/3 | 2/3 | 3/3 | 3/3 |
| `facet` | 1/3 | 0/3 | 0/3 | 3/3 |

### ensemble

| feature | glm-4.7-flash@t0.2 | glm-4.7-flash@t0.0 | flash-lite@t0.0 | flash@t0.0 |
|---|---|---|---|---|
| `Claude Code` | 2/3 | 3/3 | 3/3 | 3/3 |
| `MCP` | 2/3 | 3/3 | 3/3 | 3/3 |
| `skills` | 2/3 | 3/3 | 3/3 | 3/3 |
| `plugins` | 2/3 | 3/3 | 3/3 | 3/3 |
| `subagents` | 2/3 | 3/3 | 3/3 | 3/3 |
| `hooks` | 2/3 | 3/3 | 3/3 | 3/3 |
| `settings.json` | 1/3 | 3/3 | 3/3 | 3/3 |
| `multi-client` | 0/3 | 1/3 | 3/3 | 0/3 |
| `library` | 2/3 | 3/3 | 3/3 | 3/3 |
| `snapshot` | 2/3 | 3/3 | 3/3 | 3/3 |

## Errors

- knowmarks / glm-4.7-flash@t0.2 / s1: glm-4.7-flash@t0.2 returned empty content (finish=length, reasoning=27970 chars)
- knowmarks / glm-4.7-flash@t0.2 / s3: glm-4.7-flash@t0.2 returned empty content (finish=length, reasoning=28160 chars)
- ensemble / glm-4.7-flash@t0.2 / s3: glm-4.7-flash@t0.2 returned empty content (finish=length, reasoning=28285 chars)

## Recommendation

**Ship: drop temperature from 0.2 to 0.0 in `packages/cli/src/digest.ts:145`. Stay on `z-ai/glm-4.7-flash`.**

This is the smallest possible change that fixes the dominant problem.

### What the numbers say

The current production config (`glm-4.7-flash@t0.2`) is meaningfully broken:

- **3/12 cells errored** with `empty content, finish=length, ~28k reasoning chars`. GLM at temp 0.2 burns its thinking budget on long specs and emits nothing. This is the bug — it explains why knowmarks digests randomly missed Milkdown-class features and why fctry was reported as "broken under any prompt that adds length" in the prior session.
- **Recall is 63%** (vs 80–89% for the other three configs).
- **Variance is 39pp** — wildly inconsistent across runs on the same source.

Dropping temperature 0.2 → 0.0 (`glm-4.7-flash@t0.0`):

- **0 errors** across all 12 cells.
- **Recall 83%** (+20pp).
- **Variance 14pp** (–25pp).
- **Length compliance 7/12** in target range; the rest are `under` (i.e. shorter than ideal but not over the ceiling). No retries needed.
- Cost stays the cheapest of the four configs.

### Why not switch model

**Flash-Lite @ t0.0** has the highest recall (89%) and lowest variance (8pp), but length compliance is **0/12** — fctry digests come out at 4066–7631 tokens, far over the 1200 ceiling. Production retry logic would kick in on every fctry/orchestrator/ensemble call, and the bake-off doesn't measure whether recall survives the stricter retry. A separate experiment could promote Flash-Lite later, but switching today would change the failure mode from "GLM burns budget" to "Flash-Lite oversizes and depends on retry quality" — not a strict win.

**Flash @ t0.0** is worse than GLM-t0.0 on both recall (80% vs 83%) and variance (21pp vs 14pp). It also drops critical fctry features (`Executor`, `Observer`, `Voice Translator`, `Spec Writer` — 0–1/3 hits) where GLM-t0.0 catches them at 2–3/3. Not a candidate.

### Surprising findings worth noting

- **`Milkdown` (the original canary) is missed by every config.** GLM-t0.2: 0/3, GLM-t0.0: 1/3, Flash-Lite: 0/3, Flash: 1/3. The name appears in the knowmarks spec frontmatter at position ~17 of a long `patterns` array; digest models reliably skip it regardless of temperature or model size. The fix is upstream of the model — either reorder the spec to put high-importance features in prose paragraphs, or augment the digest prompt with a "name these specific terms verbatim if present" pass for known-load-bearing canaries.

- **`Voice Translator` (fctry) is missed by all configs (best case 1/3).** The agent has a literal name but is summarized under "voice guard" / "operational voice contract" framing in derived prose. Same upstream pattern as Milkdown.

- **GLM at temp=0 produces digests that lean *under-target* (7/12 cells short of 500 tokens)** rather than overshooting. Acceptable, but worth knowing — could be tuned by adjusting the prompt's TARGET_MIN/MAX language if we want denser digests.

### After-ship work (not blocking)

1. Refresh existing portfolio digests with the temp=0 config — the current GLM-t0.2 digests in the registry are the lossy ones.
2. Either reorder source specs to elevate canary names into prose, or add a "named-feature spotlight" prompt augmentation for high-importance terms.
3. Re-run a small bake-off later with Flash-Lite plus production length-retry simulated, to see if it can become a real winner.
