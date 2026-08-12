## 🧑 In Plain English

**What this does:** It rebuilds how we prove the system is any good. Today we can show that the machine turns better evidence into better answers in a lab setting — but we have never checked it against real history or against the real future, and we say so.

**Why it matters:** The customer asked for accuracy and quality assurance. Everyone bidding will claim accuracy. Almost nobody will publish the conditions under which their accuracy number is meaningless — and there are five specific conditions where it is.

**What's new under the hood:** A refusal. The scoring code will decline to produce a skill number when the answer key was built from the same sources the system read, the same way it already refuses to mix lab results with real-world results. Plus a "quiet period" test that reports how often each pack cries wolf when nothing is happening, a sealed register that timestamps every prediction before it can be resolved, and honest arithmetic on cost that says out loud which jobs are too small to be worth automating.

**The uncomfortable finding we lead with:** The Intelligence Community's own product-quality regime grades analytic products on eight of nine tradecraft standards and skips the ninth — *"makes accurate judgments and assessments"* — because accuracy is too hard to determine. That is the gap this section fills.

---

# Evaluation and Measurement Redesign

## 0. Why evaluation is the product, not the appendix

Two facts, both verified this session, set the strategy.

**Fact one — raw forecasting skill is commoditizing.** The Forecasting Research Institute reported on 2026-07-16 that several AI systems are now statistically indistinguishable from superforecaster-level accuracy on ForecastBench, and that one system (Cassi AI) ranks above the superforecaster median on market questions for the first time. Bootstrap one-sided p-values against the null of equal accuracy: Cassi 0.41, xAI 0.16 and 0.15, Google DeepMind 0.14 — none rejects parity ([FRI, 2026-07-16](https://forecastingresearch.substack.com/p/ai-models-have-likely-reached-parity)). **CONFIRMED**, with the operators' own caveats reproduced in §3.

**Fact two — the buyer's own quality regime does not grade accuracy.** ODNI's Analytic Integrity and Standards group conducts annual ICD 203 reviews of a sampled selection of IC analytic products and reports to Congress. AIS grades products against every analytic tradecraft standard **except Standard 8, "makes accurate judgments and assessments," because of the difficulty of determining accuracy** ([Brunel, *How do we know if an intelligence analytic product is good?*](https://bura.brunel.ac.uk/bitstream/2438/30804/5/FullText.pdf); [ODNI, Objectivity / ICD 203](https://www.dni.gov/index.php/how-we-work/objectivity)). **CONFIRMED via secondary scholarly source**; ODNI's own page confirms the AIS mandate, the annual review, and the nine tradecraft standards but does not itself state the Standard 8 exclusion — treat the exclusion as **CONFIRMED-by-secondary**, and verify with the customer.

Put together: the thing that is getting cheap is the probability. The thing that is structurally missing — inside the customer's own institution — is a defensible method for grading whether a judgment was any good. That is what this section builds, and it is the only part of the bid that a competitor with a better model cannot copy by having a better model.

---

## 1. New guards the landscape sweep proved are missing

### 1.1 `oracle_independence` — the required fourth field

The `EvaluationRegime` tag currently carries `synthetic_oracle | historical_backtest | live_post_cutoff` and no function pools regimes. That guard is necessary and insufficient. A backtest tagged `historical_backtest` can still be worthless if the answer key was manufactured by the same observation process that produced the inputs.

**The change.** Every report requires a four-field evaluation tag. The new field:

```ts
export const ORACLE_INDEPENDENCE = [
  "independent",              // resolution artifact published by a third party
                              // that did not read our inputs and does not
                              // depend on the same detection apparatus
  "shares_source_with_input", // outcome observed through the same filter,
                              // publisher, or detector as the evidence
  "analyst_consensus",        // resolution is a later human judgment built
                              // from the same reporting stream
  "revised_series",           // outcome value moves after first publication
] as const;
export type OracleIndependence = (typeof ORACLE_INDEPENDENCE)[number];
```

**The refusal — and its one deliberate exception.** A skill score is a claim that the system beat a baseline *at knowing about the world*. That claim is unavailable when predictor and oracle share a bias. But under `synthetic_oracle` the oracle *is* the generator by construction — sharing is the entire point of a controlled experiment, and the resulting number is a claim about the machinery, not about the world. So the rule is conditional, not blanket:

| Regime | `independent` | `shares_source_with_input` | `analyst_consensus` | `revised_series` |
|---|---|---|---|---|
| `synthetic_oracle` | n/a | **skill permitted, labelled INTERNAL VALIDITY ONLY** | n/a | n/a |
| `historical_backtest` | skill permitted | **REFUSE** | **REFUSE** | permitted **only** with recorded vintage (§1.3) |
| `live_post_cutoff` | skill permitted | **REFUSE** | **REFUSE** | permitted **only** with recorded vintage |

Implement it the way the platform already forbids `(Judgment) => number`: make the skill score constructible only from a `ScorableOracle` value that cannot be built from a disqualifying tag. The refusal must be a type error at the call site, not a runtime warning that a report generator can swallow.

**Justification — five confirmed mechanisms.**

**(a) The outcome dataset that undercounts closed states.** Media-sourced conflict event data underreports events precisely where reporting is thin. Dietrich and Eck, exploiting source variation in UCDP-GED, find media sources "severely underreport events in African countries," with coverage associated with trade openness and subnational access to communication technology ([Dietrich & Eck 2020](https://ideas.repec.org/a/taf/ginixx/v46y2020i6p1043-1060.html)). A 2023 *Humanities and Social Sciences Communications* review documents media blackouts distorting the record in Burundi 2015, Ethiopia 2014–2018 and 2021, Eritrea and Afghanistan ([Nature HSSC 2023](https://www.nature.com/articles/s41599-023-01559-4)). The decisive case is Weidmann's: the apparent violence-increasing effect of cellphone coverage in Africa is *partly a higher reporting rate* of violence in covered areas — the covariate drives the outcome measurement, not only the outcome ([Weidmann, AJPS](https://onlinelibrary.wiley.com/doi/10.1111/ajps.12196)). That is the exact mechanism by which a shared filter manufactures apparent skill: a model that has learned where reporting is dense will score well against a dataset built from that same reporting. **CONFIRMED.** Note fairly that ACLED's own working paper argues its coding is robust to press repression ([ACLED WP5](https://www.strausscenter.org/wp-content/uploads/ACLED_Reporting-Sources-Working-Paper-No.-5_2015.pdf)) — the point of the guard is not that any one dataset is bad, it is that the relationship between predictor and oracle must be *declared and defensible*, because it is contested even among the dataset authors.

**(b) The platform's own disclosed takedown counts as both input list and resolution source.** Meta's Adversarial Threat Reports are the near-universal input for influence-operations research — one public dashboard aggregates 214 operations extracted from 71 Meta reports ([CIB/ATP dashboard](https://cibdashboard.netlify.app/)). Meta states plainly that, CIB aside, "this report is not intended to document the full universe of our enforcement across every harm area" ([Meta H1 2026 Adversarial Threat Report](https://transparency.meta.com/sr/first-half-2026-Adversarial-threat-report)). Scoring "will Meta take down a network attributed to X" against Meta's own disclosures scores the discloser's publication policy, not the world. **CONFIRMED.**

**(c) Scoring against a later analyst consensus built from the same reporting.** This is the failure mode ODNI itself declined to grade around: Standard 8 goes ungraded because accuracy is hard to determine, so any "consensus" answer key assembled after the fact is a second analytic product drawing on the same open reporting the system read, not an observation of the world. Grading against it measures agreement with a downstream reader. **CONFIRMED** as a structural argument; the AIS Standard 8 exclusion is the supporting evidence.

**(d) Revised-upward on-chain series.** Chainalysis is explicit and repeatedly self-documenting: its 2020 ransomware figure moved from an initial ~$350M at publication to "just over $692 million" by January 2022 — nearly double ([Chainalysis 2022](https://www.chainalysis.com/blog/2022-crypto-crime-report-preview-ransomware/)); the initial 2022 figure of $457M was later "revised upward by 24.1%" ([Chainalysis 2024](https://www.chainalysis.com/blog/ransomware-2024/)); the 2024 total grew from an initial $813.55M ([Chainalysis 2025](https://www.chainalysis.com/blog/crypto-crime-ransomware-victim-extortion-2025/)) to an updated $892M, with 2025's $820M expected to "approach or exceed $900 million" ([Chainalysis 2026](https://www.chainalysis.com/blog/crypto-ransomware-2026/)). A forecast band scored against the first-published figure and a forecast band scored against the third revision are different experiments. **CONFIRMED.**

**(e) Anything observed through a detection filter.** CISA's KEV catalog requires "reliable evidence that the vulnerability has been actively exploited in the wild," and CISA states that if it "does not consider the information 100% accurate, CISA does not add the vulnerability"; further, "addition of a vulnerability to the KEV Catalog does not indicate that CISA is observing current active exploitation" ([BOD 22-01 / KEV FAQ](https://www.cisa.gov/news-events/directives/bod-22-01-reducing-significant-risk-known-exploited-vulnerabilities-revoked); [KEV criteria](https://www.cisa.gov/known-exploited-vulnerabilities-catalog/reducing-significant-risk-known-exploited-vulnerabilities)). KEV is an excellent resolution source *because* it is a dated third-party artifact with published inclusion criteria — but it resolves "was exploitation reported to and validated by CISA," not "was it exploited." Any system whose inputs include the same vendor advisories CISA reads is sharing a filter with its own oracle. **CONFIRMED.**

### 1.2 The counterfactual-branch scoring rule

The platform's core loop fans out N runs over mutually exclusive outcome bands. Only one band happens. The temptation — scoring the unrealized branches for "plausibility" and averaging — is the single fastest way to fabricate a number.

**Rule.** Under `historical_backtest` and `live_post_cutoff`, score **only the realized branch**, against the realized outcome, using the band assignment the framer committed to before resolution. Unrealized branches are reported as *narrative artifacts with no score attached*. Under `synthetic_oracle`, where the generator knows the counterfactual truth, unrealized branches may be scored — and that score may never be pooled with, averaged into, or compared against a realized-branch score. Enforce with the same no-pooling machinery that separates regimes: a counterfactual score carries its own type and there is no function that sums across the boundary.

**Why this matters commercially.** The customer's own worked example — simulate Iranian decision-making about US water infrastructure, predict how technoeconomic policy shapes their actions — is a counterfactual question. The honest deliverable there is a *branch structure with indicators*, resolved by which branch the world entered, not a scored ensemble. Say that in the bid before a T&E team says it for us.

### 1.3 Data-vintage recording for oracles that move

Every resolution record gains three fields: `oracleSourceId`, `oracleObservedAt` (when we read the value), and `oracleVintage` (the publisher's own version/edition identifier — e.g. `catalogVersion 2026.04.16` for KEV, report edition for Chainalysis, `UCDP-GED v25.1` vs `UCDP Candidate` for conflict fatalities). The VIEWS challenge already handles this correctly and publicly: test-window predictions are evaluated against final UCDP-GED data while the true-future window is evaluated against UCDP *Candidate* data, "since these are the only data that will be available at that time" ([VIEWS 2023/24 invitation](https://viewsforecasting.org/wp-content/uploads/VIEWS_2023.24_Prediction_Competition_Invitation.pdf)). Copy that discipline exactly.

**Behavior on revision:** when a vintage change is detected, the metrics package recomputes and emits **both** scores with their vintages, and flags any report whose headline number changed by more than a declared tolerance. Scores are never silently retained. A dashboard that shows a stale Brier score because the oracle moved underneath it is the same defect as a stale "All systems live" lamp beside two unhealthy integrations.

### 1.4 A platform-wide null suite — the number no vendor publishes

Run **every domain pack against a designated quiet period** and report the false-alarm rate per pack.

- **Definition.** A quiet period is an interval, chosen and sealed *before* the run, in which the pack's warning-relevant outcome did not occur. The pack is run at its normal cadence over that interval with as-of retrieval enforced.
- **Reported per pack:** false-alarm rate (fraction of intervals in which the pack put ≥X% on a non-null band), the mean probability assigned to the null band, the abstention rate, and the sharpness distribution.
- **Why it is the number that matters.** A warning customer's real cost is not a missed event once a decade; it is the watch officer who stops reading the product because it warned eleven times and nothing happened. Sharpness is the only metric in the package that notices when a backtest resolves to the null band — a hedger scores respectably on Brier while being operationally useless, and the null suite is where that shows.
- **Publish it even when it is bad.** A pack with a 30% false-alarm rate that says so is more buyable than a pack with an unpublished one, because the buyer can set a threshold. This is the single most differentiating table in the package.

### 1.5 Pre-registration via the commit-then-resolve register

**Without this, a "live" arm is a backtest with extra steps.** The register is an append-only, hash-chained log. Each entry is written *before* the resolution window opens and contains: question text, the framer's band partition, the resolution source URL and its publication schedule, the resolution rule in unambiguous prose, the as-of date, the full run identity hash, the model/config/corpus manifest, and the sealed forecast. Nothing may be edited; corrections are new entries that reference the original.

**Two hard requirements the current code does not meet.** First, the register entry must include the **panel rubric hash** — today `PanelPlan` carries an LLM-generated `systemPrompt` per adjudicator that is never persisted and never hashed, and `runId = computeRunId(identity)` has no panel field, so two runs judged by different generated rubrics share a run id. A T&E team cannot replay a judgment whose rubric was not recorded; this is a blocking defect for §6 and it must be fixed before any evaluation claim is published. Second, the register must be **held by the evaluator, not by us** — a vendor-held pre-registration is a promise, and promises are not evidence.

### Guard summary

| Guard | Enforcement point | Failure it prevents |
|---|---|---|
| `oracle_independence` 4th field | type-level; skill score unconstructible from disqualifying tag | apparent skill manufactured by a shared observation filter |
| Counterfactual-branch rule | separate score type, no cross-boundary sum | ensemble-averaged plausibility sold as accuracy |
| Data vintage + recompute | resolution record; tolerance flag on revision | a headline number that quietly no longer matches its oracle |
| Null suite per pack | release gate; published table | a warning capability with an unmeasured cry-wolf rate |
| Sealed pre-registration (evaluator-held, rubric-hashed) | register write before window opens | retro-fitted questions, post-hoc band edits, unreplayable judgments |

---

## 2. Metric selection by question class

### 2.1 When Brier skill is the wrong headline

Brier skill is a ratio against a baseline. For rare events over short windows the baseline is "predict no," which is almost always right, so its Brier score is already tiny and the skill ratio collapses toward zero for any honest model. This is not a hypothetical: the VIEWS organizers report that in their predecessor competition, "most (but not all) of the models in fact are beaten, on common forecast evaluation scores, by a basic 'no-change' model that constantly predicts a null change in fatalities" — and their `bm_exactly_zero` benchmark, which forecasts zero fatalities everywhere, is a genuinely hard baseline to beat ([VIEWS invitation](https://viewsforecasting.org/wp-content/uploads/VIEWS_2023.24_Prediction_Competition_Invitation.pdf); [Hegre et al., *JPR* 62(6)](https://viewsforecasting.org/publications/the-2023-24-views-prediction-challenge-predicting-the-number-of-fatalities-in-armed-conflict-with-uncertainty/)). **CONFIRMED.**

A vendor that headlines Brier skill on a rare-event pack is either misreporting or has chosen an easy baseline. Neither is a good look in front of a T&E team.

### 2.2 The decision table

| Question class | Headline metric | Mandatory baseline | What a good result looks like | Trap |
|---|---|---|---|---|
| **Rare event, short window** (attack in 30 days, coup this quarter) | **Tail recall @ fixed false-alarm rate**, plus **coverage@N** | "predict no" / base rate **and** persistence | recall ≥ X% at a false-alarm rate the watch floor will tolerate; the two numbers are reported as a pair, never separately | Brier skill ≈ 0 read as "no better than chance" |
| **Recurring count / tally** (monthly leak-site victims, daily incursion counts) | **CRPS** over the predictive distribution + **interval score** | last-value persistence; 12-month empirical ("conflictology") | beats the empirical-distribution benchmark, which is the strong one | point estimates with no distribution |
| **Discrete policy act on a schedule** (designation, rule annex, sanctions adoption) | **Brier skill** + **sharpness** | base rate over prior N cycles | positive skill *and* sharpness materially above the base-rate forecaster | a well-calibrated hedger |
| **Multi-band MECE outcome** (the platform's native shape) | **coverage@1 / coverage@N** + **ranked probability score** | uniform over bands; historical band frequencies | coverage@1 well above uniform with sharpness above the prior | scoring only the modal band |
| **Adversary course-of-action / counterfactual** | **Indicator likelihood-ratio quality** + realized-branch coverage@N | analyst-authored branch set (blind) | the I&W list moves the posterior in the right direction before the branch resolves | scoring unrealized branches |
| **Source-base claims** (contradiction detection, provenance completeness, evidence recall) | **precision/recall against adjudicated ground truth** | keyword/retrieval baseline; single-model baseline | P/R with an inter-rater agreement figure attached | reporting P/R with no κ / α |
| **Abstention behavior** | **risk–coverage curve** (see §2.4) | always-answer; random-abstain | dominates both across the operating range | one threshold, one number |

**Sharpness is the discriminator.** Under a proper scoring rule, forecast quality decomposes into calibration and refinement/sharpness ([Kull & Flach lineage; classifier calibration survey](https://link.springer.com/article/10.1007/s10994-023-06336-7)). A system that always emits the base rate is perfectly calibrated and worth nothing. Sharpness is also the only metric that notices when a backtest resolves overwhelmingly to the null band — which is the normal condition for warning packs. **Report sharpness next to every calibration figure, always, on the same row.**

### 2.3 Calibration reporting hygiene

The package already emits ECE/MCE with bin occupancy. Three corrections:

1. **Equal-mass bins, not equal-width.** Equal-mass binning has materially lower statistical bias; the recommended estimators are the debiased estimator (Bröcker 2012; Ferro & Fricker 2012) and `ECE_sweep` ([Roelofs et al., AISTATS 2022](https://proceedings.mlr.press/v151/roelofs22a.html)). Record which estimator and how many bins — ECE values vary substantially with bin count ([Nixon et al., *Measuring Calibration in Deep Learning*](https://openreview.net/pdf?id=r1la7krKPS)).
2. **Never headline ECE alone.** ECE reflects one aspect of posterior quality and ignores discrimination; expected proper scoring rules are the principled measure, with calibration metrics used as *development diagnostics* ([Ferrer & Ramos, TMLR 2025](https://arxiv.org/html/2408.02841)). Our BLUF already separates likelihood from confidence; the metrics must respect the same separation.
3. **Report the ICD 203 likelihood-band mapping error separately.** Because our product speaks in ICD 203 likelihood language, the operationally meaningful calibration question is: when the product said "likely," what fraction resolved true, with a confidence interval and the N per band? That table is more legible to this customer than any scalar and should sit above ECE in the report.

### 2.4 The abstention operating curve

`INSUFFICIENT_EVIDENCE` is a first-class verdict, which means the system is a *selective predictor* and must be evaluated as one. A single threshold and a single false-abstention number (currently 7%) is a working point, not a characterization — the analogue of quoting sensitivity at one specificity.

Report:
- The full **risk–coverage curve**: coverage on the x-axis, selective Brier (and selective coverage@1) on the y-axis, over the whole threshold sweep.
- **AURC**, with the caveat that AURC over-weights high-confidence failures and breaches monotonicity/interpretability requirements; report **AUGRC** alongside it, which is directly interpretable as the average rate of silent failures ([Overcoming Common Flaws in the Evaluation of Selective Classification Systems](https://arxiv.org/html/2407.01032v2); AURC lineage: [Geifman & El-Yaniv](https://jmlr.org/papers/v24/21-0048.html), [population AURC](https://proceedings.mlr.press/v267/zhou25y.html)).
- **True abstention rate on the unanswerable negative-control arm** and **false abstention rate on answerable questions**, at a minimum of three operating points plus the shipped one.
- The shipped threshold marked on the curve, with the decision rationale recorded.

Two claims that survive this treatment and are worth a great deal to this customer: *the system knows when it doesn't know* (80/80 true abstention on a provably unanswerable arm, `synthetic_oracle`), and *the price of that is quantified* (7% false abstention at the shipped threshold, threshold sweep across 6 arms). Neither may be stated without its regime label.

### 2.5 Reporting contract

Every headline metric in every artifact carries, on the same line: **value · N · baseline named · regime · oracle_independence · oracle vintage**. A metric that cannot fill all six fields does not render.

---

## 3. Human and machine baselines, honestly

### 3.1 The capture hazard — and why we could not do it anyway

Re-grading the customer's own historical analytic calls is disqualifying on two independent grounds. **Commercially:** it turns a technical evaluation into a performance review of the people who will decide whether to buy, and it is the fastest route to an internal veto. **Technically:** the material does not exist in gradeable form. AIS grades eight of nine tradecraft standards and skips Standard 8 precisely because accuracy determination is hard; there is no maintained corpus of scored historical IC judgments to score against. We would be constructing the answer key ourselves from the same reporting — an `analyst_consensus` oracle, which §1.1 forbids under both real-world regimes.

**Position for the bid:** we propose the comparison the customer can run *without us* — a REASON-style final exam (§3.4) — and we decline to score their archive. State the declination explicitly; it reads as discipline, not evasion.

### 3.2 Three legitimate baseline ladders

**Ladder A — public as-of-dated assessments.** Published, dated documents that made a forward claim, whose resolution arrives from a third party on a schedule. Examples with real cadence: the DoD annual *Military and Security Developments Involving the People's Republic of China* (mandated by NDAA FY2000 §1202, as amended; [2025 edition, 2025-12-23](https://media.defense.gov/2025/Dec/23/2003849070/-1/-1/1/ANNUAL-REPORT-TO-CONGRESS-MILITARY-AND-SECURITY-DEVELOPMENTS-INVOLVING-THE-PEOPLES-REPUBLIC-OF-CHINA-2025.PDF)); State's *Country Reports on Terrorism* (statutory, [22 U.S.C. §2656f](https://uscode.house.gov/view.xhtml?req=%28title%3A22+section%3A2656f+edition%3Aprelim%29)). These give a *human, on-the-record, as-of-dated* comparator that is public, so no capture hazard. **Constraint:** most such text is not probabilistic, so the comparison must be band-coverage, not Brier — extract the implied band from the published language, score coverage@1.

**Ladder B — forecasting-tournament crowds.** INFER / the RAND Forecasting Initiative runs crowdsourced forecasting explicitly for "warfighters, the intelligence community, and policy analysts," led by RAND with Cultivate Labs, and publishes crowd forecasts on live geopolitical questions ([RFI](https://www.randforecastinginitiative.org/about-infer); [RAND](https://www.rand.org/global-and-emerging-risks/forecasting-initiative.html)); RAND also runs a public Metaculus tournament ([RAND × Metaculus](https://www.metaculus.com/tournament/rand/)). ForecastBench is the only benchmark that compares AI forecasters to human superforecasters ([forecastbench.org](https://www.forecastbench.org/leaderboards/)). **This is the honest human baseline: a crowd that committed on the record, before resolution, to the same question.**

**Ladder C — published statistical benchmarks.** VIEWS ships named, pre-disclosed benchmark models — `bm_exactly_zero`, `bm_last_historical`, `ph_conflictology_country12`, `conflictology_bootstrap240` — with published scores, and is explicit that the post-hoc benchmarks are *not* used as scoring rules because they were not disclosed to participants at the start. That distinction between disclosed and post-hoc baselines is exactly the discipline our package needs and it should be adopted by name.

### 3.3 The ForecastBench parity result, verified, and what it means

**Verified this session** ([FRI, 2026-07-16](https://forecastingresearch.substack.com/p/ai-models-have-likely-reached-parity); tournament leaderboard as indexed late July 2026 — the board is live and moves):

| | Dataset (N) | Market (N) | Overall (N) | 95% CI (overall) |
|---|---|---|---|---|
| Superforecaster median | 63.8 (521) | 75.9 (57) | **69.2** (578) | [67.7, 71.0] |
| Cassi-2026-05-10 | 62.1 (492) | **77.3** (96) | 68.7 (588) | [67.2, 70.4] |
| Grok 4.20 (Beta, C) | 63.2 (683) | 73.8 (114) | 68.0 (797) | [66.7, 69.4] |

Brier Index = (1 − √Brier) × 100%, adopted March 2026; higher is better; the transformation is monotonic so rankings are unchanged ([FRI, 2026-03-04](https://forecastingresearch.substack.com/p/introducing-the-brier-index)). Cassi's market score exceeding the superforecaster median is, per FRI, the first time any model has done so.

**The operators' own caveats, which we must reproduce and not soften:**
- "We last elicited superforecaster predictions in 2024. Our comparison relies on a statistical extrapolation that grows less reliable over time."
- "The 95% CIs for many of these submissions overlap substantially; the results are more consistent with superforecaster parity than with outperformance."
- Tournament entries may use tools, added context, fine-tuning, ensembling — these are *systems*, not raw models. The baseline leaderboard (out-of-the-box models, no scaffolding) still shows the superforecaster median at 68.5 and the public median at 63.2, with `gpt-5.5-2026-04-23` at 62.2 — **below the public crowd on overall** ([baseline leaderboard](https://www.forecastbench.org/baseline/)).

**What this does to the value proposition — three consequences, stated plainly.**

1. **Do not sell forecasting skill.** A frontier model with good scaffolding is at parity with elite humans and improving. Anyone can rent that. If our pitch is "our probabilities are better," we are competing on a commoditizing axis against every lab.
2. **The human baseline is itself now a dated, extrapolated quantity.** FRI's superforecaster reference was elicited in 2024 and is carried forward statistically. That is a `revised_series`-adjacent hazard in the most respected benchmark in the field — and it is precisely the class of problem §1.1 and §1.3 exist to catch. We should say so, cite it as an example of why vintage recording matters, and credit FRI for disclosing it. Doing so demonstrates the discipline we are selling.
3. **The durable differentiators are measurement, abstention, provenance, calibration — and coordination-readiness.** A raw score cannot be footnoted in a coordination meeting. A judgment that arrives with a per-claim provenance record, an abstention decision with a stated operating point, a weakest-link confidence grade, and a byte-reproducible artifact *can be*. That is the product.

### 3.4 The measured human comparison we do propose

IARPA REASON's design is the template and it is public: participants are assigned to use a performer system or to a control group, produce draft reports on assigned analytic questions drawn from political, military, social, economic, environmental and diplomatic topics, and are given opportunities to revise; T&E raters evaluate system output on correctness, appropriateness and clarity ([REASON BAA, W911NF-23-S-0007](https://arl.devcom.army.mil/wp-content/uploads/sites/3/2023/04/W911NF-23-S-0007-REASON-BAA-Final-17-March-2023.pdf)). This yields a **measured** manual baseline for both quality and time, with cleared analysts, without us touching classified material or grading anyone's archive. Propose it as the human-comparison arm and price it as a T&E line item, not a vendor claim.

---

## 4. Cost and time — measured, not assumed

### 4.1 The four quantities, defined

| Quantity | Definition | Status today |
|---|---|---|
| **Cost per resolved forecast** | all-in cost of a question from authoring to scored resolution, divided by resolved questions — **includes human question-authoring and resolution engineering** | compute component measured; human component **NOT MEASURED** |
| **Cost per Brier point** | marginal dollars per 0.01 improvement in Brier skill, reported as a curve over configurations | **NOT MEASURED** |
| **Time-to-first-insight / time-to-final-product** | wall-clock to a first defensible band assignment, and to a coordination-ready product, against a **measured** manual control | machine side measured; manual control **NOT MEASURED** |
| **Analyst-hours displaced** | hours removed from a **named recurring obligation with a stated annual instance count** | denominators specified below; displacement **NOT MEASURED** |

### 4.2 What we have measured (cite exactly; do not inflate)

- Cost per live question: **$0.2959** (9 model calls) and **$0.7544** (17 calls, red-team rerun). *Live.*
- Latency per live question: **5m54s** and **8m12s**. *Live.*
- Scale: **15,832 simulations in 305 s**. *Measured.*
- Adjudicator refusal rate on the influence-ops task: **5/5**, later 2 of 3 declined. *Live.* — a cost-relevant fact: refusals consume budget and produce no judgment, so refusal rate belongs in the cost model, not only the safety section.

### 4.3 The analyst-hour denominator

Build the burdened rate transparently so the customer can substitute their own approved figures.

| Input | Value | Label |
|---|---|---|
| GS-13 step 5, 2026 base salary | **$103,049** | **CONFIRMED** ([OPM Salary Table 2026-GS](https://www.opm.gov/policy-data-oversight/pay-leave/salaries-wages/salary-tables/pdf/2026/GS.pdf)) |
| GS-13 hourly base range (steps 1–10) | **$43.57 – $56.64** | **CONFIRMED** ([OPM hourly table](https://www.opm.gov/policy-data-oversight/pay-leave/salaries-wages/salary-tables/26Tables/html/GS_h.aspx)) |
| DC-area locality uplift | ~33% | **ASSUMED / UNVERIFIED** — 2026 locality payments are unchanged from 2025 ([OPM Jan-2026 pay memo](https://www.opm.gov/chcoc/latest-memos/january-2026-pay-adjustments.pdf)); exact percentage not read this session |
| Fully burdened multiplier on salary | 1.6× – 2.2× | **ASSUMED** — replace with the customer's DCAA-approved wrap rate |
| Productive hours per year | ~1,700 | **ASSUMED** (2,080 less leave, holidays, training, admin) |
| **⇒ fully burdened analyst hour** | **≈ $129 – $177; plan at $150** | **ASSUMED, derived** |
| **⇒ fully burdened analyst year** | **≈ $219k – $301k** | **ASSUMED, derived** |

**Immediate consequence:** at $150/hr, the $0.7544 live question costs the equivalent of **about 18 seconds of analyst time**. The compute cost is therefore *not the interesting number and must not be the headline*. Leading with $0.30-per-question invites the correct rebuttal that the money is in the people.

### 4.4 The honest cost per *resolved* forecast

The compute figure omits the expensive part. A resolvable question requires a human to author the band partition, identify a third-party resolution source with a known publication schedule, write an unambiguous resolution rule, and adjudicate edge cases at resolution. **ASSUMED** estimate: 20–60 minutes per question end-to-end, i.e. **$50 – $150 of analyst time per resolved forecast — roughly 70× to 200× the compute cost.**

State this in the bid. It is the number a serious evaluator will compute anyway, and the vendor who states it first owns the credibility. It also points directly at where automation actually pays: *question authoring and resolution-source binding*, not inference.

### 4.5 Which recurring obligations make the denominator real

Assume 4 analyst-hours displaced per instance (**ASSUMED**; must be measured per §3.4). One displaced FTE ≈ 1,700 hours ≈ 425 instances/year.

| Recurring obligation | Cadence | Instances / yr | Hours displaced @4h | FTE-equiv | Annual value @$150/hr | Honest verdict |
|---|---|---|---|---|---|---|
| Mandated **annual** product (e.g. CMPR; Country Reports on Terrorism as a whole) | 1×/yr | 1 | 4 | 0.002 | $600 | **Does not fund a program.** Value here is quality, not cost. |
| Statutory assessment with per-entity entries (Country Reports on Terrorism, ~200 country/entity entries) | annual, batched | ~200 | 800 | 0.47 | $120k | Marginal — real only if the per-entry work is genuinely repetitive |
| Quarterly regional assessment | 4×/yr | 4 | 16 | 0.01 | $2.4k | **Does not fund a program.** |
| Monthly tally (leak-site victim counts, sanctions adoptions) | 12×/yr | 12 | 48 | 0.03 | $7.2k | **Does not fund a program.** |
| Weekly watch item | 52×/yr | 52 | 208 | 0.12 | $31k | Marginal |
| **Daily watch tally** (e.g. Taiwan MND daily PLA activity counts) | working days | ~250 | 1,000 | 0.59 | $150k | **Real.** Third-party dated resolution on a known schedule. |
| **Vulnerability triage loop** (KEV additions) | continuous | ~200/yr | 400 @2h | 0.24 | $60k | **Real but modest** — KEV addition rate is **UNVERIFIED**; read the catalog JSON directly before quoting a rate |
| **Per-entity screening** (entity-list / designation candidates) | continuous | 1,000–2,000 | 500–1,000 @0.5h | 0.3–0.6 | $75k–$150k | **Real.** Highest-volume honest denominator identified. |

**The line to put in the white paper:** *cost reduction is a real claim only where the obligation recurs at daily-or-higher volume. For flagship annual products the honest answer is "one analyst, a few hours a quarter," which does not fund a program — and for those products our value proposition is (a) accuracy and (c) quality assurance, not (d) cost.* Mapping our claims onto the customer's own four benefit categories, and declining one of them where it does not apply, is worth more than an inflated ROI table.

### 4.6 Cost per Brier point — the curve, and the trap

We have two measured configurations: 9 calls at $0.2959 and 17 calls at $0.7544 — a **2.55× cost increase** from the red-team rerun. **We have not measured the skill delta between them.** That is the single highest-value experiment not yet run, and it should be first in the build order: run both configurations across the existing 80q × 32-run synthetic batch and publish the (cost, skill) pair.

The trap: skill can usually be bought with more calls, so a single cost-per-Brier-point number is meaningless. Publish the **curve** — calls per question on x, Brier skill on y, with the knee marked — and state the operating point chosen and why. A buyer who can see the knee can budget; a buyer given one ratio cannot.

### 4.7 Measuring time honestly

Report **four** clocks, not one: time-to-first-band (machine), time-to-final-product (machine, including red-team reruns and refusal retries), **time-to-analyst-acceptance** (human review before the product is coordination-ready), and the **manual control** from the REASON-style final exam. Our 5m54s / 8m12s figures are the second clock only. A 6-minute machine product that takes 3 hours to review has not reduced time-to-final-product, and a T&E team will measure exactly that.

---

## 5. The benchmark set

### 5.1 What the existing six-arm synthetic benchmark does and does not establish

**Establishes (regime: `synthetic_oracle`; oracle independence: `shares_source_with_input` by construction — the generator is the oracle):**
- Skill tracks evidence quality monotonically: **+0.44 / +0.42 / +0.11** across arms; best-evidenced arm **+0.4355** Brier skill vs base rate (80q × 32 runs).
- A working **negative control**: the deliberately misspecified arm scores **worse** than base rate at **−0.4561**, coverage@1 **0.123**. A benchmark without a negative control cannot detect a scoring bug; ours can.
- **True abstention 80/80** on a provably unanswerable arm; **7% false abstention** at the shipped threshold across a 6-arm sweep.
- **Determinism**: same seed ⇒ byte-identical artifact hash (unit test + CLI).
- **Throughput**: 15,832 simulations in 305 s.

**Does not establish — and every one of these must be labelled NOT MEASURED wherever the benchmark is cited:**
- Any accuracy about the world. The oracle is the generator.
- That the framer's band partitions correspond to how real analytic questions decompose.
- Historical backtest accuracy; live post-cutoff accuracy; skill versus a human analyst; contradiction detection on real prose.
- Robustness of the panel: **one surviving adjudicator of eight currently scores identically to a full panel** (`available: results.length > 0` → `level: adjudicationAvailable ? "high" : "moderate"`), and partial panel loss is the *normal* operating condition. Until k-of-N loss is a graded field, no confidence figure from any arm is defensible.
- Portability of the actor model: four of six mission lenses re-bound or bypassed `riskTolerance` / `escalationPropensity`.

### 5.2 The published benchmark specification

Four arms. Published together, in one document, with per-arm regime and oracle-independence tags.

**Arm 1 — Synthetic oracle (exists; becomes the regression suite).** 6 arms × 80 questions × 32 runs. Rerun on every release; artifact hashes pinned in CI; any hash change is a release blocker requiring an explanation. Labelled INTERNAL VALIDITY ONLY.

**Arm 2 — Historical backtest (does not exist; build).**
- **150 questions across 5 domain packs**, as-of dates spanning 2019–2024, chosen so each pack has ≥25 questions.
- Every question resolves against a **third-party dated artifact with a recorded vintage** — a rule annex, a designation notice, a KEV addition, a published count, an election result. Questions whose only resolution source is analyst consensus are excluded at design time.
- **Leakage guards enforced and demonstrated**: as-of corpus retrieval with a hard date filter, plus the existing runtime assertion that throws if any evidence reference post-dates the run's as-of date. Publish the count of assertion trips during construction — a benchmark that never tripped its own leakage guard probably isn't testing it.
- **Pre-registered**: question set, bands, resolution rules and sources sealed in the register *before* the corpus filter is lifted for the run.
- Oracle independence declared per question; questions tagged `shares_source_with_input` or `analyst_consensus` are **retained and reported but excluded from skill computation** — and the count of exclusions is itself a published number.

**Arm 3 — Live post-cutoff (does not exist; build).**
- **200 questions**, sealed in the evaluator-held register, resolving on third-party schedules over 12 months. Prefer high-cadence packs so N accrues: daily incursion tallies, KEV additions, monthly leak-site counts, scheduled sanctions/designation cycles, survey waves, election dates.
- Interim reports at **60 / 120 / 200 resolved**, each with CIs, each carrying its vintage set.
- The **null suite (§1.4)** runs concurrently on the same packs over designated quiet periods.

**Arm 4 — Negative controls (embedded in arms 2 and 3, minimum 20% of questions).**
- **(i) Unanswerable by construction** — correct answer is `INSUFFICIENT_EVIDENCE`; measures true abstention outside the synthetic setting.
- **(ii) Prior-contradicting** — questions whose truth is the low-prior band; measures whether the system can be moved off a prior by evidence, which is exactly what an intelligence customer is buying.
- **(iii) Null-period** — nothing happens; feeds the false-alarm rate.
- **(iv) Placebo evidence** — a corpus seeded with plausible but irrelevant material; measures whether provenance completeness and unsupported-assertion counts respond correctly.

### 5.3 How many questions before the numbers mean anything

For a paired comparison against a baseline, with per-question paired score difference SD σ_d, at 80% power and α = 0.05 two-sided, n ≈ 7.84 · σ_d² / δ².

| Detectable Brier difference δ | n at σ_d = 0.10 | n at σ_d = 0.15 |
|---|---|---|
| 0.10 | 8 | 18 |
| 0.05 | 31 | 71 |
| 0.02 | 196 | 441 |
| 0.01 | 784 | 1,764 |

**ASSUMED** σ_d values; compute the real σ_d from Arm 1 before committing to an N. The order of magnitude is independently corroborated: ForecastBench's superforecaster reference rests on N = 578 overall and still yields a 95% CI roughly 3.3 Brier-Index points wide, with top systems' intervals overlapping. **Plan the live arm for 200 resolved questions minimum and state in advance that it can detect a ~0.02 Brier difference and nothing finer.** Declaring the detectable effect size before the run is the single clearest signal to a T&E team that the evaluation was designed rather than reverse-engineered.

### 5.4 Reporting format

One page per arm, every headline metric carrying value · N · baseline · regime · oracle independence · vintage; the risk–coverage curve; the null-suite table; the negative-control results *first*, because a benchmark that leads with its negative controls is making a different kind of claim than one that leads with its best number.

---

## 6. The independent-verification story

### 6.1 What credible third-party T&E of a probabilistic analytic system looks like

Six properties. All six are cheap for us *because the runs are deterministic* — that is the technical argument that makes the contracting argument work.

1. **Evaluator-held pre-registration.** The sealed register lives with the evaluator. We can write to it; we cannot amend it.
2. **Evaluator-held resolution.** The evaluator, not the vendor, reads the resolution source and applies the resolution rule.
3. **Replay from artifact.** The evaluator receives seed + config + corpus manifest + panel rubric hash and reproduces a byte-identical artifact hash. Same seed ⇒ identical hash currently holds (unit test + CLI). **This is the single most unusual thing we bring**, and it directly attacks the reproducibility problem that makes T&E of LLM systems expensive. **Blocked today** by the panel-rubric gap (§1.5): fix `runId` to include a hash of the resolved panel rubric before any replay claim is made.
4. **Evaluator-run null suite** on packs and quiet periods the evaluator chooses.
5. **Blind product grading against ICD 203 tradecraft standards** by cleared raters — including, uniquely, Standard 8, which AIS does not currently grade. Offering the customer a defensible method for grading Standard 8 is the strategic core of this section.
6. **A human control group** — the REASON final-exam design (§3.4).

### 6.2 Who does this in this customer's ecosystem

| Body | Role | Source |
|---|---|---|
| **IARPA independent cleared T&E team** (contractor-staffed) | The precedent that solves the classification barrier: performers work strictly unclassified and are tested on classified data by cleared T&E personnel; performers never review that data and receive only unclassified summary-level feedback; T&E retrains performer systems on classified data using performer-supplied scripts. Phase 2 is 18 months. | [REASON BAA](https://arl.devcom.army.mil/wp-content/uploads/sites/3/2023/04/W911NF-23-S-0007-REASON-BAA-Final-17-March-2023.pdf); [BAA Q&A](https://www.iarpa.gov/images/PropsersDayPDFs/REASON/REASONBAA-Amendment2-QandA.pdf) |
| **ODNI Analytic Integrity and Standards** | ICD 203 tradecraft grading of finished products; annual review, report to Congress; two independent graders plus a third reviewer. The natural home for product-quality grading — and the body with the Standard 8 gap. | [ODNI](https://www.dni.gov/index.php/how-we-work/objectivity); [ICD 206](https://www.odni.gov/files/documents/ICD/ICD-206.pdf); [ICD 208](https://www.odni.gov/files/documents/ICD/ICD-208-Maximizing-the-Utility-of-Analytic-Products-2017-01-09.pdf) |
| **DoD CDAO Assessment & Assurance / JATIC** | Four published AI T&E frameworks (Model, Human Systems Integration, Systems Integration, Operational) plus the JATIC program for reproducibility and traceability tooling. | [CDAO T&E](https://www.ai.mil/About/Resources/Pathway-to-AI-Readiness/Testing-and-Evaluation/); [JATIC guidance](https://cdao.pages.jatic.net/public/guidance/) |
| **OUSD(R&E) DTE&A / DOT&E** | *Developmental Test and Evaluation of AI-Enabled Systems Guidebook* (Feb 2025); DoDI 5000.61 requires VV&A of both the data used to develop and assess a trained model **and** the model itself; NIST AI RMF 1.0 and the GenAI profile (AI 600-1) are the referenced risk frames. | [DT&E of AIES Guidebook](https://www.cto.mil/wp-content/uploads/2025/02/TE_of_AIES_Guidebook_Final_26Feb25.pdf) |
| **FFRDCs / claims-based assurance** | Claims-based assurance-case framing for AI-enabled systems, mapping existing safety/cyber/ethics artifacts into an assurance argument. | [A Framework for the Assurance of AI-Enabled Systems](https://arxiv.org/html/2504.16937) |

**ASSUMED, not confirmed:** which specific organization would staff the T&E team for a CIA-sponsored effort. Do not name one in the bid.

### 6.3 The T&E handoff package — what we actually hand them

1. **Artifact bundle per run** — seed, full config, corpus manifest with as-of date, model/version pins, **panel rubric hash**, all N run artifacts, and the artifact hash. Replayable to byte-identical output.
2. **Replay CLI** — one command, one config, verifies the hash. Already the mechanism behind the determinism test.
3. **Sealed pre-registration export** — the append-only register, hash-chained, with every entry's write timestamp.
4. **Null-suite runner** — evaluator supplies packs and quiet periods; the runner emits the false-alarm table.
5. **Retraining/tuning scripts** — REASON requires that T&E be able to retrain performer systems on classified data using performer-supplied scripts, within briefed limits on retraining time and resources. Build to that constraint from the start.
6. **Two-column TRL statement** — platform (TRL 4) and each domain pack/adapter/corpus/actor-config (TRL 2–3), separately, never merged.
7. **The known-defect list, disclosed by us first** — the three architecture gaps confirmed in the code, with remediation status: the panel rubric is not in the run identity (blocks replay integrity), k-of-N panel loss is a boolean not a grade (invalidates confidence levels under partial loss, which is the normal condition), and the two actor knobs do not generalize across domains (four of six mission lenses re-bound or bypassed them). A T&E team will find all three. Disclosing them converts a finding into a roadmap.
8. **Data rights posture** — REASON requires a minimum of Government Purpose Rights; plan for GPR on the evaluation harness and artifacts.

### 6.4 What we must never claim

Verbatim labels for the bid, to be reproduced wherever the numbers appear:

- Historical backtest accuracy — **NOT YET MEASURED**.
- Live post-cutoff accuracy — **NOT YET MEASURED**.
- Skill versus a human analyst — **NOT YET MEASURED**; a design is proposed (§3.4), no result exists.
- Contradiction detection on real prose — **NOT YET MEASURED**.
- Skill delta between the 9-call and 17-call configurations — **NOT YET MEASURED**.
- Analyst-hours displaced — **NOT YET MEASURED**; only denominators are specified.
- All published skill figures to date are **`synthetic_oracle`, oracle shares source with input by construction, internal validity only.**

---

## 7. Build order

| # | Item | Why first |
|---|---|---|
| 1 | Panel rubric into `runId`; persist and hash the generated adjudicator prompts | Blocks replay, blocks §6.3, cheapest fix, highest leverage |
| 2 | k-of-N panel loss as a graded field replacing the boolean | Every confidence figure in every arm is currently indefensible under partial loss |
| 3 | `oracle_independence` field + type-level refusal | The differentiating guard; must exist before any backtest is run |
| 4 | Risk–coverage curve + AUGRC reporting replacing the single-threshold abstention number | Converts an existing strength into a defensible characterization |
| 5 | Cost/skill curve: rerun the 80q × 32 batch at 9-call and 17-call configs | Answers the customer's cost question with a measurement, not an assumption |
| 6 | Null suite + false-alarm table per pack | The number no competitor publishes |
| 7 | Evaluator-held pre-registration register | Without it, the live arm is not live |
| 8 | Historical backtest arm (150q, 5 packs) | First real-world evidence class |
| 9 | Live post-cutoff arm (200q, 12 months) | The track record; starts accruing the day the register opens |

---

## Sources

- [ForecastBench leaderboards](https://www.forecastbench.org/leaderboards/) · [tournament](https://www.forecastbench.org/tournament/) · [baseline](https://www.forecastbench.org/baseline/)
- [Forecasting Research Institute — AI models have likely reached parity with superforecasters (2026-07-16)](https://forecastingresearch.substack.com/p/ai-models-have-likely-reached-parity)
- [Forecasting Research Institute — Introducing the Brier Index (2026-03-04)](https://forecastingresearch.substack.com/p/introducing-the-brier-index)
- [IARPA REASON BAA W911NF-23-S-0007](https://arl.devcom.army.mil/wp-content/uploads/sites/3/2023/04/W911NF-23-S-0007-REASON-BAA-Final-17-March-2023.pdf) · [REASON BAA Q&A](https://www.iarpa.gov/images/PropsersDayPDFs/REASON/REASONBAA-Amendment2-QandA.pdf)
- [ODNI — Objectivity / ICD 203](https://www.dni.gov/index.php/how-we-work/objectivity) · [ICD 206 Sourcing](https://www.odni.gov/files/documents/ICD/ICD-206.pdf) · [ICD 208](https://www.odni.gov/files/documents/ICD/ICD-208-Maximizing-the-Utility-of-Analytic-Products-2017-01-09.pdf)
- [How do we know if an intelligence analytic product is good? (Brunel)](https://bura.brunel.ac.uk/bitstream/2438/30804/5/FullText.pdf) — AIS does not grade Standard 8
- [VIEWS 2023/24 Prediction Challenge invitation](https://viewsforecasting.org/wp-content/uploads/VIEWS_2023.24_Prediction_Competition_Invitation.pdf) · [Hegre et al., *JPR* 62(6) 2025](https://viewsforecasting.org/publications/the-2023-24-views-prediction-challenge-predicting-the-number-of-fatalities-in-armed-conflict-with-uncertainty/) · [PRIO results](https://www.prio.org/news/3602)
- [Dietrich & Eck — Known unknowns: media bias in the reporting of political violence](https://ideas.repec.org/a/taf/ginixx/v46y2020i6p1043-1060.html) · [Weidmann — A Closer Look at Reporting Bias in Conflict Event Data (AJPS)](https://onlinelibrary.wiley.com/doi/10.1111/ajps.12196) · [Political instability patterns obscured by conflict dataset scope (Nature HSSC 2023)](https://www.nature.com/articles/s41599-023-01559-4) · [ACLED Working Paper No. 5](https://www.strausscenter.org/wp-content/uploads/ACLED_Reporting-Sources-Working-Paper-No.-5_2015.pdf)
- Chainalysis revisions: [2022](https://www.chainalysis.com/blog/2022-crypto-crime-report-preview-ransomware/) · [2024](https://www.chainalysis.com/blog/ransomware-2024/) · [2025](https://www.chainalysis.com/blog/crypto-crime-ransomware-victim-extortion-2025/) · [2026](https://www.chainalysis.com/blog/crypto-ransomware-2026/)
- [Meta H1 2026 Adversarial Threat Report](https://transparency.meta.com/sr/first-half-2026-Adversarial-threat-report) · [Meta Transparency corrections and adjustments](https://transparency.meta.com/policies/improving/corrections-adjustments/) · [Meta CIB/ATP dashboard (214 operations, 71 reports)](https://cibdashboard.netlify.app/)
- [CISA KEV inclusion criteria](https://www.cisa.gov/known-exploited-vulnerabilities-catalog/reducing-significant-risk-known-exploited-vulnerabilities) · [BOD 22-01 and FAQ](https://www.cisa.gov/news-events/directives/bod-22-01-reducing-significant-risk-known-exploited-vulnerabilities-revoked)
- [CDAO Testing and Evaluation](https://www.ai.mil/About/Resources/Pathway-to-AI-Readiness/Testing-and-Evaluation/) · [CDAO JATIC guidance](https://cdao.pages.jatic.net/public/guidance/) · [DT&E of AI-Enabled Systems Guidebook (Feb 2025)](https://www.cto.mil/wp-content/uploads/2025/02/TE_of_AIES_Guidebook_Final_26Feb25.pdf) · [A Framework for the Assurance of AI-Enabled Systems](https://arxiv.org/html/2504.16937)
- [RAND Forecasting Initiative / INFER](https://www.randforecastinginitiative.org/about-infer) · [RAND](https://www.rand.org/global-and-emerging-risks/forecasting-initiative.html) · [RAND × Metaculus](https://www.metaculus.com/tournament/rand/)
- Calibration & selective prediction: [Ferrer & Ramos, *Evaluating Posterior Probabilities* (TMLR 2025)](https://arxiv.org/html/2408.02841) · [Roelofs et al., *Mitigating Bias in Calibration Error Estimation*](https://proceedings.mlr.press/v151/roelofs22a.html) · [Nixon et al., *Measuring Calibration in Deep Learning*](https://openreview.net/pdf?id=r1la7krKPS) · [Classifier calibration survey](https://link.springer.com/article/10.1007/s10994-023-06336-7) · [AUGRC — Overcoming Common Flaws in Selective Classification Evaluation](https://arxiv.org/html/2407.01032v2) · [Optimal Strategies for Reject Option Classifiers (JMLR)](https://jmlr.org/papers/v24/21-0048.html) · [Population AURC](https://proceedings.mlr.press/v267/zhou25y.html)
- [OPM Salary Table 2026-GS](https://www.opm.gov/policy-data-oversight/pay-leave/salaries-wages/salary-tables/pdf/2026/GS.pdf) · [2026 hourly rates](https://www.opm.gov/policy-data-oversight/pay-leave/salaries-wages/salary-tables/26Tables/html/GS_h.aspx) · [Jan 2026 pay adjustments memo](https://www.opm.gov/chcoc/latest-memos/january-2026-pay-adjustments.pdf)
- Recurring-obligation denominators: [22 U.S.C. §2656f Annual Country Reports on Terrorism](https://uscode.house.gov/view.xhtml?req=%28title%3A22+section%3A2656f+edition%3Aprelim%29) · [Military and Security Developments Involving the PRC, 2025](https://media.defense.gov/2025/Dec/23/2003849070/-1/-1/1/ANNUAL-REPORT-TO-CONGRESS-MILITARY-AND-SECURITY-DEVELOPMENTS-INVOLVING-THE-PEOPLES-REPUBLIC-OF-CHINA-2025.PDF)

**Research note:** the ForecastBench tournament table is a live leaderboard; figures above reflect an index snapshot from late July 2026 and will move. The KEV addition-rate figure (~200/yr) traces to a single third-party audit on an unfamiliar preprint venue and is marked **UNVERIFIED** — read `known_exploited_vulnerabilities.json` directly before quoting it. The DC locality percentage and all burden multipliers are **ASSUMED** and must be replaced with the customer's approved rates. This session's WebSearch budget was exhausted before work began; all verification above was performed via direct fetch and the Exa search backend.