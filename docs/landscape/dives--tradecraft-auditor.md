# Tradecraft Auditor & Indicator Lab
## C-TRADECRAFT-4 + C-TRADECRAFT-6 — Concept of Operations
### Scoring the customer's own published rubric, mechanically

---

## 1. In Plain English

Intelligence reports have to follow a published rulebook — ICD 203 — that says things like "explain how sure you are," "say what you assumed," and "list what would change your mind." Today, humans grade a random sample of reports against that rulebook by hand, once or twice a year, and they skip the hardest rule (was it actually right?) because nobody can measure it.

This builds two machines. The first reads a finished report, pulls out every statement of the form "X is likely," shows the analyst that list to confirm it got the reading right, and then does arithmetic no human can do in their head: it checks whether all seven or eight of those statements *can all be true at once*. Often they cannot — "X is likely" sitting beside "X or Y is unlikely" is a flat contradiction, and it is invisible on the page. The machine names the smallest set of sentences that clash and says how far off they are.

The second machine measures whether the warning signs on a watch list actually warn. Watch lists only ever grow, because no one wants to be the officer who deleted the indicator that would have caught it. Giving that officer a measured number — with error bars — is the only cover that makes deletion defensible.

What is new: the contradiction check has *mathematical* ground truth, not an opinion; the warning-sign measurement runs on a public daily data feed anyone can check; and both are built so that no score can ever be traced back to the person who wrote the report. That last property is not a promise in a policy memo — it is a missing field in a database and a test that fails if anyone adds it back.

---

## 2. The analytic question and its resolvable quantity

This capability answers **four** distinct questions. They resolve against different things, on different clocks, and no function in the system pools them.

### 2.1 Q1 — Coherence (the mathematical one)

> Given the estimative statements a finished product actually makes, does there exist any probability distribution over the world simultaneously satisfying all of them?

**Measure.** A three-valued verdict plus a magnitude.

| Verdict | Meaning | Emitted when |
|---|---|---|
| `COHERENT` | A satisfying distribution exists | LP feasible **and** ≥ 2 confirmed statements share ≥ 1 atom |
| `INCOHERENT` | No such distribution exists | LP infeasible, IIS extracted, red-team downgrade path exhausted |
| `UNDETERMINED` | The question was not askable | < 2 interacting statements, or extraction unconfirmed, or atom identity unresolved |

**Magnitude.** For `INCOHERENT`, the *minimum coherent repair* — the smallest total probability mass, in percentage points, that must be moved across the stated intervals to restore feasibility. This is the analyst's guaranteed loss if the stated odds were offered as bets ([De Bona & Finger, *Artificial Intelligence*, 2015](https://www.sciencedirect.com/science/article/pii/S0004370215000922) establishes the bridge between LP-computable inconsistency measures and Dutch-book incoherence degree).

**Partition.** The verdict set above is exhaustive and mutually exclusive by construction. It is not a probability distribution and is never scored with Brier.

**Resolution event.** *Immediate and internal.* Given a confirmed proposition set, the answer is a theorem, not a forecast. This is the property that makes this capability unique in the whole candidate portfolio: it is the only one whose primary output is verifiable by an evaluator with a laptop and an LP solver, with no waiting and no oracle.

**As-of discipline.** The audit runs against the product text and the source corpus as they stood at the product's draft date. The platform's as-of retrieval filter and its runtime assertion — which throws if any evidence reference post-dates the run's as-of date — apply unchanged.

### 2.2 Q2 — ICD 203 conformance (the rater-agreement one)

> For each of the nine analytic tradecraft standards, what score would a trained ODNI/AIS or DIA/PEB panel assign this product?

