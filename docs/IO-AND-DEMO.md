# PROTEUS — inputs, outputs, and a government demo

Written 2026-08-10, immediately after extracting the repo. Every number here
comes from a command run that night against this code, in this location. Where
something is unverified it says so.

---

## 🧑 In Plain English

**What this is:** a look at what you actually feed PROTEUS, what it hands back,
and what it would take to put it in front of a government evaluator.

**The short version:** the forecasting machinery is fast and free — a full
16-scenario ensemble finishes in under a second. Everything slow and expensive
is the AI layer bolted on top of it, which took **5 minutes 54 seconds and 30
cents** for a single question. The good news is that the AI layer doesn't
produce the forecast — the simulation does — so the numbers can be on screen in
one second while the AI commentary arrives afterwards. That one change is the
difference between a demo that holds a room and one that doesn't.

**The honest gap:** an evaluator will ask "can it read _our_ documents?" Today
the answer is no — it invents its own document set every run. The plumbing for
real documents is designed and typed, but the loader that reads them off disk
was never written.

---

## 1. What goes in

### 1.1 What the CLI accepts today

`proteus forecast "<question>"` plus:

| Flag        | Meaning                                            | Default              |
| ----------- | -------------------------------------------------- | -------------------- |
| `--measure` | which population quantity to forecast (1 of 5)     | adoptionRate         |
| `--tick`    | the time step the outcome resolves at              | 119                  |
| `--range`   | the outcome range the bands tile, e.g. `0.35,0.65` | definitional         |
| `--bands`   | how many outcome buckets to split the answer into  | 4                    |
| `--runs`    | ensemble size                                      | 16                   |
| `--seed`    | same seed reproduces the run exactly               | `proteus`            |
| `--as-of`   | information cutoff; nothing later may be cited     | 2026-03-01           |
| `--store`   | where run artifacts are written                    | `.proteus-artifacts` |
| `--offline` | never call a model                                 | off                  |
| `--json`    | emit the product as JSON                           | off                  |

The five measures are `meanBelief`, `variance`, `bimodality`,
`clusterSeparation`, `adoptionRate` — all bounded population statistics of a
simulated belief distribution.

### 1.2 Five inputs the engine already accepts that the CLI cannot reach

`QuestionInput` in `engine/src/pipeline/run-question.ts:81` takes six fields the
CLI never sets. These are not future work — they are wired, tested, and
unreachable from the command line:

| Field                  | What it does                                                | Why it matters for a demo                                       |
| ---------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| `abstentionThresholds` | the four gate thresholds                                    | lets you _show_ the gate's tradeoff live, not on a slide        |
| `scenarioPrior`        | the region of adversary parameter space evidence constrains | the difference between a well-evidenced and a hopeless question |
| `rerunBudget`          | how many reruns the red team may force (0 disables)         | **this is half the latency** — see §4.1                         |
| `panelSize`            | number of adjudicators                                      | directly scales cost and latency                                |
| `context`              | free-text context handed to the framer                      | the natural place a real analyst's brief would go               |
| `truth`                | the scenario that actually obtains, for scoring             | how a live "we were right" demo would be built                  |

Exposing these is a small, contained change to `cli.ts` and `forecast.ts`. It is
the single highest ratio of demo value to work in this document.

### 1.3 The input that does not exist: your documents

This is the gap that matters.

Every run generates its own synthetic corpus in-process — 60 documents from 6
sources, with contradictions deliberately planted so the reconciliation logic can
be scored. The parameters are hardcoded in `engine/src/forecast.ts:79`, and
deliberately so: the comment explains that exposing them would let a caller widen
the corpus until the contradiction rate looked better.

There is **no path to load real documents.** But the contract for them is fully
specified in `engine/src/corpus/types.ts`:

```
Source    { id, name, credibility, measurementMethod? }
Document  { id, sourceId, publishedAt, title, body, facts[] }
Fact      { subject, value, unit?, asOfDate, definition? }
```

