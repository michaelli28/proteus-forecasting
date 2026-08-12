# C-GEO-3 — Coercion Tempo Ladder
## Concept of Operations, and the ordinal escalation-ladder kernel family

**Scored 5/5/5 — unanimous top, tied first overall.** This is the platform's live-scoring track-record engine, and the only candidate in the catalogue that pre-registers an ablation of PROTEUS's own architectural contribution rather than of the data's signal.

---

## 1. In Plain English

Today, a watch officer at a Pacific military headquarters counts Chinese military aircraft and ships around Taiwan by hand, every day, from Taiwan's public defence releases. That tally becomes a sentence in an intelligence summary: *"sustained elevated pressure."* That sentence has been in the product for years. Nobody can tell you whether it was right, because it does not say what will happen or when.

This capability replaces the hand tally with a machine one, and replaces the unscoreable sentence with a dated, published prediction: over the next fourteen days, how much pressure, and at which step on a defined ladder of coercion. Because Taiwan publishes the answer every morning, the prediction gets graded every morning, and a running accuracy score accumulates from day one.

The new thing is not the forecast. Forecasts are cheap. The new thing is that the forecast is **committed and cryptographically time-stamped before the answer exists**, so it cannot be quietly adjusted afterwards — and that we simultaneously run a stripped-down version of our own system as a control, so we can prove whether our expensive reasoning layer actually beats a plain statistical fit. If it does not, that result is published too.

One rung of the ladder — a quarantine of shipping to Taiwan — has never happened. The system is built to say *"I cannot answer this"* about that rung, and to say it in a way that can itself be measured.

---

## 2. The analytic question and its resolvable quantity

**Question.** Over the next *h* days, what is the probability distribution over the coercion rung that PRC activity around Taiwan will occupy, and over the daily volume of that activity?

Two resolvable quantities, deliberately separate, because they take different scoring rules:

| | Quantity | Support | Scoring rule |
|---|---|---|---|
| **Q1 — rung** | `r_d` — highest coercion rung obtaining on day *d* | ordered categorical, R0…R5 | **Ranked Probability Score (RPS)** |
| **Q2 — tempo** | `N_d` — daily count of PLA aircraft detected in the declared sectors | non-negative integer | **CRPS** |

