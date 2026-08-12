# CONFLUENCE — Source-Discrepancy Detection and Analytic-Confidence Reconciliation

*Capability concept of operations. Fuses C-TRADECRAFT-1 (Source Conflict Adjudicator) and C-GEO-8 (Contradiction Ledger) onto C-TRADECRAFT-2 (Effective-N) as a structurally enforced upstream dependency. One product, three modes.*

---

## 1. In Plain English

**What it does:** When fourteen reports all say the same thing, this tells you how many of them are actually saying it *independently* — and how much of your confidence you were never entitled to. It then explains *why* two sources disagree about a number, sorting the reason into one of four buckets: they measured differently, they measured at different times, they measured different things, or they genuinely disagree.

**Why it matters:** In 2002 the Intelligence Community's judgment that Iraq had mobile biological weapons labs rested on roughly a hundred reports that turned out to be one man. The Silberman–Robb Commission's exact finding was that the daily reporting "left an impression of many corroborating reports where in fact there were very few sources." Nobody has ever been handed a tool that computes that number before the assessment ships.

**What is new under the hood:** a machine that reconstructs who-got-it-from-whom across a body of reporting, turns that into an *effective* source count with an honest error bar, and uses it to lower — never raise — the confidence line in a finished product. It writes the source paragraph that every analytic product already requires, and it hands the analyst a ranked list of which disagreements in a folder would actually change the bottom line if resolved, and which thirty-seven wouldn't.

**What it deliberately does not do:** it never makes a claim about the world, never names a person, and never says a source is unreliable. It only says which documents descend from which other documents. That restraint is not modesty — it is the reason it can be fielded without anyone having to decide who represents a machine in an interagency coordination meeting.

---

## 2. The analytic question and its resolvable quantity

The capability answers a question class, not a question. Each mode has a distinct resolvable quantity, and all three resolve against a third party's published artifact on a known schedule — the structural selection criterion that separates a track record from a demo.

### Mode N — provenance graph

**Question.** Of the *n* reporting streams asserting claim *c* as of date *T*, how many represent independent origins?

**Resolvable quantity.** `N_eff ∈ [1, n]`, the effective number of independent sources, reported as a posterior mean with a 90% credible interval.

**Partition.** Not a band over `N_eff` directly — bands over the *decision-relevant* consequence: does the corroboration-corrected posterior fall in the same ICD 203 likelihood band as the naive one, one band lower, or two-or-more bands lower? Three outcomes, structurally MECE, structurally scorable.

**Resolution event.** Two kinds. (i) *Constructive*: a published correction cascade. When an originating outlet publishes a wrong figure, *k* outlets repeat it, the originator corrects, and *j* outlets follow the correction, those *j* are provably derivative — the ground truth is written down and dated by third parties. (ii) *Structural*: a documented change in a known dependency graph, e.g. OPEC ceasing to use IEA data as a secondary source as of March 2022, which must produce a break in fitted dependence at a date the model was never told.

### Mode Q — single quantity

**Question.** Given *k* published values of one quantity *Q* with differing metadata, why do they differ, and what is the reconciled value?

**Resolvable quantity.** Two: (i) the winning hypothesis in the four-way partition below; (ii) the reconciled value of *Q* with an interval.

**Partition (MECE by construction over generative mechanisms).**

| | Hypothesis | Generative claim |
|---|---|---|
| **H_M** | Different **measurement** | Same concept, same period, different instrument; a persistent per-source bias |
| **H_D** | Different **date / vintage** | Same instrument, different information set; revision noise that shrinks with vintage age |
| **H_F** | Different **definition** | Different target concept; a deterministic scope offset exists that closes the gap |
| **H_G** | **Genuine dispute** | No offset, no vintage story, no stable instrument bias — irreducible disagreement |

H_G is the **residual**, never the default. Over-declaring H_G is how a data-cleaning problem gets laundered into a "sources disagree" caveat, and the evaluation plan (§7, §8-W9) has a specific falsifier for it.

**Resolution event.** The scheduled convergence artifact: the BLS third preliminary release (+2 months), the BLS annual benchmark (published each February with January first-prints), the OPEC MOMR revision series, the IEA OMR monthly table.

### Mode L — whole folder

**Question.** Across a folder of *D* documents, which contradictions exist, and which of them, if resolved, moves the BLUF's likelihood band?

**Resolvable quantity.** `flip(c) ∈ {0, 1, 2, …}` — band-steps of BLUF movement under the more consequential resolution of contradiction *c*, with `Δp(c)` as the tiebreak.

**Resolution event.** The same third-party artifact that resolves the folder's BLUF, plus post-hoc adjudication of each contradiction against the resolved record.

### As-of discipline — and the leakage vector specific to this capability

The platform already ships as-of corpus retrieval with a hard date filter plus a runtime assertion that throws if any evidence reference in a finished product post-dates the run's as-of date. This capability introduces a subtler vector that the existing assertion must be extended to cover:

1. **Archive capture records are evidence.** The Wayback CDX index returns rows carrying `timestamp`, `digest`, `statuscode`. A row with `timestamp ≥ asOf` is a post-cutoff fact about the document even though the document itself predates the cutoff. **Rule: only CDX rows with `timestamp < asOf` may enter the graph.** The existing assertion extends to CDX rows by treating each row as an evidence reference.
2. **Capture *counts* are aggregates over the future.** "This URL has 40 captures" is a statement partly about the post-as-of period. Only the count of admissible rows may be used.
3. **Corrections are labels, not evidence.** A correction published after as-of proves a pair derivative but is unavailable to the run. **Rule: the label-harvest window must close strictly before the evaluation as-of window opens.** Two disjoint date ranges, both pinned in `corpus.yaml`, both hashed into the run id.

Failing to state (1) and (3) is the most likely way an otherwise-honest evaluation of this capability leaks.

---

## 3. The kernel

### Layer 0 — the claim-instance DAG

**Nodes** are `DocumentInstance | Venue`. A `DocumentInstance` is `(doc_id, claim_id, t_first_observed, venue_id, content_digest, simhash)`. **There is no person node type and no constructor for one** (§13).

**Candidate edges** `u → v` mean "v's assertion of claim *c* descends from u's." Five evidence channels:

1. **Temporal precedence** — `t_u < t_v`. A hard constraint that makes the structure a DAG by construction. Ties resolve to *unknown*, never to a guess.
2. **Verbatim reuse** — exact `digest` match from the CDX index (free), then simhash/minhash Jaccard over shingles, then longest common substring.
3. **Shared error** — the strongest channel and the oldest idea in the document. Two witnesses sharing a *mistake* share an exemplar; two witnesses sharing a *truth* may merely both be right. This is Lachmannian **stemmatics**, applied to news: shared rare tokens, shared wrong figures, shared transliteration variants, shared misspellings.
4. **Explicit attribution** — hyperlink, wire tag, "according to X," byline reuse.
5. **Venue prior** — known syndication and subscription relationships.

### Layer 1 — effective-N, by two estimators that must agree

**Estimator A — Independent Cascade with a seed-set posterior.**

Model: the Independent Cascade of Kempe, Kleinberg and Tardos on a venue graph `G = (V, E, p)` with exponential transmission delays. An observed cascade is the set of venues asserting *c* with their timestamps; the latent object is the seed set `S₀` — venues that asserted *c* without deriving it from any venue in the corpus.

Edge parameters `p̂` are fit **once per corpus** from a large background cascade set, using the closed-form estimator of Chen, Sun, Zhang & Zhang (ICML 2021) — lower sample complexity and verifiable assumptions than the MLE/convex-programming line — with NETINF (Gomez-Rodriguez, Leskovec & Krause, KDD 2010) as fallback and cross-check. Then, holding `Ĝ` fixed:

$$P(S_0 \mid \text{cascade}, \hat{G}) \propto P(\text{cascade} \mid S_0, \hat{G})\,\pi(|S_0|)$$

with `π` a Poisson prior fit to the background corpus. **The sensitivity of the answer to `π` is a required output**, because the prior is the first thing a hostile evaluator will attack.

