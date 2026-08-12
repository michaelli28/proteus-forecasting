# CONOPS — The Iran→Water Chain: Decision → Activation → Consequence

**Fuses C-ADV-1 (Sub-Threshold Action Selector) + C-CYBER-1 (Activation Clock) + C-CYBER-2 (Hydra consequence twin)**
Capability ID: **C-CHAIN-1**. Evaluation-regime discipline: **three regimes, never pooled.**

---

## 1. In Plain English

**What it does:** It answers three linked questions as one chain — *will* Iran move against US water controls in the next 90 days, *when* would it spend the access it already has, and *what actually happens to the water* if it does. The last question is answered by a real hydraulic simulator that the government itself co-wrote, so anyone can rerun it and check us.

**Why it matters:** Today those three questions live with three different people who never talk: an intelligence analyst, a cyber threat hunter, and a utility engineer. Nobody hands the answer forward. The chain does the handoff, and it records exactly how confident it is at each step.

**What is new:** The chain refuses to launder a weak link into a strong headline. The middle question depends on a number only classified reporting has, so the unclassified version is *structurally capped* at low confidence — and it says so on the front page, naming the stage that capped it. It also refuses, in code and not in policy, to ever produce a ranked list of named American water utilities.

**The honest catch:** For the first question the truthful answer will often be "I don't know." A buyer who wants a yes/no on "will Iran attack" will get a documented refusal instead. That is the product working, not failing.

---

## 2. The analytic question and its resolvable quantity

The chain is **four** registered questions, not one. Each has its own partition, its own oracle, and its own evaluation regime. This is the load-bearing design decision: a single fused question would force a single regime tag, and the platform correctly refuses to pool regimes (`EvaluationRegime` is threaded through every metric entry point — `src/metrics/index.ts:40`, `src/pipeline/score.ts:84`, `src/pipeline/benchmark.ts:105` — and no function reduces across them).

### Q1 — Decision (C-ADV-1)

> In the 90-day window `[T, T+90)`, how many **distinct disclosed onsets** of Iranian-affiliated disruptive interaction with operational technology at US water and wastewater systems will be attributed by a dated public artifact, and what is the **dominant instrument**?

**Partition** (MECE, ordinal in severity, jointly over count × instrument):

| Count band | Instrument band (dominant) |
|---|---|
| 0 | — |
| 1 | I1 exposure/defacement only |
| 2–4 | I2 lockout (password change, IP change) |
| ≥5 | I3 logic modification (project file / Add-On Instruction) |
| | I4 setpoint manipulation **with alarm or shutdown logic disabled** |

The instrument bands are not invented. They are the observed progression in the primary record: AA26-097A's July 22, 2026 update documents project-file exfiltration via vendor configuration software, then "modification and deletion of project file logic, to include Add-On Instructions (AOIs)," and states that "the changes disabled critical shutdown and alarm logic, allowing systems to enter unsafe conditions without notifying operators of the anomalies." CISA's July 30, 2026 alert documents the lockout instrument: actors "modified passwords to lock out operators and disconnected the PLCs by changing their IP addresses," with the result that "this activity has resulted in boil water notices and sustained manual operations."

**Resolution event:** publication, by `T+90+L`, of a dated artifact from a pre-registered source set meeting a written inclusion test.