> **Correction to the assignment brief, and it matters for the evaluation panel.** The brief specifies ΔCRPS as the headline for this capability. CRPS is defined for forecasts of a *continuous* quantity as ∫(F(x) − H(x−y))² dx ([scoring rule definition](https://en.wikipedia.org/wiki/Scoring_rule)). For an *ordered categorical* outcome the correct member of the same family is the Ranked Probability Score, RPS(**p**, i) = Σ<sub>k=1..m−1</sub> (Σ<sub>j≤k</sub> p<sub>j</sub> − y<sub>j</sub>)², which credits mass placed on rungs *near* the truth. Reporting "ΔCRPS on the rung" is a category error a technical panel will catch. **We report ΔRPS on Q1 and ΔCRPS on Q2.** Both are strictly proper; RPS is the discrete analogue and the two are reported side by side, never summed.

### The partition (structural MECE, structural scorability)

The rung is a **deterministic, pre-registered function of published fields**, not an analyst's characterisation. Exactly one rung obtains per day by construction, which is what makes the partition structurally MECE rather than MECE-by-assertion — the property the Framer requires.

| Rung | Name | Defining condition (deterministic on the daily release) | Historical occurrences |
|---|---|---|---|
| **R0** | Baseline patrol | counts below the pre-registered trailing-percentile floor; no median-line crossings | common |
| **R1** | Elevated routine | sustained above-floor sorties and/or routine median-line crossings | common |
| **R2** | Named exercise | a named, declared PLA operation spanning ≥2 days | recurrent |
| **R3** | Encirclement / closure posture | declared closure or live-fire areas on multiple bearings, with coast-guard integration in a law-enforcement framing | rare |
| **R4** | **Quarantine** | announced inspection/customs regime **actually enforced** against commercial traffic | **zero** |
| **R5** | Blockade or kinetic action | interdiction of shipping/air by force, or use of force | zero |

**The single most important design detail in this document:** the rung-mapping function `mapRung(dailyRelease) → r_d` is published, hashed, and committed to the pre-registration register **before the first forecast is issued**, and its hash is carried in every forecast record. Without that, the rung is retro-definable and the entire track record is worthless. A technical panel should attack this first; we want them to find it already nailed down.

### As-of discipline

The corpus snapshot is pinned at commit time. Taiwan's Ministry of National Defense publishes its PLA-activity update on a daily cycle under 區域動態 (Regional Dynamics), covering a fixed preceding window ([mnd.gov.tw](https://www.mnd.gov.tw/), URL pattern `/news/plaact/{id}` — **verified this session**: daily dated postings present). So:

- Forecast for days *d+1 … d+14* is committed at a fixed daily wall-clock time on day *d*.
- The run may retrieve **only** from the corpus snapshot containing releases through day *d*.
- The snapshot ID is written into the run identity and into the register entry.

This is enforced in shipped code, at three layers, not by procedure — `engine/src/corpus/as-of.ts`:

> ```
>  *   1. retrieve()/getDocument() cannot return a document published after asOf
>  *   2. tests assert a post-asOf document is unreachable through every accessor
>  *   3. assertNoLeakage() throws if a finished product cites a post-asOf document
> ```

Layer 3 throws rather than warns (`engine/src/pipeline/run-question.ts:344`). For a live daily register this is the difference between a track record and a backtest with extra steps.

---

## 3. The kernel

### 3.1 Architecture class — the honest statement

**This is a hybrid, and calling it "simulate-and-adjudicate" without qualification would be inflation.**

| Layer | Class | Why |
|---|---|---|
| Tempo layer (Q2) | **estimate-and-adjudicate** | a self-exciting count model fit by MLE to observed history; it is an *estimator*, not a free-running world |
| Ladder layer (Q1) | **simulate-and-adjudicate** | a genuine repeated game with state, actor profiles, and stochastic transitions |
| R4/R5 tail | **neither — abstention plus indicator watch** | no estimand with a base rate exists; see §7.4 |

We state this because a panel will ask, and because the ablation in §7.2 is precisely designed to measure whether the simulated layer earns its place on top of the estimated one.

### 3.2 Tempo layer — daily-binned self-exciting count process

A Hawkes process has conditional intensity λ(t) = μ(t) + Σ<sub>k</sub> φ(t − t<sub>k</sub>), with branching ratio n = ∫<sub>0</sub><sup>∞</sup> φ(t)dt and stationarity requiring n < 1; the multivariate form couples types through a matrix Φ = (φ<sub>ij</sub>) ([Hawkes process](https://en.wikipedia.org/wiki/Hawkes_process), verified this session).

**Design decision, driven by both the data and the shipped kernel:** the resolution data is a *daily aggregate count*, not a timestamped event stream, and PROTEUS's kernel is a discrete tick loop (`for (let tick = 0; tick < ticks; tick++)`, `engine/src/sim/kernel.ts`). We therefore implement the **daily-binned discrete-time analogue**, not a continuous-time Hawkes:

```
N_d ~ NegBinom(λ_d, κ)                    # over-dispersion κ; Poisson is rejected by the data in almost every count series of this kind
λ_d = μ_d  +  Σ_{e < d} α_{c(e)} · g(d − e) · N_e  +  β · 1[r_d ≥ R2]
μ_d = μ_0 · seasonal(d) · anniversary(d)  # weekday effect; politically salient dates
g(u) = exp(−u/τ)                          # or Weibull, selected by AIC on the training window and then FROZEN
```

Marks `c(e)` distinguish excitation sources (median-line crossings excite differently from transit sorties), giving the multivariate Φ. Stability check `Σ α < 1` is asserted at config load and throws on violation — an unstable fit silently produces explosive forecasts and is the classic way this model family fails quietly.

**Why binned rather than continuous:** we do not have sortie-level timestamps in the public release, so a continuous-time fit would require inventing within-day arrival times. That is a fabrication the leakage guard cannot catch. Binning is the honest model of the data we actually have. This also means the **ablation baseline is the same binned fit** — the comparison is apples to apples.

Goodness of fit: residual analysis by the random time change / time-rescaling construction (transform to unit-rate Poisson residuals and test uniformity), plus PIT histograms for the count distribution. *(Standard practice; the Laub–Taimre–Pollett survey [arXiv:1507.02822](https://arxiv.org/abs/1507.02822) is the reference survey — confirmed to exist and to cover "all major aspects", though its specific treatment of thinning and time-rescaling was not confirmed this session.)*

### 3.3 Ladder layer — repeated game with a commitment ratchet

**State variables**

| Symbol | Meaning | Dynamics |
|---|---|---|
| `λ_d` | tempo intensity | §3.2 |
| `r_d` | current rung | multinomial over reachable rungs |
| `f_d` | **ratchet floor** — highest rung publicly consolidated as "normal" | **monotone non-decreasing**; enforced as a type invariant |
| `c_d` | commitment stock / accumulated audience cost | increments on public framing acts; decays slowly |
| `s_d` | counterpart response stock (transits, arms announcements, statements) | exogenous input from the corpus |
| `q_d` | quarantine-precursor vector | conjunction components, §7.4 |

**The commitment ratchet is the modelled mechanism and the reason a game layer might beat a plain fit.** Descending below `f_d` incurs a cost proportional to `c_d`. This produces the empirically characteristic signature of gray-zone coercion — asymmetric transitions, easy up and sticky down — which a symmetric self-exciting fit cannot represent. **If the ratchet is real and exploitable at 1–14 day horizons, ΔRPS(A2→A3) is positive. If it is not, it is zero. That is the whole bet, and §7.2 measures it.**

Transitions use **discrete-time competing risks on an augmented state space**: elapsed-time-in-rung is carried explicitly as a state variable, so a duration-dependent hazard becomes Markov on the augmented state and is simulable on the tick grid. (This is the same repair prescribed for C-ADV-2 in §17 — one algorithm, two packs.)

**What varies across the ensemble:** actor profile draw (§3.4), posterior draw over fitted Hawkes parameters (α, τ, κ, μ₀), ratchet-cost coefficient, counterpart-response responsiveness. All draws come from named forks of the root seed (`root.fork("init")`, `root.fork("step")`), so adding a draw in one subsystem cannot shift another — the property that keeps an ablation from being contaminated by RNG stream drift. Same seed ⇒ byte-identical artifact hash, which is what makes the register's commitments checkable by a third party.

### 3.4 How the two platform knobs map — and where they fail

This is architecture gap 3 biting exactly here, and we report it rather than paper over it.

| Platform knob | Maps to PRC gray-zone calculus? | Detail |
|---|---|---|
| `escalationPropensity` | **Yes, cleanly** | propensity to step up a rung given a counterpart action. Genuine one-to-one fit. |
| `riskTolerance` | **No — and the failure is dangerous** | See below. |

`riskTolerance` in the platform means willingness to accept exposure to loss. For this actor the binding constraint is not military risk; **it is political irreversibility.** A quarantine is *militarily cheap* and *politically near-irreversible*. A single knob that treats those as the same quantity will make the model reach for R4 too readily, because R4 scores low on military risk. **A model that over-predicts quarantine is worse than useless to this buyer** — it is the exact false alarm that destroys credibility.

**Required repair (new code, small):** `riskTolerance` is decomposed into a declared two-component profile extension:

```ts
export const COERCION_ACTOR_DIMENSIONS = [
  "militaryRisk",              // tolerance for exposure to kinetic loss
  "commitmentIrreversibility", // tolerance for acts that cannot be walked back
] as const;
```

The platform's two knobs remain the required base; each pack declares extensions, and — critically — **the extension schema hash is folded into run identity** (see §5.3), so two runs with different actor dimensionality can no longer collide on a run ID.

---

## 4. The panel

The shipped panel composes from five structured analytic techniques (`engine/src/agents/panel.ts`): `ach`, `key_assumptions_check`, `devils_advocate`, `premortem`, `red_team`. For this pack:

| Technique | What it adjudicates here | Rubric |
|---|---|---|
| **ACH** | Competing explanations of an observed tempo surge: scheduled exercise cycle vs. reaction to a counterpart action vs. deliberate ratchet step vs. reporting artefact. Ranked by weighted inconsistency ascending, Heuer diagnosticity weighting. | Evidence that cannot discriminate between two hypotheses gets weight zero — this is what makes the surge/artefact distinction survivable. |
| **Key assumptions check** | The ratchet assumption; the assumption that MND reporting policy is stationary; the rung-mapping thresholds. | **Every assumption carries a REQUIRED falsifier.** The stationarity assumption's falsifier is a documented change in MND reporting practice — a real and recurring event that would silently corrupt the series. |
| **Devil's advocate** | Argues the leading rung forecast is wrong, specifically that the ratchet is an artefact of the fitting window. | Must produce a concrete alternative distribution, not an objection. |
| **Premortem** | "Fourteen days on, this forecast was badly wrong." Explain how. | Enumerates: undetected reporting change; a rung transition driven by a non-modelled exogenous trigger; an R4 precursor we scored as noise. |
| **Red team** | Adopts PRC planning perspective: what would make this forecast profitable to defeat? Bounded rerun authority. | Bounded — red team may trigger at most one rerun; this is the $0.7544/17-call cost path. |

**What the panel is *not* asked to do:** it does not set the probability. There is structurally no function of type `(Judgment) => number` anywhere in the system. The panel adjudicates the *reasoning*, and its output feeds the confidence field and the abstention gate, which are separate fields from likelihood, per ICD 203.

---

## 5. The Scenario Pack — honestly, config versus new code

The "60 candidates collapse to ~12 kernel families" claim is the config-not-code argument. It must be stated precisely or a technical panel will correctly call it marketing. **This pack is not pure config.** Here is the actual split.

### 5.1 Untouched — the platform, reused verbatim

Kernel driver and RNG (`sim/kernel.ts`, `sim/rng.ts`) · artifact store and canonicalisation · as-of corpus and 3-layer leakage guard · abstention gate · panel agents and SAT techniques · calibration (z-score judge normalisation, outlier detection, weakest-link aggregation) · Brier/Murphy/ECE/sharpness metrics · baselines module · product assembly (BLUF, I&W, provenance). **659 tests passing, 4 skipped.**

### 5.2 New code — and it is not trivial

| Item | Size anchor | Why it is code, not config |
|---|---|---|
| **Coercion-ladder adapter** — `dynamics.ts`, `ladder.ts`, `hawkes.ts`, `mapping.ts`, `measures.ts`, `observable.ts`, `config.ts`, `index.ts` | ~8 files, comparable to the existing `sim/adapters/influence-ops/` (7 files) | `SimulationAdapter<TConfig,TState>` requires real `init`/`step`/`observe` implementations. A new domain is a new adapter. |
| **Ordinal scoring rules** — `metrics/ordinal.ts`: `rankedProbabilityScore`, `crps`, `rpsSkillScore`, paired score-differential series | new module | **Verified this session: PROTEUS has no RPS and no CRPS.** A repo-wide grep for `crps\|rankedProbability\|ordinal` across `engine/src` returns **zero hits**. `metrics/scoring-rules.ts` ships `ignoranceScore`, `logScore`, `sharpness`, `forecastEntropy`; `metrics/brier.ts` ships binary and multicategory Brier. Multicategory Brier treats the rung partition as *nominal* — it gives no credit for being one rung away. **Shipping this pack on multicategory Brier would silently mis-score the headline quantity.** |
| **Ablation harness** — `pipeline/ablation.ts` | new module | §7.2 |
| **Pre-registration register** — `register/` | new module | §7.5 |
| **Evaluation-scope type change** — `metrics/index.ts` | ~20 lines, wide blast radius | §18 |
| **MND ingest + schema lock** — `corpus/sources/mnd.ts` | new module | §6 |

### 5.3 Config the pack ships

```
packs/coercion-tempo/
  rungs.yaml              # R0..R5 definitions — the pre-registered mapping function's parameters
  hawkes.prior.yaml       # priors on α, τ, κ, μ0; stability bound Σα < 1
  ratchet.yaml            # floor semantics, audience-cost decay, descent penalty
  actors/prc.yaml         # base knobs + militaryRisk / commitmentIrreversibility extension
  actors/counterpart.yaml
  panel.yaml              # 5 adjudicators, techniques, focuses
  abstention.yaml         # per-rung threshold overrides; R4/R5 forced-abstention policy
  corpus.sources.yaml     # named allowlist — this doubles as a red-line control (§13)
  register.yaml           # commit cadence, horizons {1,3,7,14}, resolution rule, mapping hash
  baselines.yaml          # A0..A4 arm definitions
```

**The defensible claim, which we make instead of "config only":** *one adapter file-set plus one metrics module buys a new domain; the kernel, determinism guarantees, leakage guard, abstention gate, adjudication panel, calibration stack, and product assembly are untouched.* That is a real and checkable claim. "Pure config" is not.

---

## 6. Data

| Source | Role | Class | Access reality |
|---|---|---|---|
| **Taiwan MND daily PLA-activity release** (區域動態, `mnd.gov.tw/news/plaact/{id}`) | **Primary predictor and primary resolution source** | Unclassified, public | **Verified this session**: section exists, daily dated postings. Chinese-language; a stable machine schema is *not* guaranteed. |
| PLA Eastern Theater Command announcements | Named-exercise detection (R2/R3) | Unclassified, public | Announcement timing is itself strategic; treat as evidence, not ground truth |
| Taiwan MOTC / port authority notices | R4 precursor: closure areas, shipping advisories | Unclassified, public | |
| AIS commercial feeds | R4 precursor: actual traffic diversion | **Commercial licence required** | Cost line item; not free |
| Japan MoD scramble statistics | **Independent cross-source for discrepancy detection** | Unclassified, public | Different sensor, different counting rule — this is a feature, see §11(c) |
| ICB v16 | Cross-pack backtest (C-ADV-2) | Public, academic | **Verified**: 512 crises, 1,131 crisis actors, 1,000 crisis dyads, 1918–2021 ([sites.duke.edu/icbdata](https://sites.duke.edu/icbdata/)) |

### Two data findings the panel must see

**Finding 1 — a correction to the landscape sweep.** The sweep recorded "CSIS ChinaPower curation" as a daily resolution source. **I could not confirm it.** Fetches of `chinapower.csis.org/tracker/`, `chinapower.csis.org/data/`, and two plausible direct URLs returned either 404 or listings containing **no** Taiwan incursion / ADIZ / median-line tracker. The ChinaPower data repository lists China shipbuilding statistics, naval modernisation, and China–Russia exercises — no Taiwan activity tracker. **Do not put a CSIS dependency in the bid.** The MND primary source is confirmed and sufficient; any curated secondary is a convenience, not a dependency.

**Finding 2 — the single-source risk is the pack's largest technical risk, and it is not modellable.** Both the predictor series and the resolution series come from the *same* government publisher. A change in MND reporting policy — a change in which sectors are counted, or a decision to stop publishing — simultaneously corrupts the training data and destroys the scoreboard. Mitigations, all of which ship in the pack:

1. Japan MoD scramble data as an independent series; a divergence detector on the ratio, wired to the `unresolved_contradictions` abstention signal.
2. A **schema-change tripwire**: the ingest asserts the release's field structure against a locked schema and *fails the day's run* rather than silently coercing. A failed run is a visible hole in the register; a coerced parse is invisible corruption.
3. The stationarity assumption is a **named key assumption with a required falsifier** in every product.

---

## 7. The oracle and the evaluation plan

### 7.1 Regimes — nothing pooled

`EVALUATION_REGIMES` is `["synthetic_oracle","historical_backtest","live_post_cutoff"] as const` and `forecastQualityReport(forecasts, regime)` **requires** the tag (`engine/src/metrics/index.ts:35`). The in-code comment states the rule:

> *"`regime` is required so a number cannot travel without the context that makes it meaningful — a spectacular synthetic-oracle Brier says nothing about real-world skill, and the two must never appear in one pooled figure."*

| Regime | Use here | Ground truth |
|---|---|---|
| `synthetic_oracle` | Kernel validation; R4 false-abstention injection (§7.4) | Known by construction |
| `historical_backtest` | Rolling-origin backtest on MND history; leave-one-rung-out (§7.4) | Realised rungs |
| `live_post_cutoff` | **The register** — the only regime that supports a track-record claim | MND release, resolved by the pre-registered mapping |

### 7.2 The ablation harness — the point of the whole capability

Five arms, all scored on the **identical** pre-registered forecast targets and the identical register entries.

| Arm | Content | What its defeat proves |
|---|---|---|
| **A0** | Persistence: `r̂_{d+h} = r_d`; `N̂` = trailing-7-day distribution | The series is not a random walk |
| **A1** | Climatological base rate over trailing 365 days | The series has time structure |
| **A2** | **Plain daily-binned self-exciting fit, no game layer.** Same estimator, same data, same rung-mapping function. No actor profile, no ladder, no panel. | **THE PRE-REGISTERED ABLATION** |
| **A3** | Kernel + ladder game + actor ensemble. Raw ensemble distribution. No panel, no calibration, no abstention gate. | Isolates the *simulation* contribution |
| **A4** | **Full system**: A3 + adjudication panel + z-score calibration + weakest-link confidence + abstention gate | Isolates the *adjudication* contribution |

**Reported quantities — three deltas, never one:**

```
ΔRPS(A1→A2)  = RPS(A1) − RPS(A2)    # does the DATA have signal?        (every other candidate stops here)
ΔRPS(A2→A3)  = RPS(A2) − RPS(A3)    # does the GAME LAYER add signal?
ΔRPS(A3→A4)  = RPS(A3) − RPS(A4)    # does ADJUDICATION add signal?
ΔRPS(A2→A4)  = RPS(A2) − RPS(A4)    # THE HEADLINE: does simulate-and-adjudicate beat a plain fit?
```

Identically for ΔCRPS on Q2. **Reported per horizon h ∈ {1,3,7,14}, never pooled across horizons** — skill decays with horizon and pooling hides it. Per-rung ΔBrier is reported as a supplementary decomposition (each rung as a binary event), since Brier is defined on binaries and shows *which* rung the gain came from.

**Statistical treatment — where a weak evaluation gets caught:**

- Daily score differentials from a self-exciting series are **autocorrelated by construction**. A naive t-test on paired scores will overstate significance. We use **Diebold–Mariano on the score-differential series with HAC (Newey–West) standard errors**, plus a **moving-block bootstrap** over the day index, and we report both.
- Overlapping 14-day horizons induce further dependence; horizon-*h* differentials are tested within-horizon only.
- **A3 and A4 share the root seed and the same named RNG forks.** The ablation is a config flag, never a separate code path — otherwise arms differ by random draw and Δ is noise wearing a lab coat.
- **Power, stated honestly:** at 90 days with autocorrelated daily scores, the effective sample size is a small fraction of 90. **The 90-day demonstration will not produce a confidence interval narrow enough to declare victory, and we will not claim one.** A defensible ΔRPS with a usable interval needs roughly 12 months. What the 90 days delivers is a *live, timestamped, third-party-checkable register that is accruing* — which is the thing no competitor has.

### 7.3 Named baselines to beat

A0 persistence, A1 base rate, **A2 plain self-exciting fit**. Public external comparators for context only, never as a scoring reference: **ViEWS** (Uppsala University + PRIO, open-source conflict prediction with a public leaderboard and prediction-challenge dashboard — [viewsforecasting.org](https://viewsforecasting.org/about/), verified; note it forecasts armed-conflict fatalities at country/grid-month, a *different quantity*, so it is context, not a baseline). Metaculus/INFER community forecasts where a matching question exists (*not verified this session — metaculus.com returned 403*).

**We never backtest against the customer's own historical analytic calls.** Public baselines only.

### 7.4 Abstention design for R4 — and how a false-abstention rate is computable at all

**The honest statement first, because everything else depends on it: a false-abstention rate for R4 can never be *measured*. It can only be *transferred*, and every reported number must say so.**

False abstention on R4 would mean: R4 occurs (or its precursors fire decisively) and the system still returns `INSUFFICIENT_EVIDENCE`. R4 has never occurred. Therefore the event that defines the error has never been observable. Anyone who quotes a measured false-abstention rate for R4 is fabricating.

Three computable substitutes, in descending order of evidential strength:

**(1) Leave-one-rung-out (LORO) — the primary, on real data, under `historical_backtest`.** Censor rung R3 from the training corpus *and* from the base-rate table, so the pipeline faces R3 as a zero-history rung. Run the full historical window. On days where R3 actually obtained, does the gate abstain? That measured rate is a direct estimate of false abstention **on a zero-history rung, computed on real data**. Repeat for every rung with ≥1 occurrence. **Report the vector with each rung's occurrence count**, so the reader sees the estimate's own uncertainty — a LORO rate from 3 occurrences is not a rate.

**(2) Synthetic-oracle injection.** The ladder simulator can generate worlds in which R4 occurs. Run the full pipeline against a synthetic corpus built from those worlds; false abstention is measured against known ground truth. **`synthetic_oracle` regime only, and labelled in every appearance.**

**(3) Precursor-conjunction bound.** R4 decomposes into components that *have individually occurred*: coast-guard boarding/inspection of a commercial vessel; declared closure areas; a customs/inspection announcement. Score the components; the gate's behaviour on the conjunction is bounded by its behaviour on the components.

**Gate configuration for R4/R5.** The four shipped abstention reasons are `insufficient_diagnostic_evidence`, `hypotheses_indistinguishable`, `unresolved_contradictions`, `incomplete_provenance`, with defaults `{minDiagnosticEvidence: 3, minSeparation: 0.05, maxUnresolvedRate: 0.5, minProvenanceCompleteness: 0.8}` (`engine/src/evidence/abstention.ts`) — measured, not chosen; the shipped `minSeparation` of 0.05 replaced 0.15 because 0.15 cost 12% false abstention for no gain in true abstention. For R4/R5 the pack sets a **forced-abstention policy**: absent the named precursor conjunction, the verdict is `INSUFFICIENT_EVIDENCE` with the evidence gaps enumerated.

**And the metric changes with it.** For R4 the honest headline is **not** a Brier score. It is:

> *Indicator lead time* — did the named precursors fire, and how far in advance, relative to any eventual occurrence? Plus the **likelihood ratio** attached to each I&W indicator, which is scoreable against component occurrences *today*, without waiting for a quarantine that may never come.

This is the correct product for a zero-base-rate tail, and it generalises directly to C-ADV-8 (§17).

> **Do not reuse the platform's shipped 7% false-abstention figure for R4.** That number came from a threshold sweep over 6 arms in the synthetic benchmark. It is not an R4 number and must never be presented as one.

### 7.5 Pre-registration — without it, "live post-cutoff" is a backtest with extra steps

An append-only, hash-chained, publicly anchored commit-then-resolve register.

**Each entry, committed before the resolution window opens, contains:**

| Field | Why |
|---|---|
| Forecast distributions for Q1 and Q2 at h ∈ {1,3,7,14} | the claim |
| **Hash of the rung-mapping function** | otherwise the rung is retro-definable |
| **Resolution rule**: named source, field, aggregation, tie-break, and what happens if the source does not publish | otherwise resolution is negotiable |
| `runId` = `hashCanonical({config, corpusSnapshotId, kernelVersion})` | binds the forecast to a reproducible run |
| `corpusSnapshotId` | proves what was visible |
| **Panel rubric hash** | **repairs architecture gap 1 — see below** |
| Arm identifier (A0…A4) | all five arms commit, every day |
| Abstention verdict and, if abstaining, the enumerated evidence gaps | an abstention is a commitment too |

**Anchoring.** Daily Merkle root over the day's entries, published two ways because a government evaluator and a public auditor want different things:

- **Primary — RFC 3161 trusted timestamp** on the daily root, plus a git-style hash chain mirrored to a public repository. This is the Certificate Transparency pattern and is the version a government sponsor will accept.
- **Secondary — OpenTimestamps**, which anchors to Bitcoin and yields a proof that is **independently verifiable without trusting the timestamping service** ([opentimestamps.org](https://opentimestamps.org/), verified). Offered because it removes us from the trust path entirely; expected to be optional for the government reader and decisive for an external technical reviewer.

**Gap 1 repair, and why the register forces it.** Verified this session at `engine/src/artifact/store.ts:28-35`:

```ts
export interface RunIdentity {
  readonly config: unknown;
  readonly corpusSnapshotId: string;
  readonly kernelVersion: string;
}
```

and `computeRunId(identity) { return hashCanonical(identity); }` at line 123. There is **no panel field**. Meanwhile `engine/src/agents/panel.ts` generates a per-adjudicator `systemPrompt` via LLM at run time. **Two runs judged by different generated rubrics therefore share a run ID.** In a register that is fatal: the rubric that produced a judgment would be unrecoverable, and a challenger could argue the rubric was fitted after the fact. The register cannot be built without adding a `panelRubricHash` (and the actor-profile schema hash from §3.4) to `RunIdentity`. **This pack forces a platform repair that the platform needs anyway.**

---

## 8. The 90-day unclassified demonstration

| Wk | Activity | Number that comes out | What would falsify it |
|---|---|---|---|
| **1–2** | Lock MND ingest schema; build the source-change tripwire. **Run the analyst time-and-motion baseline** (§10) in parallel. | Ingest success rate over 24 months of archived releases; measured minutes/day of manual tally | Schema too unstable to parse ≥98% of historical releases → **the pack is not viable on this source and we say so in week 2** |
| **3–4** | Fit the daily-binned self-exciting model. Rolling-origin backtest. **Publish and hash the rung-mapping function.** | A2's backtest RPS and CRPS vs A0/A1, per horizon | ΔRPS(A1→A2) ≈ 0 → the data has no exploitable self-excitation; the whole family is wrong for this series |
| **5–6** | Ladder adapter, ratchet, actor profile with the two-component risk extension. `RunIdentity` extended with panel + profile hashes. | A3 backtest deltas; ensemble diversity; determinism check (same seed ⇒ identical artifact hash) | Ratchet parameter not identifiable from history → drop the ratchet, report A3 ≈ A2, and the game layer is unproven not disproven |
| **7–8** | **Register goes live.** All five arms commit daily. RFC 3161 + OTS anchoring. Panel wired. First entries resolve. | First live-resolved entries; per-arm running RPS; **cost per day, measured** | Register cannot resolve within 24h of the MND release → the operational claim fails |
| **9–10** | Abstention: LORO across every rung with ≥1 occurrence; synthetic-oracle R4 injection; precursor conjunction defined and instrumented. | LORO false-abstention vector with occurrence counts; synthetic R4 false-abstention rate; R4 indicator likelihood ratios | LORO shows the gate abstains on held-out rungs that *did* occur at a high rate → the gate is too conservative and would abstain through a real quarantine |
| **11–12** | Ablation readout. Diebold–Mariano with HAC errors + block bootstrap. | **ΔRPS(A2→A4) with an honest confidence interval, per horizon** | CI straddles zero — **expected at 90 days**, and reported as such, not spun |
| **13** | Package: register export, reproduction bundle (seed → byte-identical artifact), pack documentation, contracting annex | Third party reproduces any register entry from its `runId` | Reproduction fails → the determinism claim is void |

**The demonstration's deliverable is not a win. It is a running, anchored, third-party-reproducible scoreboard with five arms on it, and an honest interval.** Any vendor can show a number in 90 days. Almost none can show a number they committed to before they knew it.

---

## 9. The classified instantiation

**What changes.** The corpus gains classified collection. The rung-mapping function does **not** change — the resolution source stays unclassified MND, deliberately. This is the pattern that makes the whole thing work: **classified inputs, unclassified resolution.** The track record remains publicly checkable even when the inputs are not.

**What it adds.** Earlier and richer R3/R4 precursor detection (logistics, mobilisation, decision-level indicators), which is precisely where the unclassified series is weakest — R4's precursor conjunction is exactly the sort of thing that shows up in classified collection weeks before it shows up in a port notice.

**Accreditation obstacle.** ATO on a high-side network for a system that runs LLM inference. Three specific blockers: (i) model hosting and the data-egress question; (ii) the LLM layer's non-determinism, against an accreditor who wants reproducibility — **partly answered already**, since the simulation kernel is fully deterministic and `Math.random`/`Date.now` are banned in `sim/` and enforced by a source-scanning test, so the non-deterministic surface is bounded to the adjudication layer and is fully logged; (iii) cross-domain movement of the register's daily root.

**The contracting pattern that dissolves most of this: IARPA REASON's.** Performers build and are tested on unclassified data; an independent *cleared* T&E team evaluates on classified material in parallel; performers never receive classified access and refine against unclassified summary-level feedback. REASON is a 42-month program, Phase 2 Oct 2025–Mar 2027, minimum Government Purpose Rights. *(Carried forward from the landscape sweep — **UNVERIFIED this session**: iarpa.gov returned HTTP 403 to automated fetch. Confirm before the bid: [iarpa.gov/research-programs/reason](https://www.iarpa.gov/research-programs/reason).)*

**Why deterministic artifacts make that pattern cheaper than it has ever been.** Under REASON's split, the cleared T&E team must evaluate a system it cannot hand back to the performer. With byte-identical artifact hashes, the performer commits a config + seed; the cleared team runs it on the high side; the *hash* of the resulting artifact is a one-way, releasable summary that proves which version ran. The register's daily root is similarly a hash — releasable by construction. **The cross-domain artifact is 32 bytes.**

---

## 10. Buyer, workflow displacement, and the analyst-hour denominator

**Buyer.** The sweep's discriminator of buyability: *does the output land on a dated artifact with a signature block?* Here it does.

| The artifact | What lands on it |
|---|---|
| The daily/weekly INTSUM paragraph currently reading "sustained elevated pressure" | Replaced by: rung distribution at 1/3/7/14 days, with the register's running RPS and the source-discrepancy note |
| The **I&W watch-condition entry**, with a named change-of-condition threshold | The R4 precursor conjunction, with per-indicator likelihood ratios and lead times |

*(Document names are described functionally; **UNVERIFIED** — exact designations must be confirmed with the sponsor.)*

**The coordination answer, which nothing in the 60 candidates has.** IC finished intelligence is coordinated across agencies; a machine judgment needs someone to represent it in the room and someone to take the dissent footnote. **C-GEO-3 dodges this cleanly, and that is why it will field.** The product makes no claim about PRC *intent* — intent claims require coordination and an owner. It makes a claim about **the observable tempo series and about its own measured track record**: *"the rung distribution for the next 14 days, from a register scored daily for N days at RPS X against a plain statistical fit."* That is a claim about the source base and the model's own calibration. The analyst owns the intent judgment; the machine owns the distribution and the scoreboard. **No coordination footnote is required because the machine asserts nothing about the world that a human must underwrite.**

**The analyst-hour denominator — the honest position.** *I will not invent this number.* The sweep records that INDOPACOM J2 maintains the tally by hand; it does not record how many hours that is. **Week 1–2 of the demonstration exists to measure it**, via a time-and-motion log capturing: (i) minutes/day building the tally, (ii) minutes/day drafting the tempo paragraph, (iii) headcount, (iv) how many separate commands duplicate the same work.

Illustrative arithmetic, with every input **ASSUMED** and none measured: if (i)+(ii) = 30 min/day at one watch floor and four commands duplicate it, that is ≈ 730 analyst-hours/year. **This is arithmetic, not a finding, and must be labelled so in the white paper.** The real number replaces it in week 2.

**The honest ceiling on displacement.** The product displaces the *tally* and the *distribution-building*. It does not displace the judgment, the coordination, or the writing. A vendor claiming to displace an analyst here is lying; a vendor claiming to displace 30 minutes of clerical aggregation and to add a scoreboard where none existed is telling the truth and will be believed.

---

## 11. Benefit-category mapping

| Cat. | Mechanism — specific, not a claim | Evidence class |
|---|---|---|
| **(a) Efficiency and accuracy** | *Accuracy*: the pre-registered ΔRPS(A2→A4) with a HAC-corrected interval — the only accuracy claim made, and it is committed before it is known. *Efficiency*: machine tally replaces hand tally. | Accuracy **not yet measured**; efficiency measured week 2 |
| **(b) Reduced time to analyse + better prediction** | Time: tally + distribution built in one run — measured latency 5m54s (9 calls) / 8m12s (17 calls with red-team rerun). Prediction: same ΔRPS. | Latency **measured, live**; prediction **not yet measured** |
| **(c) Quality assurance — identify discrepancies between sources and reconcile analytic confidence** | **The strongest fit, and the one to lead with.** MND counts, Japan MoD scramble counts, and open-source spotters use different counting rules and disagree. Shipped code addresses exactly this: the contradiction detector with P/R metrics; the `unresolved_contradictions` abstention signal at `maxUnresolvedRate 0.5`; per-judge z-score normalisation to remove severity bias; **confidence aggregated by weakest link, never by mean**. Discrepancy *identification* and confidence *reconciliation* are not a roadmap item here — they are the shipped architecture. | Mechanism **shipped and tested**; performance on real prose **NOT MEASURED** — contradiction detection on real prose is one of the four things the platform must always label unmeasured |
| **(d) Cost reduction via automation** | Measured per-question cost $0.2959 (9 calls) / $0.7544 (17 calls). Daily cadence at the higher figure: **$0.7544/day ≈ $275/year** for the LLM layer. Simulation: 15,832 simulations in 305 s (≈52/s) means a 2,000-run daily ensemble costs ≈40 s of compute. | **Measured, live** |

**Strategic note for the bid.** The sweep's finding is that capabilities making claims about the **source base** field, while capabilities making claims about the world stall on coordination. **(c) is a source-base claim.** Lead the CIA-facing narrative with (c) and (d), support with (a)/(b). Leading with prediction accuracy invites a comparison to ForecastBench-class systems that is now much less favourable than it was in 2024 — several systems are reported statistically indistinguishable from superforecaster accuracy as of July 2026, and one outranks the superforecaster median on market questions. **Do not quote the 2024 figures (0.068 vs 0.119) as current.** If raw forecasting skill is commoditising, the durable differentiator is measurement, abstention, provenance and calibration — which is exactly (c).

---

## 12. Incumbents and prior programs

| Name | What it does | What it does not do |
|---|---|---|
| **The hand tally + "sustained elevated pressure"** | The real incumbent: a spreadsheet and a sentence | Produces no distribution, no horizon, no score, no falsifier |
| **IARPA REASON** | Evidence and reasoning augmentation for analysts; unclassified build / cleared T&E split | Does not forecast coercion tempo; **it is the contracting template, not the competitor** *(UNVERIFIED this session — 403)* |
| **ViEWS** (Uppsala + PRIO) | Open-source conflict prediction, public leaderboard and prediction-challenge dashboard ([verified](https://viewsforecasting.org/about/)) | Forecasts armed-conflict fatalities at country/grid-month — a **different quantity**; no gray-zone coercion ladder, no abstention, no adjudication |
| **Metaculus / INFER** | Human + AI forecasting with public track records | Question-by-question, human-latency, no I&W integration, no as-of provenance guarantees *(UNVERIFIED this session — 403)* |
| **CSIS ChinaPower** | China-power data repository | **Verified this session: no Taiwan incursion / ADIZ tracker found.** Not an incumbent and not a dependency |
| **Rhombus Power** ($200M IDIQ FA7014-25-D-0011, Sept 2025) | **PPBE budget decision-support tooling** | **Not adversary forecasting. Do not present it as the incumbent to beat in this lane** — the sweep's correction |

**What none of them have:** a pre-registered, cryptographically anchored, commit-then-resolve register with an architecture-ablation arm committing daily alongside the production arm.

---

## 13. Red lines — structural enforcement, not policy

Each is a mechanism a reviewer can inspect, not a paragraph in a policy annex.

| Red line | Structural enforcement |
|---|---|
| **No targeting support** | The `SimulationAdapter.observe()` firewall returns only what an outside analyst could plausibly see; the LLM layer receives observations, never full state (`engine/src/sim/kernel.ts`, in-code: *"it cannot read the answer off the world it is forecasting"*). The pack's config schema contains **no** entity-level, geolocation, or platform-identity fields, and a schema test rejects any config introducing lat/lon or tail numbers. Rungs are aggregate counts and declared postures. |
| **No US-person data** | Retrieval is snapshot-bound: `AsOfCorpus` can only return documents inside the pinned snapshot, and `corpus.sources.yaml` is a named allowlist of state and commercial publishers. There is no open-web retrieval path to disable, because none exists. |
| **No covert-action or operations planning** | Enforced by the type system via the counterfactual-branch rule (§18): unrealised branches are representable **only** under `synthetic_oracle`. The system therefore cannot emit "option X will work" as a live-regime claim. This is the structural version of the C-CYBER-3 problem, and it is a compile-time guarantee, not a review step. |
| **No unlabelled numbers** | `forecastQualityReport` requires an `EvaluationRegime`; no function pools regimes. A number cannot leave the system without its regime. |
| **Refusal is preserved, and instrumented** | Measured adjudicator refusal on the influence-ops task: 5/5, later 2 of 3 declined. Refusal capacity is retained — **and §14 explains why it must also be treated as a failure mode.** |

---

## 14. Failure modes

**F1 — Source-policy change (highest risk, not modellable).** MND changes counting rules or stops publishing; predictor and resolution series corrupt simultaneously. Mitigations in §6. **Residual risk is real and must be stated in the bid.**

**F2 — The ratchet is not identifiable.** The commitment ratchet may not be estimable from the available history. Then A3 ≈ A2 and the game layer is unproven. **Honest response: report it. The register keeps running.**

**F3 — ΔRPS(A2→A4) ≤ 0. The honest worst case.** The decision layer adds nothing over a plain self-exciting fit. This is entirely plausible: gray-zone tempo at 1–14 days may be near-purely self-exciting with no exploitable strategic structure. **If this happens we publish it.** The residual product is still real — a machine tally, an anchored register, a working abstention gate, and a source-discrepancy instrument — but the simulate-and-adjudicate thesis loses *on this question*, and we would move the architecture claim to a question class where an actor's choice set is genuinely strategic and observable. **A pre-registration that cannot embarrass us is not a pre-registration.**

**F4 — Silent panel collapse. Confirmed in code this session, and it interacts badly with the measured refusal rate.**

```
engine/src/pipeline/run-question.ts:680   available: results.length > 0,
engine/src/pipeline/analysis.ts:240       level: input.adjudicationAvailable ? "high" : "moderate",
```

Panel loss is a **boolean, not a grade**: one surviving adjudicator of eight scores identically to a full panel (architecture gap 2). Now combine with the measured refusal behaviour — 5/5 adjudicators declined the influence-ops task. **If every adjudicator refuses, `results.length === 0` → `available: false` → confidence silently drops from "high" to "moderate" and the product ships anyway**, with no signal distinguishing *"the panel refused"* from *"the panel was unavailable"* from *"the panel ran and disagreed."* On a daily register this would inject unlabelled degraded entries into the track record.

**Required repair before the register goes live (week 7):** replace the boolean with a graded panel-integrity field carrying (i) *k*-of-*N* survivors, (ii) per-adjudicator disposition — completed / refused / errored / timed out, (iii) a confidence penalty that is a function of *k/N* rather than a step. Refusal and failure must be distinguishable in the artifact. **The register cannot be trusted until this ships.**

**F5 — Over-prediction of R4 via the risk-knob conflation.** §3.4. Mitigated by the two-component profile extension; monitored by tracking R4 mass in the live register, which should be near zero absent precursors.

**F6 — Abstention gate too conservative on the tail.** Detected by LORO in weeks 9–10. If the gate abstains through held-out rungs that did occur, it would abstain through a real quarantine — the failure that matters most.

---

## 15. TRL — two columns

The sweep's finding: TRL is inflated by counting the platform instead of the domain pack. Both columns, always.

| | **Platform (PROTEUS core)** | **Domain pack (Coercion Tempo Ladder)** |
|---|---|---|
| **Today** | **TRL 4** — validated in lab. 659 tests passing / 4 skipped; deterministic byte-identical artifacts; measured synthetic-oracle results (Brier skill +0.4355 well-evidenced arm; −0.4561 on the deliberately misspecified negative control; 80/80 true abstention on the unanswerable arm; 7% false abstention at shipped threshold); two live domain bindings at measured cost and latency | **TRL 2** — formulated, not built. No adapter, no ordinal scoring rules, no MND ingest, no register. The concept is specified; nothing runs. |
| **+12 months** | **TRL 6** — demonstrated in a relevant environment, *conditional on* the gap-1 (run identity) and gap-2 (graded panel) repairs shipping and the register running clean | **TRL 5** — validated in a relevant environment: 12 months of anchored live entries on real public data with a resolved ΔRPS interval. **TRL 6 only if** the interval excludes zero **and** a government user has run it inside their own workflow. |

We will not claim TRL 6 for the domain pack on a positive point estimate alone.

---

## 16. Cost model — from measured figures only

| Line | Basis | Figure |
|---|---|---|
| LLM per question, standard path | **Measured, live**, 9 calls | **$0.2959** |
| LLM per question, red-team rerun path | **Measured, live**, 17 calls | **$0.7544** |
| Latency, standard / rerun | **Measured, live** | **5m54s / 8m12s** |
| Simulation throughput | **Measured** | **15,832 simulations in 305 s** (≈52/s) |
| Daily live register, worst-case LLM cost | 1 question/day × $0.7544 | **≈$0.75/day; ≈$275/year** |
| Daily ensemble compute, 2,000 runs | 2,000 ÷ 52/s | **≈40 s/day** |
| **90-day demonstration, inference only** | 90 × $0.7544 | **≈$68** |
| ICB backtest, 512 crises (C-ADV-2 pack) | 512 × $0.7544 | **≈$386** |
| AIS commercial feed | not measured | **UNPRICED — must be quoted before the bid** |

**The finding that matters to the buyer: compute is not the cost.** A year of daily live forecasting with a pre-registered five-arm ablation costs under $300 of inference. **The cost is engineering and analyst integration — the adapter file-set, the ordinal metrics module, the register, the ingest hardening, and the two platform repairs.** Any cost model that leads with tokens is selling the wrong thing, and a technical evaluation panel knows it.

---

# The ordinal escalation-ladder kernel family
## One kernel, four domain packs

### 17. The family

| | **C-GEO-3** Coercion Tempo | **C-ADV-2** Crisis Ladder | **C-ADV-8** Tail Watch | **C-CYBER-3** Rung |
|---|---|---|---|---|
| Ordered rungs | R0–R5 coercion | ICB violence/escalation levels | nuclear / counterspace precursor rungs | US cyber response options |
| Excitation / transition driver | daily-binned self-exciting counts + ratchet | duration-dependent hazard on crisis states | precursor conjunction | branch selection |
| Regime | `live_post_cutoff` (daily) | `historical_backtest` (ICB, 512 crises 1918–2021, [verified](https://sites.duke.edu/icbdata/)) | mixed | mixed — **and this is its whole problem** |
| Resolution source | Taiwan MND daily, third-party, scheduled | ICB coding | none for the headline | none for 5 of 6 branches |
| Judge score | **5/5/5** | high | **2/2/2 — floored** | mid |

**What is genuinely shared — the config-not-code claim, stated so it survives scrutiny.** All four use the identical `SimulationAdapter<TConfig, TState>` seam (`name`, `version`, `totalTicks`, `init`, `step`, `observe`), the identical seeded RNG with named forks, the identical artifact store and run-identity hashing, the identical as-of leakage guard, the identical abstention gate and its four reasons, the identical five SAT techniques, the identical calibration stack, and — once §5.2 ships it — the identical ordinal scoring module. **Each pack contributes one adapter file-set and one config directory.** That is the honest form of "60 candidates collapse to 12 kernel families": not *zero* new code per domain, but *bounded, seam-shaped* new code against an unchanged spine.

### 17.1 The C-ADV-2 repair — the judge's correction is CONFIRMED

The judge flagged that C-ADV-2's stated simulator is internally inconsistent. **Confirmed this session against the primary description of the algorithm:** the Gillespie stochastic simulation algorithm assumes *"the random waiting time for some reaction is exponentially distributed"* and that *"each reaction is Markovian in time"* ([Gillespie algorithm](https://en.wikipedia.org/wiki/Gillespie_algorithm)). A semi-Markov process whose transition intensity depends on elapsed time-in-state has **non-exponential holding times by definition**, so the standard SSA cannot forward-simulate it. Using it anyway does not error — it silently returns samples from the wrong process. **This is the worst class of bug: a wrong answer with a clean run.**

**The repair, in three parts:**

1. **State augmentation (what ships).** Carry elapsed-time-in-rung as an explicit state variable. A semi-Markov process on state space *S* becomes Markov on the augmented space *S* × *T*. On PROTEUS's discrete tick grid this is natural, because the tick *is* the time discretisation.
2. **Discrete-time competing risks (the transition mechanic).** At each tick, evaluate each outbound transition's hazard from the fitted duration-dependent hazard function, draw multinomially. Correct by construction on the augmented space.
3. **Ogata thinning as the validation reference.** Rejection sampling against a dominating rate λ* ≥ sup λ(t) is valid for *any* conditional intensity, including duration-dependent ones. Implement it once as a continuous-time reference and validate (1)+(2) against it on a case where both are valid, via a two-sample test on inter-transition times.

**And note what falls out:** the thinning routine required to validate C-ADV-2 is the *same* routine that provides the continuous-time reference for C-GEO-3's binned Hawkes fit. **One algorithm, two packs, written once.** That is the config-not-code argument demonstrated rather than asserted.

### 17.2 The C-ADV-8 repair — why it was floored, and the family's general answer

Three judges floored C-ADV-8 at 2/2/2 because its headline is unscoreable: a probability of nuclear or counterspace use has an approximately zero base rate, a catastrophic realisation, and no resolution schedule. That is **structurally the same problem as C-GEO-3's R4 quarantine rung** — and the family already has the answer.

**Move the headline down the ladder.** Do not forecast the top rung. Forecast **precursor rung occupancy**, which is scoreable on a schedule: test-moratorium-relevant activity, NOTAM and closure-area patterns, counterspace rendezvous-and-proximity events, warhead-related transport indicators. Report the top rung as `INSUFFICIENT_EVIDENCE` with enumerated evidence gaps, plus **indicator likelihood ratios and lead times** — the §7.4 machinery, unchanged.

C-ADV-8 openly reuses C-ADV-2's CTMC, which the judges treated as a weakness. **Under the family framing it is the point:** C-ADV-8 is C-ADV-2's kernel with a different rung set, a different corpus, and the zero-base-rate tail policy from C-GEO-3. It becomes a config, and its unscoreable headline becomes a scoreable precursor forecast plus an honest abstention. **A 2/2/2 candidate becomes fieldable by inheriting two decisions from its siblings.**

---

## 18. The general architecture rule for counterfactual-branch products

**This rule appears nowhere in the 60 candidates, and it is the difference between a structural weakness and a demonstration.**

C-CYBER-3 forecasts US cyber response options across six branches. **Five are structurally unresolvable** — the US takes one action; the other five branches never happen and never can be scored. Under current architecture nothing stops someone reporting a pooled Brier across all six, which would be meaningless *and would look excellent*, because unrealised branches can be scored however you like.

**The rule.**

> Score the **realised** branch under `historical_backtest` or `live_post_cutoff`.
> Score **unrealised** branches **only** under `synthetic_oracle`.
> **Never pool.**

**The implementation — make the illegal states unrepresentable, not merely checked.** The platform's current tag is a flat const array (`EVALUATION_REGIMES`, `engine/src/metrics/index.ts:35`). The extension replaces it with a discriminated union, so the forbidden combinations fail to compile rather than failing at runtime:

```ts
export type EvaluationScope =
  | { readonly regime: "synthetic_oracle";    readonly realization: "realized" | "counterfactual" }
  | { readonly regime: "historical_backtest"; readonly realization: "realized" }
  | { readonly regime: "live_post_cutoff";    readonly realization: "realized" };
```

`forecastQualityReport(forecasts, scope: EvaluationScope)` then makes `{ regime: "live_post_cutoff", realization: "counterfactual" }` a **type error**. Aggregation functions accept `readonly Scored[]` narrowed to a single scope; no function accepts a mixed set. This preserves the existing invariant — *no function pools regimes* — and extends it one axis.

**What this buys each pack:**

| Pack | Effect |
|---|---|
| **C-CYBER-3** | The five unresolvable branches become type-forbidden from live scoring. Their honest product is a **consequence twin** — conditional consequence distributions with named falsifiers — never a scored forecast. The realised branch scores normally. **The candidate's structural weakness becomes an enforced guarantee.** |
| **C-GEO-3** | R4/R5 counterfactual explorations cannot contaminate the live register. |
| **C-ADV-2** | ICB counterfactual crisis paths cannot enter the backtest headline. |
| **C-ADV-8** | Top-rung scenario exploration is confined to `synthetic_oracle` by the compiler. |

**Why this is worth putting in front of a technical evaluation panel.** Every vendor in this space produces counterfactual branch analysis. Essentially none can say what stops a counterfactual number from being reported as an accuracy result — because for most of them, nothing does. **We can point at a type.**

---

## Verification status of every external claim

**Verified this session, primary source fetched:**

- ICB v16 — 512 crises, 1,131 crisis actors, 1,000 crisis dyads, 1918–2021 — [sites.duke.edu/icbdata](https://sites.duke.edu/icbdata/)
- Taiwan MND daily PLA-activity releases (區域動態, `/news/plaact/{id}`, daily dated postings) — [mnd.gov.tw](https://www.mnd.gov.tw/)
- Hawkes conditional intensity, branching ratio, stability condition, multivariate form — [Hawkes process](https://en.wikipedia.org/wiki/Hawkes_process)
- CRPS definition and strict propriety; RPS for ordered categorical outcomes — [Scoring rule](https://en.wikipedia.org/wiki/Scoring_rule)
- Gillespie SSA assumes exponentially distributed waiting times and Markovian reactions — [Gillespie algorithm](https://en.wikipedia.org/wiki/Gillespie_algorithm) — **this confirms the judge's C-ADV-2 correction**
- OpenTimestamps: Bitcoin-anchored, independently verifiable without trusting the service — [opentimestamps.org](https://opentimestamps.org/)
- ViEWS: Uppsala + PRIO, open-source conflict prediction, public leaderboard — [viewsforecasting.org/about](https://viewsforecasting.org/about/)
- Laub/Taimre/Pollett Hawkes survey exists and covers "all major aspects" — [arXiv:1507.02822](https://arxiv.org/abs/1507.02822) *(specific coverage of thinning / time-rescaling not confirmed)*
- **Negative finding:** no Taiwan ADIZ / incursion / median-line tracker found at `chinapower.csis.org/tracker/` or `/data/`; two plausible direct URLs 404. **Correction to the landscape sweep — do not build a CSIS dependency into the bid.**

**UNVERIFIED this session — fetch blocked (403), carried forward from the landscape sweep; confirm before bid submission:** IARPA REASON program structure and data rights ([iarpa.gov](https://www.iarpa.gov/research-programs/reason)); CIA Acquisition Framework announced February 2026; Metaculus public track record; ForecastBench July 2026 operator statement; Rhombus Power IDIQ scope. *(WebSearch budget was exhausted for this session before this task began; all verification above was done by direct fetch.)*

**Verified this session in the PROTEUS codebase:** `RunIdentity` has no panel field (`engine/src/artifact/store.ts:28-35`, `computeRunId` at :123) — **gap 1 confirmed**. Boolean panel availability (`engine/src/pipeline/run-question.ts:680` → `engine/src/pipeline/analysis.ts:240`) — **gap 2 confirmed**. `SimulationAdapter` seam and discrete tick loop (`engine/src/sim/kernel.ts`). Three-layer leakage guard (`engine/src/corpus/as-of.ts`). Abstention reasons and measured thresholds (`engine/src/evidence/abstention.ts:17-51`). `EVALUATION_REGIMES` and mandatory regime tag (`engine/src/metrics/index.ts:35`). **No CRPS, no RPS, no ordinal scoring anywhere — repo-wide grep returns zero hits.**

**Never measured, and labelled so throughout:** historical backtest accuracy; live post-cutoff accuracy; skill versus a human analyst; contradiction detection on real prose; the analyst-hour denominator; ΔRPS for this pack in any regime.