So the shape of a real ingestion path is already decided; what is missing is a
loader that reads that shape off disk and an `AsOfCorpus` built from it instead
of from the generator. The as-of leakage guard, the contradiction detector and
the provenance counter all work against `CorpusData` and would not need to change.

**Caveat that must travel with any such demo:** the contradiction detector scores
100% on the synthetic gold set because the generator plants conflicts using the
same four structural rules the classifier uses to find them (`docs/ARCHITECTURE-PROTEUS.md`
§8c). On real prose, where those distinguishing fields are not handed over as
structured metadata, performance is **unknown**. Do not let "100% contradiction
detection" reach a slide without that sentence next to it.

### 1.4 The input a new domain would supply

A domain plugs in through four functions (`engine/src/pipeline/types.ts:55`):
the simulation adapter, `configFor`, `readQuantity`, `signatures`. The
orchestrator knows nothing about influence operations — its own tests drive it
with a toy domain containing no simulation at all, which is what makes
"one kernel, many domains" testable rather than asserted.

---

## 2. What comes out

### 2.1 The analytic product (human-readable)

From the live run I made tonight, the shape is:

- **BLUF** — one line, e.g. _"Campaign achieves dominant narrative saturation —
  likely (55%–80%), low confidence."_ Likelihood and confidence are separate
  words and are never collapsed into one number; the codebase enforces this by
  the _absence_ of a collapsing function, guarded by a source scan.
- **Ranked hypotheses** — each with an ICD 203 likelihood band, a confidence
  level, and an ACH inconsistency score.
- **Indicators & warnings** — observables with likelihood ratios, each tied to
  the instrument channel that would register it. This is the part an analyst
  actually uses: _"if hub concentration exceeds 0.9996, h4 gets more likely."_
- **Key assumptions with falsifiers** — every assumption carries what would
  break it. Required by the type, not by convention.
- **Red team challenges** — with severity, and standing to force a rerun.
- **Provenance footer** — the synthetic-world caveat.

The synthetic-world warning is the **first line of output, above any number**,
and a test asserts it.

### 2.2 The machine-readable product, and what it drops

`--json` emits the `AnalyticProduct` only: `question, bluf, asOf,
corpusSnapshotId, hypotheses[], keyAssumptions[], indicators[], claims[],
redTeam[]`, plus `abstention` when the gate fired.

It **omits everything about the run's own health**, all of which
`QuestionResult` computes and holds:

`costUsd` · `llmCalls` · `framingSource` (did the model frame this, or did it
fall back?) · `ensemble.completionRatio` · `confidence` · `degradation` ·
`oracle` · `probabilities` (the raw vector) · `reruns`

A downstream system integrating over `--json` therefore cannot tell whether the
product it just received came from a live model or from the no-model fallback.
For an evaluator asking "how do we consume this", that is the first thing they
will hit. It is a one-field change — emit a wrapper with `product` plus a `run`
block — not a redesign.

### 2.3 What lands on disk

Every ensemble member writes a content-addressed directory:

```
.proteus-artifacts/<64-hex-hash>/
  identity.json   the run's inputs
  manifest.json   what was produced
  summary.json    { bandId, quantity, seed, signatures{5}, specId }
  events.jsonl    the full tick-by-tick event stream
```

Measured: **~2.5 MB and 176 files for 44 runs**, ~57 KB per run, nearly all of it
`events.jsonl`. At benchmark scale (480 questions × 32 runs) that is roughly
**900 MB per benchmark**. Worth a retention decision before anyone runs one on a
government laptop.

The hash is the audit story: same seed ⇒ byte-identical artifact. That is a
determinism property with a test behind it, and it is more compelling to a
government audience than any accuracy number.

### 2.4 The benchmark snapshot → dashboard