**The identifiability gate — this is the most important structural fit in the design.** Berenbrink et al. (PMLR v216, 2023) prove that ICM source inference undergoes a phase transition: on *d*-regular trees with `(d−1)p ≤ 1`, *any* estimator fails at weak detection; strong detection requires `(d−1)p = ω(1)`. Chen et al. give the complementary impossibility: a complete graph and a complete-graph-minus-one-edge with `p = 1` are indistinguishable from polynomially many samples.

So there exist regimes where `N_eff` is **provably unrecoverable**, and the theory tells us which ones. PROTEUS already treats `INSUFFICIENT_EVIDENCE` as a first-class verdict with measured true and false abstention rates (80/80 true abstention on a provably unanswerable arm; 7% false abstention at the shipped threshold). **The cascade identifiability threshold maps directly onto an abstention mechanism that already exists and has already been measured.** Below threshold, Mode N returns `INSUFFICIENT_EVIDENCE` on `N_eff`, and Mode Q then refuses to run.

**Estimator B — Kish effective sample size.**

The estimator a branch chief can redo on a whiteboard, which matters as much as the estimator that is theoretically correct. Build the pairwise dependence matrix `R`, `ρ_ij = P(i and j share an origin | evidence)`, and weights `w` from ICD 206 source descriptors:

$$N_{\text{eff}} = \frac{\left(\sum_i w_i\right)^2}{w^{\mathsf T} R\, w}$$

Two degenerate cases, both of which are shipped unit tests:

- `R = I` → reduces exactly to Kish's unequal-weight ESS, $N_{\text{eff}} = (\sum w_i)^2 / \sum w_i^2$.
- `w = \mathbf{1}`, `R` equicorrelated at `ρ̄` → reduces exactly to Kish's design effect, $N_{\text{eff}} = n / \bigl(1 + (n-1)\bar\rho\bigr)$, i.e. `Deff = 1 + (n*−1)ρ` from *Survey Sampling* (1965).

Sixty-year-old survey statistics, deliberately. Novelty in the estimator is worth less here than the ability to walk a supervisor through `1 + (n−1)ρ` in ninety seconds.

**Both estimators run on every question and both are reported.** If they disagree beyond a shipped tolerance, the artifact emits `N_EFF_CONTESTED` and refuses the single-number headline. That is the platform's existing weakest-link discipline applied to a new axis.

### Layer 2 — from N_eff to the posterior, by a rule with an invariant

The naive analyst arithmetic treats *n* streams as *n* independent likelihood ratios. The correction is **not** to reduce each `Λᵢ` — it is to shrink the aggregate log-Bayes-factor by the independence ratio:

$$\log \mathrm{BF}_{\text{eff}} = \frac{N_{\text{eff}}}{n}\sum_{i=1}^{n}\log \Lambda_i$$

The linear-shrinkage form is chosen over the exponent form `Λ^{N_eff}` because it requires no homogeneity assumption across the `Λᵢ`.

**Worked example** (arithmetic, not a measurement):

- *n* = 14 reporting streams asserting a single attribution claim. Per-stream `Λᵢ` ∈ [1.2, 1.6], `Σ log Λᵢ` = 4.111 → naive BF **61:1**. Prior odds 1:1 → **98.4%** → ICD 203 **"almost certain"** (95–99%).
- `N_eff` = **2.3** [90% CI 1.6–3.9]. Equivalently `ρ̄ ≈ 0.39` in the Kish form.
- Shrinkage `2.3/14 = 0.164` → `log BF_eff = 0.675` → BF **2.0:1** → **66.3%** → ICD 203 **"likely"** (55–80%).

**Two bands.** *Almost certain* → *likely*. The sentence the product hands over: **"Your source base supports *likely*, not *almost certain*. The difference is that eleven of your fourteen streams are one stream."**

**Shipped invariant.** Every artifact must satisfy

$$\frac{\log \mathrm{BF}_{\text{after}}}{\log \mathrm{BF}_{\text{before}}} = \frac{N_{\text{eff}}}{n} \pm \varepsilon$$

enforced by `assertOddsShrinkageConsistent`, which sits beside the existing as-of leakage assertion and prevents serialization on violation. This is a real guard, not decoration: any quoted `(n, N_eff, odds-before, odds-after)` tuple that does not satisfy it is arithmetically impossible under the shipped rule, and illustrative tuples in circulation should be checked against it before they enter a brief.

### Layer 3 — N_eff into the ICD 203 **confidence** field, without collapsing it into likelihood

ICD 203 D.6.e.(2)(b) is explicit: a product using a confidence level "must not combine a confidence level and a degree of likelihood, which refers to an event or development, in the same sentence." PROTEUS already enforces the separation structurally — there is no function of type `(Judgment) => number`. The design must not break it.

**The wrong design**, and it is the obvious one: let `N_eff` both shrink the posterior *and* set confidence. That double-counts and collapses the fields.

**The right design — two different objects from the same estimate:**

- **Likelihood** takes the *central estimate* of `N_eff` via the shrinkage rule. `N_eff` is a parameter of the aggregation, so its point estimate belongs in the probability.
- **Confidence** takes the *uncertainty about* `N_eff`, expressed as a weakest-link minimum over named gates — the platform's existing aggregation rule, never a mean:

```
confidence = min(
  gate_identifiability,      // did the cascade fit clear the phase-transition threshold?
  gate_estimator_agreement,  // Kish vs ICM within tolerance?
  gate_neff_precision,       // CI width relative to N_eff
  gate_provenance_coverage,  // share of streams with a recovered first-appearance time
  gate_panel_completeness    // graded, per-technique weighted — see §4
)
```

Each gate emits a named reason string printed beside the field. The generated output is ICD-203-legal in two sentences:

> *We assess it is **likely** that [claim]. We hold **moderate confidence** in this judgment; confidence is capped at moderate because first-appearance timestamps were recovered for only 9 of 14 reporting streams.*

**And a hard constraint: `N_eff` may only *lower* confidence, never raise it.** A clean, well-identified `N_eff` of 12.8 out of 14 does not license "high confidence" — a broad source base says nothing about whether the sources are *right*. Enforcement is type-level: `confidence_final = Floor(confidence_pipeline, confidence_source_base)`, where `Floor` is a monotone non-increasing combinator with no code path that returns a level above its input. Same trick as the absent `(Judgment) => number`.

### Layer 4 — Mode Q's four diagnostic tests

Each hypothesis in the four-way space gets a test with a distinct signature, and the tests become evidence rows in an ACH matrix (§4):

| Hypothesis | Test | Signature that identifies it |
|---|---|---|
| **H_M** | Panel regression of `(xᵢ − consensus)` on source fixed effects across periods | A **significant, stable** source dummy — bias persists |
| **H_D** | Spread as a function of publication lag | Differences **collapse monotonically** with vintage; later vintages nest earlier |
| **H_F** | One-parameter offset/scale fit | Residual after offset ≈ measurement noise; gap **does not shrink with time** |
| **H_G** | Residual | Survives when the other three are scored out |

**Conditional on the winner, the reconciled value:**
- H_F → deterministic (apply the scope offset).
- H_D → "wait", plus the expected terminal value and its revision distribution.
- H_M → bias-corrected precision-weighted mean — **and this is where the hard dependency becomes mechanical.**

### The hard dependency, made unavoidable

Precision-weighted combination of *n* estimates gives `σ_combined = σ/√n`. If two of the six "independent" estimates are the same tanker-tracking feed resold twice, that standard error is wrong. The correct divisor is `√N_eff`:

$$\frac{\sigma_{\text{naive}}}{\sigma_{\text{corrected}}} = \sqrt{n / N_{\text{eff}}}$$

For *n* = 6 secondary sources with `N_eff` = 2.1 → **1.69**. Mode Q's intervals are **69% too tight** without Mode N. That is a number a panel can check on the back of an envelope, and it is the enforcement argument.

**Enforcement in the pipeline, not the README.** Mode Q's config schema requires `sourceIndependence: SourceBaseAssessment`, a type constructible only by Mode N. There is no default, no `null`, and no `{ assumeIndependent: true }`. A Mode Q run whose config lacks a Mode N artifact hash **fails at config parse, before any simulation runs**. And the Mode N artifact hash is folded into the Mode Q `runId` identity — which requires, and therefore forces, the repair of architecture gap #1 (§5).

### Layer 5 — Mode L's band-flip statistic and the correct resampling unit

