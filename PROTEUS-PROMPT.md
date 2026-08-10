# PROTEUS — paste-ready prompt

Paste everything between the `---BEGIN---` / `---END---` markers into a fresh Claude Code
session at the root of this repo.

---BEGIN---

You are architecting a pivot of this repository. Read the repo first — `README.md`,
`api/src/types.ts`, `api/src/ideation.ts`, `eval/src/types.ts`, `eval/src/orchestrator.ts`,
`eval/src/agents/{planner,research,judge,report-writer}.ts`,
`eval/src/scoring/{compute,normalize,outliers}.ts`, `worker/runner.py`,
`worker/implementation_worker.py`, and `web/components/pipeline/` — before you write a
single line. Everything below assumes you have done that.

## 1. What exists

Treemux is a fan-out orchestrator. One problem statement spawns N isolated Modal sandboxes,
each running an autonomous coding agent with its own `risk` and `temperature` parameter and
its own persona profile. Each writes to its own git branch, deploys, and reports progress
over WebSocket. When all N finish, an evaluation service auto-designs a judging panel,
scores every result across weighted categories, z-score-normalizes across judges to remove
judge bias, detects outliers, and writes a ranked report.

Today the artifact each worker produces is a web app. That is the only accidental part of
the design.

## 2. The pivot, in one sentence

**The fan-out is already a Monte Carlo engine, and the judging panel is already an analytic
adjudication layer — so stop building web apps with them and start simulating futures.**

Retarget the platform to analyze, simulate, and predict complex phenomena across three
domains: adversary decision-making, emerging-technology trajectories, and geopolitical
shifts. Working codename: PROTEUS (swap it if you like; the repo stays `treemux`).

## 3. The mapping — do not rebuild what already exists

This is the core of the work. Each existing primitive gets a new meaning, not a rewrite:

| Existing                                                            | Becomes                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `taskDescription` → N ideas (`api/src/ideation.ts`)                 | One intelligence question → N divergent, mutually exclusive hypotheses / courses of action                                                                                                                                                                          |
| `workerDescriptions` + `api/assets/personas/*.md`                   | **Actor models** — doctrine, strategic culture, domestic constraints, information environment, escalation thresholds                                                                                                                                                |
| `risk` (0–100) and `temperature` (0–100) per worker                 | Adversary risk tolerance and escalation propensity. These are already exactly the two knobs a wargame needs. Keep the names, redefine the semantics, document them.                                                                                                 |
| Modal sandbox running a coding agent                                | Isolated **simulation run** — a multi-turn agent that advances world state and emits a structured event log instead of source code                                                                                                                                  |
| One git branch per worker                                           | Immutable, auditable **run artifact** with full provenance. This is a feature, not a leftover: every forecast is reproducible from its branch.                                                                                                                      |
| `treemux-report start / step / done`                                | Simulation checkpoints — turn-by-turn state deltas streamed to the analyst dashboard                                                                                                                                                                                |
| Vercel deploy + Microlink screenshot                                | Delete for simulation runs. Deployment is dead weight here. Keep the deploy path only if you keep a build mode.                                                                                                                                                     |
| Planner auto-designing a judging panel (`agents/planner.ts`)        | Auto-designing an **adjudication panel** of structured analytic techniques: Analysis of Competing Hypotheses, key-assumptions check, devil's advocate, premortem, red team                                                                                          |
| `agents/research.ts` (researches a person → judge persona)          | Researches real decision-makers, doctrine, and order of battle from open sources → grounds the actor models in evidence instead of vibes                                                                                                                            |
| Judge scores + weighted categories                                  | **Analytic confidence scoring** in ICD 203 vocabulary: separate the likelihood estimate from the confidence in it, and never collapse them into one number                                                                                                          |
| `scoring/normalize.ts` (z-score across judges)                      | Analyst/model **bias correction and calibration** — already correct as written                                                                                                                                                                                      |
| `scoring/outliers.ts` (global / dimensional / unique)               | **Low-probability, high-impact tail detection.** This is the most valuable module in the repo and it is already written. A "dimensional outlier" is a scenario the consensus underweights on one axis — that is precisely the surprise an analyst is paid to catch. |
| `scoring/compute.ts` composite                                      | Ensemble aggregation across runs                                                                                                                                                                                                                                    |
| Rankings report                                                     | BLUF product: ranked scenarios, probabilities, drivers, and indicators                                                                                                                                                                                              |
| WebSocket pipeline UI (`web/components/pipeline/`)                  | Analyst-in-the-loop live simulation dashboard                                                                                                                                                                                                                       |
| `Semaphore`, concurrency config, checkpointing in `orchestrator.ts` | Unchanged. Already the scale and resume story.                                                                                                                                                                                                                      |