`npm run snapshot` publishes `dashboard/data/benchmark-snapshot.json`; the
dashboard renders it and recomputes nothing. Snapshots accumulate by label, so
several batch sizes build the trend series. With one snapshot the trend panel
says so rather than drawing a line through a single point.

---

## 3. Demoing this to a government evaluator

### 3.1 What is actually impressive here — and it is not the forecast

The forecast comes from a world we invented. Any evaluator worth their salary
will say so within thirty seconds, and they will be right. Lead with it instead
of letting them find it.

What survives that objection, and what the demo should be built around:

1. **It refuses to answer when the evidence cannot support an answer** — and the
   cost of that refusal is measured, not asserted. The abstention gate runs
   _before_ any probability exists, so a model that declines to adjudicate cannot
   turn "we should not answer" into "we could not check."
2. **The information cutoff is enforced in code, in three layers**, ending in a
   hard throw if any claim cites a document published after the cutoff. Not a
   prompt instruction — a guard that fails the run.
3. **Same seed, byte-identical answer.** Auditable, re-runnable, defensible.
4. **The system reports what it has not measured**, in the product, in the
   dashboard, above the first number.

That is a _tradecraft_ story, not an AI story, and it is the one a government
buyer is equipped to evaluate.

### 3.2 The 5-minute demo I would run

| #   | Beat                        | How                                                                                                                                        | Time |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 1   | **Determinism**             | Same command twice, `--offline`, diff the artifact hash                                                                                    | 5 s  |
| 2   | **It refuses**              | A question the evidence can't separate → gate fires, prints _what to collect next_                                                         | 5 s  |
| 3   | **A real answer**           | Same question, evidenced → BLUF, bands, indicators with likelihood ratios                                                                  | 5 s  |
| 4   | **The red team attacks it** | The live run's 8 challenges, incl. "the ensemble cannot generate failure scenarios — this is a sampling artifact masquerading as evidence" | 60 s |
| 5   | **How honest is it?**       | `/metrics` — reliability diagram, the gate's operating curve, and the caveat above the first number                                        | 90 s |

Beat 4 is the strongest moment in the whole system and it is worth dwelling on:
the red team, unprompted, correctly identified that zero of sixteen ensemble
members produced a campaign-failure scenario, and called the resulting confidence
a sampling artifact. **A system that publishes the best argument against its own
answer is doing something a briefing slide cannot.**

### 3.3 The thing that will break the demo

**A live question takes 5 minutes 54 seconds.** Measured tonight. You cannot
stand in front of anyone for six minutes of blank terminal.

Three ways out, in order of preference:

- **Fix the latency** (§4.1) — the forecast itself is ready in under a second.
- **Run beats 1–3 offline** (they are sub-second and need no model) and show the
  model layer from beat 4's cached run.
- **Pre-record beat 4.** Honest if labelled; the artifacts make it verifiable.

### 3.4 On the solicitation

You have a specific solicitation and have chosen not to put it in a session.
Nothing above assumes its contents. When you shape a white-paper section to it,
the structure that survives is: build the solicitation-dependent parts as
labelled slots — page budget, evaluation-criteria mapping, required headings —
and populate them offline, with a compliance matrix (criterion → where addressed)
as the skeleton. The technical claims should stay traceable to measured findings,
so swapping the framing never changes what is being claimed.

---

## 4. Streamlining, ranked by payoff

### 4.1 Latency — 5m54s, and essentially all of it is avoidable

**Measured tonight:**

| Path                            | Time         |
| ------------------------------- | ------------ |
| Offline, 8 ensemble members     | **0.44 s**   |
| Offline, 32 ensemble members    | **0.74 s**   |
| Live, 8 members (9 model calls) | **5 m 54 s** |

The simulation is free. The 6 minutes is entirely model latency, in four
sequential stages: **framer → panel planner → adjudicators → red team**. The
adjudicators run in parallel _within_ their stage; the stages chain.