For each contradiction *c* with resolutions `r ∈ {left, right}`:

$$\mathrm{flip}(c) = \max_r \bigl|\,\mathrm{band}(\mathrm{BLUF} \mid c \to r) - \mathrm{band}(\mathrm{BLUF})\,\bigr|, \qquad \Delta p(c) = \max_r \bigl|\,p(\mathrm{BLUF}\mid c \to r) - p(\mathrm{BLUF})\,\bigr|$$

Rank descending by `flip`, then `Δp`. Contradictions with `flip(c) = 0` are reported but explicitly marked **non-load-bearing** — the honest and unusual output is that most contradictions in a folder do not matter, and saying so is what makes the ones that do matter credible.

**The ensemble is a cluster bootstrap over `N_eff` clusters, not over the *n* documents.** Leaving one document out of a cluster of eleven duplicates changes nothing — which is precisely the failure the whole product exists to correct, and it would be embarrassing to reproduce it in our own resampling. Deterministic under the seeded sfc32 PRNG, so byte-identical artifact hashes hold.

### Architecture class — stated bluntly

**All three modes are estimate-and-adjudicate. None is simulate-and-adjudicate. None is a consequence twin.**

There is no forward dynamical model of the world here. The ensemble varies the *evidence partition and the estimator's nuisance parameters*, not a world state. C-GEO-8's original honesty on this point is a selling point: the deterministic-seed machinery, the abstention gate, the calibration layer, the z-score severity-bias removal, the outlier detection and the full metric suite all apply unchanged to an estimator ensemble.

**The one thing that does not carry over: the two actor knobs.** `riskTolerance` and `escalationPropensity` have no referent in a capability with no actors. This pack **does not bind them** — a clean instance of the known architecture gap (four of six mission lenses re-bound or bypassed the knobs). A lens that declares the knobs inapplicable is more honest than one that pretends to use them, and this ConOps should be the one that says so.

---

## 4. The panel

Five structured analytic techniques, each bound to something specific, each with a rubric that is **pinned pack config — not an LLM-generated system prompt** (see §5 on why that is non-negotiable).

| Technique | What it adjudicates | Rubric, and what must be persisted and hashed |
|---|---|---|
| **ACH** (Heuer diagnosticity, ranked by weighted inconsistency ascending) | Mode Q's four-way space | Evidence rows = the four diagnostic tests of Layer 4. Diagnosticity weights are **per-corpus constants pinned in `ach-matrix.yaml`**, not generated per run — otherwise the weighting is unauditable |
| **Key assumptions check** | The three things Mode N cannot test: (1) the venue graph is the right node set; (2) timestamps are honest; (3) the seed-count prior `π` | Each assumption carries a **required falsifier** (platform already mandates this). Falsifier for (2): *"if ≥5% of sampled first-captures post-date the publisher's own dateline by >48h, the timestamp channel is unreliable and confidence is capped at low"* |
| **Devil's advocate** | Argues the **high-`N_eff`** case — "these look alike because the event was loud, not because they copied" | Scored on whether it names a concrete **non-derivative** mechanism for the shared text: a shared press conference, a shared primary document, a shared statistical release. This adjudicator is the main brake on false circularity |
| **Premortem** | "It is six months later and this assessment caused a bad call" | Must produce **≥1 failure story in each direction** — over-discount and under-discount. A premortem that only imagines under-discounting is rejected by the rubric |
| **Red team** (bounded rerun authority) | The **manufactured-circularity attack**: given the assessment, construct the cheapest injection that moves the band. One rerun of Mode N with the injected document | Output is a **cost-to-flip** number: how many words of plagiarism, in how many venues, move the band one step |

**Cost-to-flip is a spin-off counterintelligence product.** It measures how attackable your own source base is against an adversary who understands the tool. It should be surfaced as a capability in its own right, not buried in the red-team log.

### Panel criticality is graded, not boolean — and this pack forces the fix

The platform currently sets `available: results.length > 0` → `level: adjudicationAvailable ? "high" : "moderate"`. One surviving adjudicator of eight scores identically to a full panel, and partial panel loss is the *normal* operating condition.

CONFLUENCE cannot ship on that. `panel.yaml` carries a per-technique criticality map:

- **Load-bearing:** ACH (adjudicates the hypothesis space) and devil's advocate (the sole brake on false circularity). Losing **either** caps confidence at **low**, regardless of how many others survived.
- **Advisory:** premortem, red team. Losing **both** caps at **moderate**.
- Key assumptions check: load-bearing only when the timestamp-channel falsifier is in a triggered state.

The criticality map is domain config, which is the config-not-code argument made concrete: the same graded-completeness machinery serves every pack, with a different weighting file each time.

---

## 5. The Scenario Pack — config versus new code, honestly

A panel will ask what was actually built. The answer must not be evasive.

### Pure config — YAML in the pack, no new TypeScript

| File | Contents |
|---|---|
| `question.yaml` | Analytic question, resolvable quantity, partition |
| `bands.yaml` | ICD 203 band edges: 01–05 / 05–20 / 20–45 / 45–55 / 55–80 / 80–95 / 95–99 |
| `panel.yaml` | The five techniques, pinned rubrics, per-technique criticality weights |
| `ach-matrix.yaml` | Four hypotheses × four diagnostic tests, per-corpus diagnosticity weights |
| `assumptions.yaml` | Each key assumption with its required falsifier |
| `corpus.yaml` | As-of date, retrieval filter, named corpora, **the two disjoint date windows** (label harvest, evaluation) |
| `baselines.yaml` | B0 naive-*n*, B1 constant-discount, B2 citation-graph-only, B3 published-consensus, B4 persistence |
| `metrics.yaml` | Which platform metrics form the headline set for this question class |
| `thresholds.yaml` | FCR ceiling 0.05, identifiability threshold, A-vs-B tolerance, abstention triggers |
| `regime.yaml` | Mandatory `EvaluationRegime` tag |
| `denominator.yaml` | **Empty slots the customer fills** — products-per-year and hours-per-source-summary-statement (§10) |

### New code — with an honest size estimate

| Module | What it is | Est. LOC |
|---|---|---|
| `sim/provenance/graph.ts` | Claim-instance DAG builder: shingling, simhash/minhash, CDX `digest` join, rare-token co-occurrence, citation extraction. Must pass the existing source-scanner test banning `Math.random` / `Date.now` in `sim/` | 1,200–1,800 |
| `sim/provenance/cascade.ts` | IC parameter fit (Chen et al. closed-form + NETINF cross-check), seeded seed-set posterior sampler, identifiability-threshold check | 600–900 |
| `sim/provenance/effectiveN.ts` | Kish ESS `(Σw)²/(wᵀRw)` + the two degenerate-case tests. Its own tiny module precisely because it needs a test seam | ~80 |
| `sim/reconcile/fourWay.ts` | The four diagnostic tests — ordinary panel regressions and offset fits | 400–600 |
| `sim/reconcile/bandFlip.ts` | Cluster bootstrap over `N_eff` clusters + band recomputation; reuses existing band machinery | ~250 |
| `product/shrinkage.ts` | The shrinkage rule + `assertOddsShrinkageConsistent` | ~120 |
| `product/confidenceFloor.ts` | The monotone non-increasing `Floor` combinator | ~60 |

**Total ≈ 3,000–4,000 new lines** (**ASSUMED** — an estimate, not a measurement).

### Two platform repairs on the critical path — blocking, not nice-to-have

1. **Hash `PanelPlan` into `runId`.** Today the per-adjudicator generated `systemPrompt` is never persisted and never hashed; `runId = computeRunId(identity)` and identity has no panel field, so two runs judged by different generated rubrics share a run id. **A source-provenance capability whose own artifacts have unrecorded provenance will not survive a panel's first question.** This pack is the right place to force the repair, and it is also the pack that most obviously cannot ship without it. Generalize the fix to cover upstream-artifact hashes at the same time, since Mode Q needs to fold the Mode N hash into its identity anyway.
2. **Grade panel completeness.** Replace the boolean with the config-weighted criticality map of §4.

---

## 6. Data

### Unclassified