If a file already does the job under a different name, **rename and redocument it — do not
fork it.** Report at the end which files you deleted and why that was safe.

## 4. The three domains

Build one shared simulation kernel and three domain adapters. Do not build three systems.

**A. Adversary decision-making.** A multi-actor game. Each actor has doctrine, objectives,
risk tolerance, resource constraints, domestic political cost functions, and — critically —
an _asymmetric information view_: each actor sees only what it can plausibly observe, and
misperception is a first-class modeled quantity, not noise. Output a course-of-action tree
with branch probabilities, decision points, and **indicators & warnings**: observable
signals that discriminate between branches. The I&W list is the deliverable an analyst
actually uses — "if you observe X, branch B just became three times more likely" beats any
single point prediction.

**B. Emerging technology.** Diffusion and capability-trajectory simulation. Inputs:
publication and patent velocity, funding flows, talent movement, supply-chain chokepoints,
export-control regimes. Simulate time-to-capability, proliferation pathways, and
second-order effects on economies and security balances. Output a trajectory with
confidence bands plus an explicit list of the assumptions the bands depend on.

**C. Geopolitical shifts.** Coupled multi-actor system dynamics over economic, alliance,
and domestic-political state. The valuable output is not the trend line — it is the set of
conditions under which the trend _breaks_, and how far in advance those conditions are
observable.

**D. Phase-1 vertical slice — build this one first: adversary influence operations, closed
world.** Instantiate a fully synthetic information environment: a population of agents with
belief distributions, media diets, trust weights, and a network topology. Inject a modeled
adversary influence campaign — narrative selection, injection points, amplification
strategy, timing — and measure belief drift, polarization indices, and cascade dynamics.
Then run the defensive half: which counter-messaging, friction, or platform interventions
actually reduce drift, and at what cost. The outputs are **detection signatures** (what
observable trace does this campaign leave in real telemetry?) and a **resilience playbook**
(which interventions dominate, under what conditions).

Hard scope boundary on D, and this is not negotiable: the simulation is entirely
closed-world. Synthetic populations only. No real accounts, no posting to any real platform,
no generation of deployable propaganda, no targeting of real individuals or groups. Data
ingestion is read-only from public or licensed sources. The system models influence
operations in order to forecast and defend against them. If you find yourself writing code
that emits content intended for a real audience, you have taken a wrong turn — stop and say
so.

## 5. Analytic tradecraft requirements

These are what separate a credible prototype from a demo:

- **Every claim carries provenance.** Source, date, and a confidence label. An assertion
  that cannot be traced to a source is a defect, and you should count them (see metrics).
- **Likelihood and confidence are separate fields.** ICD 203 style. "Likely, low
  confidence" is a legitimate and common answer.
- **The system must be able to say "insufficient evidence."** Build the abstention path
  first, not last, and measure whether it fires when it should.
- **Competing hypotheses are adjudicated, not averaged.** Use the ACH structure: score
  evidence against every hypothesis, and weight _diagnostic_ evidence — evidence that
  discriminates between hypotheses — far above evidence merely consistent with all of them.
- **Key assumptions are surfaced explicitly** and tagged with what would falsify them.
- **A dedicated red-team agent** whose only job is to argue the ensemble is wrong, with
  standing to force a rerun.

## 6. Quality assurance — reconciling conflicting sources

Build a source-reconciliation layer. When two ingested sources disagree on a fact, the
system must detect the contradiction, characterize it (different measurement, different
date, different definition, or genuine dispute), attempt reconciliation, and where it cannot
reconcile, propagate the disagreement into the confidence score rather than silently picking
one. The existing z-score normalization and outlier detection already give you the
disagreement math — extend it from judges to sources.

## 7. Success metrics — implement these as code, not prose

Build a `metrics/` package with real implementations and unit tests. This section is a
first-class deliverable, not documentation.

**Accuracy and calibration.** Brier score; Brier _skill_ score against explicit baselines
(base rate, random, single-model-no-ensemble, and a human analyst baseline you actually
measure); log/ignorance score; expected calibration error with reliability diagrams; the
Murphy decomposition (Brier = reliability − resolution + uncertainty), because reliability
and resolution fail in different ways and a single Brier number hides which; and sharpness,
to catch a system that games calibration by hedging toward base rates on everything.