**Oracle (source set, all third-party, all on a known cadence — the platform's strongest selection criterion):** CISA Cybersecurity Advisories and Alerts; CISA/GovDelivery bulletins; EPA newsroom releases (the April 7 and July 22, 2026 releases are the pattern); FBI PSAs and IC3 notices; WaterISAC TLP:CLEAR advisories; state IT-agency and fusion-center public statements (Minnesota IT Services, July 2026, is the precedent).

**`L`, the disclosure lag buffer, is pre-registered at 30 days and is itself the most attackable parameter in the design.** It is stated in the question file, hashed at registration, and never adjusted after a window opens. A window whose evidence arrives after `T+90+L` resolves to **UNRESOLVED**, which is reported and excluded from scoring rather than counted as a miss. Any scoring scheme that lets the analyst move `L` after the fact is fraudulent, and a panel should check this first.

### Q2 — Activation (C-CYBER-1)

> Conditional on an onset, what is the elapsed time from earliest disclosed access to first disruptive effect?

**Partition:** `≤7d | 8–30d | 31–90d | >90d | access held, never spent`.

**Oracle:** the advisory text itself, which carries extractable dated intervals. AA26-097A states activity "since at least March 2026" and was published April 7, 2026. Aliquippa: access and effect in the same window (November 25, 2023 intrusion; CISA alert November 28, 2023). Minnesota: onset July 26, compromise detected the evening of July 26 in Plymouth, normal operations restored the afternoon of July 28 — a two-day coordinated event across more than 30 community water systems.

**This oracle is thin and it is biased, and the bias is not correctable with unclassified data.** It observes only activations that were *disclosed*. The `never spent` band is structurally unobservable: held access produces no artifact. Consequently Q2 carries a **hard confidence ceiling of `low`** in the unclassified instantiation, set in the binding config and not by adjudicator judgment. See §9 for what lifts it.

### Q3 — Consequence (C-CYBER-2)

> For archetype network `A` under control perturbation `p` sustained `d` hours, what is the **person-hours of service below the stated pressure threshold**, and the peak count of demand nodes below threshold?

**Oracle:** the solver — WNTR over EPANET 2.2.0, authored and maintained by Sandia National Laboratories and the EPA. This is the only stage a technical evaluation panel can independently verify by rerunning it on their own machine, and that property is why the chain leads with it in the demonstration (§8).

**The `required_pressure` trap, and the structural fix.** WNTR's documentation states the pressure-dependent-demand defaults plainly: `required_pressure` **0.07 m (0.1 psi)**, `minimum_pressure` 0 m, `pressure_exponent` 0.5 — and warns, verbatim: *"If the user does not increase the default required pressure value, then a PDD simulation will be very similar to a DD simulation."* The judge's caution is **CONFIRMED by the primary source.** A headline "N people without water" produced at defaults is substantially an artifact of a config value.

The fix is a type, not a warning. The pack's consequence config declares:

```ts
readonly requiredPressureSweepM: readonly [number, number, ...number[]];
```

A tuple with minimum length two. **A single-value run is not expressible in the schema.** The reported quantity is the *band the outcome occupies across the entire sweep*, reported alongside the demand-driven baseline. If the sweep straddles a band boundary, the archetype returns `INSUFFICIENT_EVIDENCE` rather than a number. This converts the trap from a footnote into an abstention.

### Q4 — Composite

> Given Q1–Q3, is the composition itself valid, and what is the joint band ordering over consequence?

Q4 has no accuracy oracle. It is adjudicated, not scored (§4, §7).

### As-of discipline

Every stage runs against a pinned corpus snapshot with a hard date filter. The platform's `AsOfCorpus` throws `LeakageError` if any evidence reference in a finished product post-dates the run's as-of date (`src/corpus/as-of.ts`, `assertNoLeakage`). For a chain built on advisories that are *revised in place* — AA26-097A was published April 7 and materially rewritten July 22, 2026 — this matters more than usual: the pack's corpus loader stores advisory **revisions as distinct dated documents**, so a run as-of May 2026 cannot see the July expansion to Schneider Electric and Siemens. A retrieval layer that fetched "the current advisory" would leak silently. This is a named pack requirement, not a platform default.

---

## 3. The kernel

### Honest architecture class — stated before the mechanics

This capability is **not one architecture**. It is three, and conflating them is the failure mode a panel should probe first:

| Stage | Class | What is actually being computed |
|---|---|---|
| Q1 Decision | **estimate-and-adjudicate** | A structured prior over instrument choice, organized by a mixed-logit form. With 3–4 disclosed onsets in the reference period, this is closer to disciplined prior elicitation than to estimation. |
| Q2 Activation | **estimate-and-adjudicate** | An optimal-stopping *frame* over an unobservable inventory. The output is a smooth function of the prior. Confirmed weakness, not mitigated — bounded. |
| Q3 Consequence | **consequence twin** | Genuine physics. Mass and energy conservation, headloss, pressure-dependent demand, solved deterministically by EPANET 2.2.0. |

**One third of this capability is a verifiable physics twin. Two thirds are disciplined priors with measured abstention.** Saying that first is what makes the rest credible; a bid that presents all three as "simulation" deserves to lose.

### State variables and dynamics

**Q1 — mixed-logit over instrument choice with competing risks over timing.**
Latent state carried per particle: `I` = access inventory (count × quality), `r` = attribution-risk sensitivity, `π(t)` = political payoff driven by an exogenous escalation index (unclassified proxy: a dated index built from public bilateral-hostility markers), and an instrument cost/benefit vector over I1–I4. Competing risks because the window can also close by deterrence, by disruption of the actor, or by substitution to a non-water sector — and a single-risk hazard would attribute all non-events to "chose not to act," which is wrong and inflates apparent decision skill.

**Q2 — threshold-rule optimal stopping.** State: `I` (inherited, as a distribution — see below), detection hazard `λ(t)`, access value decay, political payoff. The stopping rule spends access when marginal expected payoff exceeds the option value of holding. The load-bearing input is the prior on `I`. That is the classified number.

**Q3 — deterministic hydraulic solve.** State: topology, demand pattern, tank levels, pump/valve control state, perturbation `p` (setpoint change, pump stop, alarm suppression duration `d`), and the mandatory `required_pressure` sweep.

### The composition semantics — and why it is not a product of three probabilities

The naive fusion is `P(decide) × P(activate | decide) × P(consequence | activate)`. That is wrong for four separate reasons, and the design refuses it structurally.

**(i) Particle passing, not marginal multiplication.** Q1's ensemble emits particles `{(b₁⁽ⁱ⁾, I⁽ⁱ⁾, r⁽ⁱ⁾)}` for `i = 1..N` — the ensemble carries the **latent state**, not just the band label. Q2 consumes the same particles: for each `i`, the stopping model is conditioned on `(I⁽ⁱ⁾, r⁽ⁱ⁾, b₁⁽ⁱ⁾)`. No conditional-independence assumption is made anywhere, because none is needed. Multiplying marginals would require `b₁ ⟂ b₂`, which is false: both depend on `I`. The access inventory that makes the decision cheap is the same inventory the clock stops on. Marginalizing destroys exactly the correlation that matters.

**(ii) Q3 is not a probability at all.** EPANET is a deterministic map `g: (b₁, b₂, archetype a, required_pressure q, duration d) → consequence`. The consequence measure is the **pushforward** `g#(μ)` of the joint particle measure over the product with the archetype set and the mandatory `q`-sweep. Treating `g` as "the third probability" is the specific error the fusion exists to eliminate. Uncertainty at Q3 is entirely uncertainty in `g`'s *inputs*, and the sweep is how it is quantified.

**(iii) Severity and likelihood are anti-correlated, and the product flattens it.** A low-risk-tolerance actor selects I1/I2 — high probability, low physical consequence (Plymouth: two water towers and fourteen sewer lift stations, manual operation for roughly 48 hours, water quality never affected). A high-risk-tolerance actor selects I4 — low probability, high consequence, and AA26-097A documents that instrument existing in the wild. The product of marginals hands a policymaker a scalar "chance of a bad day." The composed ensemble hands them **which** bad day, correlated with **how likely** — which is the only form in which the answer is decision-relevant. The customer's stated need is to inform US response options; response options are indexed by instrument, not by a scalar.

**(iv) Abstention is absorbing, and products cannot express that.** `INSUFFICIENT_EVIDENCE` is a first-class verdict evaluated *before* scoring. Under composition it is absorbing **per particle**: if stage `k` abstains for particle `i`, that particle contributes to no downstream band. If abstained mass exceeds the registered threshold, the composite abstains. A multiplication would silently emit a number whenever any stage failed to answer.

### Confidence under composition — weakest link, and what it implies

The platform aggregates confidence by weakest link, deliberately, and the code says why (`src/evidence/icd203.ts:112`):

> *"Deliberately NOT a mean. An ensemble is no more confident than the evidence base it shares, and averaging lets several moderate-confidence views manufacture a high-confidence product out of nothing new."*

Likelihood and confidence travel through different functions (`aggregateLikelihood` vs `aggregateConfidence`) and meet only inside `Judgment`. Applied across the chain with Q2's ceiling at `low`:

> **The unclassified composite can never exceed LOW confidence, by construction. This is a feature, and the report names Q2 as the binding constraint on its first page.**

That is a stronger thing to put in front of this buyer than a fabricated "moderate." It converts the classification barrier from an excuse into a *measurable delta* (§9).

### Evaluation regimes across the join

Each stage carries its own regime. The composite carries a **vector**, never a scalar:

```ts
type CompositeRegime = readonly [EvaluationRegime, EvaluationRegime, EvaluationRegime];
```

| Stage | Regime now | Regime at maturity |
|---|---|---|
| Q1 | `synthetic_oracle` (pre-registered), migrating to `live_post_cutoff` as windows resolve | `live_post_cutoff` |
| Q2 | `historical_backtest` on disclosed intervals only | unchanged unclassified; classified adds nothing to the *regime*, only to the prior |
| Q3 | `synthetic_oracle` — the oracle is the reference solver | `historical_backtest` if ever validated against a real logged outage |

**There is no composite Brier score, and no code path produces one.** The report emits three stage-scoped scorecards and a stated join. A panel that asks "what is the fused accuracy of the chain" should be told, on the record, that the question is malformed and why.

### What varies across the ensemble

The platform's two actor knobs are re-bound for this domain rather than reinvented — the pattern already exists at `src/pipeline/recruitment-binding.ts`, which reinterprets `riskTolerance` and `escalationPropensity` for a different mission lens *"so a framing produced for one domain still means something here."* Here:

- `riskTolerance` → instrument selection up the I1→I4 ladder; tolerance for attributable effect.
- `escalationPropensity` → stopping threshold and onset timing within the window.

**Gap 3 handled honestly:** two knobs do not span this domain. The pack declares two **pack-local** knobs rather than pretending otherwise — `accessInventoryPrior` and `attributionSensitivity` — and all four enter the run identity. Declaring the extension is the correct response to a confirmed platform limit; silently overloading `riskTolerance` to carry inventory would be the dishonest one.

Ensemble size: N = 512 particles per stage. The platform's measured kernel throughput is 15,832 simulations in 305 s, so the sampling cost is negligible. **Note: that figure is the platform's own kernel. WNTR solve wall-clock is UNMEASURED and is benchmarked in demonstration week 3–4 (§8).**

---

## 4. The panel

The panel is **stage-scoped**. A single panel judging a fused output would launder Q2's weakness into a confident composite — the exact failure the architecture exists to prevent.

| Stage | Technique | What it adjudicates | Rubric anchor |
|---|---|---|---|
| Q1 | **ACH** (Heuer diagnosticity weighting; ranking by weighted inconsistency ascending) | Instrument bands as competing hypotheses against the advisory/exposure/reporting corpus | Does each evidence item discriminate *between* bands, or is it consistent with all of them? Non-diagnostic evidence is downweighted, not counted. |
| Q1 | **Key Assumptions Check** | The reference-class definition: what counts as an "onset" | Every assumption carries a REQUIRED falsifier (platform-enforced). |
| Q1 | **Devil's Advocate** | The disclosure-lag `L` and the stationarity of the base rate | Must argue that 2026 is a different process from 2023–2025 (§7). |
| Q2 | **Key Assumptions Check** — *primary* | The access-inventory prior | The load-bearing object here is an assumption, not evidence; KAC is the correct primary instrument and ACH is not. |
| Q2 | **Premortem** | "It is T+90. We said ≤7 days; it was 60. What did we believe that was wrong?" | Output is a named belief, not a sentiment. |
| Q2 | **Red Team** (bounded rerun authority) | Authorized to rerun **once** with a different inventory prior; the rerun is recorded in the artifact and its cost is measured. | Measured red-team rerun cost: $0.7544 / 17 calls / 8m12s. |
| Q3 | **Key Assumptions Check** (LLM) | Archetype representativeness only | Is this archetype a fair stand-in for the class of systems in question? |
| Q3 | **Deterministic gates** (code, not LLM) | Mass-balance residual; DD-vs-PDD divergence; sweep-band coherence | **A structured analytic technique is the wrong instrument for a hydraulic solver.** Saying so is more honest than staffing a panel that cannot check the physics. |
| Q4 | **Devil's Advocate** — dedicated | Sole charter: argue the composition is invalid — that three regimes make the join meaningless | Its dissent is a **required field** in the product, not an optional note. |

That last row is the answer to the landscape sweep's coordination finding: IC finished intelligence is coordinated, and nothing in sixty candidates said who takes the dissent footnote. Here it is a named structural slot with a mandatory output.

### Two platform prerequisites, both confirmed in code this session

**Gap 1 — the rubric that judged a run is not in the artifact.** `PanelPlanSchema` (`src/agents/panel.ts:40`) carries an LLM-generated `systemPrompt` per adjudicator; `RunIdentity` is `{ config, corpusSnapshotId, kernelVersion }` (`src/artifact/store.ts:28-35`) and `computeRunId` is `hashCanonical(identity)` (`:123-125`). **There is no panel field.** Two runs judged by different generated rubrics share a run id.

Fix, in two parts:
1. **Platform:** extend `RunIdentity` with `panelDigest: string` — the hash of the canonicalized `[{role, techniqueId, systemPrompt}]` array — and persist the resolved `PanelPlan` into the artifact.
2. **Pack:** rubrics are **pinned, not generated.** The pack ships `panel/*.md` and sets `panelSource: "pinned"`. For a bid-grade capability whose selling point is byte-identical reproducibility, a generated per-run rubric is a liability, and pinning removes a source of run-to-run variance at no cost.

**Gap 2 — k-of-N panel loss is a boolean.** `available: results.length > 0` (`src/pipeline/run-question.ts:680`) flows to `level: input.adjudicationAvailable ? "high" : "moderate"` (`src/pipeline/analysis.ts:240`). One surviving adjudicator of eight scores identically to a full panel — and partial panel loss is the **normal** operating condition, empirically: measured adjudicator refusal on the influence-ops task was 5/5, later 2 of 3 declined.

Fix — replace the boolean with a graded quorum rule:

```
high     requires  responded/planned ≥ 2/3  AND  ≥1 of {ACH, KAC} present  AND  devil's-advocate slot filled
moderate requires  responded/planned ≥ 1/3  AND  ≥1 of {ACH, KAC} present
low      otherwise
abstain  if responded == 0
```

Confidence must be a function of *quorum ratio* **and** *technique coverage*, because losing the devil's advocate is not the same loss as losing one of five ACH judges. Until this ships, **any composite confidence this chain reports is overstated**, and the bid must say so rather than wait to be asked.

---

## 5. The Scenario Pack — config versus new code

### Ships as config (no new code)

| File | Contents |
|---|---|
| `question/q1-decision.yaml` … `q4-composite.yaml` | Partitions, as-of dates, source set, `L = 30d`, abstention thresholds, registration hash |
| `panel/{ach,kac,devils-advocate,premortem,red-team}.md` | Pinned rubrics, hashed into `panelDigest` |
| `panel/plan.json` | Stage→technique→role assignment |
| `corpus/sources.yaml` | Dated source list; revision-as-distinct-document rule; license notes |
| `actors/iran-wws.yaml` | Knob bounds for the four-knob re-binding |
| `networks/*.inp` | EPANET archetypes — published reference networks and synthetic composites only (§13) |
| `consequence/thresholds.yaml` | `requiredPressureSweepM`, duration rules, service-pressure threshold |
| `baselines.yaml` | Persistence, climatological base rate, predict-zero degenerate |

### Requires new code — stated honestly, this is not a config-only pack

| Module | Scope | Risk |
|---|---|---|
| `src/pipeline/water-chain-binding.ts` | Domain binding; mirrors `recruitment-binding.ts` | Low — established pattern |
| `src/sim/adapters/subthreshold/` | Q1 mixed-logit + competing risks. Must obey the `sim/` ban on `Math.random`/`Date.now`, enforced by a source-scanning test | Medium — ~400–600 lines |
| `src/sim/adapters/activation/` | Q2 optimal stopping | Low — smaller |
| `src/consequence/wntr-bridge.ts` + Python sidecar | Subprocess bridge to WNTR; hashes the `.inp`, WNTR version, EPANET version, and full parameter set into the artifact | **High — see below** |
| `src/pipeline/composition.ts` | Particle passing, pushforward, absorbing abstention, composite regime vector, weakest-link join | Medium |

**Platform prerequisites (not pack):** `RunIdentity.panelDigest` (gap 1); graded quorum confidence (gap 2).

**The honest hard part** is the WNTR bridge. WNTR is Python; the engine is TypeScript. Byte-identical artifacts across a language boundary are a genuine engineering risk — floating-point and numpy/scipy version drift will break determinism if unpinned. Mitigation is to pin and hash the entire sidecar environment and to assert byte-identity on rerun in CI. This is the one place where the platform's headline reproducibility property is not free, and a panel should press on it.

---

## 6. Data

### Unclassified — all of it real, dated, and citable

| Source | What it supplies | Access reality |
|---|---|---|
| CISA advisories/alerts (AA26-097A, the Nov 28 2023 Unitronics alert, the Jul 30 2026 WWS alert) | Instrument taxonomy, dated onsets, IOCs, targeted device models, ports (44818, 2222, 102, 502; modems on 22) | Public, US Government work — no licence obstacle |
| EPA newsroom + EPA CyberWater | Corroborating dated releases; sector guidance | Public |
| WaterISAC TLP:CLEAR advisories | Sector-side dated confirmations | Public tier; membership tier is TLP:AMBER and **must not** enter an unclassified artifact |
| State fusion centre / state IT statements (MNIT) | Onset detail at incident granularity | Public |
| EPA OIG reports (23-P-0003; 25-N-0004 passive assessment) | Compliance base rates and **aggregate** exposure counts | Public |
| Censys research + State of the Internet | Exposure denominator and its trajectory | Public research; the raw named host list is **not** public and must not be sought (§13) |
| WNTR / EPANET 2.2.0 | The solver | Open source, EPA + Sandia |
| Published benchmark water networks | Q3 archetypes | Open, and deliberately not real utilities |
| Dragos / Claroty OT reporting | Actor TTP corroboration | **Licensing check required** — vendor annual reports are generally public; per-client IR detail is not. Marked as a diligence item, not assumed. |

### Named actor set (verbatim from AA26-097A)

CyberAv3ngers, affiliated with Iran's IRGC Cyber Electronic Command (CEC), also referred to in private industry and open sources as *"Hydro Kitten, Storm-0784, APT Iran, Bauxite, Mr. Soul, Soldiers of Solomon, UNC5691, and the Shahid Kaveh Group."* The 2026 activity is attributed by the authoring agencies to "a group of Iranian-affiliated APT actors" and linked to the CyberAv3ngers pattern by similarity, not by identity — the advisory says the agencies "previously reported on similar activity." The pack's corpus preserves that distinction; collapsing "similar activity" into "same actor" is a leakage of confidence and the KAC rubric tests for it.

### Classified — what it would supply

Access inventory and quality (the Q2 prior); tasking and intent indications; the real escalation index; and, at CUI/PCII rather than collateral classification, calibrated utility hydraulic models.

---

## 7. The oracle and the evaluation plan

### The base-rate trap, and a correction to the pack's own premise

C-ADV-1 was scored with the weakness that most 90-day windows resolve to zero and only ~1–3 events per year resolve. **That premise is stale for the current period, and this is a finding, not a quibble.** Verified this session: AA26-097A describes activity ongoing "since at least March 2026," published April 7, 2026, materially expanded July 22, 2026; and a separate coordinated campaign hit more than 30 Minnesota community water systems on July 26–27, 2026, prompting a distinct CISA alert on July 30, 2026. That is at least two disclosed campaign windows in 2026 by August.

The reference class is therefore not merely sparse — it is **non-stationary**, which is worse. A non-stationary rare-event process defeats the naive baseline *and* the model, and it means a prior fitted on 2023–2025 describes a world that no longer exists. This is the single most likely reason Q1 will be wrong (§14).

### Why Brier skill is the wrong headline here

With `n ≈ 4` resolving windows per year and a modal outcome of zero, a single hit or miss dominates the Brier score. "Predict zero forever" is a brutal baseline that also happens to be useless. Reporting Brier skill as the headline would be metric theatre.

**The honest headline for this question class is a pair:**

- **Tail recall** — of the windows that resolved non-zero, what fraction did the system place in its top-N bands. Reported with the raw numerator and denominator, never as a bare ratio.
- **coverage@N** — how often the realised band sat inside the top-N predicted set.

Brier, Brier skill, Murphy decomposition, ECE with bin occupancy, and sharpness are all still computed and all still reported — **below** the headline, each against three named baselines: persistence (last window's band), climatological base rate over a stated lookback, and the degenerate predict-zero. If the system fails to beat predict-zero, the report says so. The platform has already demonstrated its metrics can detect badness: the deliberately misspecified arm scored −0.4561 Brier skill with coverage@1 of 0.123, worse than base rate, as a negative control.

### Moving the scoring load to a denser sub-question — the most important design move here

The genuinely dense, publicly resolving quantity in this domain is not "will Iran act." It is **exposure trajectory**, and it is measurable on a repeating schedule:

- Censys ARC identified nearly 400 web-based HMIs for US water facilities exposed online in October 2024: 95 authenticated, 264 read-only, and **40 fully unauthenticated and controllable by anyone with a browser**. After coordinated disclosure to EPA and the vendor, 24% were secured within nine days, 58% within roughly a month, and fewer than 20 remained read-only or unauthenticated by May 2025.
- EPA OIG's own passive assessment covered 1,062 drinking water systems serving over 193 million people; the October 8, 2024 scan identified 97 systems serving ~26.6 million people with critical or high-risk vulnerabilities, and a further 211 systems serving over 82.7 million with externally visible open portals.

That is a moving, publicly measured denominator with `n` in the hundreds. **A pre-registered forecast of exposure trajectory resolves every scan cycle**, which gives the 90-day demonstration a calibration curve with real bin occupancy instead of two data points. It is also the sub-question most directly aligned with the landscape sweep's finding that capabilities making claims about the *source base* field better than those making claims about the world.

### Abstention as a first-class number

Reported every cycle, never buried: true abstention rate (platform-measured 80/80 on a provably unanswerable arm), false abstention at the shipped threshold (7%, from a six-arm threshold sweep). For a rare-event stage, a system that abstains honestly outperforms one that emits a confident 3%, and the metric set must be able to say so.

### Metric assignment by stage

| Stage | Headline | Supporting | Baselines |
|---|---|---|---|
| Q1 | tail recall, coverage@N, abstention rates | Brier, Brier skill, ECE + occupancy, sharpness, log score | persistence, base rate, predict-zero |
| Q1-exposure | ECE with bin occupancy, coverage@N | Brier skill, sharpness | persistence |
| Q2 | coverage@N on disclosed intervals; abstention rate | interval calibration | base rate over disclosed intervals |
| Q3 | sweep-band stability; mass-balance residual | DD-vs-PDD divergence magnitude | the DD run itself |
| Q4 | dissent recorded (binary); inter-run stability; Krippendorff α | provenance completeness; contradiction P/R | — |

---

## 8. The 90-day unclassified demonstration

**Pre-registration ceremony, day 0.** The question files' canonical sha256 is transmitted to the government program manager before any window opens. The platform already hashes canonically, so this costs nothing and is independently checkable. Twelve questions registered. This mirrors the IARPA REASON discipline of building and testing unclassified while an independent team evaluates.

| Week | Activity | What is shown | Number produced |
|---|---|---|---|
| 1–2 | Corpus stand-up, as-of discipline | `LeakageError` fires on a deliberately post-dated reference; advisory revisions stored as distinct dated documents (a May-2026 as-of run cannot see the July 22 Schneider/Siemens expansion) | Leakage assertions: pass/fail |
| **3–4** | **Q3 first, not last** | Panel reruns a published benchmark network on their own machines. DD vs PDD at defaults shown to be near-identical, per WNTR's own warning; then the sweep | **WNTR solve wall-clock (currently UNMEASURED); sweep-band stability per archetype** |
| 5–6 | Q1 kernel + pre-registration | Mixed-logit + competing risks; registration hash transmitted | 12 registered questions, hashed |
| 7–8 | Q2 + confidence ceiling | Composite confidence pinned at `low`; ceiling removed in a side-by-side to show what dishonesty would look like | Composite confidence with and without the ceiling |
| 9–10 | Composition | Particle passing; pushforward; the report **refusing** to emit a fused Brier | Composite regime vector, printed |
| 11 | Panel-loss grading (gap 2) | Six of eight adjudicators killed mid-run; confidence steps down under the quorum rule instead of holding at `high` | Confidence vs quorum ratio curve |
| 12 | First resolutions | Exposure-trajectory questions resolve; red-team rerun cost measured live | ECE with bin occupancy; coverage@N; measured $ and latency |
| 13 | Package + reproducibility | Same seed ⇒ byte-identical artifact hash, **across the Python boundary** | Byte-identity: pass/fail; full scorecard including failures |

### What would falsify it

1. **Exposure-trajectory forecasts fail to beat persistence.** The densest, easiest sub-question is the one with the most `n`; failing there means the calibration machinery does not work, and no amount of rare-event storytelling rescues it.
2. **The `required_pressure` sweep straddles band boundaries on most archetypes.** Then Q3 abstains almost always and the consequence twin — the only verifiable stage — produces nothing usable. This is why Q3 runs in week 3, not week 12.
3. **Q1 abstains on more than a pre-registered fraction of windows.** A system that always abstains is honest and useless; the threshold for "useless" is registered on day 0 so it cannot be moved.
4. **Byte-identity fails across the TypeScript/Python boundary.** The headline reproducibility property does not survive the sidecar.

Any of these, reported, is a successful demonstration outcome in the scientific sense and a failed one in the procurement sense. The bid should say which it is treating as which, in advance.

---

## 9. The classified instantiation

### What changes, precisely

| Stage | What classification adds | Effect |
|---|---|---|
| Q1 | Intent and tasking indications; a real escalation index rather than an open-source proxy | Raises confidence; may shift bands |
| **Q2** | **The access inventory.** | **This is the only stage where classification changes the *answer* rather than the *confidence in* the answer.** |
| Q3 | The utility's own calibrated hydraulic model in place of an archetype | Narrows the sweep; this is **CUI/PCII, not collateral classification** — a materially easier accreditation path, and worth separating in the proposal |

### The value proposition is a single measurable number

Because confidence is weakest-link and the composite is pinned by Q2's ceiling, the entire classified uplift is expressible as **the composite confidence level before and after the inventory prior is supplied**. Not a narrative. A level, with the binding stage named. This is a rare case where "what does classification buy you" has a crisp, pre-registered, testable answer, and it should be the headline of the classified-instantiation section in the bid.

### The accreditation obstacle — stated without softening

The engine is a TypeScript service that calls a commercial LLM API for framing and adjudication. **In a classified enclave there is no commercial LLM API.** Two paths:

**(a) On-premise accredited model.** Changes the measured numbers. Every calibration figure, every abstention rate, and the 5/5 adjudicator-refusal observation must be re-baselined against the accredited model. A bid that quotes unclassified-measured numbers for a classified instantiation is quoting numbers that were never produced.

**(b) The REASON pattern — recommended.** Performers build and are tested on unclassified data; an independent **cleared** T&E team evaluates on classified material in parallel; performers never receive classified access and refine against unclassified summary-level feedback. REASON is a 42-month program with Phase 2 running October 2025–March 2027 and requires a minimum of Government Purpose Rights. Deterministic, byte-identical artifacts make this pattern cheaper than it has ever been: the cleared team **reruns the artifact and diffs** rather than re-deriving the analysis.

**The unglamorous second obstacle, named because panels respect it:** the WNTR sidecar adds a Python runtime with numpy/scipy as a second accreditation surface. Two language runtimes to authorise instead of one. The named on-ramp is the CIA's February 2026 Acquisition Framework, built around centralised vendor vetting, a streamlined IT authorisation process, and explicit pathways to rapidly onboard breakthrough technology prototypes.

---

## 10. Buyer, workflow displacement, and the analyst-hour denominator

### Who owns each stage, and what dated signed artifact it lands on

| Stage | Owner | Dated artifact with a signature block |
|---|---|---|
| Q1 Decision | CIA/ODNI analytic line; DHS I&A; FBI | An ICD 203-compliant coordinated assessment; a watch item |
| Q2 Activation | CISA Threat Hunting; USCYBERCOM/CNMF; FBI Cyber | **A joint Cybersecurity Advisory.** AA26-097A *is* the artifact: Product ID, original publication date, last-update date, and an authoring-agency block naming FBI, CISA, NSA, EPA, DOE, USCYBERCOM–CNMF and Treasury. |
| Q3 Consequence | — **the chain breaks here** — | see below |

Q2's buyer chain is the strongest in the entire capability portfolio: **the output type already exists, is produced on a recurring cadence, and already carries a signature block.** No new artifact needs to be invented, no new review path negotiated. The chain feeds the impact and mitigation-prioritisation sections of a product that CISA and its partners already publish.

### The honest problem at Q3 — EPA's lever is advisory, not regulatory

**CONFIRMED, with the paper trail:** EPA issued an interpretive memorandum on March 3, 2023 ("Addressing Public Water System Cybersecurity in Sanitary Surveys or an Alternate Process") requiring states to evaluate OT cybersecurity during sanitary surveys. The Eighth Circuit stayed it on July 12, 2023 on petition by Missouri, Arkansas and Iowa, with AWWA and the National Rural Water Association intervening. EPA withdrew it on October 11, 2023. In the October 25, 2023 joint stipulation of dismissal, EPA represented that it **"does not interpret existing regulations to require states to include an evaluation of the cybersecurity of operational technology during sanitary surveys of public water systems, or through an equivalent alternate process, and does not intend to issue or maintain guidance or memoranda to that effect."**

The only binding federal hook is **AWIA §2013 / SDWA §1433 (42 U.S.C. §300i-2)**: community water systems serving more than 3,300 people must conduct a risk-and-resilience assessment and emergency response plan and certify to EPA, then review at least every five years. But §1433 **does not require any particular standard, method or tool** — EPA merely recommends AWWA J100-10 and its own VSAT Web 3.0. EPA holds sole enforcement (not delegated to state primacy agencies), with civil penalties up to $69,733 per day per violation available under SDWA §1414.

Compliance is poor. EPA OIG found approximately 19% of water systems never certified their RRA by the statutory deadlines — systems serving 40 million people — with 95% of the non-compliant being small systems, disproportionately serving disadvantaged communities; EPA disagreed with the OIG's recommendations. EPA's own May 20, 2024 enforcement alert stated that **over 70% of inspected water systems fail to comply with §2013.**

And there is no money. The 7th Drinking Water Infrastructure Needs Survey puts the 20-year national need at **$625 billion** (January 2021 dollars, a 32% increase over the 6th), of which $100.1B falls on small systems (≤3,300) and $273.1B on medium systems (3,301–100,000) — precisely the size classes that made up 95% of the non-compliant population. Aliquippa serves about 15,000 people. Braham, Minnesota is a small city.

**So: the consequence lands on a municipality with no mandate and no money. Do not sell Q3 to a municipality, and do not sell it to EPA as a compliance product.** Sell it where a signed artifact and a budget already exist:

1. **Inside the CISA advisory's impact section** — the consequence annex behind "why this matters," feeding an artifact that already ships.
2. **As the IC's "so what" paragraph** — the quantified consequence behind an ICD 203 product's implications.
3. **The AWIA §2013 RRA itself — sold to the delivery layer, not the utility.** The RRA is a dated document certified to EPA on a statutory five-year cycle. Roughly 1,000 large and medium CWSs and roughly 9,000 small CWSs (3,301–49,999) fall in the 2025–2026 cycle. The buyer is the **technical-assistance provider and engineering firm** that performs RRAs at scale, and EPA's WaterTA / Cybersecurity Technical Assistance Program that funds that work. That is the signature block with a recurring cadence and an appropriation behind it.

### The analyst-hour denominator

For Q3 the displaced workflow is **not** an IC analyst-hour. It is an **INL Consequence-driven Cyber-informed Engineering engagement** — the human-executed methodological ancestor of exactly this twin. CCE is a four-phase process (Consequence Prioritisation → System-of-Systems Analysis → Consequence-based Targeting → Mitigations and Protections) which begins from the assumption that a determined adversary *will* penetrate the network, and which INL's own reference documents describe as "a considerable undertaking, iterative in nature" that should become part of an organisation's culture.

CCE is rigorous, expert-led, engineering-grounded — and per-utility and multi-month. There are roughly 10,000 community water systems above the 3,300 threshold. **CCE cannot be run 10,000 times.** That gap is the displacement argument, and it is an honest one because the twin does not replace CCE's judgment; it replaces CCE's *arithmetic* and makes Phase 1 consequence prioritisation reproducible at population scale.

For Q1/Q2 the denominator is the recurring IC production cycle for a watch item. **I do not have a verified figure for IC analyst-hours per advisory and will not invent one — UNVERIFIED.** The structure of the denominator (evidence assembly, hypothesis enumeration, coordination rounds, confidence reconciliation) is what the chain compresses; the coefficient must be supplied by the customer from its own timekeeping, and the bid should ask for it rather than assert it.

---

## 11. Benefit-category mapping

**(a) Efficiency and accuracy.** Q3 replaces a hand-built consequence narrative with a solver the panel reruns itself — WNTR over EPANET 2.2.0, EPA and Sandia authored. The accuracy claim is scoped precisely to *hydraulic fidelity against a reference solver*, **not** to predicting Iranian behaviour. Efficiency: the deterministic artifact means a reviewer reruns rather than re-derives, which is what makes the cleared-T&E pattern affordable.

**(b) Reduced time to analyse, plus better prediction.** Measured, not projected: 15,832 platform simulations in 305 s; $0.2959 (9 LLM calls) or $0.7544 (17 calls with red-team rerun) and 5m54s / 8m12s per live question. The *prediction accuracy* half of this claim is scoped to the exposure-trajectory sub-question, the only one with enough resolving events to support a calibration curve inside 90 days. Extending it to the decision question would be evidence-class inflation.

**(c) Quality assurance — identify discrepancies between sources and reconcile differences in analytic confidence.** **This is the strongest fit and should lead the bid.** Weakest-link aggregation (`src/evidence/icd203.ts:112`) is literally a mechanism for reconciling differing analytic confidence without letting averaging manufacture certainty; contradiction precision/recall is a source-discrepancy detector; provenance-per-claim counts unsupported assertions rather than blocking them, which preserves the analyst's judgment while making its evidentiary basis countable. This also matches the landscape finding that capabilities making claims about the **source base** field more readily than those making claims about the world.

**(d) Cost reduction by automating repetitive analysis and simulation.** Two concrete mechanisms: the AWIA §2013 RRA cycle across ~10,000 systems on a five-year clock, and the CCE scaling gap. Plus the re-review economy — a cleared team diffs a byte-identical artifact instead of reconstructing an analysis.

---

## 12. Incumbents and prior programs

| Named | What it does | What it does not do |
|---|---|---|
| **INL CCE** | Four-phase, expert-led, engineering-grounded consequence analysis; assumes penetration; produces High Consequence Events, System Descriptions, Attack Scenarios and Target Details | Does not scale past bespoke engagements; produces no probability, no calibration record, and no machine-checkable artifact |
| **EPA VSAT Web 3.0 / AWWA J100-10** | The tools EPA recommends for §1433 RRAs | No hydraulics, no adversary model, no forecast |
| **WNTR / EPANET 2.2.0 (EPA + Sandia)** | The solver | **Not an incumbent — a dependency, deliberately.** It is what makes Q3 independently verifiable. We are not competing with it and should say so plainly. |
| **Censys / Shodan / Dragos / Claroty** | Measure the exposure denominator and OT threat telemetry | Do not compose exposure to consequence, and do not forecast |
| **IARPA REASON** | The contracting and evaluation *pattern* — unclassified build, cleared parallel T&E, 42-month program, Phase 2 Oct 2025–Mar 2027, minimum Government Purpose Rights | Not a competing product |
| **WaterISAC** | Dissemination channel with a real dated-artifact cadence | Not an analytic engine |

Two corrections carried forward and enforced here: **Rhombus Power's $200M IDIQ (FA7014-25-D-0011, Sept 2025) is PPBE budget decision-support tooling, not adversary forecasting** — it is not the incumbent in this lane and must not be cited as one. And the 2024 "LLMs lose to superforecasters" figures (0.068 vs 0.119) are stale as of the ForecastBench operators' July 2026 report; they must not be quoted as current. That correction strengthens rather than weakens this design: if raw forecasting skill is commoditising, the durable differentiator is measurement, abstention, provenance and calibration — which is what this chain is made of.

**UNVERIFIED:** I did not establish that no commercial vendor sells a fused decision→activation→consequence product for this domain. Absence of evidence was not converted into evidence of absence, and the bid should mark it as a diligence item rather than claim a clear field.

---

## 13. Red lines and their structural enforcement

**Red line 1: This must never become a ranked target list of named US utilities.**
**Red line 2: This is not a targeting aid against Iran either.** It forecasts and models consequence; it does not select, nominate, or prioritise foreign targets.

Five enforcement mechanisms. Each is a type-level or test-level fact, not a policy paragraph.

1. **The twin cannot address a real utility.** `.inp` archetypes are published reference networks and synthetic composites. The network loader accepts a `NetworkArchetypeId` from a closed `as const` union — **there is no code path that takes a file path or a PWSID.** Pointing the twin at a real system requires forking the code, which is a visible, attributable act.

2. **No identifier reaches an artifact.** The artifact writer's input type structurally excludes an identified-utility shape, and a test scans emitted artifacts for PWSID-shaped strings (`^[A-Z]{2}\d{7}$`) and latitude/longitude pairs and fails the build. This reuses an enforcement pattern the platform **already runs and already passes** — the source-scanning test that bans `Math.random` and `Date.now` in `sim/`. Reusing a proven guard is worth more than inventing a new one.

3. **No ranking function exists.** Mirroring the platform's existing structural refusal — there is no function of type `(Judgment) => number` — this pack has **no function of type `(readonly Utility[]) => readonly Utility[]`** and no comparator over networks. Archetypes are returned in canonical order fixed by id hash, never by any severity measure. **Severity attaches to bands. It never attaches to entities.**

4. **The exposure stage counts; it does not enumerate.** Exposure evidence enters as aggregate counts under a minimum-cell-size rule: any bin below `k` members is merged upward or dropped. This is the established norm in this exact domain, twice over. EPA OIG reported 97 systems with critical or high-risk vulnerabilities serving ~26.6 million people **without naming them**. Censys, having built precisely the forbidden artifact — a spreadsheet of nearly 400 exposed water HMIs with IP, port and likely location, 40 of them fully controllable by anyone with a browser — **sent it privately to EPA and the vendor rather than publishing it**, and the exposures were remediated. The norm exists, it works, and this pack adopts it rather than inventing a weaker one.

5. **Abstention is the last line, and it runs first.** If a question as framed would require identifying a specific utility to answer, the framer's structural-scorability check fails and the run returns `INSUFFICIENT_EVIDENCE` **before any simulation executes** — the abstention gate sits ahead of scoring by design.

**The honest limit.** None of this stops a determined insider holding the source. What it does is convert misuse from a *query* into a *deliberate, logged, code-modifying act*. A boundary stated at its true strength is worth more to an evaluation panel than an absolute claim it can break in one question.

**A safety observation that is also an operational risk.** Measured adjudicator refusal on the influence-ops task was 5/5, later 2 of 3 declined. The LLM adjudicators themselves refuse work near this line. That is a genuine safety property *and* the principal cause of panel loss — which is why gap 2 (graded quorum) is a prerequisite and not an enhancement. Both facts are reported; neither is suppressed in favour of the flattering one.

---

## 14. Failure modes

| # | Failure | Class | Handling |
|---|---|---|---|
| 1 | **Reference-class instability.** 2026's rate is not 2023–2025's rate. A prior fitted on the old period describes a world that ended. | **Most likely reason Q1 is wrong** | Devil's Advocate is chartered specifically to argue this; non-stationarity is a registered key assumption with a required falsifier |
| 2 | **Disclosure-lag oracle mismatch.** A campaign surfaces after `T+90+L`. | Oracle | `L` pre-registered and hashed; late windows resolve UNRESOLVED and are excluded, never scored as misses |
| 3 | **Q2 is a prior with a wrapper.** Wrong inventory prior ⇒ smoothly, confidently wrong output. | Confirmed, structural | Not fixed — **bounded**, by the `low` confidence ceiling that propagates through weakest-link aggregation to pin the composite |
| 4 | **The `required_pressure` trap.** Confirmed by WNTR's own documentation. | Confirmed | Mandatory sweep as a min-length-2 tuple type; band-straddle ⇒ abstain. **Residual risk: Q3 abstains on most archetypes and the twin becomes useless** — tested in demonstration week 3, not week 12 |
| 5 | **Cross-language determinism.** numpy/scipy drift breaks byte-identical artifacts. | Engineering | Pin and hash the sidecar environment; assert byte-identity in CI. Honest residual risk on dependency bumps |
| 6 | **Panel loss.** One surviving adjudicator currently scores like eight. | Confirmed platform gap | Graded quorum rule is a **prerequisite**. Until it ships, every composite confidence figure is overstated and the bid must say so unprompted |
| 7 | **Rubric drift.** Two runs judged by different generated rubrics share a run id. | Confirmed platform gap | Pinned rubrics + `RunIdentity.panelDigest` |
| 8 | **Composite over-reading.** A reader collapses the regime vector into one number. | Design | No code path emits a fused Brier; the regime vector prints on the product's face |

### The honest worst case

The chain runs and produces: a well-calibrated exposure-trajectory forecast, an **abstention** on the decision question, and a consequence band with wide sweep uncertainty. In plain terms: *"I do not know whether Iran will act in this window. Here is what exposure is doing, measured. Here is what each instrument would do to a representative network, bounded."*

A buyer who wanted a yes/no on "will Iran attack in 90 days" receives a documented refusal.

**That outcome is a success by the evaluation design and a failure by a naive buyer, and the bid must state which one it is on the first page rather than discover the disagreement at the review.** Every other failure in this table is an engineering problem. This one is an expectations problem, and it is the only one that loses the program.

---

## 15. TRL — two columns

TRL inflation in this space comes from counting the platform and calling it the domain pack. Two columns, always.

| | **Platform (PROTEUS engine)** | **Domain pack (C-CHAIN-1)** |
|---|---|---|
| **Now** | **TRL 4.** Component validation in a laboratory environment: 659 tests passing / 4 skipped (verified this session); byte-identical artifacts on seed repeat; measured synthetic-oracle skill (+0.4355 on the well-evidenced arm, 80q × 32 runs) with a working negative control (−0.4561); measured abstention (80/80 true; 7% false at the shipped threshold); live runs at measured cost and latency | **Q1: TRL 2.** Concept formulated; the mixed-logit/competing-risks kernel does not exist. **Q2: TRL 2.** Same, and additionally blocked on data, not engineering. **Q3: TRL 3.** The solver is mature and government-authored; the binding, sweep discipline and archetype set are unbuilt, but analytical proof-of-concept is achievable immediately because the solver is off-the-shelf |
| **12 months** | **TRL 4→5.** Reaches 5 only if a controlled/classified instantiation runs in a relevant environment with a cleared T&E team; the graded-quorum and `panelDigest` fixes are prerequisites for any honest TRL 5 claim | **Q3: TRL 4–5** — validated in a relevant environment against a real calibrated utility model under CUI. **Q1: TRL 3** — proof-of-concept with pre-registered resolution history accumulating. **Q2: TRL 2–3 and no further.** Q2 does not advance without the classified access-inventory prior. That is a data ceiling, not an engineering one, and no amount of contract performance moves it |

Stating that Q2 cannot advance on unclassified funding is the most useful sentence in this section for a program manager building a schedule.

---

## 16. Cost model

All figures below derive from the platform's **measured** per-question numbers. Nothing is extrapolated beyond what was run.

**Measured per live question:** $0.2959 (9 LLM calls), 5m54s. With red-team rerun: $0.7544 (17 calls), 8m12s.

**Per composed assessment (4 registered questions: Q1, Q2, Q3, Q4):**

| Scenario | LLM cost | Latency (sequential — the chain genuinely is: Q2 consumes Q1's particles) |
|---|---|---|
| No red-team reruns | **$1.18** | ~23m36s |
| Red-team rerun on every stage (worst case) | **$3.02** | ~32m48s |

**Hydraulic sweep cost is CPU, not LLM.** A representative sweep — 5 `required_pressure` values × 20 perturbations × 12 archetypes = 1,200 solves — is a fixed compute cost independent of the LLM budget. **The platform's measured 15,832 simulations in 305 s is the platform's own kernel and does NOT characterise WNTR solve time. WNTR wall-clock is UNMEASURED and is benchmarked in demonstration week 3–4.** Quoting the 305 s figure for hydraulic solves would be exactly the evidence-class inflation this document is written to avoid.

**Full 90-day pre-registered demonstration:** 12 registered questions × 4 stages = 48 question-runs. At the non-rerun rate, **$14.20**; if every run triggered a red-team rerun, **$36.21**. Doubling for reproducibility re-runs gives a total LLM cost for the entire demonstration on the order of **$30–$75**.

That number is startling and it should be stated plainly, immediately followed by the thing it does not include: **the cost of this capability is not inference.** It is the corpus and its as-of discipline, the archetype set, the pinned rubrics, the pre-registration ceremony, the WNTR bridge and its determinism guarantees, and the two platform prerequisites. That is engineering labour, and this document does not invent a figure for it. The marginal cost of an assessment is roughly a dollar and half an hour. The fixed cost is people, and the customer should be quoted people.

---

## Prerequisites, restated for the program manager

Two platform changes gate this pack, both confirmed in code this session:

1. `RunIdentity` gains `panelDigest` and the resolved `PanelPlan` is persisted — `src/artifact/store.ts:28-35`, `:123-125`, `src/agents/panel.ts:40`.
2. `available: results.length > 0` (`src/pipeline/run-question.ts:680`) → graded quorum, and `level: adjudicationAvailable ? "high" : "moderate"` (`src/pipeline/analysis.ts:240`) → a function of quorum ratio and technique coverage.

Until both land, this chain can be built and demonstrated, but **no confidence figure it reports should be believed**, and the bid should say that in writing before a reviewer says it first.

---

**Sources**

- [CISA AA26-097A — Iranian-Affiliated Cyber Actors Exploit Programmable Logic Controllers Across US Critical Infrastructure](https://www.cisa.gov/news-events/cybersecurity-advisories/aa26-097a) (orig. April 7, 2026; updated July 22, 2026) · [PDF mirror](https://www.publicpower.org/system/files/documents/April_7_Joint-Cybersecurity-Advisory-Iran-Warning.pdf)
- [CISA — update announcement, July 22, 2026](https://www.cisa.gov/news-events/news/cisa-fbi-epa-and-us-government-partners-update-warning-iran-affiliated-threat-actors-targeting)
- [CISA Alert — Urges WWS Sector to Protect OT Against Activity Targeting PLCs, July 30, 2026](https://www.cisa.gov/news-events/alerts/2026/07/30/cisa-urges-water-and-wastewater-systems-sector-protect-ot-against-activity-targeting-plcs)
- [EPA/FBI/CISA/NSA joint advisory release, April 7, 2026](https://www.epa.gov/newsreleases/epa-fbi-cisa-nsa-issue-joint-cybersecurity-advisory-water-system-regarding-iranian)
- [Nextgov/FCW — CISA urges water utilities to take exposed systems down after Minnesota hacks](https://www.nextgov.com/cybersecurity/2026/07/cisa-urges-water-utilities-take-exposed-systems-down-after-minnesota-hacks/415142/) · [CBS News — US investigating whether Iran was behind Minnesota water attack](https://www.cbsnews.com/news/us-investigating-iran-cyberattack-minnesota-water-systems/) · [SecurityWeek](https://www.securityweek.com/cisa-urges-water-sector-to-protect-ot-after-coordinated-attacks-on-plcs/)
- [CISA Alert — Exploitation of Unitronics PLCs, November 28, 2023](https://www.cisa.gov/news-events/alerts/2023/11/28/exploitation-unitronics-plcs-used-water-and-wastewater-systems) · [CBS Pittsburgh — Aliquippa](https://www.cbsnews.com/pittsburgh/news/municipal-water-authority-of-aliquippa-hacked-iranian-backed-cyber-group/) · [CNN](https://www.cnn.com/2023/11/28/us/pennsylvania-water-cyberattack) · [WaterISAC advisory](https://www.waterisac.org/tlpclear-water-utility-control-system-cyber-incident-advisory-icsscada-incident-municipal)
- [WNTR hydraulics documentation — PDD parameters and defaults](https://usepa.github.io/WNTR/hydraulics.html)
- [EPA — AWIA Section 2013 / SDWA Section 1433](https://www.epa.gov/waterresilience/awia-section-2013) · [AWIA §2013 FAQs (PDF)](https://www.epa.gov/system/files/documents/2023-10/awia_s2013_faqs.pdf) · [OECA/OW enforcement memorandum (PDF)](https://www.epa.gov/system/files/documents/2024-07/section2013-waterinfrastructure-sdwa1433.pdf)
- [EPA OIG 23-P-0003 — The EPA Met 2018 Water Security Requirements but Needs to Improve Oversight (PDF)](https://www.epa.gov/system/files/documents/2023-02/_epaoig_20221208-23-P-0003_REPORT.pdf) · [EPA OIG 25-N-0004 (PDF)](https://www.epa.gov/sites/default/files/oig/documents/Full%20Report%2025-N-0004_Errata.pdf)
- [EPA — Withdrawal of Cybersecurity Memorandum of March 3, 2023 (PDF)](https://www.epa.gov/system/files/documents/2023-10/action-memo_rescinding-cyber-memo_october-2023.pdf) · [EPA — Cybersecurity in Sanitary Surveys](https://www.epa.gov/cyberwater/cybersecurity-sanitary-surveys) · [Joint stipulation of dismissal, Missouri v. EPA (PDF)](https://business.cch.com/CybersecurityPrivacy/epalawsuitdismissal.pdf) · [Reuters — 8th Circuit stay](https://www.reuters.com/legal/biden-administration-water-cybersecurity-plan-temporarily-blocked-2023-07-12/)
- [EPA — 7th Drinking Water Infrastructure Needs Survey and Assessment](https://www.epa.gov/dwsrf/epas-7th-drinking-water-infrastructure-needs-survey-and-assessment) · [Fact sheet (PDF)](https://www.epa.gov/system/files/documents/2023-04/Final_DWINSA%20Public%20Factsheet%204.4.23.pdf)
- [Censys — Working With the EPA to Secure Hundreds of Exposed Water HMIs](https://censys.com/blog/turning-off-the-information-flow-working-with-the-epa-to-secure-hundreds-of-exposed-water-hmis/) · [Censys 2024 State of the Internet Report (PDF)](https://go.censys.com/rs/120-HWT-117/images/2024SOTIR.pdf)
- [INL — Consequence-driven Cyber-informed Engineering](https://inl.gov/national-security/cce/) · [CCE Phase 1–4 Reference Document (PDF)](https://inl.gov/content/uploads/2023/07/CCE-Phase-1-4-Reference-Document.pdf) · [CCE concept paper (PDF)](https://inl.gov/content/uploads/2023/07/DOE_OSTI_CCEconcept-Paper.pdf)