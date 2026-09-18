# PROTEUS — Architecture Memo

**Status:** approved and substantially built. Deliverables 1 and 3 complete; the Phase-1
pipeline runs end to end and is benchmarked at 80 questions per arm (§8h, which supersedes
§8g's table). Build logs §8b–§8h record every deviation from this plan and every measured
finding.
**Repo:** `treemux` (unchanged). **Product name:** PROTEUS.
**Date:** 2026-08-09

---

## 🧑 In Plain English

**What exists today.** Treemux takes one problem ("build a whiteboard app"), spins up N
independent AI workers in isolated cloud machines, lets each one try a different approach,
then runs a panel of AI judges over the results — correcting for the fact that some judges
score harshly and some score generously, and flagging the entries that are unusual rather
than merely good.

**What we're changing.** Only one thing: what the workers _make_. Today they make websites.
Tomorrow they run **simulations of the future** — how an adversary might act, how a
technology might spread, how a political situation might break.

**Why this isn't a rewrite.** The valuable part of Treemux was never the website-building.
It was the shape: _run many independent attempts, then have a panel argue about them and
correct for each panelist's bias._ That is exactly how professional intelligence analysis is
supposed to work, and Treemux already does it. We are changing the cargo, not the ship.

**The one genuinely new idea.** Instead of asking an AI to imagine what happens — which
can't be checked and can't be repeated — each run has a small **mathematical model** at its
core with a fixed random seed. Same seed, same answer, every time, down to the byte. The AI
sets up the model and interprets what came out; the math does the actual simulating. This is
what makes it possible to say "our forecasts are 73% accurate" and have that number mean
something.

**How we'll know it works.** We build a synthetic world where we control the truth. The
system forecasts what will happen; the world then actually plays it out; we score the
forecast against what really happened. Because we invented the world, the AI cannot have
memorized the answer — a failure mode that quietly ruins most AI forecasting demos. Real
historical and live-market testing comes later, and until it runs, we will say **"not yet
measured"** rather than quote a number.

**What we are deliberately not building.** Nothing that produces content for real people.
The influence-operations work models a made-up population in order to learn how to _detect
and defend against_ manipulation. No real accounts, no real platforms, no deployable
messaging. That boundary is enforced in the code, not just in this document.

---

## 1. The pivot in one diagram

```
  INTELLIGENCE QUESTION
          │
          ▼
  ┌───────────────────┐
  │  [1] FRAMER       │  question → N divergent, mutually exclusive hypotheses
  │  was: ideation.ts │  each with riskTolerance, escalationPropensity, seed
  └─────────┬─────────┘
            │
            ▼   fan-out, N parallel
  ┌───────────────────────────────────────────────┐
  │  [2] SIMULATION RUN  × N                      │
  │                                               │
  │   LLM framer ──► RunConfig {seed, params}     │  ← hash-pinned
  │                      │                        │
  │                      ▼                        │
  │              ╔═══════════════════╗            │
  │              ║  NUMERIC KERNEL   ║ determinis-║
  │              ║  seeded PRNG      ║ tic, byte- ║
  │              ║  no wall clock    ║ identical  ║
  │              ╚═════════╤═════════╝            │
  │                        │ event log (JSONL)    │
  │              as-of corpus retrieval           │  ← date filter in CODE
  │                        │                      │
  │                        ▼                      │
  │                  RUN ARTIFACT                 │  ← content-addressed
  │        was: one git branch per worker         │
  └─────────────────────┬─────────────────────────┘
                        │
                        ▼
  ┌───────────────────────────────────────────────┐
  │  [3] ABSTENTION GATE   ← runs BEFORE scoring  │
  │      insufficient evidence? stop here.        │
  └─────────────────────┬─────────────────────────┘
                        │
                        ▼
  ┌───────────────────────────────────────────────┐
  │  [4] ADJUDICATION PANEL                       │
  │      was: auto-designed judge panel           │
  │                                               │
  │   ACH · key-assumptions · devil's advocate    │
  │   premortem · red team (can force rerun)      │
  │                                               │
  │   each emits: likelihood ⟂ confidence         │  ← never collapsed
  └─────────────────────┬─────────────────────────┘
                        │
                        ▼
  ┌───────────────────────────────────────────────┐
  │  [5] CALIBRATION + AGGREGATION                │
  │      normalize.ts   UNCHANGED MATH            │
  │      outliers.ts    UNCHANGED MATH            │
  │      compute.ts     + confidence-aware agg    │
  └─────────────────────┬─────────────────────────┘
                        │
                        ▼
  ┌───────────────────────────────────────────────┐
  │  [6] BLUF PRODUCT                             │
  │      ranked scenarios · likelihood+confidence │
  │      drivers · INDICATORS & WARNINGS          │
  │      key assumptions + falsifiers · provenance│
  └─────────────────────┬─────────────────────────┘
                        │
                        ▼
  ┌───────────────────────────────────────────────┐
  │  [7] METRICS  (scored vs. synthetic oracle)   │
  └───────────────────────────────────────────────┘
```

---

## 2. Findings from reading the repo

Three things I confirmed by reading code, which change the plan:

**CONFIRMED — the ideation module is dead code on the live path.**
`api/src/task.ts:39-45` bypasses `ideate()` entirely and substitutes "synthetic ideation":
the task description is passed through verbatim and `risk`/`temperature` are assigned by
`Math.random()`. `api/src/ideation.ts` (OpenRouter → `google/gemma-2-9b-it`) is wired but
never called. Consequence: the framer is a greenfield rewrite of an unused file, not a
migration of a working one. Also, `Math.random()` on the live path is the first thing that
has to go — it makes runs unreproducible at the very first step.

**CONFIRMED — the existing test suite is green.**
`npx vitest run` in `eval/`: 21 files, 108 tests, all passing, 866 ms. Evidence class:
**unit tests with mocks** — these are pure-function and prompt-shape tests; no live API calls.
This is the regression baseline the pivot must not break.

**CONFIRMED — `scoring/` is domain-free and needs no logic changes.**
`normalize.ts` (z-score per judge, rescaled to 1–10) and `outliers.ts`
(global / dimensional / unique + `cosineSimilarity`) contain zero references to projects,
websites, or hackathons. They operate on `Record<string, number[]>` and a score matrix. They
are correct as written for the new domain. This is the single largest saving in the pivot.

One judgment call flagged, not fixed: `orchestrator.ts:302-312` recomputes a judge's
project index with a nested loop inside a map — O(n²) and fragile if a judge fails on some
projects. It works today; at N=200 runs it becomes both slow and a correctness risk. I
propose replacing it with an explicit index map when that file is touched, and saying so
rather than doing it silently.

---

## 3. File-by-file mapping: kept · redefined · deleted

### `api/` — orchestrator

| File                             | Disposition                      | Notes                                                                                                                                                              |
| -------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/server.ts`                  | **KEPT**                         | HTTP/WS unchanged; new `/v1.0/question` route added alongside `/v1.0/task`                                                                                         |
| `src/observability.ts`           | **KEPT**                         | Broadcast mechanism unchanged                                                                                                                                      |
| `src/logger.ts`, `src/config.ts` | **KEPT**                         | Unchanged                                                                                                                                                          |
| `src/types.ts`                   | **KEPT + EXTENDED**              | Adds `mode: "build" \| "simulate"`, `HypothesisSpec`, simulate-mode WS events. `risk`/`temperature` **keep their wire names**, gain documented new semantics (§4)  |
| `src/ideation.ts`                | **REDEFINED → `src/framing.ts`** | Question → N mutually exclusive hypotheses. `gemma-2-9b-it` dropped — too weak to enforce mutual exclusivity. Moves to Claude via Agent SDK, matching `planner.ts` |
| `src/task.ts`                    | **KEPT + BRANCHED**              | Simulate mode skips GitHub/Vercel entirely. `Math.random()` seeding replaced by explicit per-run seeds derived from a root seed                                    |
| `src/implementation-spawn.ts`    | **KEPT + SIBLING**               | Gains `spawnSimulationRun()`; existing Modal spawn untouched                                                                                                       |
| `src/eval-bridge.ts`             | **REDEFINED**                    | Becomes the adjudication bridge. Same WS lifecycle, extended protocol                                                                                              |
| `src/github.ts`, `src/vercel.ts` | **KEPT — build mode only**       | Not deleted. Never called in simulate mode                                                                                                                         |
| `assets/personas/*.md`           | **KEPT — build mode only**       | `mrv.md`, `johnny.md` are TreeHacks artifacts with no analytic analog. Left in place (zero cost) rather than deleted                                               |
| `assets/actors/*.yaml`           | **NEW**                          | Actor models: doctrine, objectives, strategic culture, domestic cost function, information environment, escalation thresholds, observability mask                  |

### `eval/` — analytic core

| File                                             | Disposition                      | Notes                                                                                                                                                                                                                        |
| ------------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/scoring/normalize.ts`                       | **KEPT — ZERO CODE CHANGE**      | Redocumented as adjudicator bias correction. **Reused verbatim** for source reconciliation: the same z-score math over sources instead of judges                                                                             |
| `src/scoring/outliers.ts`                        | **KEPT — ZERO CODE CHANGE**      | Redocumented as low-probability/high-impact tail detection. `cosineSimilarity` reused directly by `metrics/ensemble.ts` for diversity                                                                                        |
| `src/scoring/compute.ts`                         | **KEPT + EXTENDED**              | Composite kept for likelihood. New `aggregateConfidence()` — confidence does **not** average (§4)                                                                                                                            |
| `src/orchestrator.ts`                            | **KEPT — ~85% UNCHANGED**        | `Semaphore`, checkpoint save/load, plan caching, resume, batch concurrency all survive verbatim. Only the body of `evaluateProject` changes. The O(n²) index lookup gets fixed                                               |
| `src/modal/*` (6 files)                          | **KEPT**                         | Semaphore, HMAC, client, delivery, webhook-server — unchanged                                                                                                                                                                |
| `src/agents/planner.ts`                          | **REDEFINED**                    | Designs a panel of **structured analytic techniques**, not judge personas. Same single-turn `query()` shape, new prompt + schema                                                                                             |
| `src/agents/research.ts`                         | **REDEFINED**                    | Researches actors, doctrine, order of battle instead of people. **The SHA256 cache at lines 10–32 is kept verbatim** — it is already content-addressed reproducible research pinning, which is exactly what provenance needs |
| `src/agents/judge.ts`                            | **REDEFINED → `adjudicator.ts`** | Reads an event log + evidence, not a website. Stagehand tools removed from the simulate path                                                                                                                                 |
| `src/agents/report-writer.ts`                    | **REDEFINED**                    | BLUF product writer                                                                                                                                                                                                          |
| `src/types.ts`                                   | **KEPT + EXTENDED**              | New schemas in §4                                                                                                                                                                                                            |
| `src/tools/stagehand*.ts`                        | **KEPT — build mode only**       | Not deleted                                                                                                                                                                                                                  |
| `src/eval/{server,protocol,schemas,callback}.ts` | **KEPT + EXTENDED**              | WS server and queue unchanged; message schemas extended                                                                                                                                                                      |

### `eval/src/` — new packages

| Package     | Contents                                                                                                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sim/`      | `rng.ts` (sfc32 seeded PRNG), `kernel.ts` (deterministic tick loop), `world.ts`, `restricted-view.ts`, `adapters/influence-ops.ts` (Phase 1), `adapters/{adversary,emerging-tech,geopolitical}.ts` (stubs with the shared interface) |
| `corpus/`   | `as-of.ts` (date filter enforced in code), `snapshot.ts` (content-addressed), `synthetic.ts` (generator with seeded contradictions + labels)                                                                                         |
| `evidence/` | `provenance.ts`, `ach.ts` (diagnosticity-weighted), `contradiction.ts`, `reconcile.ts`, `abstention.ts`                                                                                                                              |
| `artifact/` | `store.ts` (content-addressed run artifacts), `canonical.ts` (stable JSON for hashing)                                                                                                                                               |
| `metrics/`  | §6                                                                                                                                                                                                                                   |

### `worker/`

| File                                                                            | Disposition                                                                                 |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `implementation_worker.py`, `runner.py`, `scripts/treemux_report.py`, `skills/` | **KEPT — build mode only.** Untouched in Phase 1                                            |
| `simulation_worker.py`                                                          | **NEW, Phase 2** — the Modal scale-out seam. Not built in Phase 1 per the topology decision |

### `web/`

| File                                                                                 | Disposition                                                                                                     |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `components/pipeline/{PipelineFlow,TaskNode,WorkerNode,ProfileNode,WaitingNode}.tsx` | **KEPT + RELABELED** — same graph, new node semantics                                                           |
| `components/pipeline/DeployNode.tsx`, `components/flow/PreviewNode.tsx`              | **KEPT — build mode only.** Microlink screenshot path is dead weight in simulate mode and is not rendered there |
| `components/pipeline/{JudgeNode,EvalSidebar}.tsx`                                    | **REDEFINED** — adjudication panel + product panel                                                              |
| `hooks/useTaskStream.ts`                                                             | **KEPT + EXTENDED** — new event cases                                                                           |
| `components/metrics/`                                                                | **NEW** — calibration curve, Brier skill over time, coverage, stability, cost/insight                           |

### Deletions

**Zero files deleted in Phase 1.** Everything is kept or mode-gated. Deleting working code
before the replacement is measured trades a known-good path for an unproven one.

Deletion candidates, each with the condition that makes it safe:

| Candidate                                                           | Safe to delete when                                                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `api/src/ideation.ts` (OpenRouter/gemma)                            | Superseded by `framing.ts`. Already dead on the live path — this one is safe now and I'll remove it with the framer |
| `api/assets/personas/*.md`                                          | Build mode is retired                                                                                               |
| `api/src/vercel.ts`, `DeployNode.tsx`, `PreviewNode.tsx`, Microlink | Build mode is retired                                                                                               |
| `eval/src/tools/stagehand*.ts` + BrowserBase dep                    | Build mode is retired **and** no adjudicator needs a browser                                                        |

---

## 4. Analytic tradecraft — how each requirement is enforced in code

### Likelihood ⟂ confidence, never collapsed

ICD 203 bands as a single source of truth, derived types, no combining function:

```ts
export const LIKELIHOOD_BANDS = [
  "almost_no_chance", // 01–05%
  "very_unlikely", // 05–20%
  "unlikely", // 20–45%
  "roughly_even", // 45–55%
  "likely", // 55–80%
  "very_likely", // 80–95%
  "almost_certain", // 95–99%
] as const;
export type LikelihoodBand = (typeof LIKELIHOOD_BANDS)[number];

export const CONFIDENCE_LEVELS = ["low", "moderate", "high"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export interface Judgment {
  likelihood: LikelihoodBand;
  likelihoodPoint: number; // for scoring only, never for display
  confidence: ConfidenceLevel;
  confidenceDrivers: ConfidenceDriver[];
}
```

Enforcement is structural, not advisory: there is **no** function anywhere with signature
`(Judgment) => number`. A unit test asserts that `aggregateConfidence` is not a mean —
confidence aggregates by the _weakest-link_ rule (an ensemble is no more confident than its
evidence base), because averaging confidence is precisely the collapse the requirement
forbids. Likelihood aggregates as a weighted mean over the normalized ensemble.

### Provenance on every claim

```ts
export interface Claim {
  text: string;
  support: EvidenceRef[]; // empty array ⇒ counted as an unsupported assertion
}
export interface EvidenceRef {
  sourceId: string;
  publishedAt: string; // ISO date — required, no default
  credibility: number; // 0–1
  excerpt: string;
}
```

The report writer emits `Claim[]`, not prose. Prose is rendered _from_ claims. An assertion
with no `support` is not blocked — it is **counted**, and the count is a reported metric
(`unsupportedAssertionRate`).

### Abstention path — built first

`AbstentionGate` runs **before** any likelihood is produced. It fires when any of:

1. Diagnostic evidence count below threshold
2. ACH scores across hypotheses are within a no-discrimination band (nothing separates them)
3. Unresolved contradictions above threshold
4. Provenance completeness below threshold

Output is a first-class verdict — `{ verdict: "INSUFFICIENT_EVIDENCE", reasons, evidenceGaps }` —
not an error. Negative-control questions in the benchmark exist specifically to check that it
fires when it should, and the false-abstention rate is reported alongside.

### ACH — adjudicated, not averaged

Heuer's algorithm properly implemented: hypotheses are ranked by **weighted inconsistency,
ascending** (the hypothesis with the least evidence against it wins), not by consistency count.

Diagnosticity of evidence item `e` across hypotheses:

```
diagnosticity(e) = 2 · min(nConsistent, nInconsistent) / nApplicable
```

→ `0` when `e` is consistent with everything (worthless, the common case), `1.0` at an even
split (maximally discriminating). Hypothesis score:

```
S(h) = Σ_e  diagnosticity(e) · credibility(e) · 1[verdict(e,h) = INCONSISTENT]
```

Diagnostic evidence therefore dominates by construction, and evidence merely consistent with
everything contributes ~0.

### Key assumptions with falsifiers

```ts
export interface KeyAssumption {
  statement: string;
  confidence: ConfidenceLevel;
  falsifier: string; // required — what observation would break this
  affectedHypotheses: string[];
}
```

`falsifier` is non-optional. An assumption that cannot be falsified is a schema violation.

### Red team with standing

`RedTeamAgent` returns `{ challenge, severity, forcesRerun: boolean }`. The orchestrator
honors `forcesRerun` up to a bounded budget (1 rerun), logs the challenge, and the rerun is
a **distinct artifact** — so the provenance chain shows the challenge, the rerun, and whether
the judgment moved.

### Source reconciliation

When two sources disagree, classify the conflict:

```ts
type ConflictKind =
  | "different_measurement"
  | "different_date"
  | "different_definition"
  | "genuine_dispute";
```

The first three are mechanically reconcilable (unit conversion, temporal alignment,
definition mapping). `genuine_dispute` is **not** silently resolved — it propagates into
`confidenceDrivers` and pushes confidence down. The disagreement math is the existing
`normalize.ts` z-score, applied over sources instead of judges.

### Determinism — the load-bearing property

| Requirement    | Enforcement                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Seeded PRNG    | `sim/rng.ts` (sfc32). **`Math.random()` banned in `sim/`** — enforced by a unit test that greps the compiled kernel               |
| No wall clock  | Time is simulation ticks. `Date.now()` banned in `sim/`                                                                           |
| Stable hashing | `artifact/canonical.ts` — sorted-key JSON serialization                                                                           |
| Corpus pinning | `corpusSnapshotId` is a required field of `RunConfig`                                                                             |
| **The test**   | Run twice, same seed ⇒ **identical artifact hash**. This is a unit test, and it is the one that must never be allowed to go flaky |

### Leakage guard — in code, not in a prompt

```ts
class AsOfCorpus {
  retrieve(query: string, asOf: Date): Document[] {
    // hard filter — a document published after asOf is unreachable
  }
}
```

Three layers: (1) the filter itself; (2) a test asserting a post-`asOf` document is never
returned; (3) a **runtime assertion that throws** if any `EvidenceRef` in a finished product
carries a `publishedAt` later than the run's `asOf`. Layer 3 catches leakage that sneaks in
through a path the filter doesn't own.

---

## 5. Phase-1 vertical slice — closed-world influence operations

### Scope boundary, enforced

Synthetic populations only. No real accounts, no real platforms, no deployable messaging, no
targeting of real people or groups. Ingestion is read-only. The kernel's narrative objects
are **opaque identifiers with numeric positions** (`{id: "N1", position: 0.8}`), not text —
so the code has no path that emits persuasive content, because there is no content in it to
emit. That is a structural guarantee, not a policy note.

### The model

Agent state: belief vector over K narratives, susceptibility, per-source trust weights,
network neighbours. Update is a bounded-confidence + source-influence hybrid
(Hegselmann-Krause / Deffuant family), which produces polarization **endogenously** rather
than by fiat:

```
b_i(t+1) = b_i(t)
  + η · Σ_{j∈N(i)} w_ij · (b_j − b_i) · 1[|b_j − b_i| < ε_i]     ← peer influence, bounded confidence
  + Σ_m t_im · κ · (m_m(t) − b_i)                                 ← media diet
```

**Adversary campaign** (the injected treatment): narrative selection, injection nodes,
amplification schedule, timing.

**Measured outputs:** mean belief drift, polarization index, cascade size distribution.

**Defensive half:** counter-messaging, friction (edge-weight reduction / delay), platform
intervention (amplifier removal / rate limiting) — each with a cost. Output is the
**resilience playbook**: which intervention dominates, under what conditions, at what cost.

### The detector/oracle separation — the part that makes detection metrics real

The **detection-signature detector sees only observable telemetry** — degree ratios, temporal
burstiness, narrative-diversity collapse, cross-cluster synchrony — via `RestrictedView`. It
never sees the campaign parameters. The oracle knows the ground truth. Therefore detection
precision and recall are genuinely measurable, not asserted.

The same separation makes the forecasting metrics honest: the LLM framer and adjudicators
receive a `RestrictedView` (early ticks + as-of corpus). They never see future ticks or the
true config. Ground truth is what the ABM actually did.

**This is why leakage is structurally impossible here:** the answer did not exist anywhere
before the run produced it, so no model can have memorized it.

### End-to-end path

```
POST /v1.0/question { question, N, domain: "influence-ops", asOf, rootSeed }
  → framer: N mutually exclusive hypotheses over outcome bands
  → N runs (local pool, existing Semaphore), each → RunArtifact
  → abstention gate
  → adjudication panel (ACH · assumptions · devil's advocate · premortem · red team)
  → normalize (existing) → aggregate → outliers (existing)
  → BLUF product: likelihood + confidence + I&W + assumptions/falsifiers + provenance
  → live WS dashboard throughout
```

---

## 6. The `metrics/` package

Every module unit-tested against hand-computable or textbook worked examples.

| Module             | Contents                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `brier.ts`         | Brier, multicategory Brier, Brier **skill** vs. explicit baselines                                                           |
| `murphy.ts`        | Reliability − resolution + uncertainty decomposition                                                                         |
| `calibration.ts`   | ECE, MCE, reliability-diagram bins                                                                                           |
| `sharpness.ts`     | Forecast-distance-from-base-rate distribution — catches hedging                                                              |
| `scoring-rules.ts` | Log / ignorance score                                                                                                        |
| `ensemble.ts`      | Coverage@N, tail recall, diversity (**reuses `cosineSimilarity` from `outliers.ts`**)                                        |
| `stability.ts`     | Inter-run variance in the headline judgment, same inputs / different seeds                                                   |
| `agreement.ts`     | Krippendorff's α, Cohen's κ                                                                                                  |
| `analytic-qa.ts`   | Contradiction P/R, reconciliation accuracy, provenance completeness, unsupported-assertion rate                              |
| `cost.ts`          | $/scenario, $/forecast, $/decision-relevant insight, time-to-first-insight                                                   |
| `reliability.ts`   | Completion rate (instruments existing `JOB_ERROR`), artifact-hash reproducibility, graceful degradation under k-of-N failure |
| `baselines.ts`     | Base rate, random, single-model-no-ensemble                                                                                  |

### What Phase 1 will and will not measure

| Metric                                              | Phase 1                 | Why                                                          |
| --------------------------------------------------- | ----------------------- | ------------------------------------------------------------ |
| Brier, ECE, Murphy, sharpness, log score            | ✅ measurable           | Synthetic oracle resolves cheaply at scale                   |
| Brier skill vs. base-rate / random / single-model   | ✅ measurable           | Baselines are computable                                     |
| Brier skill vs. **human analyst**                   | ❌ **not yet measured** | Human baseline not in Phase 1 scope                          |
| Coverage@N, diversity, tail recall                  | ✅ measurable           | Oracle gives realized outcomes                               |
| Contradiction P/R, reconciliation accuracy          | ✅ measurable           | Synthetic corpus ships labels                                |
| Provenance completeness, unsupported-assertion rate | ✅ measurable           | Counted from `Claim[]`                                       |
| Inter-run stability                                 | ✅ measurable           | Cheapest high-value metric in the set                        |
| Detection-signature P/R                             | ✅ measurable           | Detector/oracle separation                                   |
| Reproducibility (artifact hash)                     | ✅ measurable           | Direct test                                                  |
| Graceful degradation                                | ✅ measurable           | Inject k-of-N failures                                       |
| **Historical backtest accuracy**                    | ❌ **not yet measured** | Mechanism built + exercised on synthetic only                |
| **Live post-cutoff accuracy**                       | ❌ **not yet measured** | Needs weeks of resolutions                                   |
| SME plausibility ratings                            | ❌ **not yet measured** | Needs humans                                                 |
| Corpus scaling at 10⁶ docs                          | ❌ Phase 2              | Phase 1 reports the curve at achieved size, honestly labeled |

Historical and live numbers will be reported as **separate figures, never pooled** with
synthetic-oracle results — including in the white paper.

---

## 7. Build order

| Step | Deliverable                                                  | Gate                                            |
| ---- | ------------------------------------------------------------ | ----------------------------------------------- |
| 1    | `sim/rng.ts` + `artifact/` + determinism test                | Same seed ⇒ identical hash                      |
| 2    | `corpus/` synthetic generator + as-of filter + leakage tests | Post-`asOf` doc unreachable                     |
| 3    | `sim/adapters/influence-ops.ts` kernel                       | Polarization emerges; oracle resolves questions |
| 4    | `evidence/abstention.ts` — **before** any scoring            | Fires on negative controls                      |
| 5    | `evidence/ach.ts` + `contradiction.ts` + `reconcile.ts`      | Diagnosticity math correct                      |
| 6    | `framing.ts` + adjudication panel + red team                 | Mutually exclusive hypotheses; rerun works      |
| 7    | Orchestrator wiring + BLUF product                           | End-to-end: question → product                  |
| 8    | `metrics/` + unit tests                                      | Textbook values reproduce                       |
| 9    | Dashboard                                                    | Live run + metrics views                        |
| 10   | Benchmark run + white paper                                  | Real numbers, or "not yet measured"             |

Steps 1–7 are the vertical slice. Nothing broadens until it runs end to end.

---

## 8. Risks I'm not going to pretend aren't there

1. **A synthetic oracle measures calibration against a world we invented.** Excellent Brier
   on the synthetic oracle proves the _pipeline_ is calibrated; it does not prove the system
   forecasts the real world well. The white paper must say this in the limitations section
   in exactly these terms, and steps 4–5 of your leakage plan (historical + live) are how it
   stops being a caveat.

2. **The ABM's realism is an assumption, not a result.** Bounded-confidence models reproduce
   polarization qualitatively; parameter values are not fitted to any real population.
   Mitigation: the ABM is a _forecasting testbed_, and every claim about the real world
   traces to corpus evidence, not to the ABM.

3. **LLM instability may swamp the signal.** Inter-run stability is measured early (step 8)
   precisely so we find out before the calibration story is built on sand. If variance is
   high, the fix is more ensemble members and tighter output schemas — but we will report
   the number either way.

4. **Mode-gating carries a maintenance tax.** Two modes through one orchestrator will
   accumulate branches. Acceptable now; revisit once simulate mode is measured and build
   mode's fate is decided.

---

## 8b. Build log — steps 1–3 (what the code does that this memo did not predict)

Three defects were found by measuring the model, not by reasoning about it. Each was
fixed in the model rather than absorbed into a weakened test.

| Found                                                                                                                      | Was                                                                                                                                                                                                                  | Now                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Campaign had **no measurable effect** (control mean 0.437 vs treated 0.436)                                                | Every agent trusted all media outlets with uniform-random weights, so all were pulled toward the same global average at 0.15/tick — a ~7-tick time constant that homogenised the population and swamped the campaign | Homophilous media diet: trust decays with belief distance (`MEDIA_HOMOPHILY_TAU = 0.25`), outlets spread across the axis instead of placed at random, `media.weight` 0.15 → 0.05                                              |
| Injected assets **outran their neighbours' confidence bound** and were filtered out, so amplification accomplished nothing | `amplification` pushed the injector's _own belief_ toward 1.0                                                                                                                                                        | `amplification` now re-weights how hard an asset pulls its neighbours (algorithmic boost). Assets converge on `targetPosition` at `injectionRate` and hold. Bounded confidence still filters — boost cannot buy reach past it |
| Platform intervention **neutralised the whole campaign at any coverage**                                                   | Boost was gated on `platformActive` alone                                                                                                                                                                            | Gated on `platformActive && coveredByDefense.has(j)` — only assets actually reached lose their boost                                                                                                                          |

Two findings worth carrying into the analytic product:

1. **Reach dominates amplification.** Across the sweep, raising injection nodes 40→120 moved
   mean belief roughly three times as much as raising amplification 1→8. Bounded confidence
   caps what volume can buy. This is now a regression test, not a remark.
2. **Naive drift-reduction scoring rewards over-correction.** Measured counter-messaging at
   0.6 coverage drove mean belief to 0.299 against a 0.497 control — it "reduced drift" by
   overshooting into the opposite direction, which is a second influence operation, not a
   defence. `interventionEffect()` therefore scores against the no-campaign counterfactual
   and reports `overshoot` separately, and caps `costPerPointRestored` so overshooting
   cannot look cheaper than exact correction.

Deliberate detail the memo left open: the detector does **not** separate attacked from
control worlds perfectly (control max 0.428 overlaps attacked min 0.380). That overlap is
kept and asserted — perfect separation would mean the detector is reading something a real
platform could not see, and it is what a precision/recall sweep would need to be a real
measurement. No such sweep has been run: `detectCampaign` is called only from a unit test.

## 8c. Build log — steps 4–5, and one limitation that must reach the white paper

Built: `evidence/icd203.ts`, `evidence/types.ts`, `evidence/ach.ts`,
`evidence/contradiction.ts`, `evidence/abstention.ts`. 82 tests.

**Contradiction classification and reconciliation score 100% on the gold set — and that
number is worth much less than it looks.** The synthetic generator plants conflicts using
the same four structural rules the classifier uses to identify them (scope, then date, then
instrument, then dispute). So the measurement confirms the classifier is _implemented
correctly_; it says nothing about detecting contradictions in real prose, where the
distinguishing fields are not handed over as structured metadata. Reported honestly:

- **Measured:** classification and reconciliation are correct on 20 planted conflicts.
  Evidence class: unit tests, synthetic corpus.
- **Not measured:** contradiction detection on real-world sources. Requires the Phase-2
  real-ingestion path, and until it runs the honest answer is _unknown_.

This must appear in the white paper's limitations section. A reader who sees "100%
contradiction-detection accuracy" without it has been misled.

Design notes worth recording:

- ACH ranks by weighted **inconsistency ascending** — the hypothesis with least evidence
  against it wins. A test asserts that a hypothesis with three pieces of non-diagnostic
  support and one diagnostic strike loses to one with no evidence at all, because
  consistency-counting is the usual mis-implementation and it rewards whichever hypothesis
  attracted the most confirmation-seeking collection.
- `aggregateConfidence` is weakest-link, and a test asserts four `high` views plus one `low`
  yields `low`. A mean would return `high`.
- The likelihood/confidence separation is enforced by the _absence_ of a collapsing
  function, so the guard is a source scan for `(…: Judgment…): number` — with a negative
  control asserting the regex matches the shape it bans.
- Conflict classification order is load-bearing: each reconcilable explanation is ruled out
  before the next is considered. Reversing it lets a definitional mismatch masquerade as a
  genuine dispute and depress confidence for no reason.

## 8d. Build log — step 6, and a blocked live verification

Built: `llm/{client,anthropic,claude,stub,structured}.ts`, `evidence/partition.ts`,
`agents/{framer,panel,red-team}.ts`, `sim/adapters/influence-ops/mapping.ts`. 149 tests.

**Live verification is blocked: both credentials in `.env` are invalid.**

```
ANTHROPIC_API_KEY (x-api-key)      FAIL: API key is invalid.
CLAUDE_CODE_OAUTH_TOKEN (bearer)   FAIL: Error
```

CONFIRMED by direct Messages API call, which returns that in ~164 ms. Until a working key
is supplied, every claim about the analytic agents is evidence class (a) units with mocks or
(b) local e2e against stubs. **No live model output has been produced. No accuracy number
exists.**

Two diagnostic notes, one of them a correction:

- I first attributed the hang to the sandbox blocking `api.anthropic.com`. That was **wrong**
  — a sandboxed `curl` reaches the API and returns HTTP 401. The hang reproduced identically
  outside the sandbox. The cause was the credential all along.
- Observed once, worth knowing: Node's `fetch` to the API failed inside the sandbox while
  `curl` succeeded. Live runs therefore need `dangerouslyDisableSandbox` or an allowlist
  entry, independent of the credential problem.

**Architectural change: analytic agents use the Anthropic Messages API, not the Agent SDK.**
Justified independently of the credential issue:

|             | Agent SDK                                                   | Messages API               |
| ----------- | ----------------------------------------------------------- | -------------------------- |
| Invalid key | `system/init`, then **hangs indefinitely** (25 s+, aborted) | Clean error in **~164 ms** |
| Per call    | Spawns a CLI subprocess                                     | One HTTP request           |
| Needs       | CLI binary, config dir, IPC pipe                            | Nothing                    |

A forecasting system that hangs is worse than one that fails — a stalled ensemble is
indistinguishable from a slow one, and the run-completion metric would record neither. The
Agent SDK backend is kept for agents that genuinely need tools (the research agent uses
WebSearch); both implement `LlmClient`, which is what the seam is for.

_Superseded 2026-08-10: `llm/claude.ts` and the `@anthropic-ai/claude-agent-sdk` dependency
were deleted — nothing ever imported it and the tool-using agent was never built. The
comparison above stands as measured; only the "is kept" commitment is reversed._

Design notes:

- **Hypotheses are outcome bands over a resolvable quantity, not free-text propositions.**
  Mutual exclusivity, exhaustiveness and resolution all become structural. `assertPartition`
  rejects overlaps and gaps and the framer throws rather than repairing — a quietly patched
  partition makes every downstream Brier score wrong in a way nothing else surfaces.
- `risk` and `temperature` keep their wire names and gain their documented semantics in
  `agents/framer.ts` (riskTolerance, escalationPropensity), with the interpretation into
  campaign parameters isolated in `mapping.ts` and bounded by `MAPPING_BOUNDS`.
- One JSON extractor with one retry policy replaces three near-identical ad-hoc parsers that
  had drifted apart across `planner.ts`, `research.ts` and `judge.ts`.
- The red team emits **no likelihood of its own** — an agent that both argues against the
  answer and helps produce it is hedging, not adversarial. Its rerun authority is bounded so
  it and the ensemble cannot loop.

## 8e. First live results — one component verified, one blocked

Credentials: `ANTHROPIC_API_KEY` valid (preflight PASS). `CLAUDE_CODE_OAUTH_TOKEN` and
`OPENAI_API_KEY` invalid; neither blocks Phase 1. Run `node scripts/preflight.mjs`.

### Framer — VERIFIED LIVE ✅

Evidence class **(c) live against a real model**, reproduced across three separate runs:

```
framer: 1 attempt, diversity 0.379, cost $0.0160
bands:  h1[0.00,0.25) h2[0.25,0.50) h3[0.50,0.75) h4[0.75,1.00)
runs:   Conservative fragmentation(r15/e20)  Cautious bridging(r35/e45)
        Asymmetric volatility(r25/e75)  Permissive consensus-seeking(r70/e55)
        Aggressive homogenization(r85/e90)
```

A real model produced a structurally valid MECE partition first try, and a genuinely
divergent ensemble spanning the parameter space. **Measured cost: $0.016 per framing call.**

### Adjudicator — BLOCKED, 100% refusal 🔴

**Measured: 5/5 refusals (`stop_reason: refusal`) on the current prompt.** Not an outage,
not a bug — the model declines the task. Contributors measured on identical repeated
prompts:

| Prompt component                                           | Refusal rate          |
| ---------------------------------------------------------- | --------------------- |
| Question + hypotheses + ensemble, bare question            | 0/3                   |
| \+ any structured reporting instruction                    | 3/3                   |
| \+ dated observation block (either wording)                | 3/3                   |
| \+ "name the collection source where it would be observed" | 1/3                   |
| Domain-laden preamble naming "information operations"      | 3/3                   |
| No preamble at all                                         | 3/3                   |
| Short neutral preamble (isolated probe)                    | 0/3 → **5/5 in situ** |

Three hypotheses tested and **all disproved**: sandbox networking (curl reached the API),
non-determinism (10/10 identical), domain vocabulary (fully neutral wording still refused).
The last row matters most: a configuration that measured 0/3 in isolation refused 5/5 in
the real pipeline, so this prompt sits **on a decision boundary where small samples are
noise**. Further prompt iteration would be tuning against noise, and I stopped.

One counterintuitive result worth keeping: **a safety disclaimer naming the sensitive topic
made refusals more likely than saying nothing** (3/3 with the preamble, 3/3 without,
0/3 with a preamble that simply describes the task literally). Disclaimers read as topic,
not as reassurance.

### What was built in response

Refusal is now a **first-class, measured failure mode** rather than an error:

- `LlmRefusalError` is distinct from transient failure and is **never retried** — it is
  deterministic, so a repair prompt spends budget to get the same answer.
- The live test **measures the refusal rate instead of asserting success**. A green tick
  that depended on luck would be worse than a number.
- The ensemble must degrade gracefully when an adjudicator abstains — which is exactly the
  k-of-N graceful-degradation requirement in §7, now with a real failure to exercise it.

### For the white paper

This belongs in the limitations section, stated plainly: **a system performing defensive
analysis of information operations will encounter model refusals on its core analytic task,
at rates high enough to block a pipeline.** Any credible architecture in this domain must
treat refusal as an expected operating condition with measured rate and a degradation path,
not as an exception. That is a finding about deploying LLM ensembles for this mission, and
it generalizes beyond this prototype.

## 8f. The metrics package — deliverable #3, complete

`src/metrics/`: `types` · `brier` · `murphy` · `calibration` · `scoring-rules` ·
`baselines` · `ensemble` · `stability` · `agreement` · `analytic-qa` · `operations` ·
`index`. **100 unit tests**, verified against hand-computable and textbook values —
the Murphy identity `Brier = reliability − resolution + uncertainty` reproduces to 12
decimal places.

Reporting discipline is enforced by the API surface rather than by convention:

- `forecastQualityReport` **requires** an `EvaluationRegime`
  (`synthetic_oracle` | `historical_backtest` | `live_post_cutoff`), and no function in
  the package pools them. A number cannot travel without the context that makes it
  meaningful.
- `formatQualityReport` **appends its own caveat** on synthetic-oracle results and warns
  when the system is hedging.
- `timeComparison` takes the measured manual baseline as a **required argument**, so a
  speedup against a guessed number cannot be produced by accident.
- `compareToBaselines` omits `human_analyst` unless a human was actually measured.

Two design points worth recording:

- **`forecastFromEnsemble` is now the primary forecast path** while LLM adjudication
  abstains. The distribution of run outcomes across the hypothesis bands is a forecast,
  and a defensible one. It applies Laplace smoothing by default: an 8-run ensemble that
  put nothing in a band must not therefore claim 0% — that is both dishonest, since no
  finite sample rules an outcome out, and fatal to log scoring, which returns −∞ on it.
- **Sharpness and resolution are reported beside every calibration number.** A system
  answering the base rate on every question is perfectly calibrated and worthless; Brier
  and ECE both approve of it, and only sharpness and the Murphy resolution term expose
  it. A test asserts exactly that case.

`analytic-qa.ts` carries the §8c caveat in its module docstring, so the limitation
travels with the code and not only with this memo.

## 8g. Build log — step 7, the orchestrator, and the first calibration numbers

`src/pipeline/`: `types` · `ensemble` · `analysis` · `product` · `run-question` ·
`score` · `benchmark` · `influence-ops-binding` · `index`. **121 new tests**; the eval
suite is now **48 files / 669 tests**, `tsc --noEmit` clean, 4.4s offline.

`runQuestion()` runs: frame → fan out through the existing `Semaphore` → hidden oracle
run → mechanical evidence → **abstention gate** → ensemble forecast → adjudication →
red team (bounded rerun) → BLUF product → leakage assertion.

### Four decisions the memo did not specify

- **Ground truth is a separate oracle run.** Its summary never enters a prompt or an
  ensemble statistic. Without this the Brier score measures the ensemble against
  itself. A test asserts the oracle's value and artifact id appear in no prompt.
- **The abstention gate runs on mechanically-derived evidence.** A reading is
  consistent with the band it landed in and inconsistent with every other, so
  diagnosticity and separation fall out of Heuer's formula with no model involved.
  This is what lets the gate fire while the adjudicator refuses 100% of the time —
  a gate that needed an LLM would report "could not check" as "should not answer".
- **Confidence has no forecast-diffuseness term.** Spread is uncertainty and belongs
  in the likelihood; folding it into confidence is the exact ICD 203 conflation this
  system refuses to make. Losing the adjudication layer caps confidence at _moderate_
  rather than collapsing it to _low_ — the ensemble forecast still stands, just
  uncross-checked, and a constant _low_ would carry no information in the regime we
  are actually in.
- **The framer degrades to a uniform partition plus a golden-ratio parameter sweep.**
  The whole pipeline therefore runs with no working model at all, which is the
  configuration the benchmark below was measured in.

### Three defects found and fixed (all pre-existing, none introduced by step 7)

- `ArtifactStore.create()` **appended** to an existing run's event log. Re-running an
  identity — which is how reproducibility is checked — produced a different artifact
  hash for a reason that had nothing to do with the simulation. Now the stale log is
  discarded. Caught by the determinism test, not by review.
- `campaignFromRunSpec()` emitted **invalid campaigns on any world smaller than the
  120-tick / 400-agent reference** (`startTick` past `endTick`; `injectionNodes`
  exceeding the population). Both clamped at source. Every clamp is a no-op on the
  reference world, so the measured parameter sweep still describes it exactly.
- `sim/adapters/influence-ops/index.ts` never re-exported `mapping.ts`, so the
  RunSpec→config mapping was unreachable through the adapter's public surface.

The determinism guard now scans `src/pipeline/` as well as `src/sim/`, and was
re-verified non-vacuously: a planted `Math.random()` + `Date.now()` file failed the
guard by name, and passed once removed.

### First calibration numbers — synthetic oracle, offline path

`PROTEUS_BENCH=1 npx vitest run tests/benchmark`. adoptionRate at tick 119, 4 bands
over a **pre-registered** [0.35, 0.65] (measured on a 5×5 sweep before any question was
scored: observed 0.390–0.613, widened 0.04 either side), 16-run ensembles, 10 questions
per arm, **849 simulations in 15s**. No LLM in the loop — this is the ensemble forecast
alone, the configuration the system currently ships in.

| arm                     | bands | abstained | Brier  | skill vs base rate | ECE    | coverage@1 |
| ----------------------- | ----- | --------- | ------ | ------------------ | ------ | ---------- |
| narrow (well-evidenced) | 4     | 0/10      | 0.1082 | **+0.4227**        | 0.1125 | 0.700      |
| medium                  | 4     | 0/10      | 0.1005 | **+0.4640**        | 0.1225 | 0.800      |
| wide-control            | 4     | 0/10      | 0.1665 | +0.1119            | 0.0619 | 0.400      |
| indistinguishable       | 16    | **10/10** | —      | —                  | —      | —          |
| misspecified            | 4     | 0/10      | 0.3143 | **−0.6763**        | 0.3333 | 0.000      |

Three things this establishes, and one it does not:

1. **Skill tracks evidence quality monotonically** — +0.46 → +0.42 → +0.11 as the prior
   widens. Asserted as a test, not just observed.
2. **The metrics measure something.** Pointed at a parameter region the truth was _not_
   drawn from, the system scores **worse than stating the base rate** (−0.68) with
   coverage@1 of **zero**. A pipeline that scored the same either way would be measuring
   nothing; this one does not.
3. **The abstention gate discriminates.** The `indistinguishable` arm partitions the
   range more finely than the simulator's irreducible seed noise (band width 0.019 vs
   seed sd ≈ 0.021), so no forecaster could separate adjacent bands. It abstained
   **10/10**, while every answerable arm abstained **0/10**.
4. **It does not establish real-world forecasting skill.** Ensemble and oracle come from
   the same simulator. These numbers say the pipeline propagates its own uncertainty
   honestly. Historical-backtest and live post-cutoff accuracy remain **NOT YET
   MEASURED**, and `formatBenchmark()` prints that caveat under every table it emits.

### Open findings — all three resolved in §8h, which supersedes this section

> Read §8h before acting on anything below. Measured there: the 0/10 abstention rates
> are a small-sample result (0.15 refuses 65 of 320 answerable questions at 80 per arm,
> which is why the shipped threshold is now 0.05); the gate's discrimination
> comes from `minDiagnosticEvidence`, not from the 0.15 separation threshold; and MCE
> does not stabilise at any batch size, so growing n does not fix it.

- **`wide-control` did not abstain at all** (0/10) despite a prior spanning the whole
  parameter square. A wide _parameter_ prior still yields a peaked _outcome_ histogram,
  so ACH separation stays above the 0.15 threshold. The gate is behaving as specified;
  whether 0.15 is the right threshold is an open question, and it must be settled by
  measuring the false-abstention rate — **not** by tuning until the control fires.
- **Two ensemble members and one question were lost to values escaping the partition**
  (recorded as `resolve`-phase failures and as `unresolved`, never silently dropped).
  Correct behaviour, and the honest cost of a pre-registered range.
- **n is small.** MCE of 0.75 on 40 binary points is a sparse-bin artefact, not a
  finding. Batch sizes need to grow before any of these figures goes in a white paper.

## 8h. Build log — step 8: the abstention gate's operating point, measured

§8g left three findings open. All three are now measured, and two came back
differently from what §8g assumed.

New: `src/pipeline/threshold-sweep.ts` (+17 tests), and a sixth benchmark arm, `tied`,
without which the separation threshold's benefit cannot be measured at all (Finding 5).
`abstentionThresholds` is now injectable through `QuestionInput` and `BenchmarkOptions` —
`abstention.ts` promised in its docstring that "every threshold is explicit and
configurable so the false-abstention rate can be measured", and `run-question.ts` was
calling the defaults regardless. The benchmark and the sweep now share one run: publishing
a curve beside a table from a different batch would invite reading two runs as one.

Headline batch is now **80 questions per arm, 32-run ensembles — 15 832 simulations in
305s**, up from §8g's 849. It supersedes §8g's table; the two must not be pooled.

One default changed: **`minSeparation` 0.15 → 0.05**, on the evidence below.

### The instrument, and why it is exact

`evaluateAbstention` is a pure function of signals a completed run already recorded,
and in the benchmark configuration nothing downstream of the gate feeds back into
them: `rerunBudget: 0` and a client that fails every call pin the orchestrator's
loop to one iteration, so ensemble, oracle, contradictions and claims are identical
whichever way the gate goes. One run therefore yields the entire curve.

That is an assumption, so the sweep does not trust it. `assertReplayable` replays
the run's OWN thresholds on every call and throws if a replayed decision disagrees
with the recorded one, or if the recomputed ensemble forecast disagrees with the
reported one. Separately, a test runs the benchmark twice — once at defaults, once
with a candidate injected — and asserts the offline sweep predicted the injected run
arm-for-arm. It is exact only in this configuration: with a live client and
`rerunBudget > 0` a red-team challenge can force a second ensemble, and the signals
a question ends on then depend on the gate that let it get that far.

### Finding 1 — the separation threshold is not what makes the gate work

`achMatrixFromEnsemble` marks each reading consistent with exactly the band it landed
in and inconsistent with every other, never `not_applicable`. So for every reading
`applicable = B`, `consistent = 1`, `inconsistent = B-1`, and Heuer's formula returns
the same number for all of them: **diagnosticity = 2·min(1, B-1)/B = 2/B**. Two
consequences, both verified against the running pipeline:

- **`separation` is an ordinal statistic of the occupancy histogram, not a measure of
  spread.** With diagnosticity and credibility constant, a band's ACH score is
  `(N − n_h)·d·c`, so ranking ascending by score is ranking descending by occupancy
  and separation collapses to `(n₁ − n₂)/(n₁ − n_min)` — the modal band's margin over
  its nearest rival. A 4-band/16-run split of (7,3,3,3) scores separation **1.000**,
  identical to a unanimous (16,0,0,0), while the far more concentrated (7,6,3,0)
  scores **0.143**.
- **`diagnosticEvidenceCount` is a step function of band count.** `2/B ≥ 0.2` exactly
  when `B ≤ 10`, so the count is the whole surviving ensemble at `B ≤ 10` and exactly
  **0** at `B ≥ 11` — never anything between, and never a function of evidence quality.

The `indistinguishable` arm has B = 16, so its abstention is mechanical. Measured:
holding separation at 0.15 and disabling `minDiagnosticEvidence` drops that arm from
**80/80 abstentions to 27/80** (true-abstention 100% → 34%); at the adopted 0.05 it drops
further, to **8/80**. The answerable arms do not move in either case. Left to itself the
separation threshold catches a third of the arm it was credited with catching at 0.15, and
a tenth of it at 0.05.

§8g's claim 3 attributed the 10/10 to band width (0.019) being below seed noise
(sd ≈ 0.021). On this quantity the two cannot be separated: bands finer than the noise
over a range of 0.30 require B ≥ 15, and B ≥ 15 > 10 already forces the diagnostic
count to 0. **The negative control is confounded by construction** — it does not
isolate what §8g said it isolates.

### Finding 2 — the pipeline refuses any question with more than 10 bands

Worth stating separately, because it is undocumented and is not a benchmark artefact.
At `B ≥ 11` every reading falls below `DIAGNOSTIC_THRESHOLD`, so
`diagnosticEvidenceCount = 0 < 3` and the gate fires **regardless of the evidence**.
Verified: a 16-band question whose ensemble puts 16 of 16 runs in one band — perfectly
decisive, separation 1.0 — still abstains, on `insufficient_diagnostic_evidence` alone.

The refusal is defensible (this evidence construction genuinely cannot discriminate 16
bands) but the reason it gives is not, and its collection guidance sends the analyst
somewhere impossible: _"Collect evidence that would be INCONSISTENT with at least one
hypothesis"_ — no additional simulation reading can ever raise `2/B`. The honest
guidance for this failure mode is **coarsen the partition**. Not changed here: it
alters operator-facing product text.

### Finding 3 — n = 10 was hiding the false-abstention rate

§8g recorded every answerable arm abstaining **0/10** at the old 0.15. At 80 questions
per arm, with the `tied` arm present, 0.15 refuses **65 of 320** answerable questions.

| minSeparation      | false-abstention | true-abstention | J          |
| ------------------ | ---------------- | --------------- | ---------- |
| 0.00               | **0%**           | 100%            | **1.0000** |
| **0.05 (adopted)** | **7%**           | 100%            | 0.9281     |
| 0.10               | 10%              | 100%            | 0.9031     |
| 0.15 (was shipped) | 20%              | 100%            | 0.8031     |
| 0.20               | 23%              | 100%            | 0.7688     |
| 0.30               | 35%              | 100%            | 0.6500     |
| 0.50               | 63%              | 100%            | 0.3750     |

True-abstention is 100% at **every** setting including zero — the unanswerable arm is
caught in full by `minDiagnosticEvidence` before separation is ever consulted. Disable
that condition and separation at 0.05 catches **8 of 80** on its own.

`minDiagnosticEvidence` by contrast sits mid-plateau: every value from 1 to 16 behaves
identically, 32 costs 25% false abstention, 33 refuses everything. The shipped 3 is well
chosen and is left alone.

### Finding 5 — the separation condition refuses questions it has no reason to

§8h added a sixth arm, `tied`, for one purpose: to give the separation condition its best
case. Eight bands (so `2/B` clears the diagnostic threshold and that condition is inert)
over the widest prior, so the leading bands routinely tie. Every abstention in this arm is
attributable to separation and to nothing else.

It does not survive its own control. Compare the skill of what each threshold keeps
against the skill of what it throws away, within the arm:

| minSeparation | kept        | given up    |
| ------------- | ----------- | ----------- |
| 0.00          | 80q +0.0856 | —           |
| 0.05          | 66q +0.0883 | 14q +0.0729 |
| 0.15          | 45q +0.0943 | 35q +0.0745 |
| 0.20          | 43q +0.0858 | 37q +0.0855 |
| 0.55          | 6q +0.1748  | 74q +0.0784 |

**The questions it refuses forecast about as well as the questions it keeps**, and kept
skill does not climb as refusals rise — it wobbles around +0.09 while up to 92% of the arm
is discarded. A gate that were selecting for unanswerable questions would show kept skill
rising and given-up skill near or below zero. This one shows neither.

The reason is now clear. Separation asks whether one band dominates its nearest rival —
which is a fact about the SHAPE of a forecast, not its quality. The premise behind the
condition's own message ("reporting a winner here would be reporting noise") is that a
winner must be reported. This system does not report a winner; it reports a calibrated
distribution over every band, and "roughly even between two adjacent bands" is a correct
and useful statement of it. Separation on the unanswerable arm even reaches **0.7059**,
higher than the answerable `tied` arm's maximum of **0.5714** — the signal does not rank
answerability at all.

### Finding 4 — MCE does not stabilise at any batch size

§8g expected MCE to settle once batches grew. It does not, and growing them shows why:
MCE is the worst SINGLE calibration bin, the ensemble's probabilities cluster, and the
tail bins never fill however many questions are added.

| batch | arm          | n   | ECE        | MCE        | occupied bins | emptiest bin |
| ----- | ------------ | --- | ---------- | ---------- | ------------- | ------------ |
| 10×16 | narrow       | 40  | 0.1125     | 0.7500     | 8             | 1            |
| 40×16 | narrow       | 152 | 0.0757     | 0.6000     | 9             | 1            |
| 40×32 | narrow       | 152 | 0.0451     | 0.3194     | 8             | 6            |
| 80×32 | narrow       | 300 | 0.0400     | 0.4167     | 9             | 2            |
| 40×32 | wide-control | 128 | 0.1151     | 0.6111     | 7             | 1            |
| 80×32 | wide-control | 252 | **0.0423** | **0.6111** | 7             | 1            |

That last pair is the whole finding: `wide-control`'s sample nearly doubles, ECE falls
63%, and MCE does not move a digit — because the emptiest occupied bin is still 1.
ECE, which weights bins by occupancy, is the figure that responds to sample size, and
the three answerable arms first agree with each other at 80×32 (0.040 / 0.048 / 0.042)
having disagreed by 2–3× at every smaller size. `formatBenchmark()` now prints this
caveat under every table. Reproduce with `PROTEUS_SCALE=1 npx vitest run tests/benchmark/scaling`.

### The 80×32 table — supersedes §8g

Six arms, `minSeparation` 0.05, **15 832 simulations in 305s**.

| arm                     | bands | abstained | Brier  | skill vs base rate | ECE    | coverage@1 |
| ----------------------- | ----- | --------- | ------ | ------------------ | ------ | ---------- |
| narrow (well-evidenced) | 4     | 0/80      | 0.1058 | **+0.4355**        | 0.0344 | 0.688      |
| medium                  | 4     | 2/80      | 0.1088 | **+0.4198**        | 0.0476 | 0.692      |
| wide-control            | 4     | 7/80      | 0.1664 | +0.1125            | 0.0388 | 0.411      |
| tied                    | 8     | 14/80     | 0.0997 | +0.0883            | 0.0193 | 0.288      |
| indistinguishable       | 16    | **80/80** | —      | —                  | —      | —          |
| misspecified¹           | 4     | 0/80      | 0.2730 | **−0.4561**        | 0.2892 | 0.123      |

¹ Scored on 73 of 80. The 7 questions whose truth landed just above the top band
(0.655–0.708) have no resolved outcome and drop out of Brier, skill, ECE and coverage@1.
Counting them as misses, coverage@1 is 9/80 = 0.1125.

§8g's three substantive properties survive the bigger batch: skill tracks evidence
quality monotonically, the misspecified arm scores worse than the base rate with
coverage@1 of 0.123, and the unanswerable arm abstains 80/80. Every run lost was lost
in `resolve` — a realized value escaping the partition — never to machinery.

Brier does not compare across rows with different band counts: `tied`'s 0.0997 is lower
than `narrow`'s 0.1058 because spreading mass over eight bands is arithmetically cheaper,
not because the harder arm forecasts better. Skill vs base rate is the comparable figure,
and it ranks the arms the way the evidence does.

### Two latent defects, found and not fixed

Both are unreachable in the shipped configuration; both change behaviour on a path the
benchmark does not cover, so they are recorded rather than patched.

- **ACH evidence ids collide after a red-team rerun.** Ids are `reading-${specId}` and
  the rerun re-runs the SAME `runSpecs`, so `mergeEnsembles` yields duplicates;
  `verdictLookup` is last-write-wins while the scoring loop iterates the duplicated
  array. Demonstrated: a 4-member ensemble split one-per-band, merged, is scored as
  unanimous — separation 1.0 instead of 0. Needs a working client and `rerunBudget > 0`.
- **An empty ensemble plus permissive thresholds throws.** A question that loses every
  member records separation 0 and diagnostic evidence 0. Either default condition stops
  it, but a candidate permissive on BOTH would let it through and `forecastFromEnsemble`
  then throws `ensemble has no runs`. The sweep now counts these as `undecidable`, holds
  them out of both rates and prints `INVALID OPERATING POINT`: a setting that would
  crash the pipeline must not read as one that answers everything.

### The answer to §8g's open question

**Applied: `minSeparation` 0.15 → 0.05.** Measured effect on the six-arm benchmark —
false abstention 20% → 7%, true abstention unchanged at 100%. `narrow` goes from 5
abstentions to 0, `medium` 6 → 2, `wide-control` 17 → 7. Nothing is given up for it,
because the unanswerable arm was never being caught by this condition.

**Still on the table: 0, i.e. retiring the condition.** J is maximised there, and the
`tied` arm — built specifically to give the condition its best case — shows it refusing
questions that forecast as well as the ones it keeps (Finding 5). The argument that
survived the first sweep was that `separation = 0` marks an exactly-tied field where
reporting a winner would be reporting noise. The `tied` arm refutes it on the evidence:
those questions score **+0.073** skill, positive and not far off the +0.088 of the
questions let through. Refusing them destroys information rather than withholding noise.

0.05 is kept for now rather than 0 because retiring a gate condition outright is a
different kind of decision from re-pointing one, and because the argument for zero rests
on this system reporting distributions rather than winners — a property of the current
product shape, not a law. If a future product surface has to name a single leading band,
the condition becomes meaningful again and the number should be re-measured then.

What is now settled, and was not before: the gate's demonstrated discrimination comes
entirely from `minDiagnosticEvidence`; the separation threshold's cost is quantified at
every setting; and the benchmark finally contains an arm that can exercise it.

### What this still does not establish

All of the above is synthetic-oracle. A threshold picked from this curve is calibrated
to this benchmark's difficulty, not to the world's. Historical-backtest and live
post-cutoff accuracy remain **NOT YET MEASURED**.

## 8i. Build log — step 9: the slice becomes runnable

`runQuestion` had no caller outside its tests, so the Phase-1 slice could be verified but
not shown. It now has one.

```
eval-agent forecast "<question>" [--offline] [--measure adoptionRate] [--tick 119]
                                [--range 0.35,0.65] [--bands 4] [--runs 16]
                                [--seed proteus] [--as-of 2026-03-01] [--store DIR] [--json]
```

`src/forecast.ts` (+10 tests) builds the four dependencies `runQuestion` needs and gets
out of the way; `formatProduct` already existed and does the rendering.

Three decisions worth recording:

- **Build mode became a default subcommand.** A `requiredOption` on the commander program
  is validated before any subcommand is dispatched, so leaving `--config` at the root made
  `forecast` demand a judging config it never reads. Build mode is now the `eval` command
  registered with `isDefault`, so `eval-agent -c config.json` reaches exactly the same
  action it always did. Verified against the built CLI, not only in tests.
- **Output leads with the synthetic-world warning, before any number.** The one output
  this system must never ship quietly is a forecast that reads like analysis of the world
  and came entirely from a simulator. A test asserts that banner is the first line.
- **No key is not an error.** Without `ANTHROPIC_API_KEY` the command runs the offline
  path — uniform partition, golden-ratio parameter sweep, ensemble forecast, no model
  anywhere — and says so in the `model:` line. That is the configuration the benchmark
  measures and the one the system currently ships in, so a missing key should not read as
  a broken install.

Corpus parameters are fixed in source rather than exposed as flags: they are the
benchmark's, so a CLI question and a benchmark question see the same evidence base, and
nobody gets a knob that widens the corpus until the contradiction rate looks better.

## 8j. Build log — step 10: the metrics dashboard (deliverable #6)

`web/app/metrics/` — per-arm scores, a reliability diagram, the abstention operating
curve, skill by arm, and cost. It renders the existing `BenchmarkReport`; no new
measurement was invented for it.

### The seam

The dashboard is a Next.js app that cannot import the eval package, so the two meet at a
generated JSON file. **Everything numeric is computed on the eval side**
(`src/pipeline/snapshot.ts`, +9 tests) and the React components only lay it out — a
reliability curve recomputed in a component is a second implementation of calibration,
and the two would disagree eventually. Regenerate with:

```
cd eval && PROTEUS_BENCH=1 \
  PROTEUS_SNAPSHOT_OUT=../web/data/benchmark-snapshot.json \
  npx vitest run tests/benchmark/calibration
```

Snapshots accumulate by label, so running several batch sizes builds the series the
"skill across runs" panel needs. With one batch it says so rather than drawing a trend
through a single point.

While wiring it, the one-vs-rest expansion was extracted to `expandToBinary()` and
`scoreQuestions`, the scaling study and the snapshot now share it. Three copies had
started to appear, and calibration bins derived from a different expansion than the Brier
score would describe a different set of forecasts.

### What the UI is built to prevent

- **The regime caveat travels with the data.** `SYNTHETIC_ORACLE_CAVEAT` is now a single
  exported constant, quoted verbatim by `formatBenchmark()` and carried inside every
  snapshot, and the page prints it above the first number.
- **No total row, no averages.** Arms are never pooled, so there is nothing to quote as
  an overall score.
- **MCE never travels alone.** Each arm carries `occupiedBins` and `emptiestOccupiedBin`,
  and marker size on the reliability diagram is bin occupancy — so a bin holding one
  forecast cannot read like a calibration failure (§8h, Finding 4).
- **Cost reads "not priced", never $0.00.** With no model in the loop there is no cost per
  insight; printing zero would read as "insights are free" rather than "nothing was
  priced".
- **An arm that abstained on everything renders as "nothing to score"**, not as a blank
  that could be mistaken for a good number.
- **Brier is footnoted wherever band counts differ**, because `tied` scores a lower Brier
  than `narrow` for reasons of arithmetic.

### Two defects found by looking at it

The palette was validated by script rather than by eye (lightness band, chroma, CVD
separation and contrast against this app's `#001a0d` surface). Layout still had to be
looked at, and two things only showed up rendered:

- Both abstention series converge on 100%, so end-anchored direct labels printed on top of
  each other. The flat series is now labelled at the right edge and the rising one
  mid-climb.
- The negative skill bar put its value label on the wrong side of zero — a sign error in
  the offset, invisible until an arm actually scored below the base rate.

## 9. What I need from you

**Approve, or tell me what to change.** No code gets written until you do.

Open items I did not ask about and will decide myself unless you say otherwise:

- **Government submission target.** If there's a specific solicitation with page limits and
  stated evaluation criteria, the white-paper section should be shaped to it. Absent that,
  I'll write it generically.
- **N for the Phase-1 demo.** Planning on N=8 for interactive runs, N=200 for metric batches.
- **Model routing.** Framer and adjudicators on Claude Sonnet; report writer on Opus —
  matching the existing `ModelConfig` defaults. The `agent: "claude" | "codex"` field
  generalizes to a provider seam so model-swap cost is measurable.