| Corpus | What it supplies | Access reality |
|---|---|---|
| **BLS CES vintage data + benchmark tables** | Every reference month's 1st/2nd/3rd print and every annual benchmark revision. Vintages from May 2003; total nonfarm reference months back to 1939. Final-vs-preliminary benchmark table runs 1979→2025 | US Gov public domain, direct download (Excel + LABSTAT). Zero friction |
| **OPEC MOMR Tables 5-7 / 5-8** | The same quantity — member crude production in tb/d — under **secondary sources** vs **direct communication**, monthly, per country, for decades | Public via the MOMR archive; parse required. **Redistribution terms UNVERIFIED — check before rehosting** |
| **IEA Oil Market Report OPEC+ supply table** | A third estimate of the same quantity. The IEA committed to publishing its monthly OPEC+ production update publicly after OPEC dropped it as a secondary source | Headline tables public; full OMR is subscription. **Plan around the public tables only** |
| **GDELT 1.0/2.0 Event + GKG** | Global news stream with per-article URLs and timestamps — the venue graph's raw material | **"Unlimited and unrestricted use for any academic, commercial, or governmental use of any kind without fee"**, redistribution permitted with citation. BigQuery or raw CSV (~2.5 TB/yr GKG) |
| **Wayback CDX Server API** | First-capture timestamps and the **`digest` field — a content hash**, giving near-free exact-duplicate detection — plus `statuscode`, `mimetype`. Pagination API for bulk | Public. Rate-limited; some fields access-controlled. Politeness required |
| **Common Crawl** | Historical page text at scale for shingling; URL-time joins | Free on AWS S3 public datasets. CDX endpoint heavily rate-limited — use the columnar/URL index via Athena or Spark, or `cc-downloader`, for bulk |
| **MemeTracker / NETINF ground truth (Stanford SNAP)** | Pre-built who-copies-from-whom cascades with published inferred networks — a ready-made *method* benchmark | Public |
| **Published corrections & retractions** | The labeled-positive engine (below) | Publisher correction pages and Wayback diffs are free. Retraction Watch bulk terms **UNVERIFIED** |

### The two data designs that carry the evaluation

**(a) Corrections are free ground truth.** If an outlet publishes 2.34 mb/d, twenty-two outlets repeat 2.34, the outlet corrects to 2.43, and eighteen follow within 48 hours — those eighteen are *provably derivative*, with timestamps, at zero labeling cost, for as many corrections as the archive holds. Shared **errors** are the ground truth; shared truths are not. The method is a hundred and fifty years old and it costs nothing.

**(b) The March-2022 natural experiment.** OPEC ceased using IEA data as a secondary source as of March 2022. If the estimator measures anything real, fitted dependence between the OPEC secondary-sources aggregate and the IEA series must show a structural break at that date — a date that is **external, publicly documented, and not chosen by us**, and which the model is never told. Pre-register it. It is the single most persuasive validation in the plan, because there is no way to tune toward it without cheating visibly.

**Scale of what is at stake in the oil corpus**, from a dated third-party analysis of Jan–Oct 2024: OPEC's *direct communication* series showed overcompliance averaging 285 kb/d, OPEC's *secondary sources* showed overproduction averaging 206 kb/d, and IEA data showed overproduction averaging 339 kb/d. Across OPEC+ as a group, IEA showed 494 kb/d over quota against OPEC secondary sources' 3 kb/d. Same nominal quantity, opposite sign, three publishers. And the mechanism is documented: a KAPSARC study of the secondary-source methodology found that "many of the secondary sources consult each other before coming up with their numbers, raising the risk of unintended convergence or falling victim to anchoring bias… rather than being a set of discrete estimates, they all exist within something of an echo chamber." **A published, named, dated instance of circular reporting in a public dataset, with an independently documented structural break in its dependency graph.** There is no better validation corpus available outside the fence.

### Classified — see §9.

---

## 7. Oracle and evaluation plan, across all three regimes

Every report carries a mandatory `EvaluationRegime` tag and **no function pools regimes**.

### Regime 1 — `synthetic_oracle`

Generate cascades from a known ICM on a known venue graph with a known seed set. Sweep *n*, true `N_eff`, `ρ̄`, graph density (**across the identifiability threshold**), timestamp noise, and adversarial injections.

Measures: `N_eff` bias and RMSE; FCR; MCR; full ROC; true and false abstention rates; and **threshold calibration** — does the system abstain exactly where the theory says it must?

**Negative control.** A deliberately misspecified arm (wrong prior `π`, wrong node set) must score **worse than the constant-discount baseline**. The platform has already demonstrated it can produce a negative control that scores worse than base rate (−0.4561 Brier skill, coverage@1 0.123); the machinery exists and the discipline transfers.

### Regime 2 — `historical_backtest`

**BLS.** As of the first print, predict (a) the sign and magnitude of the third-print revision, (b) the sign of the annual benchmark revision. Resolution: the third preliminary release at +2 months, and the February benchmark release.

**The honest caveat, in BLS's own words: "The benchmark revision is the difference between two independently derived employment counts, each subject to its own error sources."** The benchmark is a better estimate, not truth. A panel that knows CES will distrust anyone who calls it truth.

Calibration anchors from the published record: absolute mean revisions 1979–present (seasonally adjusted) are 41k for 2nd−1st, 31k for 3rd−2nd, 56k for 3rd−1st; from 2003 forward, 33k/34k/51k. Over the last ten years the annual benchmark revision has averaged 0.2% in absolute terms, range <0.05% to 0.4%. The March 2025 benchmark was −898k SA / −862k NSA, published 11 February 2026.

**A baseline the system must beat, and it is not trivial.** In 2023, 2024 and 2025 the *final* benchmark revision was less negative than the *preliminary* by +119k, +220k and +50k respectively. A persistent-direction base-rate baseline exploits that. If CONFLUENCE cannot beat it, say so.

**OPEC/IEA.** As of month *t*, given *k* source estimates of country *c*'s production, predict the value the OPEC secondary-sources series converges to after revision, and classify *why* the estimates differ against hand-labeled cases.

### Regime 3 — `live_post_cutoff`

Pre-register before the print, on quantities with a third party's published artifact on a known schedule: the next CES release (monthly, dated), the next MOMR (second week, monthly), the next IEA OMR (second week, monthly), the next EIA STEO.

At measured platform cost ($0.2959 at 9 calls; $0.7544 at 17 calls with red-team rerun), a **12-month live track across three series costs roughly $27 in inference.** A published, pre-registered, dated track record for the price of a lunch is a structural advantage and should be stated as such.

### Pre-registered questions (frozen and hashed before the as-of date)

1. For CES reference month *M*, will the third print revise total nonfarm by ≥ +25k, within ±25k, or ≤ −25k versus the first print? *(three bands, structurally MECE)*
2. For the March-2026 benchmark (published February 2027), will the final revision be more negative than the preliminary?
3. For OPEC member *c* in month *t*, will the OPEC secondary-sources figure and the IEA figure differ by more than 100 kb/d — and if so, which of {H_M, H_D, H_F, H_G} dominates?
4. Does fitted dependence between the OPEC secondary-sources aggregate and the IEA series break at March 2022?

### Baselines, named

| | Baseline | Why it is there |
|---|---|---|
| **B0** | Naive independence, `N_eff = n` | The status quo |
| **B1** | **Constant discount**, `N_eff = n/c` for the best fixed *c* fit on training data | **The baseline that matters.** If the graph machinery cannot beat a constant divisor, the graph is theatre |
| **B2** | Citation-graph only — derivative iff an explicit link or attribution exists | Cheap, widely deployed, and blind to laundered copying |
| **B3** | Published consensus — median of the *k* estimates, no reconciliation | The status quo in Mode Q |
| **B4** | Persistence | For the revision questions |
| — | INFER / Metaculus / ViEWS where a matching public question exists | Per the standing rule against ever backtesting on the customer's own analytic calls |

### The honest headline metric for this question class

**Not Brier.** Brier scores a probability about the world; this capability makes claims about the *source base*, and its value is that it moves a band in the right direction.

> **Headline: band-movement accuracy — of the assessments where the system changed the ICD 203 likelihood band, the fraction that moved *toward* the resolved outcome — reported jointly and always with the fraction of assessments changed at all.**

Two numbers, never one. A system that changes nothing has perfect direction and zero value. A system that changes everything is a random-number generator.