**Measure.** Integer 0–3 per standard, matching the scale AIS and DIA actually use — zero poor, three excellent ([Riehle 2025, *Intelligence and National Security* 40:2](https://doi.org/10.1080/02684527.2025.2468051)). Nine standards, so 0–27; we do **not** invent a composite, because AIS does not publish one and a composite is exactly the number that becomes a personnel instrument.

**Resolution event.** The blind consensus of three trained human raters, using the design Marcoci, Vercammen & Burgman validated: independent scoring, then aggregation, because aggregating three trained raters substantially improves reliability over one ([Marcoci et al. 2018](https://doi.org/10.1080/02684527.2018.1546265)). The machine's score is the estimand; the human consensus is the resolution.

**Partition.** The 4-point band per standard. Adjacent-band disagreement is reported separately from ≥2-band disagreement; only the latter is a substantive miss.

### 2.3 Q3 — Standard 8, deferred (the accuracy one)

AIS **does not grade Standard 8** — "makes accurate judgments and assessments" — because of the difficulty of determining accuracy (Riehle 2025). That exclusion is the largest hole in the IC's own quality system and it is not a hole this or any tool closes at audit time.

What the auditor does instead: at audit time it emits a **resolution contract** for every estimative statement it can bind.

```
ResolutionContract {
  statementId:       StatementId
  registeredEventId: ResolvableEventId     // third-party-resolved, dated
  resolutionSource:  Url                   // the publisher, not us
  resolutionDate:    IsoDate               // known at audit time
  bandAsserted:      Icd203Band            // one of the seven
  // no authorId. no officeId. see §13.
}
```

**Resolution event.** On `resolutionDate`, a job fetches `resolutionSource`, resolves the registered event, and scores the asserted band. Outcomes accumulate per *product class and topic*, never per person.

**The number this makes measurable.** A statement that cannot be bound to a registered event gets `UNBINDABLE`, with a reason code — and the fraction of a product's judgments that are `UNBINDABLE` is the **unclear-judgment rate**. This has been measured in the open literature exactly once: the 2016 declassified AIS review of Office of Naval Intelligence products found **45% of all judgments were "unclear"** relative to those carrying a resolvable condition (Riehle 2025, citing the declassified AIS report). Nobody has measured it since, and nobody measures it prospectively. ICD 203 Standard 8's own text demands it — *"analytic products should express judgments as clearly and precisely as possible, reducing ambiguity by addressing the likelihood, timing, and nature of the outcome"* — and there has never been an instrument. This is the single most quotable number this capability produces, and it is obtainable on public products in week 8.

### 2.4 Q4 — Indicator diagnosticity (C-TRADECRAFT-6)

> For indicator *I* and warning problem *W*, what is the likelihood ratio LR = P(I | W) / P(I | ¬W), and is it distinguishable from 1?

**Measure.** LR point estimate with a Jeffreys interval on log-LR, from a 2×2 contingency table over a declared observation window and a declared reporting-regime segment.

**Partition** — five bands plus a mandatory third verdict:

| Band | LR range | Meaning |
|---|---|---|
| Strongly diagnostic | LR ≥ 10 or ≤ 0.1 | Moves the posterior a full ICD 203 band or more |
| Moderately | 3–10 / 0.1–0.33 | Real signal |
| Weakly | 1.5–3 / 0.33–0.67 | Marginal |
| Non-discriminating | CI **entirely inside** [0.67, 1.5] | **Retirement candidate** |
| `INSUFFICIENT_EVIDENCE_TO_RATE` | — | Abstention gate fired |

**The N=1 rule, stated as a hard constraint.** The abstention gate runs on the *counting statistics, before the estimator runs*. If the minimum cell count in the 2×2 table is below `n_min`, or the Jeffreys interval on log-LR is wider than `w_max`, the verdict is `INSUFFICIENT_EVIDENCE_TO_RATE` and no LR is emitted at all — not a wide one, not a shrunk one, none. The rare-but-decisive indicator that fired once, before the one event, must never be reported as a low LR or a weak LR. It routes to a distinct bucket, "retain on judgment, unrateable," accompanied by the number of additional base-rate periods required to leave that bucket. That number is what makes the verdict usable by a watch chief.

**Retirement is affirmative, never default.** An indicator is proposed for retirement only when its confidence interval lies *entirely inside* [0.67, 1.5] — i.e. when we can positively demonstrate non-discrimination. A wide interval never retires anything. This inverts the usual hypothesis test on purpose: the cost asymmetry runs the other way for warning.

**Resolution event.** Both cells of the 2×2 come from third parties on published schedules. For the reference instantiation: Taiwan's Ministry of National Defense publishes daily PLA activity reports (sorties, median-line crossings, naval vessels) at [mnd.gov.tw](https://www.mnd.gov.tw/en/news/plaactlist/192); compiled public series exist at [CSIS ChinaPower](https://chinapower.csis.org/data/taiwan-adiz-violations/) (Brown & Lewis) and [PLATracker](https://www.platracker.com/trackers). The event side comes from MND's own dated exercise announcements. Neither side is our judgment.

---

## 3. The kernel

### 3.1 Honest statement of architecture class

**This is `estimate-and-adjudicate over documents` with a deterministic verification core. It is not `simulate-and-adjudicate` and it is not a consequence twin.**

There is no numeric kernel simulating adversary behavior. There is no actor profile. **The platform's two knobs — `riskTolerance` and `escalationPropensity` — are not used at all by this pack.** That is the fourth of six mission lenses to re-bound or bypass them, and it is honest evidence that the two-knob actor model is a simulation-lens construct, not a platform universal. A technical panel that reads six of these papers will notice; better that we say it.

The ensemble in this kernel varies over **readings of the document**, not over states of the world. That inversion is the design's load-bearing idea and it is what makes the false-alarm problem tractable (§ 3.3).

### 3.2 Layer 2 — the LP, in enough detail to check

This is Boolean probability satisfiability (PSAT), attributed to Boole (1854), reintroduced to AI by [Nilsson (1986)](https://doi.org/10.1016/0004-3702(86)90031-7), shown NP-complete by Georgakopoulos, Kavvadias & Papadimitriou (1988), and given its LP treatment by Kavvadias & Papadimitriou (1990) and Hansen & Jaumard's column-generation line ([Jaumard, Hansen & Poggi de Aragão, *INFORMS J. Computing* 3(2), 1991](https://ideas.repec.org/a/eee/ejores/v108y1998i3p671-683.html)).

**Inputs.** A confirmed set of statements *S* = {s₁ … sₙ}, each a pair (φᵢ, [lᵢ, uᵢ]) where φᵢ is a proposition over a Boolean algebra generated by atoms *A* = {a₁ … a_m}, and [lᵢ, uᵢ] is the numeric interval of the ICD 203 band asserted. ICD 203 D.6.e(2)(a) fixes those intervals:

| Band | Interval |
|---|---|
| almost no chance / remote | 0.01–0.05 |
| very unlikely / highly improbable | 0.05–0.20 |
| unlikely / improbable | 0.20–0.45 |
| roughly even chance / roughly even odds | 0.45–0.55 |
| likely / probable | 0.55–0.80 |
| very likely / highly probable | 0.80–0.95 |
| almost certain(ly) / nearly certain | 0.95–0.99 |

**World enumeration.** Let *W* be the set of complete conjunctions over *A*. Naively |*W*| = 2^m. In practice it is far smaller, because declared MECE partitions collapse it: a partition over *k* mutually exclusive, exhaustive outcomes contributes *k* worlds, not 2^k. The platform's Framer already emits structurally-MECE outcome bands; that output feeds world enumeration directly and is the single largest reuse in this pack.

|*W*| = ∏ (partition sizes) × 2^(free atoms).

**Variables.** π_w ≥ 0 for each w ∈ *W*.

**Constraints.**

```
(N)   Σ_{w∈W} π_w = 1

(Sᵢ)  lᵢ ≤ Σ_{w ⊨ φᵢ} π_w ≤ uᵢ                          for each i = 1..n

(Cⱼ)  conditional statement P(Y | X) ∈ [l, u] linearizes to
      l · Σ_{w ⊨ X} π_w  ≤  Σ_{w ⊨ X∧Y} π_w  ≤  u · Σ_{w ⊨ X} π_w
      — still linear in π, no ratios in the model

(Pₖ)  Σ_{outcomes o ∈ partition k} P(o) = 1              for each declared partition
```

**Feasibility ⟺ coherence.** A feasible π is a witness distribution satisfying every stated band simultaneously. Infeasibility means no such distribution exists, in any world, for any beliefs — a bookmaker offering the analyst's own stated odds can construct a book that loses in every world.

Caveat, stated plainly: this is the **Kolmogorovian** reading. Full de Finettian coherence, which admits conditioning on null events, requires the integer-programming treatment of [Cozman & di Ianni, *IJAR* 2015](https://www.sciencedirect.com/science/article/pii/S0888613X1400142X). We ship the Kolmogorovian check and flag any statement conditioning on an event whose lower bound is 0 as `REQUIRES_DE_FINETTI` rather than silently resolving it. That flag is a finding, not a failure.

**Solve strategy, with the size threshold named.** For |*W*| ≤ 262,144 (m ≤ 18 free atoms) we build the LP explicitly and solve it dense. A 25 × 32,768 LP — the typical case, since IC products carry roughly 6–12 estimative statements — solves in milliseconds. **This matters more than it sounds:** at IC product scale the exponential LP is solved *exactly*, so there is no heuristic, no sampling, and no approximation anywhere in the coherence verdict. Beyond the threshold we fall back to column generation with a SAT-based pricing oracle ([Finger & De Bona, IJCAI 2011](https://www.ijcai.org/Proceedings/11/Papers/096.pdf)) and the artifact records that it did.

### 3.3 Layer 3 — IIS extraction, and why we do not use the solver's

When infeasible, we must name the sentences. An **Irreducible Infeasible Subsystem** is a subset of constraints that is itself infeasible and becomes feasible if any single member is removed. Both [Gurobi](https://docs.gurobi.com/projects/optimizer/en/current/features/infeasibility.html) and [HiGHS](https://ergo-code.github.io/HiGHS/stable/guide/advanced/) expose IIS routines.

**We do not call them, and the reason is a determinism requirement.** Solver IIS routines are explicitly *not* minimum-cardinality — Gurobi's own documentation says an infeasible model may have multiple IISs and the returned one need not be smallest; HiGHS's IIS facility is documented as "under development," LP-only, and driven by an `iis_strategy` bitmap. Different presolve settings return different IISs for the same model. That destroys the platform's byte-identical-artifact property, which for a compliance instrument is not a nicety — an audit finding you cannot reproduce is not an audit finding.

So we compute the **minimum-cardinality IIS** ourselves, deterministically, as a small MIP:

```
minimize   Σᵢ yᵢ                                  yᵢ ∈ {0,1}, one per statement
subject to Σ_{w ⊨ φᵢ} π_w ≥ lᵢ − yᵢ · M
           Σ_{w ⊨ φᵢ} π_w ≤ uᵢ + yᵢ · M
           Σ π_w = 1,  π ≥ 0
```

with M = 1 (probabilities are bounded, so big-M is exact and there is no numerical tuning). yᵢ = 1 relaxes statement i entirely. The optimum is the smallest number of statements whose removal restores coherence, and the support of **y** is the reported clash set. For n ≤ 12 this is instantaneous. When multiple optima exist, we enumerate all of them via iterative no-good cuts up to a cap of 8 and report the **intersection** ("implicated in every explanation") and the **union** ("implicated in at least one"), canonically sorted by statement offset so the artifact hash is stable.

**Minimum repair.** Separately, the elastic LP:

```
minimize   Σᵢ (εᵢ⁺ + εᵢ⁻)
subject to lᵢ − εᵢ⁻ ≤ Σ_{w ⊨ φᵢ} π_w ≤ uᵢ + εᵢ⁺
           Σ π_w = 1,  π ≥ 0,  ε ≥ 0
```

The optimum, in percentage points, is the report's headline magnitude: *"These four statements cannot all hold. The smallest repair moves 11 points."*

**Determinism.** The artifact records the sorted clash set, the repair magnitude, the solver identity and version, presolve settings, and the world-enumeration order — never the simplex basis, which is degenerate-dependent. Same input ⇒ byte-identical artifact hash, preserving the platform's existing guarantee (unit test + CLI, verified).

### 3.4 Layer 1 — the multi-reading extraction ensemble

This layer is stochastic, and it is where the whole system can fail.

For each product, run *k* = 5 independent extractions under different **charitable-reading policies**, seeded by the platform's sfc32 PRNG:

1. **Widest admissible** — every ambiguous scope resolved to the loosest reading
2. **Narrowest admissible** — every ambiguous scope resolved to the tightest
3. **Syntactic-attachment A / B** — the two readings of any prepositional or relative-clause attachment ambiguity
4. **Literal** — no scope resolution; ambiguity preserved as a disjunction

A proposition enters the candidate set with `agreement: k/5`. Propositions with agreement < 5/5 are surfaced to the analyst as **"this sentence has more than one admissible reading"** — which is itself a Standard 6 finding (*"Language and syntax should convey meaning unambiguously"*) and a Standard 8 finding (*"reducing ambiguity"*). The extraction's weakness becomes a product feature, and it maps directly onto the 45% unclear-judgment figure.

**Coherence is declared only if the statement set is infeasible under *every* admissible reading.** A clash that dissolves under any charitable reading is not a contradiction; it is a clarity defect, and it is reported as one.

### 3.5 Layer 4 — the Indicator Lab estimator

Not an LLM. A 2×2 contingency estimator:

```
                    W occurred    ¬W
  I fired              a           b
  I did not            c           d

  LR⁺ = [a/(a+c)] / [b/(b+d)]
```

with Jeffreys (Beta(½,½)) intervals on each conditional and the delta method on log-LR. Segmented by declared **reporting regime** — MND's publication format has changed across the series, and an LR estimated across a format change is an artifact of the format change, not of the adversary. Segment boundaries are declared in the pack config, pre-registered, and hashed into the run id. Researcher degrees of freedom in segmentation are the single largest threat to this component's validity and pre-registration is the only defense.

**Marginal cost per indicator is a database query, not an LLM call.** This is the cheapest capability in the entire portfolio to operate at scale.

---

## 4. The panel — which standards are mechanically checkable, and which are not

### 4.1 The concession table

This table concedes more than it claims, deliberately. An evaluation panel will trust a paper that draws the line honestly far more than one that claims nine-for-nine.

| # | ICD 203 Tradecraft Standard | Mechanical? | What the machine actually does | What it cannot do |
|---|---|---|---|---|
| 1 | Properly describes quality and credibility of sources | **Partial** | Every judgment has ≥1 source descriptor; descriptor vocabulary conforms to ICD 206; count of unsupported assertions (the platform already counts these without blocking) | Judge whether the descriptor is *accurate* — that requires source access |
| 2 | Properly expresses and explains uncertainties | **Largely yes** | (a) every estimative expression is in the ICD 203 table; (b) **row-mixing without the required disclaimer** — ICD 203 D.6.e(2)(a); (c) **a confidence level and a degree of likelihood in the same sentence** — explicitly prohibited by D.6.e(2)(b), a sentence-level parse; (d) **joint satisfiability** — the LP | Judge whether the *chosen band* is the right one |
| 3 | Distinguishes information from assumptions and judgments | **Partial** | Every stated assumption carries an implication statement and a falsifier (both textually required by the standard: *"explain the implications for judgments if assumptions prove to be incorrect… identify indicators that, if detected, would alter judgments"*) | Detect an *unstated* load-bearing assumption — the hard judgment, and the key-assumptions-check adjudicator's whole job |
| 4 | Incorporates analysis of alternatives | **Partial** | Alternatives exist; they are MECE over a declared partition (Framer already enforces structural MECE); each carries indicators, per the standard's own text | Judge whether the alternative set is *plausible* or complete |
| 5 | Demonstrates customer relevance, addresses implications | **No** | — | Pure judgment |
| 6 | Uses clear and logical argumentation | **Partial** | Internal consistency of estimative statements is exactly the LP — a mechanization of a clause in this standard's own text: *"Products should be internally consistent."* Ambiguity detection via the reading ensemble | General argument validity |
| 7 | Explains change to or consistency of judgments | **Partial → yes once a store exists** | Given a posterior store: does this product's band on a registered event differ from the last product's, and does it say so? Fully mechanical | Judge whether the *explanation* of change is adequate |
| 8 | Makes accurate judgments and assessments | **No at audit time; yes at resolution time** | Emits resolution contracts; scores them on their dates; reports the unbindable rate | Score accuracy at audit time — which is exactly why AIS excludes it |
| 9 | Incorporates effective visual information | **No** | — | Pure judgment |

**Four fully mechanical checks in Standard 2 alone, one of which (2b) is a verbatim prohibition in the directive that no tool checks today.** That is the wedge.

### 4.2 The adjudication panel

The platform's existing panel, re-tasked. Each adjudicator scores on the AIS/DIA 0–3 scale with a **required evidence span** (a character offset range into the product) — a finding without a span is rejected by the type, not by a reviewer.

| Adjudicator | Adjudicates | Rubric |
|---|---|---|
| **Key assumptions check** | Standard 3 | For each assumption: is it load-bearing (removing it changes ≥1 judgment's band)? Does it carry a falsifier that is *observable* and *dated*? Does the product state the implication if it fails? |
| **Devil's advocate** | Standard 4 | Was the strongest alternative addressed, or a straw one? Rubric: construct the strongest alternative the source base supports; score whether the product engages it |
| **ACH with Heuer diagnosticity** | Standards 1 + 4 jointly | Which cited sources are actually *diagnostic* between the product's own alternatives? A product with a beautifully-described but wholly non-diagnostic source base gets flagged. Ranking by weighted inconsistency ascending, as shipped |
| **Premortem** | Standard 8, prospectively | "Assume this judgment is wrong in 12 months. What was the most likely reason?" Output feeds the resolution contract's failure modes |
| **Red team, bounded rerun** | The coherence finding itself | Given an IIS, find an admissible reading under which it dissolves. Success ⇒ finding downgraded to `AMBIGUOUS_READING` (a Standard 6/8 clarity finding). This is the *second* layer of false-alarm defense and it reuses the platform's shipped bounded-rerun authority |

**Calibration.** Per-judge z-score normalization removes severity bias (shipped). Confidence aggregates by **weakest link, never by mean** (shipped). Outlier detection global/dimensional/unique (shipped). Krippendorff alpha across adjudicators is reported on every audit.

### 4.3 Two platform gaps this pack cannot work around — required code, not config

**Gap 1 — the rubric that judged a run is not in the artifact.** `PanelPlan` carries an LLM-generated `systemPrompt` per adjudicator; it is never persisted and never hashed; `runId = computeRunId(identity)` and identity has no panel field. **For a compliance instrument this is disqualifying.** An audit finding that cannot be traced to the rubric that produced it will not survive a single IG question. Required change: the Scenario Pack ships adjudicator rubrics as **versioned files**, generation is disabled for this pack, and the pack content hash enters `computeRunId`. This is new code in the identity path, not configuration, and it is a precondition for fielding — not a nice-to-have.

**Gap 2 — k-of-N panel loss is a boolean.** `available: results.length > 0` → `level: adjudicationAvailable ? "high" : "moderate"`. One surviving adjudicator of five scores identically to a full panel, and partial panel loss is the *normal* operating condition. For a graded compliance score this is a silent quality failure. Required change: `panelCoverage: { responded: k, planned: N }` as a required artifact field, and a confidence ceiling that is a monotone function of k/N. Also new code.

**Gap 3 — the two knobs.** Not applicable; this pack does not instantiate an actor. Stated in § 3.1.

---

## 5. The Scenario Pack — config versus new code, itemized honestly

### 5.1 Ships as configuration (existing platform machinery)

| File | Contents |
|---|---|
| `standards/icd203-lexicon.json` | The seven bands, both term rows, numeric intervals — transcribed from ICD 203 D.6.e(2)(a) |
| `standards/icd203-standards.json` | Nine tradecraft standards, ID, text, mechanical/judgment classification per § 4.1 |
| `rubrics/ais-0-3.json` | The 0–3 anchors per standard, per AIS/DIA practice |
| `panel/*.rubric.md` | Five versioned adjudicator rubrics (§ 4.2) — **files, not generated** |
| `framer/coherence-partition.json` | The three-valued verdict partition; abstention gate thresholds |
| `abstention/indicator-gate.json` | `n_min`, `w_max`, retirement CI band [0.67, 1.5] |
| `corpus/asof-policy.json` | Draft-date freeze; existing as-of filter and post-date assertion |
| `metrics/regimes.json` | The three `EvaluationRegime` tags; no pooling function exists |
| `indicators/mnd-segments.json` | Declared reporting-regime segment boundaries for the Taiwan series — **pre-registered, hashed into run id** |
| `events/registry.seed.json` | Registered `ResolvableEvent` definitions with resolution sources and dates |

### 5.2 New code — stated plainly, no pretending

| Component | Why it is not config | Size estimate |
|---|---|---|
| **Estimative-statement extractor** | New pipeline: sentence segmentation, band recognition, proposition normalization, atom binding to the event registry, 5-reading ensemble | Largest single item |
| **Show-back confirmation UI + `AnalystConfirmation` token** | The type-level gate of § 6/§ 13 does not exist | Medium |
| **World enumerator** | Consumes Framer MECE partitions, emits the world set with a canonical order | Small |
| **PSAT LP builder + dense solve + column-generation fallback** | New; wraps HiGHS via its C API | Medium |
| **Minimum-cardinality IIS MIP + no-good enumeration** | Deliberately *not* the solver's IIS (§ 3.3) | Small |
| **Elastic minimum-repair LP** | New | Small |
| **Resolution-contract emitter + dated resolver job** | New; the Standard 8 mechanism | Medium |
| **2×2 LR estimator with Jeffreys intervals + segmentation** | New; no LLM | Small |
| **MND scraper + normalizer** | New; built against MND directly, not a third-party compilation, to avoid terms dependence | Small |
| **k-anonymity aggregation layer** | New; the § 13 enforcement | Small |
| **Platform: rubric-in-identity (Gap 1)** | Core change to `computeRunId` | Small but core |
| **Platform: graded panel coverage (Gap 2)** | Core change to confidence aggregation | Small but core |

**The honest ratio.** The landscape sweep's "60 candidates collapse to ~12 kernel families" argument is a config-not-code argument, and it holds for the simulation packs. **It does not hold cleanly here.** This pack is roughly 60% new code by effort, because the verification core (LP/IIS/MIP) and the extraction pipeline are genuinely new kernel families that no simulation pack needs. Claiming otherwise would be the first thing a technical panel breaks. What *does* transfer, unchanged and substantially: the abstention gate, the adjudication panel, z-score calibration, weakest-link confidence, the as-of leakage guards, deterministic seeded execution, the artifact hash, the three-regime tagging, and the ICD 203-shaped product schema with its required-falsifier key assumptions. That is a real and large reuse, and it is the reuse worth claiming.

---

## 6. Data — named, with access reality

### 6.1 Standards and rubrics

| Source | Status |
|---|---|
| [ICD 203, Analytic Standards](https://www.dni.gov/files/documents/ICD/ICD%20203%20Analytic%20Standards.pdf) (2015 revision; supersedes 21 June 2007) | Public. Full text obtained. |
| [ICD 206, Sourcing Requirements for Disseminated Analytic Products](https://www.odni.gov/index.php/who-we-are/organizations/policy-capabilities/ps/ps-related-menus/ps-related-links/policy-division/intelligence-community-directives) | Public. |
| ODNI *Rating Scale for Evaluating Analytic Tradecraft Standards* (ODNI 2015b), the operational rubric AIS uses | **UNVERIFIED** as a currently-retrievable public document. It is cited in the peer-reviewed literature (van Gelder et al. 2020; Marcoci et al. 2018) and was used by cleared and uncleared researchers under CREATE. We build against the published 0–3 anchors described by Riehle (2025) and request the current rating criteria at award. This is a named dependency, not a hidden one. |
| 50 U.S.C. § 3364 (IRTPA §§ 1019–1020) | Public. [govinfo](https://www.govinfo.gov/content/pkg/USCODE-2024-title50/pdf/USCODE-2024-title50-chap45-subchapIV-sec3364.pdf) |

### 6.2 Unclassified analytic-product corpus (the 90-day demo)

Target: 120 products written in ICD 203-shaped estimative prose, with dated resolvable content.

- **DNI Annual Threat Assessments** (public, 2015–2026) — written to IC convention, heavy in estimative language.
- **Declassified NIE and SNIE key judgments** — [CIA FOIA Reading Room](https://www.cia.gov/readingroom/), including the Grabo warning-intelligence handbooks.
- **UN Panel of Experts reports** (DPRK, Libya, Yemen) — outstanding: explicit estimative language, dated, publicly resolved.
- **IAEA Board reports** — same properties.
- **Congressional Research Service reports** — public since 2018.
- **Think-tank products written to IC convention** — CSIS, ISW, RAND. Use with care: not IC prose, and we must not claim they are.
- **State/INR public releases** — sparse but genuine.

**The honest gap.** None of these is a *draft* IC product on a classified network. Extraction precision on this corpus does not transfer to IC prose, which is denser and uses house conventions we will never see. This is the central technical risk (§ 14.1) and § 9 is how it is retired.

### 6.3 Indicator Lab data

| Source | Access |
|---|---|
| [Taiwan MND daily PLA activity reports](https://www.mnd.gov.tw/en/news/plaactlist/192) | Public, daily, Chinese + English. **Primary.** We scrape MND directly. |
| [CSIS ChinaPower Taiwan ADIZ Violations](https://chinapower.csis.org/data/taiwan-adiz-violations/) (Brown & Lewis) | Public compilation. Used for cross-validation only; licensing terms **UNVERIFIED**, so no operational dependency. |
| [PLATracker](https://www.platracker.com/trackers) — 20,000+ flights | Same treatment. |
| [ISW monthly PRC ADIZ incursions](https://understandingwar.org/map/monthly-prc-incursions-into-taiwans-adiz-2022-present/) | Cross-check. |

Secondary indicator domains with published schedules, for breadth: [CISA KEV catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) additions; EU sanctions adoptions in the Official Journal; MOFCOM export-control announcements. Each is a dated third-party artifact on a known cadence — the landscape sweep's strongest structural selection criterion.

### 6.4 Classified data — what we never touch

Under the REASON contracting pattern (§ 9), performers **never receive classified access**. We build and are measured on unclassified data. A cleared, independent T&E team retrains and evaluates on classified draft products and source reports in parallel, and returns actionable **summary-level unclassified feedback**. This is stated in the REASON BAA (W911NF-23-S-0007, § II.A.3): *"Performers will refine their systems to process the content and style of the IC's source reports using unclassified examples, but they will not have access to classified data."*

---

## 7. The oracle and the evaluation plan

### 7.1 Three regimes, tagged, never pooled

Every report carries a required `EvaluationRegime` tag and no function in the codebase pools across them. That constraint is already enforced.

---

### Regime 1 — `synthetic_oracle`

**Oracle.** Products generated with **injected incoherence of known type, location, and magnitude**. Ground truth is exact — we know which statements clash and by how many percentage points, because we constructed the clash.

Injection families:
1. **Direct band conflict** — P(X) ∈ likely, P(¬X) ∈ likely
2. **Disjunction violation** — P(X) ∈ likely, P(X ∨ Y) ∈ unlikely *(the paper's motivating example)*
3. **Partition overflow** — declared MECE bands summing above 1
4. **Conditional inconsistency** — P(Y|X), P(X), P(X∧Y) mutually unsatisfiable
5. **Transitive chain** — a 4-statement clash with no 3-statement subset infeasible (tests minimum-IIS correctness specifically)
6. **Near-miss controls** — sets coherent by ≤ 2 percentage points. **The false-alarm test.**

**Pre-registered questions.**

> **PR-1.** Coherence-detection **precision ≥ 0.98** at recall ≥ 0.90 on the injected set. *Precision is the headline; F1 is not reported, because F1 hides exactly the asymmetry warning (i) is about.*
> **PR-2.** On family 6 (near-miss controls) the false-positive rate is **< 0.01**.
> **PR-3.** Exact-minimum-IIS rate ≥ 0.95 — the reported clash set equals the injected one, by set equality.
> **PR-4.** Reported minimum repair is within 0.5 percentage points of the injected magnitude.
> **PR-5.** Byte-identical artifact hash across 100 reruns at fixed seed, including the IIS and repair fields.

**Baselines to beat.**

| Baseline | Why it is the right baseline |
|---|---|
| **B1 — regex/keyword estimative-term detector** | The floor. Finds terms, cannot reason about them. |
| **B2 — a frontier LLM asked directly "are these statements jointly consistent?", no LP** | **The baseline that matters.** It is what a competitor will build in a week, and it is what an evaluator will assume we are. Expected failure mode: high recall, catastrophic precision on family 6, no IIS, no magnitude, and non-reproducibility across reruns. We must publish its numbers, not assert them. |
| **B3 — B2 with chain-of-thought and self-consistency over 5 samples** | The strengthened version of B2. Same structural defect: no ground truth, no minimality guarantee, non-deterministic. |

---

### Regime 2 — `historical_backtest`

**Oracle A — conformance.** 40 public analytic products scored by three trained human raters, blinded and order-randomized, using the design Marcoci et al. validated.

> **PR-6.** Machine-vs-consensus **Krippendorff alpha ≥ the human-vs-human alpha measured in the same experiment**.

The bar to beat, honestly stated: Marcoci, Vercammen & Burgman found inter-rater reliability of the Rating Scale **without training was ICC = 0.294** (95% CI [−0.330, 0.654]) — near-useless, and their entire point was that calibration training is a prerequisite. Beating *untrained* human agreement is a low bar and we say so. The real bar is the trained three-rater consensus, and matching it is the claim.

**Oracle B — the human effect-size context.** The correct published CREATE/SWARM figures, which any evaluator will check:

> Analyst teams working on the SWARM platform scored a mean of **21.4 out of 32** on the IC Rating Scale, versus **15.9 out of 32** for the same analysts using their organizations' normal methods. *p* < .01, *t* = 6.86, *df* = 51.2. Effect size **Cohen's d_rm = 1.37**, 95% CI **[0.56, 2.23]**. Under the conservative missing-report treatment, d_rm = 1.2, CI [0.42, 2.03]. Scale construction: the seventh standard ("explains change to or consistency") was dropped as irrelevant in a laboratory setting, leaving eight dimensions at 1–4, summing to 8–32, with three trained raters averaged per report.
> — [van Gelder et al., *Journal of Cognitive Engineering and Decision Making* 14(3), 2020](https://journals.sagepub.com/doi/full/10.1177/1555343420926287)

A note that will be checked: in the same study, **general-public teams on SWARM scored 22.6, higher than the professional analysts' 21.4** (d = 0.25, p = 0.27, n.s.). We do not hide it. It reinforces the argument: the platform, not the expertise, carried the effect — which is the case for instrumenting the process rather than the person.

We are **not** claiming to beat 1.37. That is a human-process effect on report quality; ours is a measurement instrument. The claim is that we can measure whether such an intervention worked, cheaply, repeatedly, and on every product rather than a sample.

**Oracle C — deferred accuracy.** Resolution contracts written against products from 2015–2024 whose resolution dates have passed, scored now.

> **PR-7.** Unbindable-judgment rate reported with a 95% interval, per product class. Reference point for interpretation, not a target: the 2016 declassified AIS review of ONI products found **45% of judgments "unclear"** and that **87% of IC future judgments "tested accurate"** while only ~56% of ONI products met that standard (Riehle 2025).
> **PR-8.** Brier and Brier skill on bound contracts against a persistence baseline and a base-rate baseline. **Reported per regime and never pooled with synthetic results.**

**Never** backtested against the customer's own historical analytic calls. Public baselines only — persistence, base rate, INFER/Metaculus/ViEWS where a matching question exists.

---

### Regime 3 — `live_post_cutoff`

**Indicator Lab, pre-registered, forward.** 25 indicators over the Taiwan MND series, registered with their 2×2 definitions, windows, and segment boundaries *before* the scoring window opens, hash-committed at registration.

> **PR-9.** Fraction of the 25 that receive a non-abstaining LR. *This number has never been published for any real watch list and is the capability's most honest headline.*
> **PR-10.** Among rated indicators, fraction whose CI excludes [0.67, 1.5] in either direction — the fraction that demonstrably discriminates.
> **PR-11.** Fraction whose CI lies **entirely inside** [0.67, 1.5] — the demonstrably non-discriminating, i.e. retirement candidates.
> **PR-12.** False-abstention rate on a held-out set where the true LR is known by construction. The platform's shipped 7% false-abstention figure was measured on a different question class and **does not transfer**; this must be measured fresh.

**Assumption-drift, forward.** 30 key assumptions extracted from the 2026 public corpus, each with a falsifier bound to a scheduled third-party source.

> **PR-13.** **Falsifier latency** — days between a falsifying event's publication date and the first product acknowledging it. Never measured in the IC. It is a direct benefit-(c) instrument.

### 7.2 The honest headline metric for this question class

Not Brier. Brier is the headline for the forecasting packs; here it is a third-order metric that only exists after resolution contracts mature.

**The auditor's headline is coherence-detection precision at fixed recall, with the false-positive rate on near-miss controls printed beside it.** Because adoption dies on a false alarm, not on a miss.

**The Indicator Lab's headline is the pair (rateable fraction, demonstrably-non-discriminating fraction).** Because the buyer's question is not "how good is my watch list" but "how much of my watch list can be evaluated at all."

---

## 8. The 90-day unclassified demonstration

Every week names the number and what would falsify it.

| Wk | Activity | Number out | What falsifies it |
|---|---|---|---|
| **1–2** | Corpus assembly (120 public products). Annotation guide. Three annotators mark every estimative statement, its band, its proposition. | **Inter-annotator Krippendorff alpha on proposition extraction.** | α < 0.6 ⇒ humans cannot agree what a product asserts, and the whole capability rests on sand. **This is the single most informative early result and it is deliberately scheduled first.** |
| **3–4** | Extraction pipeline; 5-reading ensemble; show-back UI. | **Extraction precision / recall vs the annotated gold set. Analyst rejection rate in the show-back.** Both printed in the report header from day one. | Precision < 0.85 ⇒ the show-back becomes tedious enough that analysts stop reading it and start rubber-stamping — which silently defeats the § 13 defense. |
| **5–6** | World enumerator; PSAT LP; min-cardinality IIS MIP; elastic repair. 400 synthetic products, 6 injection families. | **PR-1 … PR-5.** Precision, near-miss FPR, exact-IIS rate, repair accuracy, hash stability. | FPR on near-miss controls > 0.01. |
| **7–8** | Run the full pipeline on the 120 **real** public products. | **How many real analytic products contain a demonstrable Dutch book — and the unbindable-judgment rate.** | **If the count is zero, the within-product detector has no market and the entire value proposition moves to portfolio-level (§ 12.2), where atom identity is far harder. This is the demo's genuine falsifier and we name it in advance.** |
| **9–10** | Three trained raters score 40 products blind; machine scores the same 40. | **PR-6** — machine-vs-consensus alpha, alongside human-vs-human alpha from the same data. | Machine alpha below the untrained-human floor (ICC ≈ 0.29). |
| **11–12** | Indicator Lab: MND scraper, segmentation, 25 pre-registered indicators. | **PR-9, PR-10, PR-11** — rateable fraction, discriminating fraction, retirement candidates. | Rateable fraction < 0.3 ⇒ public data is too thin and the capability needs classified holdings, which changes the whole acquisition story. |
| **13** | Assumption-drift watch on 30 assumptions from weeks 7–8. | **PR-13** — falsifier latency for any that fired in the window; count of standing watches with a live schedule. | No falsifier fires in 13 weeks ⇒ the cadence is wrong and the watch needs a longer horizon to demonstrate. |

**What is shown, physically.** A single dated artifact per product: verdict, minimum clash set with source spans, minimum repair in percentage points, nine standard scores with evidence spans, panel coverage k/N, extraction precision/recall/rejection-rate header, unbindable-judgment rate, and a byte-identical artifact hash the evaluator can reproduce on their own machine from the seed. **The evaluator can independently verify the coherence verdict with any LP solver.** No other capability in the portfolio can say that.

---

## 9. The classified instantiation

### 9.1 What changes

Nothing in the kernel. The LP is the LP. The rubrics are the rubrics. The abstention gate is the gate.

What changes is the **corpus** and the **extraction distribution**. IC draft prose is denser, uses house conventions, carries source descriptors in formats we have never seen, and embeds classification and dissemination markings mid-sentence that will wreck a naive segmenter. Extraction precision measured on public products **does not transfer** and we must never present it as though it does.

### 9.2 What it adds

- **Portfolio coherence becomes real.** The unclassified demo has 120 unrelated products with almost no shared registered events. A classified enclave has thousands of products on overlapping accounts — the condition under which C-TRADECRAFT-8 (§ 12.2) is worth anything.
- **Standard 7 becomes fully mechanical.** Requires a posterior store over a continuous production line. Only exists inside.
- **Standard 1 becomes checkable against real source descriptors** under ICD 206 rather than against public analogues.
- **Cross-element discrepancy detection.** ICD 203 Standard 7 requires that *"significant differences in analytic judgment, such as between two IC analytic elements, [be] fully considered and brought to the attention of customers."* Today this is found when a human happens to read both products. This is benefit category (c) exactly.

### 9.3 The accreditation obstacle, and the solved pattern

The obstacle is not the math. It is that a vendor cannot see the data on which the capability must be proven, and the IC cannot buy a capability that has never touched its data.

**IARPA REASON already solved the contracting shape**, and we adopt it wholesale rather than inventing one:

- 42-month program; **Phase 1 (base) 1 Oct 2023 – 30 Sep 2025; Phase 2 (option) 1 Oct 2025 – 31 Mar 2027**.
- Phase 1: performer systems tested comprehensively on **unclassified** data; in parallel, an independent **cleared** T&E team retrains and evaluates the same systems on **classified** draft analytic reports and source reports.
- Phase 2: systems tested on classified data. **Performers do not have access to classified data.** They refine against the content and style of IC source reports using unclassified examples and **actionable summary-level unclassified feedback** from the cleared T&E team.
- Deliverables require a **minimum of Government Purpose Rights**, sufficient for the Government to modify and deploy on classified networks.

(REASON BAA W911NF-23-S-0007, §§ II.A.1, II.A.3 — [full text](https://arl.devcom.army.mil/wp-content/uploads/sites/3/2023/04/W911NF-23-S-0007-REASON-BAA-Final-17-March-2023.pdf))

**Why deterministic byte-identical artifacts make this pattern cheaper than it has ever been.** Under the REASON model the cleared T&E team runs the system on data the performer cannot see, and the performer must debug from summary feedback. That loop is normally agonizing, because the performer cannot reproduce anything. Here they can: the T&E team returns a run id, a seed, a rubric hash, and a pack hash. The performer reproduces the *identical* execution on synthetic data with the same structure and the same seed, sees the same code path, and fixes the defect — without ever seeing a classified byte. **Determinism converts an opaque feedback loop into a reproducible one.** That is a concrete, checkable acquisition argument, not a marketing claim, and it is the strongest reason this architecture belongs in a cross-domain solution over a classification boundary.

**The on-ramp.** The CIA announced a new Acquisition Framework on **9 February 2026**, built around centralized vendor vetting, a streamlined IT authorization process, and explicit pathways to *"rapidly onboard breakthrough technology prototypes"* — led by chief procurement executive Efstathia Fragogiannis, formerly director of contracts at DARPA ([CIA](https://www.cia.gov/stories/story/cia-launches-new-acquisition-framework-to-turbocharge-collaboration-with-private-sector/); [Nextgov/FCW](https://www.nextgov.com/acquisition/2026/02/cia-announces-new-acquisition-framework-speed-tech-adoption/411285/); [Federal News Network](https://federalnewsnetwork.com/intelligence-community/2026/02/cia-emphasizes-speed-under-new-acquisition-framework/)). A prototype with an unclassified 90-day demonstration and a REASON-shaped T&E plan is precisely the shape that pathway was built for.

---

## 10. Buyer, workflow displacement, and the analyst-hour denominator

### 10.1 The recurring mandated denominator — this is the section that makes benefit (d) defensible

The IC does not merely *permit* ICD 203 review. **It is required by statute, on a fixed annual cadence, with a report to Congress.**

- **50 U.S.C. § 3364(b)(1)(B)–(C)** — the responsible entity *"shall perform, on a regular basis, detailed reviews of finished intelligence product"* and *"shall be responsible for identifying on an annual basis functional or topical areas of analysis for specific review."*
- **50 U.S.C. § 3364(c)** — *"Not later than February 1 each year, the Director of National Intelligence shall provide to the congressional intelligence committees… a briefing with a description, and the associated findings, of each review."*
- **ICD 203 § E.1.b(2)** — DDNI/II shall *"prepare findings of analytic intelligence product reviews for reporting to Congress and relevant IC elements."*
- **ICD 203 § E.3.c** — heads of IC elements shall *"conduct internal programs of review and evaluation of analytic intelligence products utilizing the IC Analytic Standards as the core criteria, and provide annual status reporting to the DDNI/II."*
- **ODNI's own description of how it meets the mandate:** *"Evaluating hundreds of finished analytic products from all IC elements."* ([ODNI, Objectivity](https://www.dni.gov/index.php/how-we-work/objectivity))
- **§ 6312, Pub. L. 117–263 (Dec 2022)** — added an annual analyst training certification to the intelligence committees and an annual report on compliance incidents reported to analytic ombudspersons.

**The per-product human cost, itemized from published practice** (Riehle 2025):

| Step | AIS | DIA Product Evaluation Board |
|---|---|---|
| Sampling | Random, annual | Random, **every six months** |
| Independent scoring | 2 graders, separately | 2 analysts, separately, **from a different division than the author** |
| Consensus | Graders discuss to reach consensus | Analysts meet, compare, reach consensus |
| Adjudication | **Third independent grader** reviews | — |
| Output | 0–3 per standard | 0–3 per standard **+ narrative explanation for each score** |
| Coverage | All standards **except Standard 8** | Standards + a critical/required/when-appropriate matrix |

So the denominator is:

```
analyst-hours = (products sampled)
              × (2 independent reads + 1 consensus session + 1 third-grader review)
              × (hours per read — UNMEASURED)
              × (elements running an equivalent program: all of them, per ICD 203 E.3.c)
              × (cadence: annual at ODNI, semiannual at DIA)
```

**We do not assert an hours-per-read figure, and we will not.** It is the one number this paper cannot get from public sources, and inventing it is exactly the move a technical panel punishes. It is obtained in a timed side-by-side during the demonstration and it is the first thing we ask the customer for. What we can assert from public record is that the task is **statutory, recurring, sampled (so most products are never reviewed), performed by working analysts pulled off their accounts, and structurally excludes the standard everyone cares about most.**

### 10.2 The dated signed artifact the output lands on

The landscape sweep's reliable discriminator of buyability is whether the output lands on a dated artifact with a signature block. There are four, and they are unusually good ones:

1. **The DNI's annual briefing and report to the congressional intelligence committees** under 50 U.S.C. § 3364(c) — statutory, dated, signed, and the findings section is precisely what an auditor's aggregate output populates.
2. **Each IC element's annual status report to DDNI/II** under ICD 203 § E.3.c — dated, signed, mandatory for every element.
3. **DIA's semiannual Product Evaluation Board report** — dated, with per-standard scores and narrative.
4. **The watch officer's dated indicator-list revision** — for C-TRADECRAFT-6, the signed change record removing or retaining an indicator. *A watch chief cannot delete an indicator today because there is no artifact on which to justify it. The Indicator Lab's LR-with-CI is that artifact.*

### 10.3 Coordination and dissent — the question the sweep says nobody answered

The sweep's finding was that nothing in 60 candidates says who represents a machine judgment in a coordination meeting or who takes the dissent footnote, and that the capabilities which dodge this entirely are those making claims about the **source base** rather than about the world.

**This capability dodges it completely, and that is the point.** The auditor never makes a claim about Iran, Taiwan, or anything in the world. Every one of its outputs is a claim about a *document*: this document's statements are jointly unsatisfiable; this document's uncertainty expression mixes ICD 203 term rows without the required disclaimer; this indicator, as measured on public data, has LR = 1.1 [0.8, 1.5]. **No machine judgment enters a coordination meeting because no machine judgment is about the subject matter.** Nobody takes a dissent footnote for a theorem. This is the capability class the sweep predicted would actually field, and it is the reason to lead the package with it.

---

## 11. Benefit-category mapping

| Category | Mechanism | Evidence class today |
|---|---|---|
| **(a) Efficiency and accuracy** | The coherence check finds a defect class **no human reviewer finds** — holding seven probabilistic propositions in working memory and checking joint satisfiability is not a human capability. Not "faster than a human at the same task": a task humans do not perform. Efficiency: extraction + show-back localizes every estimative statement with a source span, replacing the reviewer's read-and-locate pass. | Coherence math: **theorem**. Detection precision: measurable in synthetic oracle, week 5–6. Reviewer time saved: **unmeasured**, requires the timed side-by-side. |
| **(b) Reduced time to analyze + better prediction accuracy** | Time: assumption-drift latency (PR-13) is the measurable — days between a falsifier publishing and a product acknowledging it. Prediction: **resolution contracts make Standard 8 scorable at all**, which is the precondition for ever improving accuracy. AIS excludes Standard 8 today; you cannot improve what you never score. | Latency: measurable live, week 13. Accuracy: contracts written now, resolved on their dates — **explicitly a future measurement, not a present claim.** |
| **(c) Quality assurance — identify discrepancies between sources and reconcile differences in analytic confidence** | **This is the dead center of this capability.** Within a product: the LP *is* a mechanical discrepancy detector over stated confidences. Across products: portfolio coherence (§ 12.2) literally reconciles differences in analytic confidence between IC elements — the thing ICD 203 Standard 7 requires be brought to the customer's attention and which today depends on someone happening to read both documents. | Within-product: week 7–8. Across-product: requires a posterior store, i.e. the classified instantiation. **Labelled as not demonstrable in 90 days on public data.** |
| **(d) Cost reduction by automating repetitive analysis tasks** | The ICD 203 review program is the most repetitive statutorily-mandated analytic task in the IC (§ 10.1): random sampling, two independent reads, a consensus session, a third-grader review, per-standard narratives, every six to twelve months, in every element, forever. It has a real denominator and a real signature block. | Denominator: **documented from statute and published practice**. Hours: **unmeasured, and we say so**. |

---

## 12. The two adjacent capabilities the judges said were missing

### 12.1 C-TRADECRAFT-7 — Assumption-drift monitoring

**The gap, precisely.** ICD 203 Standard 3 requires: *"Products should state assumptions explicitly when they serve as the linchpin of an argument… Products should explain the implications for judgments if assumptions prove to be incorrect. Products also should, as appropriate, identify indicators that, if detected, would alter judgments."* Standard 2 requires: *"products should identify indicators that would alter the levels of uncertainty."* Standard 4 requires: *"products also should identify indicators that, if detected, would affect the likelihood of identified alternatives."*

**Three of the nine standards mandate falsifiers. Nothing anywhere watches whether one has fired.** The falsifier is written, the product ships, and the falsifier is never looked at again. This is the purest example in the whole IC of a compliance box that could be an operating capability and is not.

The PROTEUS product schema already **requires** a falsifier on every key assumption. That requirement, which exists today as a quality constraint, becomes the seed of a standing watch.

**Design.**

```
StandingWatch {
  assumptionText:     string
  falsifier:          Predicate          // over registered ResolvableEvents
  resolutionSource:   Url                // third party, published schedule
  checkCadence:       Cadence
  nextCheckDate:      IsoDate
  dependentJudgments: JudgmentRef[]      // products standing on this assumption
  // no authorId. no publish(). see below.
}
```

A scheduled job evaluates each falsifier against the as-of corpus. On a fire, it emits a **dated drift alert** naming every product whose judgment now stands on a falsified assumption, plus a **draft Standard 7 paragraph** — because Standard 7 ("explains change to or consistency of analytic judgments") is precisely the obligation a fired falsifier triggers.

**Why this is more than a reminder service.** It converts Standard 7 from a retrospective grading criterion into a **triggered obligation with a timestamp**, and it produces **falsifier latency** — a number the IC has never had. Latency is the honest operational measure of whether the assumption discipline is real or ceremonial.

**Red line, structurally enforced.** The watch **must not auto-publish**. `DriftAlert` has no `publish()` method and the emitter module has no import of any dissemination client. Enforced by the same source-scanning test pattern the platform already uses to ban `Math.random` and `Date.now` in `sim/`: a test that scans the drift module's imports and fails on any dissemination surface. Structural, not a paragraph.

**Interlock with the Indicator Lab.** A falsifier is an indicator. Every registered falsifier is automatically enrolled in the Indicator Lab and receives an LR-with-CI or an abstention. **A falsifier measured non-discriminating is not a falsifier** — it is decoration, and a product whose key assumption rests on one has a Standard 3 defect that is currently invisible. This is the first mechanism anywhere that grades the *quality* of a falsifier rather than its presence.

### 12.2 C-TRADECRAFT-8 — Portfolio-level coherence

**The idea.** Run the Dutch-book detector **across** products rather than within one. Two current products from different offices assigning incompatible probabilities to overlapping propositions is exactly the *"significant differences in analytic judgment, such as between two IC analytic elements"* that ICD 203 Standard 7 requires be brought to customers' attention — and today it is found by luck.

**Why no incumbent can match it.** It requires a persistent store of machine-readable posteriors bound to registered events. That requires the confirmed-extraction step, which requires the analyst-in-the-loop show-back. **REASON produces comments on drafts; it does not build a posterior store** (BAA § II.A: TA1 finds evidence, TA2 finds reasoning strengths and weaknesses, TA3 produces comments — nothing persists a posterior). Commercial document-review tools do not either. This is a moat grounded in an accumulated artifact, not in a model, and artifacts compound while model advantages do not.

**The three hard problems, stated before an evaluator raises them.**

1. **Scope explosion.** The union atom set over 200 products vastly exceeds 18 free atoms and the explicit LP dies. *Answer:* coherence is checked only within a **topic cluster** sharing a declared ontology, and only over statements sharing at least one registered atom. Cluster membership is by **declared atom overlap, never by embedding similarity** — because a soft-matched atom is a false contradiction, and warning (i) applies with double force when the false alarm implicates two organizations.

2. **Atom identity is the entire game.** "Iran conducts a disruptive cyber operation against US water infrastructure before 2027-01-01" in product A and product B must be the *same* atom or the check is nonsense. *Answer:* atoms are identified **only** when both products cite the same registered `ResolvableEvent` — a dated definition with a named third-party resolution source. Never by text similarity, never by an LLM's judgment of equivalence. If two products do not share a registered event, the verdict is `NOT_COMPARABLE`, not `COHERENT`. **A false `COHERENT` from a missed match is a silent failure; a `NOT_COMPARABLE` is an honest one, and we always take the honest one.** Residual risk: a registry mis-entry propagates to every check that touches it, so registry edits are versioned, hashed into run identity, and require two-person review.

3. **Temporal versioning.** A 2025 product and a 2026 product are not incoherent for disagreeing; the world moved. *Answer:* only products within the same as-of validity window are compared, and superseded products are excluded by the platform's existing as-of discipline. The window is declared per topic cluster in pack config, not inferred.

**What it outputs.** A dated cross-product finding: the registered event, the two (or more) products, their asserted bands, the minimum repair, and — critically — **no recommendation about which one is right.** The system detects the discrepancy; humans reconcile it. That boundary is structural (§ 13, red line 3).

---

## 13. Red lines — structural enforcement, not policy notes

Each line names the mechanism and the test that fails if the mechanism is removed.

---

### RL-1. No product score can ever be aggregated to a named author

**Why this is existential.** The moment ICD 203 scores can be traced to a person, this becomes a performance-management instrument, analysts route around it, and adoption dies — permanently, because you cannot un-ring that bell. Congress has already noticed the tension: § 6312 of Pub. L. 117–263 required each IC element's head of analysis to report *"how compliance with the standards set forth in Intelligence Community Directive 203… is considered in the performance evaluations and consideration for merit pay, bonuses, promotions, and any other personnel actions for analysts."* The pressure toward personnel use is real and legislatively documented.

**The precedent that makes this a soft sell.** DIA's Product Evaluation Board already works this way: *"The scores are reported in aggregate, not individually to analysts, meaning they are not intended to critique an individual but the analytic process overall"* (Riehle 2025). **We are not asking the customer to adopt a new norm. We are making an existing norm mechanically unbreakable.** That framing is the entire adoption argument and it should be the first sentence of any briefing on this capability.

**Enforcement, four layers:**

1. **The field does not exist.**
```ts
type TradecraftFinding = {
  productId:    ProductId
  standardId:   StandardId      // 1..9, closed union
  score:        0 | 1 | 2 | 3
  evidenceSpan: SourceSpan      // required — no finding without a span
  runId:        RunId
  panelCoverage: { responded: number; planned: number }
}
// There is no authorId. There is no drafterId. There is no employeeId.
```

2. **The aggregation API cannot express the query.**
```ts
type GroupBy = 'standard' | 'productType' | 'topicArea' | 'quarter'
// 'author' is not a member of this union. The compiler rejects it.
declare function aggregate(f: TradecraftFinding[], by: GroupBy): AggregateCell[]
```

3. **k-anonymity floor on every aggregate.** Any cell backed by fewer than K distinct products (default K = 20) returns `SUPPRESSED`, never a number. This blocks the re-identification attack of slicing by (office × quarter × topic) until one analyst remains. The floor applies to *every* aggregate, including intermediate ones, so it cannot be composed around.

4. **The failing test, which is the actual specification.**

```ts
test('no aggregation path can resolve to a single author', () => {
  // Synthetic corpus where authorship is known to the TEST but never to the system.
  // Enumerate every reachable GroupBy combination, to depth 4.
  for (const path of allGroupByCombinations(4)) {
    const cells = aggregate(corpus, path)
    for (const cell of cells) {
      expect(cell.distinctProducts).toBeGreaterThanOrEqual(K)   // or SUPPRESSED
      expect(inferAuthor(cell, groundTruth)).toBe(null)          // no cell isolates one
    }
  }
})

test('schema and API surface contain no person identifier', () => {
  // Same enforcement pattern as the shipped ban on Math.random/Date.now in sim/.
  const banned = /\b(author|analyst|drafter|employeeId|personId|badgeNumber)\b/i
  expect(scanSourceTree('tradecraft/schema', 'tradecraft/api')).not.toMatch(banned)
})
```

**These tests are written first and fail first. They are the deliverable of week 1, not a documentation task.** They ship in the repository, they run in CI, and their presence is demonstrable to an evaluator in thirty seconds.

**Honest limit.** A determined manager can export findings and join them to a publication roster *outside* the system. No technical control prevents that. The technical control is **necessary and not sufficient**, and it must be paired with a contractual and policy prohibition. Saying otherwise would be the kind of overclaim that costs credibility on every other page.

---

### RL-2. No coherence finding without a confirmed extraction

The LP's input type is `ConfirmedPropositionSet`, constructible **only** by a function taking an `AnalystConfirmation` token. There is no path from `ExtractedPropositionSet` to `solve()`. Test: `refuses_to_solve_unconfirmed_extraction` asserts the type-level rejection and the runtime guard.

---

### RL-3. The auditor never scores the analyst's conclusion, only its form and coherence

`standardId` is a closed union over the nine tradecraft standards. Standard 8 resolves **only** against a registered third-party `ResolvableEvent` on its resolution date — never against a model's opinion. **There is no code path in which a model's belief about the world becomes a score against a human's judgment.** Structurally, this mirrors the platform's existing guarantee that no function of type `(Judgment) => number` exists.

---

### RL-4. No auto-publication

Neither `DriftAlert` nor `TradecraftFinding` has a publish path. The emitting modules import no dissemination client. Enforced by import-scanning test.

---

### RL-5. No US-persons content persists in the analytic store

ICD 203 § D.5 makes PII protection an explicit purpose of the standards. Propositions persist as `(registeredEventId, interval, spanOffset)` — never as free text of the source span. The document itself stays in its own classification and handling enclave; the analytic store holds offsets into it. A proposition that cannot be bound to a registered event and would require free-text storage is dropped, not stored.

---

### RL-6. Segmentation and pre-registration for every LR

Indicator segment boundaries are declared in pack config and hashed into `computeRunId`. An LR computed under a segmentation not present in the committed pack cannot be emitted. This closes the researcher-degrees-of-freedom hole that would otherwise let anyone produce any LR they wanted.

---

## 14. Failure modes

### 14.1 The extraction is the whole system, and it is an LLM

**The honest worst case.** Extraction precision is high on ODNI-style public prose and collapses on real IC drafts, which are denser, house-conventioned, and littered with mid-sentence classification and dissemination markings. Every downstream guarantee — the LP, the IIS, the repair magnitude — is exactly and only as good as the proposition set fed into it. A perfect theorem over a wrong premise set is a confident false alarm, which is the failure mode warning (i) says kills adoption.

**Mitigations, in order of strength:** the 5-reading ensemble (a clash must survive every admissible reading); the mandatory show-back with analyst confirmation; the red-team downgrade path; the published parse-error rate in every report header. **None of these measures precision on IC prose.** Only the cleared T&E loop does. This is the largest technical risk in the paper and it cannot be retired by anything in the 90-day demonstration.

### 14.2 Zero real Dutch books

Well-edited published products may already be coherent. If week 7–8 returns zero, the within-product detector has no market and all value moves to portfolio-level, where atom identity is far harder and demonstration requires a classified enclave. **Named in advance as the demo's falsifier.** Partial hedge: the unbindable-judgment rate is measured on the same run and is valuable regardless, and the AIS 45%-unclear datum suggests it will not be zero.

### 14.3 Cross-office false alarms are worse than within-product ones

A false contradiction between two offices implicates two organizations and creates a political incident, not just an annoyed analyst. Mitigated by the registered-event requirement and the `NOT_COMPARABLE` default — but a registry mis-entry propagates silently to every check touching it. Versioned registry, hashed into identity, two-person review on edits. Residual risk remains and is real.

### 14.4 The IIS is technically correct and rhetorically useless

"Statements 2, 5 and 7 are jointly infeasible" may be true and unhelpful if the analyst meant something looser than the ICD 203 intervals imply. Mitigated by the red-team downgrade path and by leading with the minimum repair in percentage points rather than the bare verdict. Unmitigated residue: some analysts will experience the ICD 203 numeric intervals as a strawman of their intent — even though those intervals are the directive's own, not ours. Expect and prepare for this objection; the answer is that the directive fixed the numbers, and if the numbers do not match intent, that is itself a Standard 2 finding worth surfacing.

### 14.5 Indicator regime shifts masquerade as signal

MND's reporting format has changed across the series. An LR estimated across a format boundary measures the format change. Mitigated by pre-registered declared segmentation, but segmentation choice is a researcher degree of freedom and pre-registration is the only real defense. **A reviewer should check the committed segment boundaries against MND's actual format history and we should hand them that comparison unprompted.**

### 14.6 Abstention swallows the answer

If the gate is conservative, most indicators return `INSUFFICIENT_EVIDENCE_TO_RATE` and the watch chief learns nothing. The platform's measured **7% false-abstention rate at the shipped threshold** was measured on a different question class (threshold sweep, 6 arms, synthetic oracle) and **does not transfer**. PR-12 measures it fresh. If the rateable fraction (PR-9) comes back below 0.3, the honest conclusion is that public data is too thin for this capability and it requires classified holdings — which changes the acquisition story materially and should be reported as such rather than papered over.

### 14.7 Show-back fatigue defeats RL-2

If extraction precision sits at 0.85, analysts face a rejection every seventh row, and the rational response is to stop reading and start clicking through. The type-level guard survives; the *substance* of the guard does not. This is why extraction precision has a hard week-3/4 gate rather than being treated as a tunable. Additional mitigation: the show-back surfaces disagreement rows (agreement < 5/5) first and separately, so the analyst's attention lands where the machine is least sure.

### 14.8 Standard-8 contracts never resolve

Contracts written today resolve on dates months or years out. If a large fraction return `UNRESOLVED` — the source stopped publishing, the event definition was underspecified — Standard 8 remains as unscored as it is today, just with more machinery. Mitigated by requiring a *scheduled* third-party resolution source at contract creation, and by counting `UNRESOLVED` separately with reason codes rather than dropping it. The unresolved rate is itself a published metric.

---

## 15. TRL — two columns

TRL inflation in this domain comes from counting the platform and reporting it as the capability. Two columns, always.

| | **Platform (PROTEUS core)** | **Domain pack (Tradecraft Auditor)** | **Domain pack (Indicator Lab)** |
|---|---|---|---|
| **Today** | **TRL 4** — component and breadboard validation in a laboratory environment. 659 tests passing / 4 skipped, verified this session. Deterministic seeded execution with byte-identical artifact hash (unit test + CLI). Measured on synthetic oracle: Brier skill +0.4355 on the well-evidenced arm; skill tracking evidence quality monotonically (+0.44 / +0.42 / +0.11); the misspecified negative control scoring **worse** than base rate (−0.4561, coverage@1 0.123); 80/80 true abstention on a provably unanswerable arm; 15,832 simulations in 305 s. **Two confirmed architecture gaps (rubric not in identity; panel loss is boolean) must close before any compliance use.** | **TRL 2** — technology concept formulated. The LP formulation is textbook and 40 years old; the extraction pipeline does not exist; the annotated IC-prose corpus does not exist; the show-back UI does not exist. Nothing has been run end to end. | **TRL 2** — same status, but on a materially better footing: the data source is public, daily, and already flowing, and the estimator is elementary statistics rather than novel research. |
| **At 12 months** | **TRL 5** — validation in a relevant environment, **conditional on the cleared T&E loop actually running**. Without that loop it stays at 4 regardless of how many tests pass. | **TRL 4 on unclassified public products; TRL 3 on IC prose.** The split is the honest statement: we will have component validation in the lab on public data and only conceptual/analytical evidence for IC drafts, because we will never have seen one. | **TRL 4–5.** The only pack in this set that can credibly reach "validated in a relevant environment" on unclassified data alone, because Taiwan MND is real operational data resolving on a real schedule against real third-party artifacts. **Lead the package with this one.** |

**Why the split matters commercially.** A buyer reading "TRL 5" across a portfolio should ask which column it came from. Ours says: the machinery is TRL 4–5, the Taiwan indicator pack can reach TRL 4–5, and the ICD 203 auditor on classified prose is TRL 3 and will stay there until a cleared team runs it. That is the whole argument for buying the REASON-shaped T&E arrangement rather than a delivered product.

---

## 16. Cost model

### 16.1 Measured platform figures — cited, not inflated

| Quantity | Measured | Class |
|---|---|---|
| Cost per live question, standard panel | **$0.2959** (9 model calls) | live |
| Cost per live question, with red-team rerun | **$0.7544** (17 model calls) | live |
| Latency per live question | **5m54s** / **8m12s** | live |
| Scale, deterministic kernel | **15,832 simulations in 305 s** | measured |

Implied per-call cost from the live runs: **$0.0329** (0.2959 / 9) and **$0.0444** (0.7544 / 17). The second is higher because red-team reruns carry longer contexts.

### 16.2 Per-product audit — decomposed by call count, projected not measured

A product audit is not one question. Decomposition:

| Stage | Calls | Notes |
|---|---|---|
| Extraction ensemble | 5 | One per charitable-reading policy |
| Adjudication panel | 5 | Key assumptions, devil's advocate, ACH, premortem, red team |
| Red-team rerun (conditional, ~30% of products) | +8 | Only when an IIS is found and a dissolving reading is sought |
| **LP + min-IIS MIP + repair LP** | **0** | Deterministic solver, no model calls |
| Resolution-contract emission | 1 | Binding to the event registry |

**Base case: 11 calls. With rerun: 19 calls.**

Projected per-product cost, at the measured per-call rates:

- **Base: ~$0.36** (11 × $0.0329)
- **With red-team rerun: ~$0.84** (19 × $0.0444)
- **Blended at 30% rerun rate: ~$0.50 per product audited**

**This is a projection by multiplication of measured per-call costs, not a measured per-product figure. No run has produced it.** It is labelled as such wherever it appears.

Latency: the panel dominates and is comparable to the measured 5m54s–8m12s per question; extraction adds ~1 minute; **the LP, MIP and repair solve in milliseconds and contribute nothing measurable.**

### 16.3 Indicator Lab — the cheap one

**Marginal cost per indicator evaluated: one database query.** No model call. The only recurring cost is the MND scraper (one HTTP fetch per day) and storage.

- Scraping and normalization: negligible
- LR estimation for 25 indicators: **sub-second, $0**
- Re-estimating the entire 25 after each day's data: **$0**

This is the cost profile that makes retirement review a *continuous* rather than a *periodic* activity, and continuous review is the only kind that ever actually shrinks a list.

### 16.4 Assumption-drift watch

One scheduled evaluation per falsifier per cadence period. Most falsifiers are structured predicates over registered events — **no model call**. Only free-text falsifiers that failed structuring require a model call, and those should be pushed back to the analyst as a Standard 3 finding rather than silently modelled. Projected cost: **near zero at the scale of hundreds of standing watches.**

### 16.5 What dominates the real cost

Not compute. **Human show-back time and human rater time for the calibration set.** The 40-product three-rater calibration exercise in weeks 9–10 is the demonstration's largest line item, and the ongoing calibration refresh is the largest recurring cost of the fielded system. That is worth saying plainly: the expensive part of an automated tradecraft auditor is the humans you need to keep it honest, and any vendor claiming otherwise has not built one.

---

## Sources

- [ICD 203, Analytic Standards (ODNI, 2015 revision)](https://fab.industries/docs/2025/icd-203.pdf) — full text; five Analytic Standards, nine Tradecraft Standards, the seven-band likelihood lexicon with numeric intervals, the row-mixing disclaimer rule (D.6.e(2)(a)), and the prohibition on combining a confidence level and a degree of likelihood in the same sentence (D.6.e(2)(b))
- [ODNI, "Objectivity" — ICD 203 overview and the nine tradecraft standards](https://www.dni.gov/index.php/how-we-work/objectivity)
- [ODNI, Intelligence Community Directives index (ICD 203, ICD 206)](https://www.odni.gov/index.php/who-we-are/organizations/policy-capabilities/ps/ps-related-menus/ps-related-links/policy-division/intelligence-community-directives)
- [50 U.S.C. § 3364 — Assignment of responsibilities relating to analytic integrity (IRTPA §§ 1019–1020; Pub. L. 117–263 § 6312)](https://www.govinfo.gov/content/pkg/USCODE-2024-title50/pdf/USCODE-2024-title50-chap45-subchapIV-sec3364.pdf)
- [Kevin Riehle, "How do we know if an intelligence analytic product is good?", *Intelligence and National Security* 40:2 (2025), 261–276](https://doi.org/10.1080/02684527.2025.2468051) — AIS 0–3 scale, two graders plus consensus plus third independent grader, AIS's exclusion of Standard 8, DIA Product Evaluation Board practice and its aggregate-only reporting, the 2016 declassified AIS/ONI figures (87% of IC future judgments tested accurate, ~56% for ONI, 45% of judgments unclear), Mandel & Barnes on Canadian IAS
- [van Gelder et al., "Improving Analytic Reasoning via Crowdsourcing and Structured Analytic Techniques", *Journal of Cognitive Engineering and Decision Making* 14(3), 2020](https://journals.sagepub.com/doi/full/10.1177/1555343420926287) — SWARM 21.4/32 vs 15.9/32, Cohen's d_rm = 1.37 CI [0.56, 2.23], the 8-dimension 8–32 scale, three trained raters, general-public teams at 22.6
- [Marcoci, Vercammen & Burgman, "ODNI as an analytic ombudsman: is ICD 203 up to the task?", *Intelligence and National Security* (2018)](https://doi.org/10.1080/02684527.2018.1546265) — untrained inter-rater ICC = 0.294, calibration training as a prerequisite
- [IARPA CREATE program page](https://www.iarpa.gov/research-programs/create) — program ended February 2020
- [IARPA REASON program page](https://www.iarpa.gov/research-programs/reason)
- [REASON BAA W911NF-23-S-0007 (final, 17 March 2023)](https://arl.devcom.army.mil/wp-content/uploads/sites/3/2023/04/W911NF-23-S-0007-REASON-BAA-Final-17-March-2023.pdf) — 42-month program; Phase 1 1 Oct 2023 – 30 Sep 2025; Phase 2 1 Oct 2025 – 31 Mar 2027; TA1/TA2/TA3; metrics α-nDCG, REQ, F1, RCQ, RQS (six standards, 6–24, ΔRQS > 3.0 Phase 2 target); performers have no classified access; minimum Government Purpose Rights
- [Nilsson-line PSAT literature: Finger & De Bona, "Probabilistic Satisfiability: Logic-Based Algorithms and Phase Transition", IJCAI 2011](https://www.ijcai.org/Proceedings/11/Papers/096.pdf) — Boole 1854, Nilsson 1986, NP-completeness (Georgakopoulos/Kavvadias/Papadimitriou 1988), LP and column-generation history
- [Jaumard, Hansen & Poggi de Aragão, "Column Generation Methods for Probabilistic Logic", *INFORMS J. Computing* 3(2), 1991](https://ideas.repec.org/a/eee/ejores/v108y1998i3p671-683.html)
- [De Bona & Finger, "Measuring inconsistency in probabilistic logic: rationality postulates and Dutch book interpretation", *Artificial Intelligence* (2015)](https://www.sciencedirect.com/science/article/pii/S0004370215000922) — the bridge from LP-computable inconsistency measures to Dutch-book incoherence degree
- [Cozman & di Ianni, "Probabilistic satisfiability and coherence checking through integer programming", *IJAR* (2015)](https://www.sciencedirect.com/science/article/pii/S0888613X1400142X) — de Finettian coherence via IP
- [Gurobi Optimizer Reference Manual — Infeasibility Analysis / IIS](https://docs.gurobi.com/projects/optimizer/en/current/features/infeasibility.html) and [How does Gurobi compute the IIS?](https://support.gurobi.com/hc/en-us/articles/360041448572-How-does-Gurobi-compute-the-IIS-for-infeasible-models) — IIS definition, Farkas dual proof, and the explicit non-minimum-cardinality caveat
- [HiGHS documentation — Advanced features, IIS detection](https://ergo-code.github.io/HiGHS/stable/guide/advanced/) — LP-only, `iis_strategy` bitmap, "under development"
- [Cynthia Grabo, *Anticipating Surprise: Analysis for Strategic Warning*](https://apps.dtic.mil/sti/tr/pdf/ADA476752.pdf) and [*Warning Intelligence*, AFIO Monograph 5](https://www.afio.com/publications/monographs/GRABO%20Cynthia%20Warning%20Intelligence%20-%20AFIO%20Monograph%205.pdf) — indicators vs indications, indicator lists, diagnostic value, Bayesian weighting in warning
- [CIA, *A Tradecraft Primer: Structured Analytic Techniques for Improving Intelligence Analysis* (2009)](https://www.cia.gov/resources/csi/static/Tradecraft-Primer-apr09.pdf) — Indicators or Signposts of Change: "regularly review and update the indicators lists" — with no retirement mechanism and no measure of discriminating power
- [RAND, *Strategic Warning on NATO's Eastern Flank* (RR-2080)](https://www.rand.org/pubs/research_reports/RR2080.html) — "necessary to ensure that warning indicators… have diagnostic value", a recommendation never operationalized
- [Taiwan Ministry of National Defense — PLA Activities list](https://www.mnd.gov.tw/en/news/plaactlist/192)
- [CSIS ChinaPower, Taiwan ADIZ Violations dataset (Brown & Lewis)](https://chinapower.csis.org/data/taiwan-adiz-violations/) · [PLATracker](https://www.platracker.com/trackers) · [ISW, Monthly PRC Incursions into Taiwan's ADIZ](https://understandingwar.org/map/monthly-prc-incursions-into-taiwans-adiz-2022-present/)
- [CIA, "CIA Launches New Acquisition Framework to Turbocharge Collaboration with Private Sector", 9 February 2026](https://www.cia.gov/stories/story/cia-launches-new-acquisition-framework-to-turbocharge-collaboration-with-private-sector/) · [Nextgov/FCW](https://www.nextgov.com/acquisition/2026/02/cia-announces-new-acquisition-framework-speed-tech-adoption/411285/) · [Federal News Network](https://federalnewsnetwork.com/intelligence-community/2026/02/cia-emphasizes-speed-under-new-acquisition-framework/) — centralized vendor vetting, streamlined IT authorization, pathways to rapidly onboard breakthrough technology prototypes; led by CPE Efstathia Fragogiannis (ex-DARPA)

**Marked UNVERIFIED in this document:** current public retrievability of the ODNI *Rating Scale for Evaluating Analytic Tradecraft Standards* (ODNI 2015b); licensing terms of the CSIS ChinaPower and PLATracker compiled datasets; analyst-hours per ICD 203 product review (no public source exists — to be measured, never asserted).