Then the red team forced a rerun, which re-entered the whole analytic pass —
planner, adjudicators, red team again. **A forced rerun roughly doubles wall
clock.** `rerunBudget: 0` disables the mechanism, and the CLI cannot set it
(§1.2).

The structural fix is better than any of that. From
`run-question.ts:547`, in the code's own words:

> _The ensemble IS the forecast. Adjudication cross-checks it and shapes
> confidence; it does not move these probabilities._

The probability vector is complete before the first adjudicator is called. So:
**emit the forecast the moment the ensemble finishes (~1 s), then stream the
framing, indicators and red-team challenges in as they land.** Nothing about the
numbers changes; the perceived latency goes from 6 minutes to 1 second. For a
demo this is the whole ballgame.

Ranked:

1. Stream the ensemble forecast before the analytic layer. _Large change, largest payoff._
2. Expose `--rerun-budget` / `--panel-size`. _One-line change, halves worst case._
3. Overlap the red team with the adjudicators — it consumes their reasoning today, but could run against the ensemble summary alone.

### 4.2 Cost — $0.2959 for one question

9 model calls, measured. Implications worth knowing **before** anyone runs a
live benchmark:

- A 6-arm × 80-question benchmark is 480 questions ⇒ **~$140 live.**
- The current published benchmark is the offline path, so it cost nothing and
  the dashboard correctly reads "not priced" rather than "$0.00".
- `panelSize` and `rerunBudget` are the two cost knobs, and neither is reachable.

### 4.3 Adjudicator refusals — you pay full latency for nothing

Tonight's run: **2 of 3 adjudicators declined.** Each refusal costs the full
round-trip and returns no content.

Worth recording as a correction: `docs/ARCHITECTURE-PROTEUS.md` §8e states the
adjudicator is **BLOCKED at 100% refusal** and that live verification is blocked
by invalid credentials. Neither is true as of tonight — `npm run preflight`
reports `ANTHROPIC_API_KEY … valid`, and 1 of 3 adjudicators returned a usable
result. The doc is stale, not wrong-at-the-time; §8e should be annotated rather
than rewritten, since the refusal _rate_ is itself a measured finding.

### 4.4 Smaller items

- **`--json` is lossy** (§2.2). Wrap the product with a `run` block carrying
  cost, call count, framing source and ensemble completion.
- **`src/llm/claude.ts` is dead code** — a complete Agent SDK backend that
  nothing imports. Either wire it as the second provider for the
  model-agnosticism metric it was built for, or delete it. It currently costs a
  dependency (`@anthropic-ai/claude-agent-sdk`) that nothing else needs.
- **Artifact volume** (§2.3) — ~900 MB per full benchmark. Decide retention
  before, not after.
- **Dashboard advisories** — 3 high-severity npm advisories, all inside Next 15's
  own tree (`postcss` at build time, `sharp` for `next/image`). Neither is
  reachable from a static page rendering a local JSON file. Clearing them means
  Next 16, a breaking upgrade. Unreachable ≠ absent; if a government reviewer
  runs `npm audit`, have this paragraph ready.

---

## 5. What is measured, and what is not

Unchanged by anything tonight, and the most important table in the project:

| Claim                                            | Status                                      |
| ------------------------------------------------ | ------------------------------------------- |
| Pipeline propagates its own uncertainty honestly | ✅ measured (synthetic oracle)              |
| Abstention gate fires on unanswerable questions  | ✅ measured, with its false-abstention cost |
| Same seed ⇒ identical artifact                   | ✅ measured                                 |
| Contradiction detection on **real** prose        | ❌ unknown                                  |
| Historical backtest accuracy                     | ❌ not yet measured                         |
| Live post-cutoff accuracy                        | ❌ not yet measured                         |
| Skill vs. a human analyst                        | ❌ not yet measured                         |

Synthetic-oracle numbers must never be pooled with the others — including in the
white paper.
