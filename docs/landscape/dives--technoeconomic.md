# Concept of Operations — Adversary Technoeconomic Decision-Making

**Fuses C-ADV-5 (Technoeconomic Retaliation) + C-TECHECON-8 (Coercion Instrument Chooser) + C-TECHECON-2 (Sanctions Package Pre-Mortem), with C-TECHECON-4 (Critical-Mineral Chokepoint)**

Working name: **CHOOSER/COST** — one kernel family, three fitted variants, one Scenario Pack.

---

## 1. In Plain English

**What this does:** When a foreign government is deciding how to hit back economically — cut off a mineral, tighten an export rule, blacklist a company — this system predicts *which* lever they will pull, *when*, and *how hard*, and then predicts what happens downstream if they pull it, including which of our allies gets hurt by accident.

**Why it matters:** Today, when a US export-control rule goes to interagency review, the "how will they retaliate" section is usually one experienced person reasoning from the last two episodes, written under a deadline, with a signature block on it. There is no score attached and no way to check later whether it was right. This attaches a dated, checkable forecast to that page.

**What's new under the hood:** Three things. First, the adversary is modelled as someone *making a choice from a menu*, with the choice model fitted to 1,547 real sanctions episodes rather than guessed at. Second, a separate model of stockpiles and inventories that can predict the pattern everyone gets wrong — a price that spikes and then *collapses*. Third, a hard rule that the system refuses to answer when the underlying economic data simply does not exist, which is the honest situation for Iran and North Korea.

**What it deliberately will not do:** It will not tell the US government which economic weapon to use, and it will not print a price forecast to the dollar. Both refusals are enforced in the code, not in a policy memo.

---

## 2. The Analytic Question and Its Resolvable Quantity

### 2.1 Primary question (CHOOSE)

> Which technoeconomic instrument, if any, will **ACTOR** apply against **TARGET × SECTOR** in window **[T₀, T₀+H]**, and at what intensity band?

**The partition.** Instruments are classified by *published legal form*, which makes the partition structurally MECE and structurally scorable — an action's legal form is a fact on a dated document, not a judgment call:

| # | Instrument class | Resolution artifact |
|---|---|---|
| 1 | No action in window | Absence across all sources at T₀+H |
| 2 | Export licensing tightening on named HS / control code | MOFCOM announcement, official gazette |
| 3 | Export prohibition / embargo on named code | Same |
| 4 | Extraterritorial extension (de minimis / foreign-direct-product analog) | Same |
| 5 | Entity-level designation | Unreliable Entity List / equivalent |
| 6 | Informal administrative friction (customs slowdown, licences simply not issued) | Volume series divergence without a published rule |
| 7 | Import restriction / tariff on target | Tariff schedule notice |
| 8 | Investment / procurement restriction | Gazette |
| 9 | **Reversal or suspension of an existing measure** | Gazette |
| 10 | **Out-of-menu** (a genuinely new instrument class) | Adjudicated; counted as a first-class metric |