**Secondary headline: ΔBrier attributable to shrinkage** — Brier of the post-shrinkage forecast minus Brier of the naive-independence forecast on the same questions. That isolates *this capability's* contribution rather than the platform's.

**And a deliberate, stated trade.** Removing unearned confidence improves the **reliability** term of the Murphy decomposition (which the platform already computes) while typically *reducing* **sharpness**. That is the intended direction and it must be reported as such. A panel that knows Murphy will check whether we understand we are trading sharpness for reliability. We are, deliberately.

### The false-circularity rate as a co-equal reported metric

**Why over-declaring circularity is not a safe error.** Three reasons, and the second is the one that should worry a program office most:

1. **It deletes real corroboration.** Posteriors shrink toward the prior, assessments drift toward "roughly even chance," and the product becomes uninformative in exactly the cases where it should be decisive.
2. **It is an adversary attack surface.** An adversary who knows the system penalizes textual similarity can **manufacture false circularity** — have a cut-out plagiarize a genuine independent report, and the genuine report gets discounted. Cheap, deniable, and it attacks the system along its designed axis.
3. **It creates a perverse collection incentive** — suppress reporting that resembles other reporting. The opposite of what collection is for.

**Definitions, reported on every artifact:**

- **FCR** = FP / (FP + TN) — the false-positive rate **on genuinely independent pairs**. Reported instead of precision, because the base rate of independent pairs is high and precision hides it.
- **MCR** = FN / (FN + TP) — missed circularity. The Curveball error.
- **`N_eff` bias** = E[N̂_eff − N_eff^true], and **`N_eff` RMSE**, on synthetic cascades with known seed sets.

**Shipped asymmetric operating point: FCR ≤ 0.05.** MCR is whatever it is at that point, and is published. The rationale goes in the ConOps, not a footnote: *the system's job is to remove unearned confidence, and a tool that removes earned confidence will be switched off the first time it does.* Reviewers are told the direction of the thumb on the scale and the number it is set to.

**Third co-equal metric — directional harm.** Of the runs that changed a band, what fraction moved it toward the resolved truth versus away? On BLS and OPEC the truth is known, so this is directly measurable, and it is the only metric that can distinguish a working system from a constant discount with good FCR.

---

## 8. The 90-day unclassified demonstration

Thirteen weeks. Every week names what is shown, what number comes out, and what would falsify it.

| Wk | What is shown | The number | What falsifies it |
|---|---|---|---|
| **1–2** | Claim-instance DAG over a frozen GDELT + Wayback slice for one topic family (OPEC production reporting), hard as-of filter | Fraction of claim instances with a recovered first-appearance timestamp | **<70% recovery** → Mode N cannot run on open news; the pack must retarget to corpora with native provenance |
| **3** | **Platform repairs.** `PanelPlan` hashed into `runId`; graded panel completeness | The run-id collision test flips from failing to passing; a 1-of-8 panel no longer scores as 8-of-8 | Hashing the panel plan breaks artifact determinism → the reproducibility claim is in question and **everything stops** |
| **4–5** | `N_eff` on the synthetic oracle; ROC across the identifiability sweep | FCR and MCR at the 0.05 operating point; abstention rate as a function of `(d̄−1)p̂` | The system does **not** abstain below the theoretical identifiability threshold → the abstention gate is decorative |
| **6** | Labeled corrections corpus: published corrections + Wayback diffs | Corpus size — target ≥2,000 labeled derivative pairs, ≥20,000 labeled independent pairs | Corrections cannot be harvested at scale → real-data FCR is unmeasurable, and only the synthetic number exists, **labelled as such forever** |
| **7** | **GO / NO-GO.** Head-to-head against B1, the constant discount | `N_eff` RMSE, ours vs B1 | **B1 wins → ship the constant divisor and cancel the graph.** Stated in advance, in this document, on purpose |
| **8** | The March-2022 natural experiment | Estimated break date and its CI, versus true March 2022 | No break detected, or a break at a date with no external explanation → the estimator is fitting noise |
| **9** | Mode Q four-way classification on CES, where all print-to-print differences are H_D **by construction** | Confusion matrix over {H_M, H_D, H_F, H_G}; specifically the **H_G false-positive rate** | **H_G false positives >10%** → the residual hypothesis is absorbing model failure, the exact pathology the design forbids. Kills the release |
| **10** | Mode Q on OPEC, with and without the Mode N divisor | Interval-width ratio `√(n/N_eff)` and the resulting empirical coverage | Naive intervals **already achieve nominal coverage** → the hard dependency is not load-bearing and the architecture argument collapses |
| **11** | Mode L on a real multi-document folder (the public record on one OPEC compliance dispute) | Fraction of contradictions with `flip(c) = 0` | Nearly **all** contradictions flip the band → the sensitivity statistic does not discriminate and the ranking is noise |
| **12** | Red team: cost-to-flip | Words of plagiarism × venues required to move the band one step | Trivially low (one 200-word repost in one venue) → the operating point is too aggressive; tighten FCR before any fielding |
| **13** | Live pre-registration frozen and hashed; **one complete Source Base Assessment end to end** on a real question | Artifact hash; the two-sentence ICD-203 likelihood/confidence pair; the ranked ledger; measured cost and latency; abstentions | The assessment cannot be produced without a human editing the output → the artifact is not actually machine-generated |

**What the demonstration does not claim, and must never be reported as claiming:** accuracy against classified reporting; comparison to a human analyst; contradiction detection on real intelligence prose; historical backtest accuracy or live post-cutoff accuracy beyond what the pre-registered track has actually resolved. All are on the platform's standing NOT-MEASURED list and stay there.

---

## 9. The classified instantiation

### What changes — and it gets *easier*, which is the counterintuitive point

Claim instances become **serialized report bodies with native, trustworthy provenance**: originator, collector, report serial, date-of-information versus date-of-report, and the ICD 206 source descriptor. Timestamp recovery goes from an estimated ~70% on open news to essentially 100%. **The single largest technical risk in the unclassified version — timestamp poisoning — largely disappears behind the fence.**

The dependence edges gain a channel the open version cannot have: **liaison relay chains** and **sub-source chains inside a single HUMINT report**. That is precisely the Curveball topology — a foreign service debriefs, DIA's Defense HUMINT Service disseminates as a self-described "conduit," and *n* agencies cite the dissemination. The WMD Commission found that on mobile BW facilities Curveball provided approximately **100 detailed reports** while the second and fourth sources provided **one report each**, and the whole was presented as attributable to "multiple sensitive sources." The Commission's conclusion is the product specification: *"A more accurate presentation would have allowed senior officials to see just how narrow the evidentiary base for the judgments on Iraq's BW programs actually was."*

ICD 206 source descriptors become the `w` weights in the Kish ESS. The formula does not change; the inputs get better.

### What the classified version adds

1. **Recall propagation.** The Commission found there was no uniform requirement to reissue or recall reporting from a source later shown to be fabricating — and that a source deemed a fabricator in May 2002 nonetheless reached the October 2002 NIE. Given the provenance DAG, a recall is a **reachability query**: which disseminated judgments have a path from the recalled report? Output: a dated list of products to re-derive, ranked by band-flip. That is a workflow product with a signature block, and it exists only because the graph exists.
2. **Cross-INT independence.** SIGINT and HUMINT reporting on the same event are treated as independent by default. They are not when the HUMINT sub-source's access *is* the SIGINT-collected channel. The graph makes that testable rather than assumed.
3. **Cost-to-flip as counterintelligence.** How cheaply could an adversary manufacture apparent corroboration inside our own holdings?

### The accreditation obstacle, named precisely

The obstacle is **not** the classification of the data — that is what the REASON contracting pattern solves. The obstacle is that this capability's outputs are assertions about specific reporting streams, and therefore sit adjacent to source protection and asset-validation equities.

