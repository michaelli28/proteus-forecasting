# RED-TEAM EVALUATION — PROTEUS SUBMISSION PACKAGE

**Panel position:** technical evaluation, hostile. **Verification basis:** the PROTEUS source tree was read and its test suite executed this session (`engine/` at commit `42cafde`); external citations checked against primary sources. Every finding below is labelled **CONFIRMED** (with the output or citation that proves it) or **ASSUMED**.

---

## 0. Disposition

This package is unusually honest by vendor standards and it will still lose on the current draft, for a reason its authors have not anticipated: **the discipline it sells is not uniformly applied to itself.** The package's differentiator is "we label what our numbers mean." A panel's first move is to test that labelling — and it fails in at least four places, two of them in the shipped code, one of them a factual "correction" that is itself false, and one of them the strategic premise the whole bid rests on.

Second structural problem: **across six capabilities, the package's answer to the customer's own worked example is an abstention, a refusal, and an unregistrable pack.** That is defensible engineering and indefensible bidding, and nothing in the package converts it into something the customer can buy.

Third: the "config not code" claim is contradicted by the package's own line-count estimates, by a factor of roughly 1.5.

---

## 1. What survives (stated so the rest is credible)

These were checked and hold. A panel should concede them.

| Claim | Verification |
|---|---|
| 659 tests passing, 4 skipped | **CONFIRMED.** `npx vitest run` this session: `Test Files 34 passed \| 3 skipped (37)`, `Tests 659 passed \| 4 skipped (663)` |
| Architecture gaps 1, 2, 3 exist as described | **CONFIRMED in source.** `engine/src/agents/panel.ts:36` (`systemPrompt: z.string().min(1)`), `engine/src/artifact/store.ts:28-35` (`RunIdentity` = config/corpusSnapshotId/kernelVersion, no panel field), `:123` `computeRunId`; `engine/src/pipeline/run-question.ts:680` `available: results.length > 0`; `engine/src/pipeline/analysis.ts:240` `level: input.adjudicationAvailable ? "high" : "moderate"` |
| Platform LOC table (8,748 / 74.6%; 2,529 / 21.6%) | **CONFIRMED exactly.** `src` total 11,723; adapters 2,529; bindings 446; 11,723 − 2,529 − 446 = 8,748. Influence-ops file sizes match the package line-for-line (165/237/152/94/209/196/151 = 1,204) |
| PROTEUS has no RPS and no CRPS | **CONFIRMED.** `grep -rniE "crps\|rankedProbability\|ordinal" engine/src/` returns zero hits |
| Weakest-link and as-of comments quoted verbatim | **CONFIRMED.** `engine/src/evidence/icd203.ts:111-117`; `engine/src/corpus/as-of.ts:1-14`, `:148-151` |
| WNTR `required_pressure` trap | **CONFIRMED verbatim** — defaults 0.07 m / 0 m / 0.5 and *"If the user does not increase the default required pressure value, then a PDD simulation will be very similar to a DD simulation"* ([WNTR hydraulics docs](https://usepa.github.io/WNTR/hydraulics.html)) |
| CISA AA26-097A, its 22 Jul 2026 update, the AOI/shutdown-logic language, the CyberAv3ngers alias list, ports 44818/2222/102/22/502 | **CONFIRMED verbatim** ([CISA AA26-097A](https://www.cisa.gov/news-events/cybersecurity-advisories/aa26-097a); [IC3 PDF](https://www.ic3.gov/CSA/2026/260722.pdf)) |
| PoisonedRAG 97% ASR / 5 texts / 2,681,468 / 0.0002% / pp. 3827–3844 | **CONFIRMED** ([USENIX Sec '25 paper](https://www.usenix.org/system/files/usenixsecurity25-zou-poisonedrag.pdf)) |
| GSDB-R4: 1,547 cases, 1950–2023, free on request | **CONFIRMED** ([globalsanctionsdatabase.com](https://www.globalsanctionsdatabase.com/); [GSDB-R4 WP](https://www.lebow.drexel.edu/sites/default/files/2025-01/wp2025002-global-sanctions-db.pdf)) |
| FRI ForecastBench parity p-values (0.41 / 0.16 / 0.15 / 0.14) | **CONFIRMED exactly** ([FRI, 2026-07-16](https://forecastingresearch.substack.com/p/ai-models-have-likely-reached-parity)) |

That is a better verification hit-rate than most submissions. It makes the failures below more damaging, not less.

---

## 2. Findings that would sink the submission

### F1 — The mandatory `EvaluationRegime` tag is not mandatory in the code path that produced every headline number. **CONFIRMED.**

The package asserts, in six separate documents, that every report *requires* a regime tag and that no number can travel without it. `engine/src/pipeline/score.ts:42-43` says so in a comment: *"`regime` is required and never inferred."*

But every headline number in the brief — +0.4355 Brier skill, the −0.4561 negative control, 80/80 true abstention, 7% false abstention, 15,832 sims in 305 s — comes from the benchmark harness, and there:

```
engine/src/pipeline/benchmark.ts:83    readonly regime?: EvaluationRegime;
engine/src/pipeline/benchmark.ts:241   const regime = options.regime ?? "synthetic_oracle";
```

The tag is **optional**, and it **silently defaults**. A caller who omits it gets a report stamped `synthetic_oracle` that nobody chose. Two consequences a panel will draw:

1. The central architectural claim is false as stated. It is true of `scoreQuestions`, false of `runBenchmark`. The codebase contradicts itself at `score.ts:42` versus `benchmark.ts:241`.
2. Because the default is `synthetic_oracle`, no *published* number is currently mislabelled — but the guard that is supposed to make that impossible is a default value, not a type. The package repeatedly says the right way to build such a guard is to make the wrong state unconstructible (`(Judgment) => number`, the `ScorableOracle` proposal). It did not do that here.

**This is the finding that most damages the bid**, because it is the one place where the product's own thesis is refutable by reading the product.

### F2 — Q3's regime tag is a category error: the model is its own oracle. **CONFIRMED from the package's own text.**

`iran-water` §3 tags Q3 (WNTR/EPANET consequence) as `synthetic_oracle` and states the oracle *is* the reference solver. It then makes Q3 the lead of the demonstration because "the only stage a technical evaluation panel can independently verify."

Reproducibility is not accuracy. If WNTR is both the predictor and the answer key, the measured skill is 1.0 by construction and carries no information about water systems. The package's own `evaluation` section defines exactly this failure and builds a type to forbid it — `oracle_independence: "shares_source_with_input"` → **REFUSE**. Q3 is the package's clearest instance of the thing the package's own guard exists to reject, and it is presented as the strongest evidence in the bid.

The defensible claim is narrower and should replace it: *Q3 is verifiable, not validated.* The package concedes as much in the regime table ("`historical_backtest` **if ever validated** against a real logged outage") and then does not carry that concession into the demonstration plan.

### F3 — The `required_pressure` "fix by type" does not fix it. **CONFIRMED.**

The proposed guard is `readonly requiredPressureSweepM: readonly [number, number, ...number[]]`, with the claim: *"A single-value run is not expressible in the schema."*

The type forbids arity 1. It does not forbid `[20.0, 20.0]`, or `[20.0, 20.001]`. A degenerate sweep type-checks and produces a single-valued answer wearing a range. The type constrains **cardinality**, and the trap is about **span**. This needs a validated minimum span and a floor at WNTR's enforced 0.07 m minimum — which the package does not mention, though the same documentation page it quotes states it: *"WNTR also enforces 0.07 m (0.1 psi) as the lowest value for required pressure."*

Second, unremarked problem in the same measure: the reported quantity is **person-hours** of service below threshold, over EPANET benchmark networks. Benchmark `.inp` files carry demand nodes, not populations. "Person-hours" requires an undeclared population-per-node allocation — precisely the hidden multiplier that manufactures the "N people without water" headline the section claims to have structurally eliminated.

### F4 — Panel-loss severity is quoted at a size the shipped system does not have. **CONFIRMED.**

Four documents say *"one surviving adjudicator of eight scores identically to a full panel."* `tradecraft-auditor` says *"one of five."* The shipped defaults:

```
engine/src/pipeline/run-question.ts:78   const DEFAULT_PANEL_SIZE = 3;
engine/src/agents/panel.ts:72            count = 4,
engine/src/agents/panel.ts:23-29         SAT_TECHNIQUES — 5 entries
```

There is no eight. The package's own measured refusal datum — *"later 2 of 3 declined"* — is itself evidence the operating panel is three. So a single paragraph in four documents quotes a 3-adjudicator measurement while describing the gap in terms of an 8-adjudicator panel, inflating the confessed defect ~2.7×. A panel that catches a vendor inflating *its own admitted weakness* concludes the numbers are decorative, and then re-reads every other number in that light.

### F5 — A stated "correction" to the landscape sweep is false, and it deletes a real source. **REFUTED with citation.**

`coercion-ladder` §6, Finding 1, presented as verified this session:

> *"I could not confirm it. Fetches of `chinapower.csis.org/data/…` returned either 404 or listings containing **no** Taiwan incursion / ADIZ / median-line tracker… **Do not put a CSIS dependency in the bid.**"*

The tracker exists, at that exact URL: **[Taiwan ADIZ Violations, ChinaPower Project, CSIS](https://chinapower.csis.org/data/taiwan-adiz-violations/)**, compiled by Gerald C. Brown and Ben Lewis. CSIS published a full analysis of the 2025 series in February 2026 (3,764 ADIZ incursions in 2025, +22.4% on 2024) ([ChinaPower](https://chinapower.csis.org/china-increased-military-activities-indo-pacific-2025/)). [PLATracker](https://www.platracker.com/trackers) hosts the same database (>20,000 flights), and CSIS/AMTI's own 2024 study states it "relied heavily on the Taiwan ADIZ Violations Database, a public dataset managed by PLATracker."

Three compounding problems:

1. A **false negative asserted as a verified correction** — the exact failure mode the package's `/reality-audit` posture claims to prevent.
2. **`tradecraft-auditor` §2.4 cites the same URL as a live compiled series.** The package contradicts itself on a checkable fact, in the same submission.
3. The false correction **removes the mitigation for the pack's own largest named risk.** `coercion-ladder` §6 Finding 2 states the single-publisher dependency on Taiwan MND is "the pack's largest technical risk." An independently compiled series of the same quantity, maintained by a third party, is a direct partial mitigation — and Finding 1 tells the bid team to delete it.

A panel reading Findings 1 and 2 in sequence sees a vendor argue itself out of its own risk control on the strength of a failed HTTP fetch.

### F6 — "Config not code" is contradicted by the package's own estimates. **CONFIRMED by arithmetic.**

Existing domain-free core: **8,748 lines** (verified). New code the six packs declare or imply:

| Pack | New engine code |
|---|---|
| CONFLUENCE (source-discrepancy) | 3,000–4,000 (stated) |
| retrieval-poisoning | ~1,390 adapter **+ a harness the pack calls "a larger engineering effort than the adapter"** |
| coercion-ladder | ~8-file adapter (influence-ops = 1,204 for 7 files) + `metrics/ordinal.ts` + `pipeline/ablation.ts` + `register/` + `corpus/sources/mnd.ts` + a wide-blast-radius change to `metrics/index.ts` |
| iran-water | Q1 400–600 + Q2 + WNTR bridge **+ a Python sidecar** + `composition.ts` + binding |
| technoeconomic | `choose.ts` + `stock.ts` + `network.ts` + `asof-io.ts` + `bands.ts` — **no size estimate given** |
| tradecraft-auditor | PSAT LP + min-cardinality IIS MIP + 5-reading extraction ensemble + Indicator Lab — **no size estimate given** |

Conservative total: **12,000–16,000 new lines**, against 8,748 lines of reusable core. **The new domain code exceeds the entire domain-free platform.** "60 candidates collapse to ~12 kernel families, and the collapse *is* the config-not-code argument" does not survive this table. Three of six packs concede it explicitly ("this pack is not pure config"); two give no estimate at all, which reads as avoidance rather than honesty.

Worse for the reuse claim: the packs cannot even reuse each other's honesty. Four of six declare the two actor knobs inapplicable or requiring extension (`iran-water` adds 2, `technoeconomic` adds 3, `coercion-ladder` decomposes `riskTolerance`, `CONFLUENCE` and `tradecraft-auditor` bind neither). A parameterization that four of six domains reject is not a platform primitive.

### F7 — Abstention is doing work it has not earned, in three distinct places.

The package treats abstention as a virtue everywhere. In three cases it is an inability to answer wearing a verdict:

- **Q2 (activation clock).** The `never spent` band is stated to be "structurally unobservable." A partition with an unobservable band is not structurally scorable — the platform's own stated requirement. Any Brier/RPS on Q2 is computed over a censored partition, and the package never names the censoring, never proposes a censored-data estimator, and never states what fraction of mass sits in the unobservable band.
- **Iran-COST ≈ 100%, DPRK ≈ 100% structural abstention** (`technoeconomic` §6.3). Correctly declared, correctly separated from the measured rate. But the customer's worked example is Iran. A capability that abstains ~100% of the time on the buyer's named case is not a capability for that case.
- **Coherence `UNDETERMINED`** (`tradecraft-auditor` §2.1). The verdict fires when "< 2 interacting statements." IC estimative statements in one product frequently concern different atoms — the share-an-atom precondition may rarely be met. **The package never states an expected `UNDETERMINED` rate on real products**, though §2.3 says the unclear-judgment rate is obtainable on public products in week 8. The instrument that reports other people's ambiguity has not measured its own inapplicability rate.

The 7% false-abstention figure is quoted in at least four documents; in `technoeconomic` §6.3 and `iran-water` it appears **without its regime tag**, which is the package's own cardinal sin.

### F8 — A cost measured on one domain is presented as another pack's measured cost.

`iran-water` §4 lists, in the Q2 red-team row: *"Measured red-team rerun cost: $0.7544 / 17 calls / 8m12s."* That number is the live influence-operations run (per the brief and commit `42cafde`). It is a measurement of a different pack, on a different task, with a different panel, transplanted into a table of this pack's properties. `coercion-ladder` §4 does the same ("this is the $0.7544/17-call cost path"). Under the package's own evidence-class rules this is a regime violation of exactly the kind it polices in others.

### F9 — The determinism guarantee leaks precisely where the package claims to have sealed it.

`tradecraft-auditor` §3.3 rejects solver IIS routines *because they are non-deterministic* and substitutes a hand-rolled minimum-cardinality IIS as a MIP over the world variables, then: *"When multiple optima exist, we enumerate all of them via iterative no-good cuts up to a cap of 8 and report the intersection and the union."*

If more than 8 optima exist, **which 8 you get is determined by the solver's branching order** — the same class of dependency (presolve, threading, version) that motivated rejecting the vendor IIS. The cap re-introduces the defect one layer down. Byte-identical artifacts are claimed for a compliance instrument whose headline finding may not be stable across solver versions.

Separately, the scale claim is not credible as written: |W| ≤ 262,144 continuous variables solved "dense… in milliseconds" is plausible for the LP; the same-sized **MIP** with big-M indicators, called "instantaneous," then enumerated up to 8 times, is not. No timing measurement is offered for either. **UNVERIFIED and unsupported.**

### F10 — The retrieval-poisoning kernel builds the failure mode it correctly diagnoses.

§2.2 states, correctly and forcefully: *"global corpus share is the wrong state variable. A model built on 'what fraction of the corpus is poisoned' is structurally incapable of reproducing a 0.0002% → 97% result."* **CONFIRMED** — the PoisonedRAG result is achieved by injecting five texts *crafted for each specific target question* ([paper §5.1](https://www.usenix.org/system/files/usenixsecurity25-zou-poisonedrag.pdf)).

The kernel's state variables (§3.3) are `Nc[c]`, `Np[c]`, `Dp[c]` — per-topic-cell **corpus counts** — with retrieval driven by a single scalar mean shift `delta`. **There is no query variable anywhere in the dynamics.** Per-query targeting, the entire mechanism of the cited result, is not representable. The pack diagnoses the wrong-state-variable error in §2.2 and commits it in §3.3.

Compounding: `delta` is the load-bearing parameter and the pack labels it **ASSUMED**, noting no public dataset measures it. The synthetic oracle then *sets* `delta`, *generates* planted documents to a numeric similarity target, and *verifies the achieved similarity gain* — so it measures the harness, not the world. And the real-world arm is conceded to be N=1. **A capability whose strongest oracle is circular and whose only external arm is a single point has no evidence of external validity at all.**

### F11 — CONFLUENCE's motivating example is not resolvable by CONFLUENCE's oracle.

The Curveball / Silberman–Robb framing is the strongest paragraph in the package. But Mode N's resolution events are (i) published correction cascades and (ii) documented dependency-graph changes. The ~100-reports-one-source finding was **not** established by a correction cascade; it was established by source exposure and a commission with access to the underlying HUMINT reporting. The pack's oracle would never have resolved its own headline case.

Related, and more serious for fielding: the pack claims *"it never makes a claim about the world, never names a person"* and *"there is no person node type and no constructor for one."* Evidence channel 4 is **"explicit attribution — hyperlink, wire tag, 'according to X,' byline reuse."** Byline reuse requires byline data. The absence of a `Person` node type does not mean person-identifying data is absent from the graph; it means it is stored on `DocumentInstance` instead. A security reviewer will find this in one pass, and the red line will read as a naming convention rather than a control.

### F12 — Tradecraft Auditor's de-anonymization exposure is dismissed in one line.

The claim is that no score can be traced to an author because of *"a missing field in a database and a test that fails if anyone adds it back."* But Q3's resolution contracts accumulate outcomes **"per product class and topic"**, and Q2's estimand is resolved by three human raters scoring specific products. Product class × topic × date is, in most IC production shops, a near-unique identifier for an office and frequently for an individual. **k-anonymity is never mentioned.** No suppression rule, no minimum cell size, no aggregation floor.

This is the single largest **policy tripwire** in the package and it is understated. ODNI/AIS deliberately samples and does not publish a composite; the package correctly declines to invent a composite and then proposes continuous, per-product, per-topic scoring — which is a composite by accumulation. The union representation, the IG, and the analytic ombuds will all ask, and "there is no `authorId` field" is not an answer.

### F13 — The Indicator Lab ships the oracle dependency the package elsewhere calls fatal.

`tradecraft-auditor` §2.4: the 2×2 contingency table's indicator side is Taiwan MND daily PLA activity, and the event side is *"MND's own dated exercise announcements."* Both cells, one publisher. That is `oracle_independence: shares_source_with_input`, which the package's own `evaluation` §1.1 table marks **REFUSE** under both real-world regimes. Meanwhile `coercion-ladder` §6 Finding 2 independently names the same single-publisher dependency as its largest technical risk. Two sections of the same package assess the same dependency as fatal and as acceptable.

### F14 — Selection effects in the Iran→water scoring set.

`L = 30d` is well-defended as a pre-registered parameter. The undefended part is the disposal rule: *"A window whose evidence arrives after `T+90+L` resolves to UNRESOLVED, which is reported and excluded from scoring rather than counted as a miss."*

Given a base rate of ~1–3 disclosed events per year over 90-day windows, and a disclosure process whose lag is exactly what Q2 says is unobservable, **the excluded set is not missing at random — it is selected on late disclosure, which correlates with the instrument bands the model is trying to discriminate.** Scoring only the windows where something was disclosed on schedule is a mechanism for manufacturing apparent skill. The package flags `L` as "the most attackable parameter" and directs the panel at it; the disposal rule underneath it is the more attackable one.

### F15 — Q1's partition and the actual 2026 record do not line up.

Q1 counts *"Iranian-affiliated"* disclosed onsets. The largest US water OT event of the period — 30+ Minnesota communities, seven states, boil-water notices — is, per CISA's 30 July 2026 alert, **named to no country or group**, and attribution remains pending federal investigation ([SecurityWeek](https://www.securityweek.com/cisa-urges-water-sector-to-protect-ot-after-coordinated-attacks-on-plcs/); [FBI/EPA PSA](https://www.fbi.gov/investigate/cyber/alerts/2026/malicious-cyber-actors-targeting-water-and-wastewater-sector-internet--facing-programmable-logic-controllers-causing-operational-disruptions)). The pack's own §7 uses these events to argue the base rate is stale — while its resolution rule may exclude them. **The correction to the base rate is built on events that may not resolve into the partition it corrects.** The pack is right that "similar activity" ≠ "same actor" and says the KAC rubric tests for it; it does not apply that discipline to its own resolvable quantity.

### F16 — Asymmetric skepticism on the strategic premise. **CONFIRMED.**

The package's whole strategy rests on: raw forecasting skill is commoditizing, therefore measurement/abstention/calibration is the durable moat. The evidence is FRI's 2026-07-16 post, reproduced with exact p-values (**CONFIRMED**: 0.41, 0.16, 0.15, 0.14).

What the package does not carry forward, from the same page and the ForecastBench leaderboard:

- *"We last elicited superforecaster predictions in 2024. Our comparison relies on a **statistical extrapolation that grows less reliable over time**."*
- *"Human comparison groups were last surveyed in July 2024 and therefore **answered a different set of questions** than models evaluated after that date. To enable fair ranking across forecasters despite **non-overlapping question sets**, we use a two-way fixed-effects model that adjusts for question difficulty."*
- On the tournament leaderboard the **superforecaster median still ranks #1 overall** (69.2, N=578) ahead of Cassi (68.7, N=588). The market-question result is 77.3 (N=96) vs 75.9 (N=57), CIs [73.6, 82.2] and [72.8, 80.3] — **overlapping**.

A package that refuses to let its own Brier score travel without a regime tag accepts, at face value, an external comparison across non-overlapping question sets against a two-year-stale human baseline, because it supports the strategy. The panel will not miss this. It is the same error the package is selling a product to prevent.

### F17 — Path root is wrong in five of seven documents.

The repository root is `engine/`. Five documents cite `src/metrics/index.ts`, `src/agents/panel.ts`, `src/artifact/store.ts`; only `coercion-ladder` and part of `retrieval-poisoning` use the correct `engine/src/…`. Line numbers are mostly right (`panel.ts:36` and `:40` are both correct and cite different things; `store.ts:28-35`, `run-question.ts:680`, `analysis.ts:240` all verified). But three documents cite three different line numbers — `:40`, `:35`, `:41-45` — for the regime machinery in one file. Trivial individually; collectively it tells a panel the citations were not re-derived, which undercuts every other `file:line` in the package.

### F18 — A broken citation.

`tradecraft-auditor` §3.2 cites *"Jaumard, Hansen & Poggi de Aragão, INFORMS J. Computing 3(2), 1991"* and hyperlinks it to an IDEAS/RePEc record for **European Journal of Operational Research 108(3), 1998**. Journal, volume, and year all disagree with the link. One broken citation in a document whose selling point is provenance discipline is worth more to an opposing evaluator than it should be.

---

## 3. Where the package contradicts itself

| # | Section A | Section B | Conflict |
|---|---|---|---|
| C1 | `coercion-ladder` §6: CSIS ChinaPower tracker does not exist; do not put it in the bid | `tradecraft-auditor` §2.4: cites the same URL as a live compiled series | The tracker exists. A is wrong. **Refuted above.** |
| C2 | `evaluation` §1.1: same-publisher oracle ⇒ **REFUSE** skill score | `tradecraft-auditor` §2.4: MND indicator + MND event side | Same-publisher 2×2 shipped as the reference instantiation |
| C3 | `evaluation`/all: regime tag required | `benchmark.ts:241`: regime defaults silently | Claim false on the path that produced the headline numbers |
| C4 | 4 docs: "one of eight" | `tradecraft-auditor`: "one of five" | Shipped default is **3** |
| C5 | `iran-water` §1: "refuses, in code, to ever produce a ranked list of named American water utilities" | §2/§6: counts named US WWS onsets, ingests Censys exposure denominators, cites named victims | Distinction is policy-level, not code-level; §6 also concedes the raw Censys host list "must not be sought," i.e. the key input exists only in a forbidden form |
| C6 | `platform` §1.2: class B "will actually field" because it claims about the source base, not the world | `CONFLUENCE` §1: "never says a source is unreliable" | The fielding argument *is* that it makes source claims; the red line says it does not |
| C7 | `iran-water` §3: architecture stated honestly as three classes | §1: "a real hydraulic simulator that the government itself co-wrote, so anyone can rerun it and check us" | Plain-English section sells verifiability as validation — the exact inflation §3 exists to prevent |

---

## 4. Completeness pass — what is missing

**Modalities not run.** All six capabilities are text + numeric time series. There is **no imagery, no geospatial, no SIGINT-shaped, no financial-transaction, no biometric/identity modality** anywhere. The customer asked about socio-political phenomena and adversary decision-making; a package with no imagery and no geospatial reasoning is answering a fraction of the question.

**Language.** The only non-English dependency named is Taiwan MND (Chinese), with an admitted absence of a stable machine schema. **No machine-translation error propagation is modelled anywhere**, and no pack states how translation variance enters the ensemble or the confidence field. For an adversary-focused system this is a large, unaddressed hole — and CONFLUENCE explicitly uses "shared transliteration variants" as an evidence channel while never modelling translation as a noise source.

**Benefit category (b) — reduced time to analyze — is never measured.** No time-on-task study, no analyst workflow, no human-in-the-loop evaluation, no UI evaluation, no comparison against an analyst performing the same task. The package measures machine accuracy and never measures the thing the customer said it wanted.

**Benefit category (d) — cost reduction — has no denominator.** `CONFLUENCE` §5 ships `denominator.yaml` as **"empty slots the customer fills — products-per-year and hours-per-source-summary-statement."** That is the vendor asking the buyer to supply the business case. The only cost figures in the package are $0.2959 and $0.7544 **per question**, commercial-API, Low tier, explicitly non-transferable to the high side (`dualtier` §1.1). There is **no analyst-hour baseline, no products-per-year figure, no fully-loaded rate, and therefore no cost-reduction claim that survives arithmetic** — because no arithmetic is attempted.

**Framer refusal is unmodelled.** Adjudicator refusal is measured (5/5, then 2 of 3) and designed around. But if the **Framer** refuses — and influence-ops, sub-threshold cyber, and coercion prompts sit on the same policy boundary — there is no partition, no ensemble, and no run. The single point of failure upstream of everything is not analyzed. `dualtier` §1.1 correctly notes the refusal rate must be re-measured on the high side; nothing states what happens when framing itself fails.

**Register custody and integrity.** `evaluation` §1.5 requires the register be "held by the evaluator, not by us." No section specifies who, under what agreement, with what hash-chain anchoring, what happens on dispute, or how a 12-month accrual survives a contract gap. For the capability whose entire value is a track record, the custody model is one sentence.

**Competitive analysis is absent.** One incumbent is named and then corrected out (Rhombus). There is no treatment of Palantir, Primer, Recorded Future, Two Six, BAE, RAND, Good Judgment Inc., or the ForecastBench top submissions — several of which (Cassi, Foresight, Mantic) are commercial forecasting systems now at or near superforecaster parity on the very benchmark the package cites. **The package cites the evidence that its competitors are strong and never names them.** A panel that has funded losers will ask "who else does this, and why are they wrong," and the package has no answer.

**Buyer is identified only as an agency.** No program office, no contracting vehicle beyond a gesture at the Feb 2026 Acquisition Framework and the REASON *pattern*. No BAA, no CSO, no SBIR topic, no IQT path, no facility clearance status, no key personnel, no schedule with dollars, no data rights posture beyond noting REASON's GPR floor. For a technical white paper some of this is out of scope; a panel still asks, and the package pre-empts none of it.

**Nothing addresses coordination, despite the sweep identifying it as the decisive finding.** The landscape sweep's own conclusion is that no candidate says who represents a machine judgment in an interagency coordination meeting or who takes the dissent footnote. `iran-water` §4 answers this with a dedicated devil's-advocate slot whose dissent is a required product field — that is a mechanism for *producing* a dissent, not for *assigning* it to a signatory. `platform` §2.2 adds `owner: string` with the comment "machine judgments need a signatory," and no document develops it. **The package's own strongest finding remains its largest gap.**

**Six of eight documents, as provided to this panel, terminate mid-section** — `iran-water` §7, `CONFLUENCE` §6, `tradecraft-auditor` §5.1, `coercion-ladder` §7.4, `technoeconomic` §7.1, `retrieval-poisoning` §7.3, `platform` §2.4, `dualtier` §2.4, `evaluation` §3.2. The truncated material is disproportionately §6 Data, §7 Oracle/Evaluation, and the §9–14 range (classification path, red lines, cost, schedule) — i.e. exactly where the hardest questions live. If the submission ships in this state it fails on responsiveness before anyone reads the technical content.

---

## 5. The three fixes that most raise the probability of an award

### Fix 1 — Make the regime tag unconstructible-when-wrong, then re-run and re-publish every headline number under it.

Delete `regime?` and the `?? "synthetic_oracle"` default at `engine/src/pipeline/benchmark.ts:83,241`. Make `EvaluationRegime` a required positional argument everywhere, and implement the `evaluation` section's own `ScorableOracle` proposal so a skill score is *unconstructible* from a disqualifying `oracle_independence` tag — the same trick as the absent `(Judgment) => number`. Then re-run the 80q × 32-run batch and re-state +0.4355, −0.4561, 80/80 and 7% with all four fields attached (value · N · baseline · regime · oracle_independence · vintage).

**Why this one first:** it is cheap, it is provable in a demo, and it converts the package's most refutable claim into its most defensible one. Right now a panel can break the central thesis by reading two lines of the vendor's own source. After this fix, the thesis is the only claim in the package a competitor cannot make.

### Fix 2 — Ship one capability end-to-end with a live, third-party-resolved register accruing before the paper is submitted, and lead with it.

The only capability that can do this today is the coercion ladder: Taiwan MND publishes daily, the rung-mapping function can be hashed and committed now, and the register accrues from day one. Every other capability in the package is a specification.

Do three things to it: (a) restore the CSIS/PLATracker cross-source that Finding 1 wrongly deleted, and use it as the independent-series mitigation the pack already asks for; (b) start the register **now**, so the submission carries N weeks of timestamped, resolved, third-party-checkable forecasts rather than a promise; (c) state the power analysis exactly as §7.2 already does — a 90-day window yields an accruing register, not a significant ΔRPS — and make *that honesty* the pitch.

**Why:** the package's own strongest structural criterion is that the resolution source be a third party's published artifact on a known schedule. Every competitor will claim accuracy. **A live register with commitment hashes predating resolution is the only artifact in this market that a T&E team can verify without trusting the vendor at all.** Submitting a paper about a register you have not started is submitting the same thing everyone else submits.

### Fix 3 — Answer the customer's worked example with something buyable, and say so on page one.

Today the package's answer to *Iran → US water infrastructure* is: `iran-water` caps at **low** confidence by construction; `technoeconomic` **refuses** Iran on consequence (~100% structural abstention); and `platform`'s worked example ships with `resolution.verifiedAt: null`, meaning it **cannot register a live arm**. Three documents, three non-answers, on the one case the customer named.

Each refusal is individually correct. Collectively they are a decline letter. The fix is not to weaken them — it is to **re-cut the deliverable around what the chain can actually assert at high confidence**, which is Q1 and Q3: a scored, third-party-resolved forecast of disclosed Iranian-affiliated WWS onsets by instrument band, plus a rerunnable hydraulic consequence envelope over published benchmark networks — with Q2 declared out of scope for the unclassified tier and named as the specific, priced delta that classified access buys. State on page one: *"Here is what we answer, here is what we refuse, here is exactly what a classified corpus adds and how you would measure whether it did."* That framing turns the classification barrier into the REASON-pattern sales argument the `dualtier` document already makes well, instead of leaving three separate refusals for the panel to assemble.

**Also fix, cheaply, before submission:** the CSIS false correction (F5); the panel-size inflation (F4); the path roots (F17); the broken citation (F18); the transplanted red-team cost (F8); and add the missing LOC estimates for `tradecraft-auditor` and `technoeconomic` (F6). None is hard. Each one individually is small; together they are the difference between "disciplined" and "asserts things it did not check."

---

## 6. The one claim most likely to be false

> **"Every report REQUIRES an `EvaluationRegime` tag … and no function pools them."** — asserted in the brief and in six of the eight documents, in some form.

**It is false as stated, and it is false in the direction that matters.** `engine/src/pipeline/benchmark.ts:83` declares the tag optional and `:241` supplies `synthetic_oracle` when it is absent. The benchmark harness is the code path that produced every quantitative claim the package makes about itself: the +0.4355 Brier skill, the monotone evidence-quality ladder, the −0.4561 negative control, coverage@1 0.123, the 80/80 true-abstention arm, and the 7% false-abstention threshold sweep. **CONFIRMED by reading the source this session.**

The second half of the claim survives — no function pools regimes, and `metrics/index.ts` is built to prevent it. The first half does not. And the first half is the one the bid leans on, because it is the claim that licenses every other number.

Two aggravating factors. First, the codebase contradicts itself in plain sight: `score.ts:42` states *"`regime` is required and never inferred"* while `benchmark.ts:241` infers it. Second, the package elsewhere demonstrates it knows the correct construction — it proposes exactly this fix for the oracle-independence field ("the refusal must be a type error at the call site, not a runtime warning that a report generator can swallow") and cites the absent `(Judgment) => number` as the pattern. It applied the pattern to a field it has not built and not to the field it ships.

**Runner-up**, and the one most likely to be raised first in the room because it needs no code access: *"Do not put a CSIS dependency in the bid"* (F5) — a false negative, asserted as a verified correction, contradicted by another section of the same package, and refuted by a live page at the cited URL.

---

**Sources**

- [WNTR hydraulic simulation documentation — required_pressure defaults and PDD/DD warning](https://usepa.github.io/WNTR/hydraulics.html)
- [WNTR HydraulicOptions API reference](https://usepa.github.io/WNTR/apidoc/wntr.network.options.HydraulicOptions.html)
- [CISA AA26-097A — Iranian-Affiliated Cyber Actors Exploit PLCs Across US Critical Infrastructure](https://www.cisa.gov/news-events/cybersecurity-advisories/aa26-097a)
- [IC3 PDF of AA26-097A, 22 July 2026](https://www.ic3.gov/CSA/2026/260722.pdf)
- [FBI/EPA PSA — Malicious Cyber Actors Targeting WWS Internet-Facing PLCs, 30 July 2026](https://www.fbi.gov/investigate/cyber/alerts/2026/malicious-cyber-actors-targeting-water-and-wastewater-sector-internet--facing-programmable-logic-controllers-causing-operational-disruptions)
- [SecurityWeek — CISA Urges Water Sector to Protect OT After Coordinated Attacks on PLCs](https://www.securityweek.com/cisa-urges-water-sector-to-protect-ot-after-coordinated-attacks-on-plcs/)
- [Tenable — Coordinated Cyberattack on Minnesota Water Utilities](https://it.tenable.com/blog/coordinated-cyberattack-on-minnesota-water-utilities-what-you-need-to-know)
- [CSIS ChinaPower — Taiwan ADIZ Violations dataset](https://chinapower.csis.org/data/taiwan-adiz-violations/)
- [CSIS ChinaPower — Tracking China's Increased Military Activities in the Indo-Pacific in 2025](https://chinapower.csis.org/china-increased-military-activities-indo-pacific-2025/)
- [PLATracker — Trackers](https://www.platracker.com/trackers)
- [CSIS AMTI — The Sky's the Limit: Comparing China's ADIZ Intrusions](https://amti.csis.org/the-skys-the-limit-comparing-chinas-adiz-intrusions/)
- [Zou et al., PoisonedRAG, USENIX Security '25 (pp. 3827–3844)](https://www.usenix.org/system/files/usenixsecurity25-zou-poisonedrag.pdf)
- [Global Sanctions Data Base](https://www.globalsanctionsdatabase.com/)
- [GSDB-R4 working paper, Drexel LeBow](https://www.lebow.drexel.edu/sites/default/files/2025-01/wp2025002-global-sanctions-db.pdf)
- [Forecasting Research Institute — AI models have likely reached parity with superforecasters on ForecastBench, 16 July 2026](https://forecastingresearch.substack.com/p/ai-models-have-likely-reached-parity)
- [ForecastBench tournament leaderboard](https://www.forecastbench.org/tournament/)
- [ForecastBench leaderboards — methodology notes on the July 2024 human comparison group](https://www.forecastbench.org/leaderboards/)