Classes 9 and 10 carry disproportionate weight and are the reason this partition is not the obvious one. Class 9 exists because the two most instructive episodes in the entire dataset are *de-escalations*: China resuming rare-earth flows to Japan in late 2010, and — verifiable in the current record — China suspending its October 2025 rare-earth controls for one year and lifting the US gallium ban for one year, both in November 2025 ([USGS Mineral Commodity Summaries 2026](https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-rare-earths_ver.1.2.pdf)). A menu without a reversal column cannot be right about this problem. Class 10 exists because MOFCOM Announcement No. 61 of 9 October 2025 invented an instrument that did not previously exist in Chinese practice — a 0.1 %-by-value de minimis rule plus a Chinese foreign-direct-product rule, described by practitioners as "China's first application of the re-export, de minimis rule and FDPR rules" ([CSET translation](https://cset.georgetown.edu/publication/mofcom-notice-2025-61/); [Crowell](https://www.cmtradelaw.com/2025/10/china-expands-rare-earth-export-controls-and-adds-14-entities-to-the-unreliable-entity-list/)). A menu fitted through 2024 would have scored that as out-of-menu, and saying so is the honest presentation.

**Resolution event.** Two, both third-party and on a published schedule:
- **Instrument identity and date:** MOFCOM / General Administration of Customs announcements, the EU Official Journal, the *Federal Register*.
- **Intensity:** China customs (GACC) monthly export series by HS code and destination, published monthly ([GACC statistics](http://english.customs.gov.cn/Statistics/Statistics?ColumnId=1)) — including per-element series for antimony, gallium, germanium, dysprosium and terbium by destination.

**Annual back-stop:** USGS *Mineral Commodity Summaries*, published February each year (MCS 2026 published 6 Feb 2026, DOI 10.3133/mcs2026), which prints US net import reliance per commodity — a numeric, dated, third-party scorecard nobody in this market can influence.

### 2.2 Secondary question (COST / STOCK)

> Conditional on instrument *I* being applied at T₀, which pre-registered band contains **[consequence measure]** at T₀+h, for h ∈ {1, 3, 6, 12, 24} months?

Consequence measures are chosen strictly for third-party resolvability: monthly controlled-code export volume to a named destination (GACC, tonnes); US net import reliance (USGS, annual); the count of mitigating general licences issued (OFAC / *Federal Register*); ordinal price band against a named public reference index (never a point estimate — see §13).

### 2.3 As-of discipline

The platform already hard-filters corpus retrieval by date and throws at runtime if any evidence reference in a finished product post-dates the run's as-of date. This pack extends that assertion to two new leakage vectors that documents-only filtering misses:

- **Table vintages.** The OECD ICIO database's current release (revised January 2026) covers 1995–2022 for 80 economies ([OECD ICIO](https://www.oecd.org/en/data/datasets/inter-country-input-output-tables.html)). A backtest at as-of 2010 that loads it is using a table published fifteen years after the decision. The loader must resolve to the ICIO/GTAP *release* available at T₀.
- **The fitted-model vintage, and a residual we cannot fully close.** GSDB-R4 covers 1950–2023 but was published June 2025 ([GSDB](https://www.globalsanctionsdatabase.com/)). Truncating to cases imposed ≤ T₀ removes the obvious leak but not the subtler one: the coding conventions, the success categories, and the very decision about which episodes are cases were all set with hindsight. **We state plainly that this cannot be fully eliminated**, and we quantify it: report skill with the fitted coefficients versus skill with coefficients re-fitted on a pre-T₀ sanctions dataset (TIES, HSEO) that had no knowledge of the later episodes. The gap between those two numbers is the honest upper bound on hindsight contamination.

---

## 3. The Kernel

### 3.1 Architecture class — stated honestly, up front

The three variants are **not the same architecture class**, and claiming otherwise is the first thing a technical evaluator will break:

| Variant | Architecture class | Why |
|---|---|---|
| **CHOOSE** | **Estimate-and-adjudicate** | A fitted discrete-choice model, Monte-Carlo'd over parameter and shock uncertainty. The "simulation" is uncertainty propagation, not agent dynamics. Calling it a simulation would be inflation. |
| **STOCK** | **Consequence twin** | Genuinely dynamic: an inventory state variable carried across periods, a non-negativity constraint producing a real nonlinearity, path-dependent outcomes. |
| **COST** | **Estimate-and-adjudicate today; consequence twin after the replacement in §3.5** | Currently a static propagation. This is the weak link. |

### 3.2 CHOOSE — the adversary as a chooser

**Model family:** conditional logit with random coefficients (mixed logit), over the closed menu of §2.1, with a competing-risks hazard on timing so the model predicts *instrument × month*, not just *instrument*. Fitted on the GSDB-R4 case-list and dyadic versions — 1,547 cases, 1950–2023, coded along type (trade / financial / travel / arms / military assistance / other), objective (nine categories), and success (five categories), with trade sanctions further split into complete and partial import and export sanctions ([Yotov et al., GSDB-R4 working paper](https://www.lebow.drexel.edu/sites/default/files/2025-01/wp2025002-global-sanctions-db.pdf)).

**State variables:** dyad-level trade dependence (Comtrade, as-of), chokepoint concentration (USGS net import reliance and world production share), prior instrument in the dyad, elapsed time since last action, target's retaliation capacity index, sender's own exposure to the instrument (the cost-to-self term), and an ally-alignment count.

**What varies across the ensemble:** the fitted coefficient draws, the actor-knob draws (§5.3), the timing hazard's baseline, and the corpus subsample. Same seed ⇒ byte-identical artifact hash, per the platform's existing determinism guarantee.

**The one-shot argmax is replaced.** The candidate as described did a single argmax over the menu. That is indefensible for three reasons and the replacement addresses all three: (i) it has no clock, and the customer's question has a due date — hence the hazard; (ii) it ignores that the chooser anticipates a counter-move — hence a two-stage node with a continuation value on the target's response; (iii) argmax discards the distribution, which is the only thing worth reporting — hence a full posterior over menu × month.

### 3.3 STOCK — why spike-then-collapse is the whole ballgame

The 2010 rare-earth episode is the best-designed discriminating backtest in the catalogue precisely because a model that only predicts "prices go up" *passes at six months and fails catastrophically at twenty-four*. The record:

| Series | Pre-episode | Peak | Post-collapse |
|---|---|---|---|
| Dysprosium | $118.49/kg (2008) | $2,262/kg (Sep 2011) | $1,170/kg (Apr 2012) |
| Neodymium oxide | ~$45/kg (2010) | $338/kg (Q3 2011) | $120/kg (Apr 2012) |
| US customs avg REE from China | $5,589/t (Jan 2010) | $158,389/t (Sep 2011) | $46,694/t (Feb 2012) |
| Japanese REE demand | 32,000 t (2010) | — | −20.9 % (2011), −31.4 % (2012) |

Sources: [CRS R42510](https://www.everycrsreport.com/reports/R42510.html); [MINING.com, Apr 2012](https://www.mining.com/we-need-to-talk-about-how-rare-earth-prices-are-imploding/).

The mechanism is not mysterious and it is not a trend: downstream users filled inventories, which *drove* the bubble, and then demand destruction turned out to be permanent. The academic reconstruction is explicit — "Fear of Chinese economic power fueled a two-year speculative bubble," and "much of the 'demand destruction' in the wake of the crisis was actually permanent" ([Notre Dame working paper on the 2010 REE episode](https://ondisc.nd.edu/assets/344352/market_structure_and_economic_sanctions_the_2010_rare_earth_elements_episode_as_a_pathway_case_of_market_adjustment.pdf)).

**Model family:** the rational-expectations competitive storage model, whose defining feature is exactly the one that generates this shape — the market as a whole cannot carry negative inventories, "an essential non-linearity which carries through into non-linearity of the predicted commodity price series," explaining "the existence of rare but violent explosions in prices" ([Deaton & Laroque, *RES* 1992](https://www.princeton.edu/~deaton/downloads/On_The_Behaviour_of_Commodity_Prices.pdf)).

**State variables:** carry-in inventory (commercial + government stockpile), harvest/production shock, a demand curve with a *ratcheting* elasticity that permits permanent demand destruction, storage cost, and interest rate.

**Two implementation warnings we will not repeat.** First, Deaton and Laroque themselves concluded the model could not generate observed serial correlation — a conclusion later shown to be an artefact of **grid resolution**: re-estimation "with a much finer grid to approximate the equilibrium price function yields quite different estimates for most commodities," and reinstates the model ([Cafiero, Bobenrieth, Bobenrieth & Wright, *J. Econometrics* 2011](https://ideas.repec.org/a/eee/econom/v162y2011i1p44-54.html)). The policy-function grid is therefore a first-class, versioned config parameter with a convergence test, not an implementation detail. Second, the same literature finds "consumption demand has a low response to price" — which is consistent with §3.4 and reinforces it.

### 3.4 COST — and the honest statement about the I-O layer

**Where it is static, and why that is a defect rather than a simplification.** A Leontief inverse is a *first-order* object. Hulten's theorem says that to first order, the macro impact of a shock to a sector equals that sector's sales share — the network structure, the substitution elasticities, and returns to scale are all irrelevant. That is exactly why static I-O feels sufficient. It is sufficient *for small shocks*. Export-control chokepoints are not small shocks, and second-order terms are "shaped by the microeconomic details of the disaggregated production structure: network linkages, microeconomic elasticities of substitution in production, microeconomic returns to scale, and the degree to which factors can be reallocated." Critically, the sign is known: "nonlinearities magnify negative shocks and attenuate positive shocks," almost tripling the estimated impact of the 1970s oil shocks ([Baqaee & Farhi, *Econometrica* 87(4), 2019](https://www.nber.org/papers/w23145)).

**So the static I-O layer is not merely imprecise — it is biased in a known direction: it systematically understates the damage from a chokepoint cut-off.** That is a statement we can defend in a technical review, and it is far stronger than pretending the approximation is fine.

**The elasticities are the soft underbelly, and here is the size of the problem.** The best-identified estimates put the trade elasticity at **−0.76 in the year following a tariff change**, rising to **−1.75 to −2.25 in the long run**, taking **7–10 years to converge**, with a cross-sectional range across ten broad HS sections of **−0.5 to over −6** ([Boehm, Levchenko & Pandalai-Nayar, *AER* 113(4), 2023](https://www.aeaweb.org/articles?id=10.1257%2Faer.20210225)). The conventional wisdom the previous generation of models used was −5 to −10. A twelve-month consequence forecast built on a "standard" elasticity of −5 overstates the trade response by roughly a factor of six.

**Structural response, not a caveat paragraph.** σ is swept as a first-class ensemble parameter over the interval the literature supports, and every COST band ships with an **elasticity share of variance** — the fraction of band width attributable to the σ prior rather than to data. When that share exceeds a pre-registered threshold, the abstention gate fires *before* scoring and the product returns `INSUFFICIENT_EVIDENCE` with the reason "parameter-dominated." A reader must never be unable to tell whether they are looking at a measurement or a prior.

### 3.5 The dynamic replacement — specified, not promised

| Layer | Now | Replacement | Buys |
|---|---|---|---|
| Production | Static Leontief | Nested-CES production network, σ swept; sector-level Domar weights + second-order terms | Correct sign and magnitude on large negative shocks |
| Choice | One-shot argmax | Mixed logit + competing-risks hazard + two-stage counter-move node | Timing, a distribution, anticipation |
| Commodity | None | Competitive storage with inventory non-negativity, fine-grid policy function | Spike-then-collapse; stockout nonlinearity |
| Inventory data | None | DLA stockpile position + commercial stocks (USGS consumer year-end stocks) | Makes the storage state observable rather than latent |

**What we still will not claim.** None of this simulates the internal politics of the adversary's decision. It models *revealed choice conditional on observables*. That is a narrower and far more defensible claim than "adversary decision simulation," and we will make it in exactly those words in front of an evaluation panel.

---

## 4. The Panel

| Technique | What it adjudicates | Rubric |
|---|---|---|
| **ACH** (Heuer diagnosticity weighting) | Instrument-choice hypotheses against as-of evidence; ranks by weighted inconsistency ascending | Platform-native. Evidence items restricted to the as-of corpus by the existing hard date filter |
| **Key Assumptions Check** | The σ prior, menu closure, I-O vintage, the storage-cost assumption | Every assumption carries a **required falsifier** naming an observable and a date — e.g. "if GACC November volumes for HS 2846 to Japan exceed X, the binding-constraint assumption is dead" |
| **Devil's Advocate** | **Mandatorily assigned the reversal branch** whenever the ensemble's modal path is escalation | This is 2010 and November 2025 wired into the panel rather than left to luck |
| **Premortem** | "It is T₀+H and the annex was wrong" | Must produce ≥1 out-of-menu instrument candidate and ≥1 ally-collateral surprise |
| **Red Team** (bounded rerun authority) | COST bands under adversarial σ selection | May force one rerun at the σ prior's tail; bounded per the platform's existing rerun authority |
| **Data-Precondition Adjudicator** *(new, and not an LLM)* | Whether this actor × question passes the abstention manifest | A deterministic config check that returns `INSUFFICIENT_EVIDENCE` **before** scoring. This is the Iran/DPRK enforcement (§6.3) |

**Confidence aggregation:** weakest link, never mean (platform-native). **Calibration:** per-judge z-score normalisation for severity bias; global / dimensional / unique outlier detection.

**A prerequisite risk, stated because it is measured.** The platform's live adjudicator refusal rate on the influence-operations task was 5/5, and later 2 of 3 declined. Sanctions-and-coercion prompts sit near the same refusal boundary. Partial panel loss is therefore not an edge case here — it is the expected operating condition, and **the platform currently scores one surviving adjudicator identically to a full panel** (`available: results.length > 0` → `level: adjudicationAvailable ? "high" : "moderate"`). Grading k-of-N panel loss is a hard prerequisite for this pack, not an enhancement. Likewise, the `PanelPlan`'s generated `systemPrompt` is never persisted and never enters `runId`; **a backtest whose rubric is not in the artifact is not a backtest.** Both platform gaps must close before week 1 of the demo.

---

## 5. The Scenario Pack — config versus new code, honestly

### 5.1 Config (existing engine, new files)

```
question/     techecon-{prc-ree,prc-ga-ge-sb,rus-energy,irn-choose}.yaml
actor/        prc.yaml  rus.yaml  irn.yaml  dprk.yaml  usa-mirror.yaml [gated]
menu/         instrument-menu-v1.yaml          # the closed partition of §2.1
panel/        techecon-panel.yaml              # SAT composition + rubric text
bands/        price-ladder.yaml  volume-ladder.yaml  # pre-registered, versioned
corpus/       gacc.yaml  mofcom.yaml  fedreg.yaml  ofac.yaml  eu-oj.yaml  usgs.yaml
abstention/   preconditions.yaml               # actor × question-type × data requirement
priors/       sigma-short-run.yaml             # the elasticity prior, cited to source
```

### 5.2 New code — the credibility test

Claiming this is "all config" would be false and an evaluator would find it in ten minutes. What is genuinely new:

| Module | What it is | Novelty |
|---|---|---|
| `sim/kernel/choose.ts` | Mixed logit + competing-risks hazard sampler; GSDB fitting harness | Moderate — standard econometrics, new to the platform |
| `sim/kernel/stock.ts` | Competitive storage, inventory non-negativity, policy function on a convergence-tested grid | **Genuinely new numerics.** The grid-resolution failure mode is real and documented |
| `sim/kernel/network.ts` | Nested-CES propagation, σ swept, second-order terms | Moderate |
| `sim/data/asof-io.ts` | I-O / price-series vintage loader with as-of enforcement | Small but leakage-critical |
| `product/bands.ts` | Band-ladder types; removes any numeric price field from the product schema | Small; enforces the §13 red line structurally |
| *(platform)* panel persistence + hashing into `runId` | Gap 1 | Prerequisite |
| *(platform)* k-of-N panel grading | Gap 2 | Prerequisite |

### 5.3 The two knobs do not fit — a concrete instance of gap 3

`riskTolerance` and `escalationPropensity` cannot express the single most important behavioural parameter in this domain. This pack requires three:

- **`costToleranceToSelf`** — how much damage to its own economy the actor will absorb. This is what separates the April 2025 controls (low self-cost, seven medium/heavy elements, [Announcement No. 18](https://english.mofcom.gov.cn/Policies/AnnouncementsOrders/art/2025/art_0dd87cbee7b045bf93fabe6ab2faceee.html)) from an actual embargo.
- **`instrumentFormalism`** — preference for a published rule versus informal customs friction. This is the difference between menu class 2 and menu class 6, and it determines whether the action is even *observable* at T₀+h.
- **`reversalPropensity`** — willingness to unwind. **Neither existing knob can express this**, and both 2010 and November 2025 turn on it entirely.

This is reported to the platform team as evidence for gap 3, not routed around.

---

## 6. Data

### 6.1 Named sources, all unclassified

| Source | Content | Access reality |
|---|---|---|
| **GSDB-R4** | 1,547 sanctions cases, 1950–2023, typed and coded; case-list + dyadic | Free **on request** (GSDB@drexel.edu). **Action item: confirm terms for USG-funded contractor use before this appears in a bid.** Do not assume "public good" means "government-use licensed." |
| **UN Comtrade** | Bilateral trade, HS 6-digit | Subscription for bulk/API; mirror estimation for non-reporters |
| **China GACC monthly customs** | Export volume/value by HS × destination, monthly | Public; the live resolution spine |
| **OECD ICIO** (Jan 2026 revision) | 80 economies + RoW, 1995–2022 | Free. **Does not include Iran or DPRK** (verified against the published country list) |
| **GTAP 12** | Global CGE database; Iran is region 103 (IRN) | Licence fee |
| **USGS MCS 2026** | Net import reliance, production, reserves, prices, stockpile position; ~90 commodities | Public, annual, February |
| **Federal Register / BIS Entity List** | Dated rules with signature blocks | Public |
| **OFAC SDN + Recent Actions + general licences** | Designations, delistings, mitigations | Public |
| **MOFCOM / GACC announcements** (+ CSET translations) | Chinese instrument text | Public |
| **EU Official Journal** | Sanctions adoptions | Public |
| **DLA Annual Materials Plan** | Statutory, to Congress by 15 February (50 U.S.C. § 98h-2) | Public — **and note the observable: USGS records that "for fiscal year 2026, the Annual Materials Plan was not released."** That non-release is itself a signal the pack should ingest |

### 6.2 Classified

**None required for the demonstration.** That is the design choice, and it is what makes the REASON contracting pattern available (§9).

### 6.3 Iran and DPRK — the honest abstention

**CONFIRMED:** the OECD ICIO 2025/2026 edition covers 80 economies plus Rest of World; scanning the published list, neither Iran nor DPRK is among them. GTAP 12 does carry Iran as a separate region (103, IRN); DPRK is not a separate GTAP region. UN Comtrade estimates missing reporters "through the use of the data reported by the trading partners (so called mirror data)"; the World Bank's WITS Iran profile notes "Mirror Exports is considered for export data." For DPRK, the documented error scale is not a rounding problem — PIIE found IMF DOTS recording $1.6 bn of imports from Algeria in a single year that appears in neither Comtrade nor KOTRA, and Indian exports to DPRK in 2008 recorded as $772 m by one source and $53 m by another ([PIIE](https://www.piie.com/blogs/north-korea-witness-transformation/north-korean-trade-data-caveat-emptor)).

**Therefore, declared in `abstention/preconditions.yaml`:**

| Actor | CHOOSE | COST / STOCK |
|---|---|---|
| PRC | Admissible | Admissible |
| Russia | Admissible | Admissible (ICIO includes RUS) |
| **Iran** | **Admissible, wider bands** — the instrument menu and coercion history are observable from public actions | **Refused, structurally.** No I-O structure; trade spine is mirror-only and distorted by UAE/Türkiye re-export |
| **DPRK** | **Refused** | **Refused** |

**This matters more than any other line in this document, because the customer's own worked example is Iran.** The pack answers Iran on *choice* and refuses on *consequence magnitude*, and that refusal is generated by a named unmet data precondition, not by model uncertainty. It is the same property that produced 80/80 true abstention on the platform's provably-unanswerable arm. Expected structural abstention: Iran-COST ≈ 100 %, DPRK ≈ 100 %. These are *declared*, not *measured*, and must be reported in a separate column from the measured false-abstention rate (7 % at the shipped threshold, from the six-arm threshold sweep).

---

## 7. The Oracle and the Evaluation Plan

Every report carries an `EvaluationRegime` tag and **no function pools across regimes.**

### 7.1 `synthetic_oracle`

Generative ground truth: sample a true coefficient vector and true σ, simulate an adversary's choice path and the resulting price/volume path, hand the pack only what would have been observable at T₀. This is the only regime where a negative control is possible — a deliberately misspecified arm (wrong menu, wrong elasticity regime) must score **worse than base rate**, as the platform's existing misspecified arm does (−0.4561 Brier skill, coverage@1 0.123). If the technoeconomic misspecified arm does not go negative, the oracle is not discriminating and the whole batch is void.

### 7.2 `historical_backtest` — four episodes, pre-registered bands

Bands are registered, hashed, and committed **before** the as-of corpus is loaded.

**Episode 1 — China/Japan rare earths, as-of 2010-09-30. The discriminator.**
Pre-register at +6 mo *and* +24 mo: Chinese REE export volume to Japan; neodymium-oxide price band; Japanese REE demand change. Ground truth in §3.3. **A model that only predicts "up" passes +6 and fails +24.** This is the arm that justifies STOCK's existence, and if STOCK does not beat the static kernel here, STOCK should be deleted.

**Episode 2 — Rusal, as-of 2018-04-05 (the day before designation). The one that sells.**
Pre-register: (a) will OFAC issue mitigating general licences within 90 days? (b) will the action be materially unwound within 12 months? (c) aluminium price band at +30 d.
Ground truth: General Licence 14 issued **23 April 2018** — 17 days ([OFAC](https://ofac.treasury.gov/recent-actions/20180423)); intent-to-delist notified to Congress **19 December 2018**; delisting effective **27 January 2019** ([OFAC](https://ofac.treasury.gov/recent-actions/20190127)). OFAC's own notification memo is the ally-collateral exhibit, in Treasury's words: *"The price of aluminum soared in the weeks following the designation, and Rusal subsidiaries in the United States, Ireland, Sweden, Jamaica, Guinea, and elsewhere faced imminent closure without limited sanctions mitigation in the form of OFAC general licenses"* ([Treasury notification, 19 Dec 2018](https://ofac.treasury.gov/system/files/126/20181219_notification_removal.pdf)).

**Episode 3 — CBR reserve freeze (Feb 2022, ~$300 bn) and the $60 oil price cap (5 Dec 2022). A pre-registered expected failure.**
We predict, in advance and in writing, that the pack does **poorly** here, because the binding constraint on the price cap was shadow-fleet formation — an evasion-network phenomenon the kernel does not model. Registering an expected failure and being right about *where* it falls is worth more to a technical evaluator than winning everywhere. ([CRS IF12062](https://www.congress.gov/crs-product/IF12062); [Council of the EU, 3 Dec 2022](https://www.consilium.europa.eu/en/press/press-releases/2022/12/03/russian-oil-eu-agrees-on-level-of-price-cap/).)

**Episode 4 — Huawei FDPR, as-of 2020-05-14. The granularity test.**
The May 15 2020 interim final rule (85 FR 29849) and the 17 August 2020 final rule adding 38 further affiliates. The kernel has no firm-level foundry structure, so this arm principally tests whether the abstention gate **correctly fires** when the question sits below the sector granularity the kernel supports. A confident answer here is a failure, not a success.

**Replication set (2025–26), now available and closer to the live regime:**
Announcement No. 18 (4 Apr 2025, seven medium/heavy REEs) → Announcement No. 61 (9 Oct 2025, de minimis 0.1 % + Chinese FDPR, mostly effective 1 Dec 2025) → **November 2025 suspension of the October controls for one year, and lifting of the gallium ban to the US for one year**. That November reversal is the modern spike-then-collapse discriminator.

### 7.3 `live_post_cutoff`

40 questions/month, each with a date-certain resolution event drawn only from: GACC monthly release dates, *Federal Register* publication, EU OJ adoption, OFAC action postings, USGS MCS February publication, DLA solicitation postings on SAM.gov, and the statutory 15 February Annual Materials Plan.

### 7.4 Baselines to beat — named, public, never the customer's own calls

**CHOOSE:** (1) **"no action in window" null** — the honest hardest baseline, because most months contain no action; (2) instrument base rate from GSDB-R4 conditional on the dyad; (3) persistence (actor repeats last instrument); (4) where a matching public question exists, the Metaculus / INFER community forecast.
**COST / STOCK:** (1) random walk on the public reference index; (2) futures-curve-implied band where a curve exists; (3) trade-volume persistence.

**We do not backtest against the customer's own historical analytic calls.** In a bid that is an unforced error.

### 7.5 The honest headline metric for this question class

Not Brier alone. The headline is a triple:

1. **Brier skill score against the "no action in window" null**, Murphy-decomposed, reported **separately for the timing component and the instrument-identity component**. Pooling them hides the failure mode that matters.
2. **Reversal Coverage@(h₁,h₂)** — the fraction of episodes whose true path reversed direction (escalate-then-de-escalate, spike-then-collapse) for which the model's band covered the truth at **both** horizons. *This is the metric nobody in this market publishes, and it is the one that separates this from a trend extrapolator.* On the 2010 episode, a naive escalation model scores 0.
3. **Out-of-menu rate** — the fraction of resolved events that fell outside the fitted menu. Announcement No. 61 would have scored as out-of-menu against a menu fitted through 2024, and we will say so.

Co-equal, always reported: ECE/MCE with bin occupancy, coverage@1, sharpness, true and false abstention rates (structural and measured, in separate columns), and the elasticity share of variance.

---

## 8. The 90-Day Unclassified Demonstration

| Weeks | What is built / shown | The number that comes out | What would falsify it |
|---|---|---|---|
| **1–2** | Platform prerequisites: persist + hash `PanelPlan` into `runId`; grade k-of-N panel loss. Measure adjudicator refusal rate on 30 sanctions/coercion prompts | Refusal rate on this task family; % of runs where panel loss changes the graded confidence level | Refusal rate > ~40 % ⇒ the SAT panel is not viable on this domain and the concept needs a different adjudication design. **Report it either way.** |
| **3–4** | `choose.ts` + GSDB-R4 fitting harness; menu v1 locked and hashed; band ladders pre-registered and committed | In-sample fit and a held-out-by-year log score vs. the three baselines | Fitted model fails to beat the "no action" null out-of-sample ⇒ the choice model adds nothing over a base rate |
| **5–6** | `stock.ts` with grid-convergence test; Episode 1 (2010) run at as-of 2010-09-30 | Reversal Coverage@(6mo, 24mo) for STOCK vs. static kernel | STOCK does not beat static at +24 mo ⇒ **delete STOCK.** This is the pack's own negative control |
| **7–8** | `network.ts` with σ sweep; Episode 2 (Rusal) at as-of 2018-04-05 | Probability assigned to "mitigating GL within 90 days"; probability of material unwind within 12 months; elasticity share of variance on the aluminium band | Both Rusal probabilities below the base rate for OFAC mitigations ⇒ the ally-collateral claim — the part that sells — is unsupported |
| **9–10** | Episodes 3 and 4; abstention manifest wired; Iran-CHOOSE and Iran-COST runs | Structural abstention: Iran-COST and DPRK must be 100 %. Episode 4 must abstain. Episode 3 must fail *as pre-registered* | Any confident Iran-COST answer, or a confident Huawei answer ⇒ the gate is broken, which is worse than a bad forecast |
| **11–12** | Synthetic-oracle batch (80 questions × 32 runs), including a deliberately misspecified negative-control arm; live arm opens with 40 questions | Brier skill vs. base rate on the well-evidenced arm; **negative skill on the misspecified arm**; ECE with bin occupancy; cost and latency per question | Misspecified arm does not go negative ⇒ the oracle is not discriminating and the batch is void |
| **13** | Package: artifact hashes, band pre-registrations with commit timestamps, full metric table by regime, and the four things that are *not* measured | Two-column TRL; cost model; the list of open failures | — |

**What is deliberately absent:** any claim of accuracy against a human analyst, any historical-backtest number presented as a live-accuracy number, and any analyst-hour savings figure. Those are §10 and §14 problems and they are labelled as such.

---

## 9. The Classified Instantiation

**The pattern is IARPA REASON's, and it is already proven at a US IC agency.** Under the REASON BAA (W911NF-23-S-0007), Phase 1 performer systems are tested on unclassified data while "the REASON independent T&E team will retrain and evaluate performer systems on classified draft analytic reports and source reports"; in Phase 2, "performers will refine their systems to process the content and style of the IC's source reports using unclassified examples, but they will **not have access to classified data**," receiving instead "actionable summary level unclassified feedback from the independent cleared T&E." Phase 2 runs 18 months ([REASON BAA](https://arl.devcom.army.mil/wp-content/uploads/sites/3/2023/04/W911NF-23-S-0007-REASON-BAA-Final-17-March-2023.pdf)).

**What changes on the high side:** the corpus. Classified holdings on adversary internal deliberation sharpen the CHOOSE priors — particularly `costToleranceToSelf` and `reversalPropensity`, which are the knobs public data constrains worst.

**What it adds:** nothing to the kernel. The kernel is identical. That is the argument.

**Why deterministic artifacts make this cheaper than it has ever been.** Same seed ⇒ byte-identical artifact hash. The cleared T&E team can re-run an identical seed on the high side against the augmented corpus and return **only the hash and the metric deltas** across the boundary — a payload small enough to be reviewed line-by-line for low-side release. That is a materially cheaper cross-domain evaluation loop than shipping narrative feedback.

**The accreditation obstacle, named.** The pack pulls live external data (GACC, *Federal Register*, MOFCOM, EU OJ). A high-side instance cannot reach any of it. The pack therefore ships a **corpus-drop mode**: a signed, dated, one-way transfer of the as-of corpus, with the existing runtime as-of assertion serving as the guarantor that the high-side run used exactly the low-side corpus and nothing later. Without that, the two sides are not running the same experiment and the comparison is meaningless.

**The on-ramp, named.** The CIA Acquisition Framework announced 9 February 2026 by Director Ratcliffe, built around centralised vendor vetting, a streamlined IT authorisation process, and explicit pathways to "rapidly onboard breakthrough technology prototypes," led by chief procurement executive Efstathia Fragogiannis (a DARPA alum who joined in November 2025) ([CIA](https://www.cia.gov/stories/story/cia-launches-new-acquisition-framework-to-turbocharge-collaboration-with-private-sector/); [Nextgov](https://www.nextgov.com/acquisition/2026/02/cia-announces-new-acquisition-framework-speed-tech-adoption/411285/)). The streamlined IT authorisation is the specific mechanism this pack needs; the prototype pathway is the vehicle. Minimum Government Purpose Rights, per REASON precedent.

---

## 10. Buyer, Workflow Displacement, and the Analyst-Hour Denominator

| Buyer | The decision | **The dated artifact with a signature block** |
|---|---|---|
| **BIS / Commerce** | Entity List and FDPR rule packages. Decided by the **End-User Review Committee** — Commerce (chair), State, Defense, Energy voting, Treasury consulted; **majority vote to add, unanimous to remove**, 30-day vote clock, escalation ACEP → EARB → President ([15 CFR Pt. 744 Supp. 5](https://www.law.cornell.edu/cfr/text/15/appendix-Supplement_No_5_to_part_744)) | The *Federal Register* final rule — e.g. 32 entities added, 16 Sep 2025 ([90 FR](https://www.govinfo.gov/content/pkg/FR-2025-09-16/html/2025-17893.htm)). The retaliation annex rides in the interagency package |
| **OFAC / Treasury** | Designation packages and mitigating general licences. **The Under Secretary for TFI already requires impact assessments before and after every action** (GAO-20-145), and Treasury stood up a **Sanctions Economic Analysis Division in April 2023** (GAO-25-107079) | The designation memo and the GL decision |
| **State / EB** | Ally consultation and coalition maintenance | The démarche / action package |
| **DLA Strategic Materials** | **Appropriated money.** Cobalt: up to 7,500 t / $500 m, first purchase since 1990. Antimony: ~$245 m sole-source IDIQ to USAC (23 Sep 2025), first delivery order ~$10 m (30 Sep 2025). Multiyear authority at 50 U.S.C. § 98e-2 (NDAA FY2024) | **The Annual Materials Plan, statutorily due to Congress by 15 February** (50 U.S.C. § 98h-2) — and the solicitation/J&A on SAM.gov |
| **OUSD(A&S) Industrial Base Policy** | DPA Title III + Industrial Base Fund. ASD(IBP) Michael Cadenazzi testified 24 Feb 2026 to $975 m invested in minerals, with $5 bn IBF, $2 bn NDS and a $100 bn Office of Strategic Capital loan limit newly available | The DPA Title III award and the Presidential Determination (e.g. 30 Jul 2026, recoverable critical minerals) |

**The workflow being displaced.** Not "analysis" in the abstract — one specific page. Today the retaliation annex in a BIS rule package, and the impact assessment TFI requires before an OFAC designation, are produced by an experienced officer reasoning from the last two episodes under a deadline. GAO found the government-wide picture bluntly: agencies "have not conducted such assessments on their own," citing difficulty isolating effects, shifting goals, and lacking data ([GAO-20-145](https://www.gao.gov/products/gao-20-145)). Five years later GAO found the Russia programme still has no "clearly defined objectives linked to measurable outcomes with targets," and that as of March 2026 Treasury had provided no update on progress ([GAO-25-107079](https://www.gao.gov/products/gao-25-107079)).

**The analyst-hour denominator — and we do not have it.** We will not assert a savings figure. **UNVERIFIED.** The measurement plan is REASON's own: a control group and a system-assisted group produce the same annex on the same question, and T&E scores both. REASON's rubric is directly reusable — Report Quality Score, built on six IC Analytic Tradecraft Standards (sourcing, uncertainty, assumptions, alternatives, logic, accuracy), each 1–4, range 6–24, compared against the control group. Adopting the government's own scoring instrument is worth more than inventing one.

---

## 11. Benefit-Category Mapping

**(a) Efficiency and accuracy.** *Mechanism:* replaces a per-episode bespoke judgment with a fitted model plus a fixed panel, and — the actual accuracy claim — attaches a Brier skill score against a named public baseline to something that currently has no score at all. Accuracy is not asserted; it is made *measurable*, which is the prerequisite.

**(b) Reduced time to analyse, better prediction accuracy.** *Mechanism:* measured platform figures are 5m54s at $0.2959 (9 calls) and 8m12s at $0.7544 (17 calls, red-team rerun) per question, with the numeric kernel running 15,832 simulations in 305 s. The band-and-hazard output arrives before the interagency clock (the ERC's 30-day vote window) rather than after. Prediction accuracy is claimed only for the regimes measured, and labelled.

**(c) Quality assurance — discrepancies between sources, reconciled analytic confidence.** *Mechanism:* this is the strongest fit and the least glamorous. ACH with diagnosticity weighting surfaces which evidence actually discriminates between instrument hypotheses; per-judge z-score normalisation removes severity bias so two judges' confidences are commensurable; outlier detection flags the judge who is out of family; **confidence aggregated by weakest link, never by mean**, so one unsupported leg cannot be averaged away; and provenance per claim with unsupported assertions counted. Every key assumption carries a **required falsifier** with an observable and a date — which is exactly "reconcile differences" made operational.

**(d) Cost reduction by automating repetitive analysis and simulation.** *Mechanism:* the repetitive part is the ensemble, and it is nearly free — 15,832 simulations in 305 s. See §16: model inference is the cheapest line item in this programme by two orders of magnitude.

---

## 12. Incumbents and Prior Programs

**The category's own procurement name is "illumination," and that is the entire argument.** The GSA vehicle is literally the *Supply Chain Risk **Illumination** Professional Tools and Services* BPA — 10 years, $919 m, sponsored by OUSD(A&S) ([GSA](https://www.gsa.gov/technology/it-contract-vehicles-and-purchasing-programs/multiple-award-schedule-it/bpas-scripts)). DIU's catalogue entry for Altana is titled "Supply Chain Illumination" ([DIU](https://www.diu.mil/solutions/portfolio/catalog/a0Tt0000009WqubEAC-a0h830000004wfMAAQ)).

| Vendor | What it does | What it does not do |
|---|---|---|
| **Sayari** | ~12 bn primary-source records across 250+ jurisdictions; 1.5 bn+ entities, 3 bn+ relationships. $8.5 m Treasury contract; $7.8 m CBP UFLPA contract; In-Q-Tel investment | Publishes no dated, scored, forward prediction |
| **Kharon** | ClearView / GraphCast / CoreStream; expert-verified ownership and control networks; contracts with US Treasury (May 2024) and CBP; agencies in 20+ countries | Same |
| **Exiger** | Highest-ranked unrestricted awardee on SCRIPTS; Army Materiel Command 1Exiger licence (Nov 2025); FedRAMP; 60+ USG agencies | Same |
| **Interos** | Resilience platform, i-Score across six risk domains; 250 m+ entities, 11 bn+ relationships; on SCRIPTS via Carahsoft | Risk *scores*, not resolvable forecasts against a baseline |
| **Altana** | Altana Atlas, multi-tier map of physical-goods supply chains | Same |
| **C4ADS** | Non-profit OSINT network analysis on illicit and state-linked networks | Same. *Specific current contract detail: UNVERIFIED* |

**None of these publishes a forward-scored prediction with a resolution date and a Brier score against a named baseline.** They make claims about *the source base* — who owns what, who ships to whom. This capability makes a claim about *the world* — what an actor will do and what follows. That is a different product in a different aisle, and the government's own contract scope language proves the aisle is empty.

**Prior programs.** IARPA **REASON** improves the reasoning inside an analyst's draft; it does not forecast, and explicitly "will exploit recent advances in artificial intelligence, **not to perform the analysis or write the report**" ([IARPA](https://www.iarpa.gov/research-programs/reason)). It is a complement and a contracting template, not a competitor. IARPA's forecasting-tournament lineage produced general-purpose geopolitical forecasting, not instrument-choice forecasting against a fitted menu. And per the established landscape finding, ForecastBench operators reported on 2026-07-16 that several systems are statistically indistinguishable from superforecaster accuracy — which *strengthens* this concept rather than weakening it: if raw forecasting skill is commoditising, the durable differentiator is measurement, abstention, provenance and calibration, which is precisely what this platform is.

---

## 13. Red Lines — Structural Enforcement, Not Policy Notes

**RL-1 — No US instrument ranking. The policy-advocacy landmine.**
Mirror mode (same kernel, US instrument menu) is one of the few genuine demonstrations of config-not-code in the catalogue, and it is also the sharpest legal hazard in this pack. ICD 203 is unambiguous: *"Analytic assessments must not be distorted by, nor shaped for, advocacy of a particular audience, agenda, or policy viewpoint. Analytic judgments must not be influenced by the force of preference for a particular policy"* ([ICD 203](https://donohueintellaw.ll.georgetown.edu/sites/default/files/assets/ICD%20203%20Analytic%20Standards.pdf)), enforced by the ODNI Analytic Ombuds and by 50 U.S.C. § 3364.

**The boundary, stated exactly:**
- **Permitted:** running **COST** on a US instrument the analyst names. That is a consequence forecast about the world — an impact assessment. TFI already requires one before every designation. Buyer: Treasury OIA / Sanctions Economic Analysis Division.
- **Forbidden without separate equities:** running **CHOOSE** on the US menu. Enumerating and *ranking* US instruments is policy prescription with a machine's name on it. It is a different product, with different equities, a different customer, and — critically — a different oversight regime.

*Structural enforcement:* the menu loader refuses any actor config whose `jurisdiction` is `US` unless a separately-signed `mirror` capability is present in the run identity; the product type has **no `recommendedInstrument` field**; a source-scanning test asserts that no code path constructs a ranked US instrument list. This is the same enforcement style as the existing test that bans `Math.random` and `Date.now` from `sim/`.

**RL-2 — Coarse bands only; never a point price estimate.**
A Treasury or Commerce lawyer raises this in the first meeting, and they are right to. *Structural enforcement:* the product schema contains **no numeric price field**. The only price-typed field is an ordinal drawn from a pre-registered, versioned band ladder against a named public reference index over a named window. The serialiser throws on any price-typed claim carrying more precision than the ladder. This mirrors the platform's existing discipline that there is structurally no function of type `(Judgment) => number`.
*Second-order hazard:* COST run on a *contemplated* US action produces, by construction, pre-decisional market-moving information. That configuration is instantiated only inside the customer's enclave; artifacts never leave; the audit log is the control.

**RL-3 — No leakage.** The existing runtime assertion (throws if any evidence reference post-dates the as-of date), extended to I-O table vintages, price-series vintages, and the fitted-model vintage. Residual hindsight contamination in GSDB coding conventions is quantified rather than denied (§2.3).

**RL-4 — No US-person targeting.** Entity resolution refuses to emit any claim keyed to a US person; the corpus filter drops US-person-keyed records at ingest.

**RL-5 — No pooling across evaluation regimes.** Platform-native; every report carries its `EvaluationRegime` tag.

---

## 14. Failure Modes

**Technical.**
1. **Timing is worse-calibrated than identity — and timing is what the annex needs.** Most likely single failure. Mitigated by decomposing Brier skill into timing and identity components so it cannot hide, but not solved.
2. **Elasticity variance dominates and every COST band is uninformative.** The σ range in the literature is nearly an order of magnitude across sectors. The abstention gate turns this into a refusal rather than a bad answer, which is correct but is also a product failure — a user who reads "we don't know" five times stops opening the tool.
3. **Out-of-menu events.** Announcement No. 61 invented a Chinese FDPR. A fitted menu has no column for a genuinely new instrument class, and the only honest response is abstention. Reported as an explicit out-of-menu rate.
4. **Evasion networks are outside the kernel.** The oil-price-cap arm will fail for this reason, pre-registered.
5. **Storage-model grid resolution.** Documented in the literature as having produced *wrong published estimates*. Convergence test required; the grid is versioned config.
6. **Adjudicator refusal.** Sanctions and coercion prompts sit near a measured refusal boundary (5/5 on the influence-ops task). Compounded by the current platform behaviour of grading one surviving adjudicator identically to eight.

**The honest worst case.** The pack ships, the panel refuses on a third of sanctions questions, the abstention gate fires on most Iran and most consequence-magnitude questions, and what remains is a well-calibrated forecaster of Chinese export-control instrument *identity* with mediocre timing — genuinely useful to exactly one desk at BIS, worth roughly one analyst's leverage, and nowhere near the scope implied by "adversary decision-making." That outcome should be stated in the bid, because it is a plausible outcome, and a programme that describes its own floor is easier to fund than one that describes only its ceiling.

---

## 15. TRL — Two Columns

| | Platform (PROTEUS) | Domain pack (CHOOSER/COST) |
|---|---|---|
| **Now** | **TRL 4** — 659 tests passing, deterministic seeded kernel, abstention gate, SAT panel, calibration and metrics validated in a laboratory environment; live runs executed at measured cost and latency | **TRL 2** — concept formulated; data sources surveyed and access-verified; **no kernel code written.** Claiming TRL 3 would be inflation |
| **At 12 months** | **TRL 5–6** — validated in a relevant environment, contingent on an accumulated live arm with resolved questions and on closing the panel-hash and k-of-N gaps | **TRL 4** — component validation in a laboratory environment: three kernels implemented, four historical backtests with pre-registered bands executed, synthetic oracle with a working negative control, live arm open |
| **What moves it** | Resolved live questions; independent T&E replication of an artifact hash | Working `stock.ts` that beats static on the 2010 +24-month horizon; a Rusal arm that assigns above-base-rate probability to mitigation-within-90-days |

---

## 16. Cost Model

Built from the platform's **measured** live figures, extrapolated to this pack's question shape. Extrapolation, not measurement, and labelled as such.

| Line | Basis | Figure |
|---|---|---|
| Per question, standard panel | Measured: 9 calls, 5m54s | **$0.2959** |
| Per question, red-team rerun | Measured: 17 calls, 8m12s | **$0.7544** |
| Numeric ensemble | Measured: 15,832 simulations in 305 s | Compute-seconds; negligible |
| Full backtest sweep, 80 adjudicated questions at the red-team rate | 80 × $0.7544 | **≈ $60** |
| Live arm, 40 questions/month at the red-team rate | 40 × $0.7544 | **≈ $30/month** |

**Note against a common error:** the platform's 80q × 32-run batch shape means 32 runs of the *numeric kernel*, not 32 panels. Multiplying the per-question LLM cost by 32 would overstate the figure by more than an order of magnitude.

**The conclusion that matters to a programme office: model inference is the cheapest line item in this programme by roughly two orders of magnitude.** The real cost is (1) data licensing — GSDB usage terms for contractor use are an open action item, GTAP carries a licence fee, Comtrade bulk access is a subscription; (2) the independent cleared T&E team, which under the REASON pattern is the single largest line; (3) analyst hours to pre-register bands, which is irreducible because pre-registration is what makes the score mean anything.

---

## Sources

[Global Sanctions Data Base (GSDB-R4)](https://www.globalsanctionsdatabase.com/) · [GSDB-R4 working paper](https://www.lebow.drexel.edu/sites/default/files/2025-01/wp2025002-global-sanctions-db.pdf) · [GAO-20-145, Economic Sanctions](https://www.gao.gov/products/gao-20-145) · [GAO-25-107079, Russia Sanctions and Export Controls](https://www.gao.gov/products/gao-25-107079) · [MOFCOM Announcement No. 18 (2025)](https://english.mofcom.gov.cn/Policies/AnnouncementsOrders/art/2025/art_0dd87cbee7b045bf93fabe6ab2faceee.html) · [MOFCOM Notice No. 61 (2025), CSET translation](https://cset.georgetown.edu/publication/mofcom-notice-2025-61/) · [Crowell, China expands rare earth controls](https://www.cmtradelaw.com/2025/10/china-expands-rare-earth-export-controls-and-adds-14-entities-to-the-unreliable-entity-list/) · [USGS Mineral Commodity Summaries 2026](https://pubs.usgs.gov/publication/mcs2026) · [MCS 2026 — Rare Earths](https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-rare-earths_ver.1.2.pdf) · [MCS 2026 — Gallium](https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-gallium.pdf) · [OFAC, Rusal delisting 27 Jan 2019](https://ofac.treasury.gov/recent-actions/20190127) · [OFAC, notification of intended removal, 19 Dec 2018](https://ofac.treasury.gov/system/files/126/20181219_notification_removal.pdf) · [OFAC, General Licence 14, 23 Apr 2018](https://ofac.treasury.gov/recent-actions/20180423) · [CRS R42510, China's Rare Earth Industry and Export Regime](https://www.everycrsreport.com/reports/R42510.html) · [Notre Dame, 2010 REE episode as a pathway case](https://ondisc.nd.edu/assets/344352/market_structure_and_economic_sanctions_the_2010_rare_earth_elements_episode_as_a_pathway_case_of_market_adjustment.pdf) · [MINING.com, rare earth prices imploding (Apr 2012)](https://www.mining.com/we-need-to-talk-about-how-rare-earth-prices-are-imploding/) · [Boehm, Levchenko & Pandalai-Nayar, AER 2023](https://www.aeaweb.org/articles?id=10.1257%2Faer.20210225) · [Baqaee & Farhi, Beyond Hulten's Theorem](https://www.nber.org/papers/w23145) · [Deaton & Laroque, On the Behaviour of Commodity Prices](https://www.princeton.edu/~deaton/downloads/On_The_Behaviour_of_Commodity_Prices.pdf) · [Cafiero et al., empirical relevance of the competitive storage model](https://ideas.repec.org/a/eee/econom/v162y2011i1p44-54.html) · [OECD Inter-Country Input-Output tables](https://www.oecd.org/en/data/datasets/inter-country-input-output-tables.html) · [GTAP 12 regions](https://www.gtap.agecon.purdue.edu/databases/regions.aspx) · [PIIE, North Korean trade data: caveat emptor](https://www.piie.com/blogs/north-korea-witness-transformation/north-korean-trade-data-caveat-emptor) · [UN Comtrade methodology](https://comtrade.un.org/labs/data-explorer/About.html) · [China GACC monthly statistics](http://english.customs.gov.cn/Statistics/Statistics?ColumnId=1) · [ICD 203, Analytic Standards](https://donohueintellaw.ll.georgetown.edu/sites/default/files/assets/ICD%20203%20Analytic%20Standards.pdf) · [50 U.S.C. § 3364, analytic integrity](https://uscode.house.gov/view.xhtml?req=%28title%3A50+section%3A3364+edition%3Aprelim%29) · [IARPA REASON](https://www.iarpa.gov/research-programs/reason) · [REASON BAA W911NF-23-S-0007](https://arl.devcom.army.mil/wp-content/uploads/sites/3/2023/04/W911NF-23-S-0007-REASON-BAA-Final-17-March-2023.pdf) · [CIA Acquisition Framework, 9 Feb 2026](https://www.cia.gov/stories/story/cia-launches-new-acquisition-framework-to-turbocharge-collaboration-with-private-sector/) · [Nextgov, CIA acquisition framework](https://www.nextgov.com/acquisition/2026/02/cia-announces-new-acquisition-framework-speed-tech-adoption/411285/) · [15 CFR Pt. 744 Supp. 5, ERC procedures](https://www.law.cornell.edu/cfr/text/15/appendix-Supplement_No_5_to_part_744) · [BIS End-User Review Committee](https://media.bis.gov/about-bis/bis-leadership-and-offices/end-user-review-committee) · [90 FR, Entity List additions, 16 Sep 2025](https://www.govinfo.gov/content/pkg/FR-2025-09-16/html/2025-17893.htm) · [85 FR 29849, Huawei FDPR interim final rule](https://www.govinfo.gov/content/pkg/FR-2020-05-19/html/2020-10856.htm) · [85 FR, Huawei FDPR final rule, 20 Aug 2020](https://www.govinfo.gov/content/pkg/FR-2020-08-20/html/2020-18213.htm) · [CRS IF12062, Russia financial and trade sanctions](https://www.congress.gov/crs-product/IF12062) · [Council of the EU, oil price cap, 3 Dec 2022](https://www.consilium.europa.eu/en/press/press-releases/2022/12/03/russian-oil-eu-agrees-on-level-of-price-cap/) · [50 U.S.C. § 98e-2, multiyear procurement authority](https://www.law.cornell.edu/uscode/text/50/98e-2) · [50 U.S.C. § 98h-2, stockpile reports](https://uscode.house.gov/view.xhtml?req=%28title%3A50+section%3A98h-2+edition%3Aprelim%29) · [DLA Strategic Materials](https://www.dla.mil/Strategic-Materials/) · [SASC hearing, rebuilding critical minerals supply chains, 24 Feb 2026](https://www.armed-services.senate.gov/hearings/to-receive-testimony-on-rebuilding-american-critical-minerals-supply-chains) · [GSA SCRIPTS BPA](https://www.gsa.gov/technology/it-contract-vehicles-and-purchasing-programs/multiple-award-schedule-it/bpas-scripts) · [Exiger, SCRIPTS award](https://www.exiger.com/perspectives/exiger-wins-gsa-scripts-bpa/) · [DIU, Altana Supply Chain Illumination](https://www.diu.mil/solutions/portfolio/catalog/a0Tt0000009WqubEAC-a0h830000004wfMAAQ) · [Sayari government](https://sayari.com/government/) · [Kharon public sector](https://www.kharon.com/solutions/industries/public-sector)