- **The schema has no person nodes** — enforced by a validator that rejects the artifact, not by a policy note (§13). Structurally, the system *cannot* output "source X is unreliable"; it can only output "these two report instances share an origin."
- **The IT authorization path.** CIA's February 2026 Acquisition Framework — centralized vendor vetting, a streamlined IT authorization process, and explicit pathways to onboard breakthrough technology prototypes — is the named on-ramp. The concrete ATO argument is architectural: a deterministic, offline kernel with `Math.random` and `Date.now` banned in `sim/` and enforced by a source-scanning test is a far cheaper accreditation object than a system that calls a model at inference time. **Design implication: push as much of the pipeline as possible into the deterministic kernel and as little as possible into the LLM adjudicators, and report the split as a percentage** — that percentage is the accreditation cost driver, and it belongs in the proposal.
- **The contracting pattern is IARPA REASON's, and determinism makes it cheaper than it has ever been.** REASON Phase 1 tests performer systems comprehensively on unclassified data while the independent T&E team retrains and evaluates on classified draft reports and classified source reports in parallel; Phase 2 tests on classified data. Byte-identical seeded artifacts add something new to that pattern: **the cleared T&E team can verify that the classified-side run and the unclassified-side run used the same code and the same config by comparing hashes, without transmitting any content in either direction.** That is the strongest single technical argument for this contracting model and it should lead the transition discussion.

---

## 10. Buyer, workflow displacement, and the analyst-hour denominator

### The dated artifact with a signature block

**The source summary statement.** ICD 203 D.6.e.(1) requires products to describe the quality and credibility of underlying sources using ICD 206 descriptors, and states that source summary statements "are strongly encouraged and should be used to provide a holistic assessment of the strengths or weaknesses in the source base and explain which sources are most important to key analytic judgments."

That is a paragraph an analyst writes, an editor reviews, and a signature block covers, in every disseminated analytic product. **It is the exact paragraph this capability generates.** Not a standalone probability for a senior policymaker with no home in IC production — a required paragraph in an existing product with an existing review chain.

**Second landing zone:** the ICD 203 product-evaluation program. ICD 203 requires that "each IC element shall maintain a program of product evaluation using the IC Analytic Standards as the core elements for assessment criteria." Sourcing is standard 1 of 9, and — not coincidentally — sourcing is the first of the six standards in REASON's Report Quality Score. A tool that improves the sourcing paragraph is scoring against a rubric the customer already runs.

### Workflow position

CONFLUENCE runs **before the product goes to coordination**. Its output is an input to drafting, not a competitor to the draft. That is what makes §11's adoption argument work.

### The analyst-hour denominator — surviving the branch chief's first question

The branch chief's first question is not *"is it accurate?"* It is **"whose hours does this replace, and were those hours being spent?"**

The wrong answer is "it saves analysts reading time." The right answer names the task, its owner, and its duration — and admits what we do not know.

- **The task:** drafting the source summary statement and the sourcing-related portions of a finished product, plus the pre-coordination check of whether apparently-corroborating reports are actually independent.
- **The denominator:** *(finished products requiring a source summary statement, per office, per year)* × *(hours per statement)*. **Both numbers are held by the customer, not by us.** We do not have a published IC figure for hours-per-source-summary-statement and **we will not invent one (UNVERIFIED).**
- **What we ship instead of a number: an instrument.** The pack contains `denominator.yaml` with two empty slots the customer fills with its own figures. The 90-day demo instruments the same task on unclassified analogues to give a reference range. The resulting ratio is *their* arithmetic.
- **Why a slot beats an estimate.** A fabricated hours figure is the single easiest thing for a branch chief to reject, and rejecting it discredits everything else in the document. A slot leaves only one disputable term, and it is theirs.
- **The number we can put on our side, measured:** **$0.2959 per question at 9 model calls; $0.7544 at 17 calls with a red-team rerun. Latency 5m54s and 8m12s respectively.** One Source Base Assessment costs **under a dollar and finishes inside nine minutes.** Any hours-per-statement figure above roughly four minutes of loaded GS-13 time makes the ratio favourable — and four minutes is below any plausible value. That is the honest way to say *the cost side is not the constraint* without inventing the other side.
- **What is not displaced, stated plainly:** the analyst still writes the judgment, still owns the product, still coordinates it. What is displaced is the reconstruction of who-got-it-from-whom — currently done by memory and habit, if at all. The Commission's finding is that in the highest-stakes case on record, it was not done at all.

---

## 11. Why this capability never enters interagency coordination — and why that is the adoption argument

The landscape sweep's finding stands: IC finished intelligence is coordinated across agencies, and nothing in sixty candidates says who represents a machine judgment in a coordination meeting or who takes the dissent footnote.

**CONFLUENCE dodges the problem structurally, not rhetorically.**

- *"These eleven reports share an origin"* is a claim about **documents**. It is checkable by anyone holding the documents. It is not an analytic judgment, so it has no dissent footnote — **there is no agency position on whether two documents share an exemplar.** DIA does not maintain a house view on textual descent.
- Contrast: *"Iran is likely to escalate"* is a judgment. It belongs to an agency, an agency can dissent from it, and someone must sit in the room and own it. That is the coordination problem no candidate solves.
- **The distinction is enforced in the type system, not asserted in prose.** Output types are `SourceBaseClaim` (about documents; checkable; requires no coordination) and `BandRecommendation`. **`WorldClaim` is not in the pack's output union.** The only world-facing act is *shrinking a judgment the analyst already owns* — and the shrunken band goes back to that analyst with a required `acceptedBy` field and a recorded override reason.
- **Consequence for adoption:** nobody has to decide who represents the machine, because the machine never speaks in the meeting. The analyst walks in with a better source paragraph and a defensible answer to *"how many independent streams is this really?"* — a question that gets asked in coordination meetings today and answered from memory.

**The second-order adoption argument, which matters more than the first.** This is the one capability where being *wrong is cheap and visible*. If it says two reports share an origin and they don't, an analyst who knows the account sees it immediately and says so. That is a fast, local, low-stakes feedback loop — the opposite of a forecasting tool whose errors resolve in eighteen months. **Capabilities with fast local feedback get adopted; capabilities with slow global feedback get piloted forever.**

---

## 12. Benefit-category mapping

| | Claim strength | Mechanism |
|---|---|---|
| **(c) Quality assurance — identify discrepancies between sources and reconcile differences in overall analytic confidence** | **Strong. Claim this one hard.** | Word-for-word the capability. Mode L enumerates discrepancies at folder scale and ranks them by band-flip. Mode Q adjudicates *why* over a MECE four-way generative space instead of reporting "sources disagree." Mode N reconciles analytic confidence by making the corroboration count an *estimated quantity with an interval* instead of an unexamined integer, feeding the ICD 203 confidence field through a monotone floor that can only lower it |
| **(a) Efficiency and accuracy** | **Narrow, and must be stated narrowly** | The system does not make the analyst's judgment about the world more accurate. It removes one specific, measurable, **directional** error — over-counting corroboration — whose effect on the ICD 203 band is computable. Measured as band-movement accuracy and ΔBrier-attributable-to-shrinkage. Efficiency: **<$1 and <9 minutes per assessment, measured** |
| **(b) Reduced time to analyze / better prediction accuracy** | **Partial — and the accuracy half must be qualified** | *Time:* the who-got-it-from-whom reconstruction goes from unbounded-and-usually-skipped to nine minutes. *Accuracy:* claimable **only through calibration, not sharpness.** Removing unearned confidence improves the reliability term of the Murphy decomposition while typically *reducing* sharpness. That trade is deliberate and is reported |
| **(d) Cost reduction by automating repetitive analysis** | **Strong on automation; the denominator is the customer's** | The strongest genuine automation case in the set, because the displaced task is genuinely repetitive, genuinely mechanical, and genuinely skipped today. We claim the numerator ($0.2959–$0.7544, measured) and ship the instrument for the denominator (§10) |

---

## 13. Red lines — with structural enforcement, not policy notes