**The leakage problem — treat this as the central scientific risk.** A model "predicting"
a historical event it has memorized is retrodiction, and it will produce spectacular,
worthless scores. Guard it four ways: (1) evaluate primarily on questions resolving _after_
the model's training cutoff; (2) as-of retrieval corpora with hard date filters, enforced in
code, so a run for date T can never retrieve a document published after T; (3) synthetic and
counterfactual worlds where no ground truth exists in training data; (4) a running live
forecasting tournament on near-term resolvable questions with a public scoreboard. Report
historical backtest and post-cutoff live performance as **separate numbers, never pooled.**

**Ensemble and scenario quality.** Coverage — did the N-scenario ensemble contain the
realized outcome, measured as hit rate at N. Diversity — pairwise distance across scenarios
(`cosineSimilarity` in `scoring/outliers.ts` already does this). Tail recall — of realized
surprises, how many appeared in the ensemble at any weight. And blind SME plausibility
ratings of scenarios, mixed with decoys.

**Analytic QA.** Contradiction-detection precision and recall against a seeded set of known
conflicts you deliberately inject. Source-reconciliation accuracy against a labeled gold
set. Provenance completeness — percentage of claims in the final product traceable to a
dated source. Unsupported-assertion rate. Inter-run stability — identical inputs, different
seeds, measure variance in the headline judgment; LLM systems are wildly unstable here and
almost nobody measures it, so this is a differentiator. Agreement with human analysts via
Krippendorff's alpha or Cohen's kappa.

**Efficiency and cost.** Time-to-first-insight and time-to-final-product against a
_measured_ manual baseline, not an assumed one. Analyst-hours displaced per product.
Dollars per scenario, per forecast, and per decision-relevant insight. Throughput at fixed
cost.

**Scalability.** Wall-clock as a function of N and its linearity. Cost per scenario as N
grows — should be flat or sublinear. Maximum concurrent runs before degradation. Corpus
scaling: ingest rate and retrieval latency at 10^6 documents.

**Reliability.** Run completion rate — the codebase already emits `JOB_ERROR`, so instrument
it. Reproducibility: pinned seed plus pinned corpus snapshot should yield an identical
artifact hash. Graceful degradation: what does the product look like when k of N runs fail,
and does the confidence score correctly drop? Checkpoint recovery time.

**Maintainability.** Test coverage of the analytic core specifically, not the whole repo.
Measured hours to add a new actor model, data source, or domain adapter. Model-swap cost —
the system must be model-agnostic, and the existing `agent: "claude" | "codex"` field is the
seam to generalize. Config-over-code ratio: a new scenario should be a new config file.

**Negative controls.** Include questions where the correct answer is "insufficient
evidence," and questions whose ground truth contradicts the obvious prior. A system that
never abstains and never surprises itself is overfit to sounding confident.

## 8. Deliverables

1. **An architecture memo** mapping the existing repo to the new system file by file: kept,
   redefined, deleted. Lead with a plain-English section a non-engineer can follow.
2. **A working Phase-1 vertical slice** — the closed-world influence-operations simulation,
   end to end: question in, N parallel runs, adjudication, calibrated ensemble output,
   live dashboard. Thin but complete beats broad and broken.
3. **The `metrics/` package**, implemented and unit-tested.
4. **The backtest harness** with as-of corpora and enforced leakage guards.
5. **A benchmark set**: historical questions with strict information cutoffs, plus live
   post-cutoff questions with resolution criteria written _before_ the runs.
6. **A metrics dashboard** — calibration curve, Brier skill score over time, coverage,
   stability, cost per insight.
7. **A white-paper section** suitable for a government submission: the approach, the
   evaluation methodology, the measured results, and an honest limitations section.

## 9. How to work

Ask me your clarifying questions **first**, bundled into a single round — do not start
building on assumptions. Then produce the architecture memo and stop for my approval. Only
then write code, and build the thinnest end-to-end slice before adding any breadth.

Evidence discipline throughout: label every causal claim CONFIRMED (with the output that
proves it) or ASSUMED. Never report an accuracy number that a run did not actually produce.
If the backtest has not been executed, say "not yet measured" — I trust that far more than
confidence. When you claim something works, name which class of evidence backs it: unit
tests with mocks, local end-to-end against stubs, or a live run against real data.

Do not gold-plate the UI. Correctness and calibration of the running system outrank polish.

---END---