| # | Red line | Enforcement mechanism |
|---|---|---|
| 1 | **No person nodes, ever** | Node type is a discriminated union of `DocumentInstance \| Venue`. There is **no constructor for a person**. A validator rejects any artifact whose node table contains a field matching a name/selector/identifier pattern, and the artifact does not serialize — same family as the existing as-of leakage assertion that throws on any post-cutoff evidence reference |
| 2 | **No claims about source reliability — only about source descent** | Output type `SourceBaseClaim` has exactly two constructors: `SharesOrigin(a, b, p)` and `EffectiveN(n, interval)`. There is no `Unreliable(source)` constructor, and the word does not appear in any template |
| 3 | **The system cannot emit a judgment about the world** | `WorldClaim` is not in the pack's output union. `BandRecommendation` carries a required `acceptedBy` field that only a human action populates. The artifact is invalid without it; there is no default |
| 4 | **Confidence can only be lowered, never raised** | The `Floor` combinator is monotone non-increasing by type; a property test asserts it over all level pairs |
| 5 | **No US-person targeting** | Structurally moot: there are no person nodes and the corpora are published documents. Stated as an **absence of surface**, not as a promise |
| 6 | **Never backtest against the customer's own historical analytic calls** | Every report requires an `EvaluationRegime` tag and no function pools regimes. The pack ships only public-baseline configs; a customer-call corpus has no valid regime tag to receive |
| 7 | **Domestic-media application is out of scope** | Enforced only by **visibility**: corpus config is hashed into the run id, so a run against a domestic-outlet corpus is a *different, visibly different* run id. **This is the weakest enforcement on the list and it is labelled as such rather than dressed up.** Visibility is what is on offer here, not prevention |

---

## 14. Failure modes

### Technical

1. **Timestamp poisoning.** The entire DAG hangs on temporal precedence. Backdated posts, CDN republication times, CMS re-dating, and archive first-capture lag all corrupt edge direction. *Mitigation:* three independent timestamp channels (dateline, CDX first capture, GDELT first-seen) with disagreement **surfaced as a confidence gate, never silently reconciled**. *Residual risk: real.* Largely disappears in the classified instantiation.
2. **Identifiability failure.** Below the cascade phase transition, no estimator recovers the seed set. *Mitigation:* abstain. *Residual risk:* a large fraction of real-world questions may fall below threshold, giving low **coverage** even with high accuracy where the system speaks. **Coverage@N is therefore a headline metric, not a footnote.**
3. **Manufactured circularity.** Cheap, deniable, and it attacks the system along its designed axis. *Mitigation:* the red team's cost-to-flip number and a conservative FCR ceiling. *Residual risk:* an adversary who reads this document knows exactly what to do. That is a cost of writing an honest ConOps and it is worth paying.
4. **H_G absorbing model error.** If H_M, H_D and H_F are mis-specified for a domain, "genuine dispute" wins by default — which sounds sophisticated and is actually a modelling failure. *Mitigation:* the W9 falsifier — H_G false positives above 10% on CES, where the truth is known to be H_D, kills the release.
5. **Common cause without copying.** Twelve outlets attending the same press conference are not derivative but look derivative on every textual feature. This is the devil's advocate's job and the dominant driver of FCR. *Mitigation:* event-anchor features as an explicit **third** state alongside independent and derivative. *Residual risk:* "both copied the press release" versus "both attended the press conference" may be genuinely undecidable from text.
6. **Beaten by a constant.** Week 7. If B1 wins, ship B1 and cancel the graph.

### The honest worst case

**Not that the system is wrong — that it is right, quiet, and ignored.**

It correctly reports `N_eff = 2.3`. The analyst notes it. The branch chief keeps "we assess with high confidence." The paragraph the tool wrote is edited back into the paragraph the office always writes, because the incentive gradient in finished intelligence runs toward confident language. In that world every metric in §7 is green and the capability has zero effect.

**The only defence is workflow position and instrumentation.** The assessment lands *before* coordination; the band recommendation carries a required `acceptedBy` and a recorded override reason; **and the override reasons are themselves a dataset the office can review.** If nobody ever accepts a shrinkage, that is a finding about the institution, and it should be reported rather than hidden.

**The second worst case is more corrosive:** the system over-declares circularity on a genuinely corroborated stream, an assessment is softened, the event happens, and the tool is blamed for the miss. That asymmetry is the *reason* for the FCR ceiling, and it should be presented as the reason — not as a technical footnote after the fact.

---

## 15. TRL — two columns

| | **Platform (PROTEUS engine)** | **Domain pack (CONFLUENCE)** |
|---|---|---|
| **Now** | **TRL 4.** 659 tests passing / 4 skipped, verified this session. Deterministic seeded kernel, byte-identical artifact hashes. Abstention gate with measured true/false rates. Five-technique panel. Calibration and full metric suite. Measured live cost and latency. **Two named architecture gaps open:** panel plan not hashed into run identity; panel loss boolean, not graded | **TRL 2.** Formulation only. The four-way hypothesis space, the Kish/ICM composition, the shrinkage rule, the confidence floor and the band-flip statistic are **specified in this document and not implemented**. No provenance graph builder exists. **No number in §7 has been produced** |
| **At 12 months** *(assuming the demo clears W7 and a follow-on is funded)* | **TRL 5.** Both gaps closed and regression-tested. Graded panel completeness. Upstream-artifact hashes in run identity. Validated in a relevant environment via the unclassified demonstration | **TRL 4.** Component validated in lab: synthetic-oracle `N_eff` RMSE and FCR published; corrections-corpus FCR published; March-2022 break test run; Mode Q four-way confusion matrix on CES published; one live pre-registered track under way. **Not TRL 6** — no classified instantiation, no operational-environment validation |

The landscape sweep's own finding is that TRL gets inflated by counting the platform instead of the domain pack. This should be the document that visibly does not do that.

---

## 16. Cost model

Built from the platform's **measured** figures. Where a figure is transferred rather than measured on this pack, it says so.

| Item | Figure | Basis |
|---|---|---|
| One assessment, full panel, no red-team rerun (~9 model calls) | **$0.2959, 5m54s** | Measured live on the platform, on a different pack. **ASSUMED transferable** — the panel is the same five techniques and call count is what drives cost |
| One assessment with red-team rerun (~17 calls) | **$0.7544, 8m12s** | Measured live |
| Kernel scale | **15,832 simulations in 305 s** | Measured. Mode L's cluster bootstrap at B = 1,000 sits well inside this — **the kernel is not the cost; the adjudicators are** |
| 90-day demo inference | **≈ $300** | ~400 adjudicated assessments across W4–W13 at ~$0.75. **The demo's cost is labour, not compute**, and the ConOps says so rather than padding a compute line |
| 12-month live pre-registered track | **≈ $27** | 3 series × 12 months × ~$0.75 |
| **Not included, and named** | — | Corpus engineering (Common Crawl / GDELT storage and compute), the labeled-corrections harvest, cleared T&E on the classified side, and accreditation. **These dominate total cost and none of them are inference costs** |

---

## 17. The missing sibling — coordination-comment adjudication (Mode C)

*Both judges named it; nobody proposed it. Here it is, with an honest verdict.*

### The math transfers exactly — and the metadata is better

A corpus of forty interagency comments from six agencies is a provenance DAG with **cleaner metadata than any news corpus**: authored, timestamped, agency-attributed, threaded, and frequently explicitly referential ("concur with State's comment on para 4"). The four-way space maps cleanly:

- **H_M different measurement** → different **collection posture**. Two agencies disagree because they are looking through different instruments at the same thing.
- **H_D different date** → one comment rests on an earlier cut of the reporting.
- **H_F different definition** → the agencies are using the same word for different concepts. **Probably the largest real category, and the most valuable to name** — it is the "inferred versus synthesized" problem in policy form, and today it is resolved by an hour of meeting time.
- **H_G genuine dispute** → an actual analytic disagreement that deserves a dissent footnote. Isolating the real ones from the definitional ones is the whole value.

And the effective-N observation is, if anything, sharper: **six agencies submitting forty comments is not forty independent views. It is at most six, and usually fewer, because agencies caucus before the meeting.**

Plus a statistic the source version has no analogue for: **band-flip over comments** — which three of forty, if adopted, move the BLUF? The other thirty-seven are style. That is directly actionable in a meeting that is already on the calendar.

### Verdict: better *value*, worse *product*, and it must not go first

**For:**
1. Coordination is the acknowledged bottleneck, and the sweep found **nothing** in sixty candidates addressing it. No competitor.
2. Clean metadata kills the two worst technical risks — timestamp poisoning and identifiability failure largely vanish.
3. It lands on an even more dated, more signed artifact: the coordination record itself.
4. Band-flip over comments is immediately actionable.

**Against — and these are decisive for sequencing:**

1. **The corpus does not exist outside the fence.** There is no unclassified analogue of an interagency coordination record carrying real equities. **No demo, no public oracle, no 90-day unclassified demonstration** — which is the entire de-risking mechanism this bid rests on. The plausible substitutes (IETF working-group last-call threads, IPCC review comments with author responses, notice-and-comment rulemaking dockets, Cochrane peer-review threads) are structurally similar and genuinely useful for *method* development, but a panel will correctly observe that none carries equities, and equities are what make coordination hard. *(IPCC review-comment corpora are the most promising of the four; whether they are complete and machine-readable enough to serve is **UNVERIFIED** and worth checking.)*
2. **It destroys the adoption argument that makes the source version safe.** The source version never enters coordination because it makes claims about **documents**. A comment adjudicator makes claims about **agencies' positions** — "State's and DIA's comments are not independent"; "this is a definitional dispute, not a substantive one." Those are claims about colleagues, they are political, and someone must own them in the room. **The exact problem the source version dodges is the comment version's core.**
3. **It reads as surveillance of the coordination process.** The first office that feels graded by it stops writing candid comments. That is a real institutional risk with no technical mitigation.
4. **Person-adjacency.** Comments are authored. The no-person-nodes red line is far harder to hold when the node *is* a named drafter's comment, even if only the agency is stored. Agency-level aggregation is possible, but the raw data is person-linked, which changes the handling posture entirely.

### Recommendation

**Build it as CONFLUENCE Mode C, sharing the entire kernel — and sequence it second, gated on the source version having been fielded and trusted.** Its 90-day demonstration cannot exist, so it must ride the classified instantiation, which makes it a Phase-2 item. Pitch it in the white paper as the named follow-on **with its political risks stated in our own words** — a program office that watches you name the risk yourself will believe the rest of the document more.

**One design change worth proposing now, because it materially reduces the political risk:** Mode C should output the four-way classification and the band-flip ranking, but **never an effective-N over agencies.** The N-over-agencies number is the one that reads as *"your colleagues don't count."* The classification and the flip ranking are pure service to the drafter. **Drop the number that makes it a weapon, and it becomes a tool.**

---

## Claim ledger

**CONFIRMED this session, with citation:** REASON's task areas, metrics, RQS definition and phase structure; ICD 203's likelihood bands, the confidence/likelihood separation rule, and the source-summary-statement language; the WMD Commission's Curveball findings and the "many corroborating reports / very few sources" language; BLS CES revision magnitudes, benchmark history and vintage-data availability; the OPEC secondary-sources / direct-communication structure, the documented echo-chamber finding, and the March 2022 IEA delisting; Kish's design effect and effective sample size; the Independent Cascade model, NETINF, and the ICM source-inference phase transition; GDELT, Common Crawl and Wayback CDX licensing and access terms.

**MEASURED on the platform, cited as such:** 659 tests passing / 4 skipped; same-seed byte-identical artifact hashes; live cost $0.2959 (9 calls) and $0.7544 (17 calls); latency 5m54s and 8m12s; 15,832 simulations in 305 s; abstention 80/80 true and 7% false at the shipped threshold; negative-control Brier skill −0.4561 at coverage@1 0.123.

**ASSUMED, labelled in place:** the ~3,000–4,000 LOC estimate; the transferability of measured per-question cost to this pack; the ~70% timestamp-recovery target; the FCR ≤ 0.05 operating point as the right ceiling.

**NOT MEASURED, and never to be reported otherwise:** any `N_eff` accuracy figure, any FCR or MCR figure, any band-movement accuracy, historical backtest accuracy, live post-cutoff accuracy, skill versus a human analyst, contradiction detection on real intelligence prose. **No number in §7 exists yet.**

**UNVERIFIED:** OPEC MOMR redistribution terms; Retraction Watch bulk-access terms; IPCC review-comment corpus completeness and machine-readability; any specific commercial vendor's current provenance/claim-matching roadmap; any IC figure for hours per source summary statement.

---

### Sources

- [IARPA REASON program page](https://www.iarpa.gov/research-programs/REASON) · [REASON BAA W911NF-23-S-0007 (full text, TA definitions and metric targets)](https://arl.devcom.army.mil/wp-content/uploads/sites/3/2023/04/W911NF-23-S-0007-REASON-BAA-Final-17-March-2023.pdf) · [REASON BAA Amendment 2 Q&A (RQS six standards confirmation)](https://www.iarpa.gov/images/PropsersDayPDFs/REASON/REASONBAA-Amendment2-QandA.pdf) · [Army/IARPA REASON BAA release, 20 Mar 2023](https://intelligencecommunitynews.com/army-iarpa-release-reason-baa/)
- [ICD 203, Analytic Standards (full text, incl. likelihood table and D.6.e.(2)(b))](https://fab.industries/docs/2025/icd-203.pdf) · [ICD 203/206/208 compilation](https://www.bmbs.org/salamanca/readings/ODNI_ICDs_203-206-208.pdf) · [ODNI on the nine tradecraft standards](https://www.intelligence.gov/mission/our-values/objectivity)
- [WMD Commission (Silberman–Robb) report, 31 Mar 2005](https://www.govinfo.gov/content/pkg/GPO-WMD/pdf/GPO-WMD.pdf) · [Chapter One: Iraq case study](https://www.govinfo.gov/content/pkg/GPO-WMD/pdf/GPO-WMD-1-6.pdf) · [Appendix B, BW findings](https://irp.fas.org/offdocs/wmd_appb.pdf) · [BW excerpt: ~100 Curveball reports vs one each](https://nsarchive2.gwu.edu/NSAEBB/NSAEBB234/WMD_report_excerpt.pdf)
- [BLS CES revisions between over-the-month estimates, 1979–present](https://www.bls.gov/web/empsit/cesnaicsrev.htm) · [BLS CES National Benchmark Article](https://www.bls.gov/web/empsit/cesbmart.htm) · [BLS CES technical notes, Table 5 preliminary vs final benchmark 1979–2025](https://www.bls.gov/web/empsit/cestn.htm) · [BLS CES vintage data information](https://www.bls.gov/web/empsit/cesvininfo.htm)
- [OPEC MOMR archive, Tables 5-7 / 5-8](https://publications.opec.org/momr/archive/chapter/114/1823) · [KAPSARC, "OPEC Oil Production Data: The Role of Secondary Sources" (echo-chamber finding)](https://doi.org/10.30573/ks--2018-dp40) · [FactSet, "Cheating in OPEC: Depends Where You Look," Dec 2024](https://insight.factset.com/cheating-in-opec-depends-where-you-look) · [IEA Oil Market Report](https://www.iea.org/reports/oil-market-report-may-2026) · [IEA statement on OPEC+ dropping the OMR as a secondary source](https://www.iea.org/news/statement-about-oil-market-report-data)
- [Kempe, Kleinberg & Tardos, "Maximizing the Spread of Influence through a Social Network"](https://theoryofcomputing.org/articles/v011a004/v011a004.pdf) · [Berenbrink et al., "Inference of a Rumor's Source in the Independent Cascade Model" (PMLR v216, 2023)](https://proceedings.mlr.press/v216/berenbrink23a/berenbrink23a.pdf) · [Chen, Sun, Zhang & Zhang, "Network Inference and Influence Maximization from Samples" (ICML 2021)](https://proceedings.mlr.press/v139/chen21q/chen21q.pdf) · [SNAP NetInf / MemeTracker](http://snap.stanford.edu/netinf/)
- [Design effect and effective sample size (Kish)](https://en.wikipedia.org/wiki/Design_effect) · [PracTools: Design Effects and Effective Sample Size](https://cran.r-project.org/web/packages/PracTools/vignettes/Design-effects.html) · [Madansky, "Design Effect and Effective Sample Size"](http://www.analyticalgroup.com/download/DesignEffectAndEffectiveSampleSize.pdf)
- [GDELT Project licensing and terms](https://www.gdeltproject.org/about.html) · [GDELT data access](https://www.gdeltproject.org/data.html) · [Wayback Machine APIs](https://archive.org/help/wayback_api.php) · [Wayback CDX Server API (fields incl. `digest`)](https://github.com/internetarchive/wayback/blob/master/wayback-cdx-server/README.md) · [Common Crawl index server](https://index.commoncrawl.org/) · [Common Crawl FAQ and access terms](https://commoncrawl.org/faq)