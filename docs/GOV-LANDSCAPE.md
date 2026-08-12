# PROTEUS — Government landscape and platform redesign

**What this is:** the deliverable for "take the treemux principle — many agents simulate,
many judges adjudicate, everything driven by config — and redesign it for classified
socio-political analysis." It contains the opportunity landscape, scored; six capabilities
taken to concept-of-operations depth; and the architecture redesign.

**Date:** 2026-08-10. **Buyer:** CIA-originated solicitation, adjacent IC/DoD/civil buyers covered.

---

## 🧑 In Plain English

**The idea we started from.** Treemux ran one problem past many independent AI workers,
then had a panel of AI judges score the results — correcting for the fact that some judges
are harsh and some are generous, and flagging the entries that were _unusual_ rather than
merely good. PROTEUS already repointed that machine from building websites to forecasting
futures.

**What this document adds.** We surveyed what the US government has already paid for in this
space, who already sells something like it, what the CIA specifically has said it wants, and
what it is legally and practically able to buy. Then we generated 60 candidate products,
had three independent panels score every one, and took the survivors apart.

**The short version.** Sixty ideas turn out to be about twelve underlying machines wearing
different costumes — and saying that out loud is the strongest argument for the platform,
not an embarrassment. The capabilities that win are not the exciting ones. A simulation of
Iranian decision-making wins the demo; a tool that tells a reviewer "you believed fourteen
sources but you actually have 2.3 independent ones" is what still gets used in year three.

**The one thing that changed the plan.** In February 2026 the federal government ordered
agencies to stop using Anthropic's technology. Our only working model backend is Anthropic's.
That sounds fatal and isn't — the fix is two lines — but it has to be fixed _before_ anything
is submitted, not after.

---

## 0. How this was produced, and what that is worth

15 research agents across program archaeology, buyer mapping, competitive analysis,
compliance, and acquisition; 6 candidate-generation agents across distinct mission lenses;
3 independent judging panels scoring all 60 candidates; then 6 concept-of-operations deep
dives and 3 architecture agents. **Coverage: 15/15 and 10/10, zero agents lost.**

Three things about the evidence, stated before any claim rests on them:

- **Agent reports are research, not verification.** Where this document makes a load-bearing
  claim, it says whether _I_ checked it this session or whether it comes from an agent's
  citation. Agent findings are marked with their own `CONFIRMED` / `REPORTED` / `UNVERIFIED`
  labels where they carried them.
- **The session's 200-search web budget was exhausted by the landscape sweep.** The
  deep-dive agents that ran afterwards worked from supplied context rather than fresh
  research. Their _designs_ are sound; their _citations_ are thinner and are marked.
- **Two judges independently reached several of the same conclusions from different
  starting points.** Where that happened it is noted, because independent convergence is
  worth more than either report alone.

The full agent reports (≈1.9 MB, 25 documents) are in `docs/landscape/`, indexed in §10.

---

## 1. The principle, formalized

Read from `TreeHacksFINAL/treemux/eval/src/` this session. The reusable core is four files,
and three of them contain **zero** domain references:

| #   | Mechanism                                         | Where                                                         | Why it generalizes                                                                                                                      |
| --- | ------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | One context document designs the whole panel      | `agents/planner.ts:59`                                        | The scenario is _data_. Swap the document, get a different panel. This is the "custom prompts/settings" requirement in its rawest form. |
| 2   | Judge system prompts are generated, not written   | `types.ts:88-96` `JudgeSpec.systemPrompt`                     | The panel adapts to the question with no code change.                                                                                   |
| 3   | Human-authored judges coexist with generated ones | `types.ts:61,94` `custom_judges`, `source: "auto"\|"persona"` | Analyst-authored techniques merge with auto-designed ones.                                                                              |
| 4   | Per-judge weighting is external config            | `types.ts:66` `judgeWeights`                                  | Panel composition tunes without touching scoring math.                                                                                  |
| 5   | Judge severity-bias correction                    | `scoring/normalize.ts:18-38` — z per judge, rescale, clamp    | Domain-free. Works on **sources** as readily as on judges.                                                                              |
| 6   | Dimensional outlier = the underweighted axis      | `scoring/outliers.ts:52-86` — z per (judge × category)        | The _surprise_ detector: the case consensus underrates on exactly one axis.                                                             |
| 7   | Unique-profile = ensemble diversity               | `scoring/outliers.ts:88-134` — cosine distance from centroid  | Measures whether N runs actually differ.                                                                                                |
| 8   | Every threshold injectable                        | `types.ts:20-27` `OutlierConfig`                              | No magic numbers in the math.                                                                                                           |

Items 5–8 operate on `Record<string, number[]>` and a score matrix. That is the asset.

**This ranking was produced with items 5–7.** The 60 candidates below were scored by three
panels, then z-normalized per panel to strip severity bias, composited, and checked for
dimensional outliers — the method, applied to its own opportunity set.

> ### ⚠️ CORRECTION — items 5, 6 and 8 are **not in PROTEUS**
>
> They are in **treemux**. `find engine/src -iname "normalize*" -o -iname "outlier*" -o -iname "compute*" -o -type d -name scoring` returns **nothing**. Only `cosineSimilarity`
> survived the pivot, into `util/vector.ts:9`, where `metrics/ensemble.ts:137` uses it for
> diversity.
>
> `docs/ARCHITECTURE-PROTEUS.md:175-176` records both files as **"KEPT — ZERO CODE CHANGE."**
> `evidence/contradiction.ts:209` still says it _"extends the existing z-score disagreement
> math from judges to sources."_ Both describe the predecessor repo. **The record and the
> code disagree, and the code wins.**
>
> **Consequences.** (1) Do not claim per-judge severity correction or three-way outlier
> detection as shipped capability — they are NEW work. (2) The z-normalization behind the
> ranking below was written _this session in a scoring script_, not run through PROTEUS.
> (3) There is a live correctness issue: with an ungraded panel **and** no cross-judge
> normalization, a single severe adjudicator currently moves the aggregate more than it
> should. (4) Delete the stale rows from `ARCHITECTURE-PROTEUS.md` — leaving them there
> invites exactly the claim we must not make.

### What had to change, and what is still open

PROTEUS closed five of the eight gaps between a hackathon judge and an intelligence product:
ordinal ranking → probability distribution over a resolvable partition; no abstention →
measured gate; no provenance → dated claims with counted unsupported assertions;
judge-sees-truth → oracle separation; `Math.random()` → seeded byte-identical artifacts.

Three remain, all **confirmed in the code this session**:

| Gap                                                                                                                                                                                                                | Evidence                                                                                                                                                                                                                                      | Why it matters to this buyer                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The rubric that judged a run is not in the artifact.** `PanelPlan` carries an LLM-generated `systemPrompt` per adjudicator; never persisted, never hashed. Two runs judged by different rubrics share a `runId`. | `grep -rni panelplan src/` matches only `agents/panel.ts`; `src/artifact/` and `src/pipeline/types.ts` hold no `panel*` reference; `runId = computeRunId(identity)` (`artifact/store.ts:137`) and identity has no panel field.    | This is the gap between **configurable** and **auditable**. To an accreditation authority, the first without the second reads as a defect.                                                                                  |
| **k-of-N panel loss is a boolean, not a grade.** One surviving adjudicator of **three** yields the same confidence driver as a full panel.                                                                         | `run-question.ts:680` `available: results.length > 0` → `analysis.ts:240` `level: adjudicationAvailable ? "high" : "moderate"`. Shipped panel is `DEFAULT_PANEL_SIZE = 3` (`run-question.ts:78`); `planPanel(count = 4)`; 5 techniques exist. | Not hypothetical — a live run measured **2 of 3 declining**, i.e. exactly one survivor of the shipped panel, scored identically to a full one. The graceful-degradation metric is measuring a boolean.                      |
| **The mandatory evaluation-regime tag is not mandatory on the code path that produced every headline number.**                                                                                                     | `benchmark.ts:83` `readonly regime?: EvaluationRegime` and `:241` `const regime = options.regime ?? "synthetic_oracle"` — while `score.ts:42` states _"`regime` is required and never inferred."_                                             | **The most refutable claim in the submission, refutable by reading two lines of our own source.** No published number is mislabelled — the default is the correct value — but the guard is a default, not a type. See §7.1. |
| **Two knobs do not fit every domain.**                                                                                                                                                                             | Four of six mission lenses re-bound or bypassed `riskTolerance`/`escalationPropensity`.                                                                                                                                                       | Fixable by naming it: a generic two-knob actor profile **plus** a declared free-form ensemble dimension. Presented right, this is reach, not weakness.                                                                      |

One concern that turned out to be a non-issue, recorded so it does not get carried into a
submission as a gap: treemux's planner ran with `bypassPermissions` /
`allowDangerouslySkipPermissions`. `grep -rn "bypassPermissions\|allowDangerouslySkipPermissions\|claude-agent-sdk" src/`
returns **nothing** — the Agent SDK backend was deleted. Not a PROTEUS problem.

---

## 2. The buyer

The single most useful thing established by the sweep: **the CIA reorganized its technology
and acquisition organization between October 2025 and June 2026, and cia.gov is only partly
caught up.** A buyer map written from the public org chart is stale.

| Change                                                                                                                                                     | Date        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Center for Cyber Intelligence elevated to a full Mission Center reporting to the Director                                                                  | Oct 2025    |
| New CIA Acquisition Framework — centralized vendor vetting, streamlined IT authorization, pathways to "rapidly onboard breakthrough technology prototypes" | 9 Feb 2026  |
| Directorate of Digital Innovation renamed **Directorate of Mission Systems**; open source and offensive cyber removed from its portfolio                   | 30 Jun 2026 |
| **Office of Corporate Partnerships** stood up as industry's "single point of access"                                                                       | 30 Jun 2026 |

Do not address a submission to "DDI." Address the **Directorate of Analysis** as mission
owner, name **DMS** as the enterprise host, and treat the Office of Corporate Partnerships
as intake. Naming DMS correctly is a cheap, high-signal proof of reading the buyer as of
this quarter.

### The three quotes that shape the whole strategy

1. **The DA's own AI strategy has three pillars: "AI as an intelligence topic; AI as a
   mission enabler; and AI governance and evaluation"** — and it is "horizontally scanning
   for new AI technology and novel use cases, **such as simulating crisis scenarios**."
   (Wayne McCool, then Associate Deputy Director for Analysis, Feb 2024; a named officer's
   public post, not an official release — verify before quoting.)
   _The customer named our product category, and the third pillar is our metrics package._

2. **"Within the next couple of years, we will have AI co-workers built into all of the
   agency's analytic platforms… It won't do the thinking for our analysts, but it will help
   draft key judgments, edit it for clarity, and compare drafts against tradecraft
   standards."** (Deputy Director Michael Ellis, SCSP IntelSummit, 9 April 2026.)
   _A Deputy Director has publicly committed, on a two-year horizon, to machine checking of
   analytic products against ICD 203. That is deep-dive #3 below, almost verbatim._

3. **Osiris — CIA's disclosed enterprise LLM — is for summarization, and CIA considers it a
   home run.** The CTO in the same breath: analysts "must be able — with full certainty — to
   annotate and explain data they cite and how they reach conclusions. Our tradecraft has not
   changed."
   _The summarization slot is taken and defended. The open slot is provenance and
   adjudication. A white paper that reads as "better summarization" competes with an internal
   success and loses._

### The panel is the buyer's own doctrine

CIA's published _Tradecraft Primer: Structured Analytic Techniques for Improving Intelligence
Analysis_ names Analysis of Competing Hypotheses, Key Assumptions Check, Devil's Advocacy,
Team A/Team B, High-Impact/Low-Probability, "What If?", and Indicators and Signposts — and on
ACH specifically, that it highlights evidence that is most **"discriminating."**

The adjudication panel is not a methodology we have to sell. It is the CIA's own primer,
implemented in software, with the diagnosticity weighting made explicit and the outputs
measured. Say so on page one and cite the Primer by name.

There is also a fifty-year-old internal argument to answer: Colby's 1973–75 devil's-advocate
initiative died on "the practicality of institutionalizing challenge procedures" and fears
that the costs might outweigh the benefits. **Cost per insight answers that argument**, and
saying so is worth a paragraph.

### The objections, published by the buyer

CIA's own journal has printed the case against us. _Studies in Intelligence_ 68 no.1 calls
generative AI integration "irresponsible, at best," resting on "brittle, untested, and
untrustworthy applications whose inner workings not even their designers can entirely
explain." _Studies_ 67 no.4: "both the 'dots' and the connections between those dots exist
within a black box at a time when organizations like the IC continue to work toward greater
transparency about the underpinnings of their judgments."

Every one of those is a direct hit on a black-box LLM product and a direct miss on this
architecture. Quote them and answer mechanism by mechanism. That move separates a submission
from vendors who have not read the buyer's own literature.

---

## 3. The landscape — 60 candidates, scored

Six mission lenses produced 10 candidates each. Three panels scored all 60 independently:
**mission reality** (would an office buy and defend it), **architecture fit** (is this really
simulate-and-adjudicate, or a RAG chatbot in a trench coat), **win probability** (federal
capture view).

Panel means before normalization: 3.20 / 3.48 / 3.15 — close enough that severity correction
barely moved the order, which is itself a useful signal about the panels.

### The top of the table

| #   | id             | M   | A   | W   | Capability                                               |
| --- | -------------- | --- | --- | --- | -------------------------------------------------------- |
| 1   | C-GEO-3        | 5   | 5   | 5   | Coercion Tempo Ladder — PRC gray-zone pressure on Taiwan |
| 2   | C-TRADECRAFT-2 | 5   | 5   | 5   | Effective-N — circular reporting and source independence |
| 3   | C-TRADECRAFT-9 | 4   | 5   | 5   | The Range — synthetic closed worlds                      |
| 4   | C-ADV-5        | 5   | 4   | 5   | Technoeconomic Retaliation                               |
| 5   | C-TRADECRAFT-4 | 5   | 4   | 5   | Tradecraft Auditor — ICD 203 + Dutch-book coherence      |
| 6   | C-CYBER-2      | 3   | 5   | 5   | Hydra — water cyber-physical consequence twin            |
| 7   | C-CYBER-4      | 4   | 5   | 4   | Ransomware Ledger                                        |
| 8   | C-CYBER-6      | 4   | 5   | 4   | Exploit acquisition capacity                             |
| 9   | C-GEO-9        | 4   | 5   | 4   | Post-Election Legitimacy Crisis                          |
| 10  | C-IW-7         | 4   | 5   | 4   | Censorship Posture as a regime-insecurity barometer      |
| 11  | C-TECHECON-3   | 4   | 5   | 4   | Time-to-Capability                                       |
| 12  | C-IW-9         | 4   | 4   | 5   | Retrieval poisoning of the IC's own AI answer surface    |

Twenty candidates scored ≥4 from every panel. Seven were floored unanimously.

### The finding that matters more than the ranking

**Sixty candidates collapse to roughly twelve kernel families.** Both the architecture and
win-probability panels reached this independently and enumerated the clusters by id — one
ordinal escalation ladder behind four candidates; one threshold-cascade-on-a-network behind
six; one queueing/production pipeline behind six; one capture-recapture estimator behind three.

State the collapse deliberately in the submission. **The collapse _is_ the config-not-code
argument**, and it is far more persuasive stated than discovered by an evaluator.

### What the panels agreed on, unprompted

- **Buyability has one reliable discriminator: does the output land on a dated artifact with
  a signature block?** A BIS rule annex, an OFAC designation memo, a stockpile purchase, an
  ICD 203 review, a watch list. Candidates that name one scored 4–5. Standalone probabilities
  "for senior policymakers" scored 2–3, because a standalone probability has no home in IC
  production and nobody is empowered to act on it.
- **The unglamorous capabilities are the ones that field.** Four of the mission panel's top
  eight are quality-assurance products. They displace mandated, repetitive, disliked tasks and
  produce no judgment anyone has to defend. _"The adversary-simulation candidates win the demo
  and lose the deployment."_
- **Coordination appears in zero of sixty candidates and is the largest adoption risk.** IC
  finished intelligence is coordinated, not authored. Nobody said who represents a machine
  judgment in a coordination meeting or who takes the dissent footnote. The capabilities that
  dodge this entirely are the ones making claims about the **source base** rather than about
  the world — and that is not a coincidence, it is why they will field.
- **TRL is inflated across the board** by counting the platform (TRL 4, 663 tests) instead of
  the domain pack (TRL 2–3, everywhere, without exception). Ship two columns before an
  evaluator draws the line for you.
- **Never backtest against the customer's own historical calls.** If the model beats them, the
  submission is saying "your people were wrong" in a room containing people who were there.
  Use public baselines.

---

## 4. What to claim, and what to cut

The competitive analysis was run adversarially, and it is the most uncomfortable and most
useful section of the sweep. Legend: ✅ safe · ⚠️ narrow it · ❌ cut it.

| Claim                                                                                                           | Verdict               | Why                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Measured abstention** — INSUFFICIENT_EVIDENCE as a first-class outcome with a published false-abstention rate | ✅ **Lead with this** | Zero vendors in the defense/IC market advertise it. The mechanism exists only in open-source RAG kernels and one finance product. The strongest differentiator in the deck. Cite the research (SURE-RAG et al.) yourself to show you know the literature and are claiming the _fielded implementation_, not the invention. |
| **The evaluation-regime tag and the refusal to pool**                                                           | ✅                    | A self-limiting claim, which is itself the credibility signal.                                                                                                                                                                                                                                                             |
| **Leakage guards enforced at runtime**                                                                          | ✅                    | Anchor to DoDM 5000.102, which already forbids validating M&S on training data. We enforce mechanically what the regulation demands.                                                                                                                                                                                       |
| **Weakest-link confidence aggregation**                                                                         | ✅                    | The one calibration idea with **no prior art found**. Lead the calibration story with this, not with z-scores.                                                                                                                                                                                                             |
| **Artifact hash as an accreditation object**                                                                    | ✅                    | No LLM-wargaming vendor is talking about accreditation. Open lane.                                                                                                                                                                                                                                                         |
| "We measure Brier and they don't"                                                                               | ❌ **Cut**            | Logicon publishes Brier 0.106 / AUC 0.95 on **480 resolved real-world** predictions. Good Judgment, RAND's forecasting initiative and Metaculus all publish real-world calibration. On this axis PROTEUS is **behind**, not ahead — 15,832 synthetic simulations is an engineering result, not a forecasting result.       |
| "Everything is config"                                                                                          | ❌ **Cut**            | Every competitor claims no-code configurability. If kept, convert to a number: measured wall-clock and marginal cost to stand up a new scenario.                                                                                                                                                                           |
| Two-knob adversary profiles as a differentiator                                                                 | ❌ **Cut**            | DecisionAdvantage's DecisionCompass and Anadyr Horizon are deeper and have named users. Reframe: the profiles exist to generate measured _ensemble diversity_, not to be psychologically faithful.                                                                                                                         |
| "Reproducible simulation", unqualified                                                                          | ⚠️                    | AFSIM is reproducible; JHU APL's GenWar Lab already owns "rigor," "repeatability," "traceable." Narrow to **cryptographic reproducibility of an LLM-in-the-loop run**.                                                                                                                                                     |
| Auto-designed ACH panel                                                                                         | ⚠️                    | Automated ACH is prior art — MITRE holds patent 8,966,569 and IARPA funded the critique problem via REASON. Narrow to per-question panel composition plus a red team whose objection is a **control-flow event**, not advisory text. Have counsel check the patent before any IP claim.                                    |
| Likelihood/confidence separation                                                                                | ⚠️                    | Real but low-moat — an indie project already enforces exactly this constraint in code. One paragraph as tradecraft literacy, not a pillar.                                                                                                                                                                                 |

**The one-line competitive frame, from the analysis:** _every vendor in this market sells an
answer — Palantir sells the platform it runs on, Rhombus and Dataminr sell the claim it
arrived early, APL and Hadean sell more answers faster. Nobody sells the measurement of
whether the answer was any good, and nobody sells the ability to decline to answer._

### Where we are genuinely weaker — say it first

1. **No real-world forecast track record.** Competitors have hundreds of resolved questions.
   The honest claim is narrow and strong: the monotonic skill-vs-evidence-quality curve
   (+0.44 / +0.42 / +0.11 / −0.46) shows **the machinery responds correctly to evidence
   quality**. Say exactly that and no more.
2. **No accreditation, no vehicle, no ATO.** Competitors hold JWICS ATOs, IL2–IL7 paths, and
   multi-billion IDIQ ceilings. Name the intended path or it reads as a science project.
3. **The IC already tried scored forecasting and abandoned it.** A CIA reviewer over 45 will
   remember. **The adoption argument matters more than the technical argument.** The honest
   answer: cost per forecast collapses when the forecaster is a machine, and the abstention
   gate removes the analyst's fear of being scored on unanswerable questions.
4. **The escalation literature is a loaded gun.** Published work found off-the-shelf LLMs
   escalate, develop arms-race dynamics, and occasionally reach for nuclear weapons; another
   study with 214 national-security experts found LLM-simulated teams cannot represent human
   player characteristics at all. **Cite these yourself.** This architecture puts the LLM at
   setup and interpretation and a deterministic kernel at simulation — precisely the
   mitigation those papers imply. Nothing builds more credibility with an IC reviewer than
   citing the strongest argument against your own category.

---

## 5. The procurement risk that has to be fixed first

**Reported and independently corroborated by two agents, then verified by me this session
against PBS NewsHour:** on **27 February 2026** the administration ordered all US agencies to
stop using Anthropic's AI technology; the Secretary of Defense designated Anthropic "a supply
chain risk." Most agencies were to stop immediately; the Pentagon received a six-month
phase-out. The dispute originated in Anthropic's refusal to permit unrestricted military use
without safeguards.

Our only working model backend is `src/llm/anthropic.ts`, and the README already concedes
"model-agnosticism is a seam, not a measurement."

**The exposure is smaller than it looks, and I measured it.** `LlmClient` is a two-member
interface (`name`, `complete`). Every analytic agent — `framer.ts`, `panel.ts`, `red-team.ts`,
`run-question.ts`, `benchmark.ts` — imports only the _type_. No vendor SDK is imported
anywhere outside `src/llm/anthropic.ts`, and there is **not one hard-coded `claude-*` model id
outside that file**. The entire coupling is two lines:

```
src/forecast.ts:20    import { createAnthropicClient } from "./llm/anthropic.js";
src/forecast.ts:168     return createAnthropicClient();
```

both inside `selectClient()`.

**Recommendation.** Implement a second backend against an open-weight or non-designated model
and run the existing benchmark through both. That converts the README's caveat into a measured
number — model-swap cost — and turns the single largest procurement risk into a differentiator,
because vendor-diversity is now an explicit CIA posture: the Deputy Director said publicly that
the agency "cannot allow the whims of a single company" to constrain its use of AI.

Two consequences for the submission, both from the buyer analysis:

- **Do not name a model vendor anywhere in the document.** Describe the LLM layer as pluggable
  and specify the interface.
- **The deterministic kernel means the numeric result does not depend on which model is
  installed** — the LLM frames and interprets, the seeded math simulates. That is the strongest
  available answer to "single-company whims," and no summarization-first competitor can make it.

---

## 6. The acquisition path

- **There is no CIA SBIR.** IC elements are statutorily exempt; NGA is the only IC member that
  participates, voluntarily. Do not spend a cycle looking for a topic.
- **In-Q-Tel is the only CIA-adjacent channel that explicitly asks for a technology white
  paper** and can fund adaptation work without a clearance. Two instruments: equity-only
  (~$250K, board observer seat) and directed investments / technology development agreements
  (low single-digit millions, tied to a named government partner's use case). For a
  pre-revenue prototype with a synthetic-oracle benchmark, the directed investment is the
  highest-probability first dollar. The ask is not "buy this" — it is "here is a measurable
  capability, here is the DA use case it serves, fund the adaptation."
- **CIA Labs publishes a CRADA intake form.** Lowest-clearance-barrier front door on the
  entire CIA surface. Not revenue, but a citable engagement and a government sponsor.
- **The `cia.gov/partner-with-cia/` unsolicited channel works** — enter the keyword
  `private-sector`, expect a Submission Reference ID, and note the asymmetry: **CIA replies
  within 45 days only if interested. Silence is a rejection.**
- **Write to DARPA/IARPA conventions.** CIA's Chief Procurement Executive arrived from DARPA
  in November 2025. Expect white papers, Heilmeier framing, milestone-and-metric structure.
- **Assume five pages, 12 pt, 1-inch margins, everything inside the count** — the modal
  government white paper, matching both IARPA and DARPA. If the actual solicitation says
  otherwise, its instructions win absolutely; non-conformance is the cheapest way to get binned.
- **Heilmeier question 5 is where this wins**: _how will you evaluate progress, and what are
  your milestones and metrics?_ Most submissions fumble it. We arrive with a metrics package,
  a mandatory regime tag, and a rule that no function pools regimes.

### The classification barrier has a solved pattern — use it

IARPA REASON's structure is the template, and it is the strongest thing this architecture has
to say about classification: performers build and are tested on **unclassified** data; an
independent **cleared T&E team** evaluates on classified material in parallel; performers never
receive classified access and refine against unclassified summary-level feedback.

**Deterministic seeded byte-identical artifacts make that pattern cheaper than it has ever
been** — a cleared T&E team can re-derive a performer's run exactly, without the performer, and
attribute any difference to a named config line. Every capability that says "the classified
version swaps one config file" should say this instead.

Two more, both from the compliance sweep: REASON requires **a minimum of Government Purpose
Rights**, which is the data-rights floor for this space and must be priced in rather than
discovered at negotiation. And **a deterministic system with no wall clock and no
`Math.random()` is materially cheaper to accredit under ICD 503 than a stochastic service** —
reproducibility is a _schedule_ argument, not only a science argument, at an agency publicly
trying to compress 24-month onboarding to 6.

### A second door, already written to this architecture

A DIU/ODNI solicitation issued 11 March 2026 seeks "an evaluation harness and
government-specific benchmarks that together enable rigorous, reproducible, vendor-agnostic
assessment of any AI system," including reproducible degradation testing and gaming-resistant
benchmarks. **The government is buying the metrics package as a separate procurement.** If the
CIA path stalls, that requirement already describes what exists.

---

_Sections 7 (the six deep dives) and 8 (the architecture redesign) follow when the second
workflow lands._

---

## 7. The six capabilities, taken to depth

Chosen by composite rank, then **deduplicated into fused capabilities** rather than left as
raw candidates — because the clusters are the product. Full concept-of-operations documents
are in `docs/landscape/dives--*.md`.

### 7.1 C-CHAIN-1 — Iran → water: decision → activation → consequence

_(fuses C-ADV-1 + C-CYBER-1 + C-CYBER-2)_

The customer's own worked example, and the only capability both judging panels independently
named as the biggest gap in the catalog: nobody had chained the three stages. _Will_ Iran
move against US water controls; _when_ would it spend access it already holds; _what happens
to the water_. Today those three questions live with an analyst, a threat hunter, and a
utility engineer who never speak, and nobody hands the answer forward.

Built as **four registered questions, not one** — because a fused question would force a
single regime tag, and the three stages genuinely have different oracles. The consequence
stage runs on **WNTR/EPANET 2.2**, an EPA/Sandia solver a panel can rerun themselves.

**The design decision that makes it honest:** the activation stage depends on an access-
inventory prior only classified reporting has, so the unclassified tier is **structurally
capped at low confidence**, and the product names the stage that capped it. The chain refuses
to launder a weak link into a strong headline.

**What the red team broke, and it matters:** the consequence stage was tagged
`synthetic_oracle` with WNTR as its own oracle. _Reproducibility is not accuracy_ — if the
solver is both predictor and answer key, measured skill is 1.0 by construction. The
defensible claim is narrower: **Q3 is verifiable, not validated.** Also: the proposed
`[number, number, ...number[]]` guard on the pressure sweep forbids arity 1 but not
`[20.0, 20.0]` — it constrains cardinality where the trap is about span.

### 7.2 CONFLUENCE — source discrepancy and analytic-confidence reconciliation

_(fuses C-TRADECRAFT-1 + C-GEO-8 on C-TRADECRAFT-2 as enforced upstream)_

Maps **word for word** onto stated benefit (c). One product, three modes: provenance graph,
single quantity, whole folder.

In 2002 the judgment that Iraq had mobile biological weapons labs rested on ~100 reports that
turned out to be one man; Silberman–Robb found the reporting "left an impression of many
corroborating reports where in fact there were very few sources." **Nobody has ever been
handed a tool that computes that number before the assessment ships.** The output is a
sentence no one in the room has seen: _you believed fourteen sources; you have 2.3; your
posterior odds fall from 61:1 to 4:1._

It never claims anything about the world, never names a person, only says which documents
descend from which. **That restraint is the fielding argument** — it is why this capability
never enters interagency coordination, which the sweep identified as the largest unaddressed
adoption risk in the entire catalog.

**Two things to fix.** The false-circularity rate must be co-equal reported — over-declaring
circularity suppresses real corroboration, which is not a safe error. And the "no person
node" red line is weaker than stated: evidence channel 4 is byline reuse, which requires
byline data; absence of a `Person` type means the data sits on `DocumentInstance` instead.
A security reviewer finds that in one pass.

### 7.3 Tradecraft Auditor — ICD 203 compliance and probabilistic coherence

_(C-TRADECRAFT-4, with C-TRADECRAFT-6 Indicator Lab)_

The most defensible position a vendor can occupy: **scoring against the customer's own
published regulation.** And the Deputy Director has publicly committed, on a two-year
horizon, to AI coworkers that "compare drafts against tradecraft standards."

The genuinely new element is a **linear-programming Dutch-book detector**: are the seven
estimative statements in one product mutually satisfiable? This has _mathematical_ ground
truth and finds a defect nothing else finds, because holding seven probabilistic propositions
in working memory is beyond any human reviewer. The failure — "X is likely" beside "X or Y is
unlikely" — is invisible and embarrassing.

Indicator Lab is its sibling: it gives a watch chief measured cover to **delete** indicators,
an organizational pathology with no current solution anywhere in the community.

**Two hard adoption warnings, both with structural answers.** A false contradiction alarm
destroys analyst trust faster than any other failure, so the extracted proposition set must be
shown back for confirmation before infeasibility is declared. And the moment scores aggregate
to a named author this becomes a personnel instrument and adoption dies — **the red team
found this understated**: scoring accumulates per product class and topic, which in most shops
is near-unique to an office and often an individual. k-anonymity is never mentioned. "There is
no `authorId` field" is not an answer to that.

### 7.4 C-GEO-3 — Coercion Tempo Ladder

_(and the ordinal escalation-ladder kernel family: C-ADV-2, C-ADV-8, C-CYBER-3)_

**Unanimous 5/5/5, tied first.** A watch officer at INDOPACOM counts PLA aircraft by hand
each morning from Taiwan's public releases, and writes "sustained elevated pressure" — a
sentence that has been in the product for years and that nobody can score.

**This is the capability that should lead, and the reason is not the forecast.** It is the
only candidate that pre-registers an ablation of _PROTEUS's own architectural contribution_
rather than of the data's signal: it names **"a plain Hawkes fit with no game layer"** as the
model to beat. Every other candidate compares itself to a base rate, which tests whether the
data has signal. This one tests whether simulate-and-adjudicate has signal. A positive ΔRPS
from the decision layer on daily public data is worth more than every synthetic number in the
package — and if it is negative, we need to know before a customer does.

**A correction the deep dive made to my own brief:** I specified ΔCRPS as the headline. CRPS
is for continuous quantities; for an _ordered categorical_ rung the correct member of the
family is the **Ranked Probability Score**. Reporting "ΔCRPS on the rung" is a category error
a technical panel will catch. ΔRPS on the rung, ΔCRPS on the tempo, reported side by side,
never summed. `grep -rniE "crps|rankedProbability|ordinal" engine/src/` returns **zero hits** —
neither is implemented.

### 7.5 Adversary technoeconomic decision-making

_(fuses C-ADV-5 + C-TECHECON-8 + C-TECHECON-2, with C-TECHECON-4)_

The customer named technoeconomic policy explicitly. A BIS rule package goes to interagency
with a retaliation annex that has a due date, a drafter and a signature block — and today it
is one person reasoning from the last two episodes.

The differentiator against Sayari, Kharon, C4ADS, Altana, Exiger and Interos is exact: **they
illuminate networks; none models the adversary as a chooser, and none publishes a
forward-scored prediction.** C-TECHECON-8's coefficients are _fitted_ on the Global Sanctions
Database's 1,547 coded cases rather than hand-set, and it ships a mirror config (same kernel,
US instrument menu) — one of only five places where config-not-code is genuinely demonstrable.

**The problem to face rather than hide:** a static input-output matrix with a one-shot argmax
on top is not obviously a simulation, and a technical evaluator will say so. And Iran and DPRK
are largely absent from the I-O tables, so **structural abstention on the customer's named
case approaches 100%.**

### 7.6 C-IW-9 — Retrieval poisoning of the IC's own AI answer surface

The sleeper, and the shortest path to a first contract. Every other capability asks the
customer to trust a prediction about the world; this one makes a claim about **a machine the
customer owns**, and the verification is running the audit. CIA already fields a generative-AI
tool over open source used by thousands of analysts across 18 agencies, and nobody measures
how far an adversary has gotten into it.

**The classification barrier inverts here** — the classified version is the _easy_ one,
because the thing modeled is the customer's own index, which exists only inside the enclave.

**The red team found the kernel commits the error it diagnoses.** §2.2 correctly argues that
global corpus share is the wrong state variable, because PoisonedRAG achieved 97% attack
success by injecting **5 texts per target question into 2,681,468** — a 0.0002% poisoning
rate that no corpus-share model can reproduce. Then §3.3's state variables are per-topic-cell
corpus counts with **no query variable anywhere in the dynamics**. Per-query targeting — the
entire mechanism of the cited result — is not representable. This is fixable, and it must be
fixed before the capability is pitched.

---

## 8. The redesign

Full documents: `docs/landscape/redesign--{platform,dualtier,evaluation}.md`.

### 8.1 Name the three architectures, and stop selling them as one

The platform contains three legitimate but distinct shapes, and pitching all three as
"simulate-and-adjudicate" is the exact evidence-class inflation the platform exists to prevent:

| Class                           | What it is                                                      | What varies across the ensemble                                                      |
| ------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **A — simulate-and-adjudicate** | a decision process with state evolving under a rule             | divergent actor/decision profiles                                                    |
| **B — estimate-and-adjudicate** | an estimator over a fixed evidence set                          | _interpretive_ hypotheses — evidence partitions, model choices, deception hypotheses |
| **C — consequence twin**        | a physical/operational process, adversary as boundary condition | perturbation and parameter draws                                                     |

**Classes B and C have systematically better oracles than class A**, because their quantities
are constructible or physically measured. Claim each on its own terms. Class B is also where
the capabilities that actually field live.

### 8.2 The Scenario Pack, and the honest version of "config not code"

The config contract: question contract (measure, partition, resolution tick, as-of, range),
actor/profile models, kernel adapter binding, corpus binding, **panel spec**, thresholds, red
lines — canonicalized and hashed to a `packHash`, with **every numeric leaf required to carry
an `estimator:` field or the pack fails to load.**

**The arithmetic that kills the unqualified claim.** Domain-free core: **8,748 lines**
(verified: `src` total 11,723 − adapters 2,529 − bindings 446). New code the six packs declare
or imply: **12,000–16,000 lines.** The new domain code exceeds the entire domain-free
platform, and two of six packs give no estimate at all. Claim config-reuse in the five places
it is demonstrable and **kernel-family reuse** everywhere else.

### 8.3 The three confirmed gaps, and their fixes

- **Panel provenance** → the panel spec becomes a content-addressed artifact; `packHash`,
  `panelSpecHash` and `ensembleDimensionHash` join `RunIdentity` at `identityVersion: 2`; a
  registry of human-approved panels exists; an unapproved panel produces a flagged-and-counted
  run, not a blocked one.
- **Graded degradation** → delete `adjudicationAvailable: boolean` (`analysis.ts:171`) and
  `available: results.length > 0` (`run-question.ts:680`); replace with a `PanelSurvival`
  record that grades refusals and errors apart, and instantiate `degradationCheck()`
  (`metrics/operations.ts:159-195`) over it so graceful degradation becomes a test assertion.
- **The two knobs** → delete the hard-wired schema at `framer.ts:41`. Replace with a generic
  two-knob actor profile **plus a declared free-form ensemble dimension**. Four of six domains
  rejected the knobs; a parameterization four of six domains reject is not a platform
  primitive. Say it as reach, not apology: the fan-out generalizes past actor psychology.

### 8.4 New first-class components

The observation-corruption layer (delay, censoring, bias, quantization, deception policy,
laundering operator) as a **wrapper any kernel can run through**, so every pack gets a
synthetic false-positive and false-abstention rate for free — today those rates are measurable
for one capability and asserted for the rest. The Range as **infrastructure, not a product**
(precedent: IARPA FOCUS evaluated methods by having hundreds of people forecast outcomes in
complex simulations, so the regime is already accepted by the customer's own research arm).
The `estimator:` field with a **variance-attribution gate** that abstains when ensemble spread
is dominated by a parameter with `estimator: none` — converting "your diversity is decoration"
from a rhetorical objection into a runtime assertion. A **stylized-facts gate** that refuses
to forecast until the kernel reproduces published empirical regularities. The **ablation
harness**. The **commit-then-resolve register**. The **rerun-diff** — which upgrades
determinism from a reproducibility claim to an _attributable-change_ claim: here is the single
config line that moved the BLUF band and here is the one that did not. And the
**dissent-and-override channel**, because IC tools die of non-adoption far more often than of
inaccuracy.

### 8.5 Dual-tier: the REASON pattern is the answer, and determinism is why

Every capability that says "the classified version swaps one config file" should say this
instead: performers build and are tested on unclassified data; an independent **cleared T&E
team** evaluates on classified material in parallel; performers never receive classified
access. **Because a run's identity is the hash of everything that produced it and the artifact
hash is the hash of everything it emitted, a cleared T&E team can re-execute an uncleared
performer's pack against classified corpora and prove — byte for byte — that it ran the same
system, without the performer ever seeing the data or the result.**

The component substitution table, the red-line type system as an accreditation artifact
(a schema diff plus a failing test showing config-load rejection is worth more in a bid than
every TRL number combined), and the two ICD 203 standards an auditor will actually fail us on
— **sourcing of model _parameters_, not just evidence items**, and the requirement for an
_argument_ rather than a number — are in `redesign--dualtier.md`.

### 8.6 Evaluation: the new guards

`oracle_independence` as a **required fourth field** on the regime tag
(`independent | shares_source_with_input | analyst_consensus | revised_series`), with the
metrics package **refusing to compute a skill score** against a contaminated oracle. The
counterfactual-branch rule: score the realized branch under backtest or live regimes, score
unrealized branches only under synthetic oracle, never pool. Data-vintage recording for oracles
that move. A **platform-wide null suite** — every pack run against a quiet period, reporting
false-alarm rate per pack, which is the number a warning customer wants and no vendor
publishes. And metric selection by question class: for rare events over short windows the
honest headline is **tail recall and coverage@N**, not Brier skill, because "predict no" is a
devastating baseline.

---

## 9. What to do next, in order

1. **Fix the regime tag, then re-run and re-publish every headline number under it.** Delete
   `regime?` and the `?? "synthetic_oracle"` default at `benchmark.ts:83,241`; make
   `EvaluationRegime` required. This is cheap, provable in a demo, and converts the most
   refutable claim in the package into the most defensible one. Right now a panel can break
   the central thesis by reading two lines of our source.
2. **Add a second LLM backend and measure the swap.** Two lines of coupling
   (`forecast.ts:20,168`). This closes the procurement risk in §5 and turns model-agnosticism
   from a caveat into a number.
3. **Start the commit-then-resolve register now, on the coercion ladder.** Taiwan MND
   publishes daily; the rung-mapping function can be hashed and committed today. **A live
   register with commitment hashes predating resolution is the only artifact in this market a
   T&E team can verify without trusting the vendor at all.** Submitting a paper _about_ a
   register you have not started is submitting what everyone else submits.
4. **Correct the record in `ARCHITECTURE-PROTEUS.md`.** Delete the rows claiming
   `scoring/normalize.ts` and `scoring/outliers.ts` are "KEPT — ZERO CODE CHANGE," and fix the
   stale comment at `evidence/contradiction.ts:209`. Leaving them invites exactly the claim we
   must not make.
5. **Grade panel loss** and add per-judge normalization — currently a single severe
   adjudicator over-moves the aggregate, with no correction anywhere.

### Two things this package still cannot answer

**Benefit (b) — reduced time to analyze — is never measured.** No time-on-task study, no
human-in-the-loop evaluation, no comparison against an analyst doing the same task. We measure
machine accuracy and never measure the thing the customer said it wanted.

**Benefit (d) — cost reduction — has no denominator.** The only cost figures are $0.2959 and
$0.7544 _per question_, commercial-API, and explicitly non-transferable to the high side.
There is no analyst-hour baseline and no products-per-year figure, so **no cost-reduction
claim currently survives arithmetic** — because no arithmetic has been attempted. Both are
squarely in scope for the customer's stated benefits, and both are unaddressed.

---

## 10. Evidence base

| File                                          | What it is                                                                                   |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `landscape/priorArt--cia.md`                  | The buyer: offices, AI posture, procurement, ICD standards, a recommended five-page skeleton |
| `landscape/priorArt--iarpa.md` · `--darpa.md` | Program archaeology — what the government already paid for, and the gap it left              |
| `landscape/priorArt--incumbents.md`           | Adversarial competitive analysis and the differentiation table                               |
| `landscape/priorArt--standards.md`            | ICD 203/206/505, IL levels, ICD 503, model availability by tier, data rights                 |
| `landscape/priorArt--acquisition.md`          | Every pathway from white paper to first dollar, with timelines                               |
| `landscape/candidates--*.md`                  | The 60 candidates, full template each                                                        |
| `landscape/judges--*.md`                      | Three independent scorings of all 60                                                         |
| `landscape/dives--*.md`                       | The six concept-of-operations documents                                                      |
| `landscape/redesign--*.md`                    | Platform architecture, dual-tier deployment, evaluation redesign                             |
| `landscape/redteam.md`                        | The hostile evaluation that found the defects in §7 and §9                                   |

**Caveat that travels with all of it:** these are research agents' reports. Claims I verified
myself this session are marked as such in the body above. The rest carry the agents' own
labels, and the deep-dive agents ran after the session's web-search budget was exhausted, so
their citations are thinner than the landscape sweep's.

---

## Appendix — all 60 candidates, scored

M = mission reality · A = architecture fit · W = win probability, each 1–5 from an
independent panel. Composite is the z-normalized mean across panels. ⭐ = no panel scored
it below 4.

| # | id | lens | M | A | W | composite | capability |
|---|---|---|---|---|---|---|---|
| 1 | `C-GEO-3` | Geopolitical instability | 5 | 5 | 5 | 7.71 | Coercion Tempo Ladder ⭐ |
| 2 | `C-TRADECRAFT-2` | Analytic tradecraft QA | 5 | 5 | 5 | 7.71 | Effective-N ⭐ |
| 3 | `C-TRADECRAFT-9` | Analytic tradecraft QA | 4 | 5 | 5 | 7.29 | The Range ⭐ |
| 4 | `C-ADV-5` | Adversary decision-making | 5 | 4 | 5 | 7.25 | Technoeconomic Retaliation ⭐ |
| 5 | `C-TRADECRAFT-4` | Analytic tradecraft QA | 5 | 4 | 5 | 7.25 | Tradecraft Auditor ⭐ |
| 6 | `C-CYBER-2` | Cyber & critical infrastructure | 3 | 5 | 5 | 6.88 | Hydra water twin |
| 7 | `C-CYBER-4` | Cyber & critical infrastructure | 4 | 5 | 4 | 6.87 | Ransomware Ledger ⭐ |
| 8 | `C-CYBER-6` | Cyber & critical infrastructure | 4 | 5 | 4 | 6.87 | Exploit Pipeline ⭐ |
| 9 | `C-GEO-9` | Geopolitical instability | 4 | 5 | 4 | 6.87 | Post-Election Legitimacy ⭐ |
| 10 | `C-IW-7` | Information warfare | 4 | 5 | 4 | 6.87 | Censorship Posture barometer ⭐ |
| 11 | `C-TECHECON-3` | Technoeconomic statecraft | 4 | 5 | 4 | 6.87 | Time-to-Capability ⭐ |
| 12 | `C-IW-9` | Information warfare | 4 | 4 | 5 | 6.84 | Retrieval Poisoning ⭐ |
| 13 | `C-GEO-8` | Geopolitical instability | 5 | 4 | 4 | 6.83 | Contradiction Ledger ⭐ |
| 14 | `C-TECHECON-2` | Technoeconomic statecraft | 5 | 4 | 4 | 6.83 | Sanctions Package Pre-Mortem ⭐ |
| 15 | `C-TECHECON-4` | Technoeconomic statecraft | 5 | 4 | 4 | 6.83 | Mineral Chokepoint ⭐ |
| 16 | `C-TRADECRAFT-6` | Analytic tradecraft QA | 5 | 4 | 4 | 6.83 | Indicator Lab ⭐ |
| 17 | `C-ADV-7` | Adversary decision-making | 3 | 5 | 4 | 6.46 | Coalition Cohesion |
| 18 | `C-ADV-2` | Adversary decision-making | 4 | 4 | 4 | 6.42 | Crisis Ladder ⭐ |
| 19 | `C-TECHECON-7` | Technoeconomic statecraft | 4 | 4 | 4 | 6.42 | Proliferation Diffusion ⭐ |
| 20 | `C-TECHECON-8` | Technoeconomic statecraft | 4 | 4 | 4 | 6.42 | Coercion Instrument Chooser ⭐ |
| 21 | `C-TRADECRAFT-1` | Analytic tradecraft QA | 4 | 4 | 4 | 6.42 | Source Conflict Adjudicator ⭐ |
| 22 | `C-TRADECRAFT-5` | Analytic tradecraft QA | 4 | 4 | 4 | 6.42 | Collection Tasker ⭐ |
| 23 | `C-ADV-1` | Adversary decision-making | 4 | 3 | 5 | 6.39 | Sub-Threshold Action Selector |
| 24 | `C-GEO-2` | Geopolitical instability | 4 | 4 | 3 | 6.00 | Mobilization Cascade |
| 25 | `C-TECHECON-1` | Technoeconomic statecraft | 4 | 4 | 3 | 6.00 | Diversion Pathway |
| 26 | `C-TECHECON-5` | Technoeconomic statecraft | 4 | 4 | 3 | 6.00 | Interdiction Portfolio |
| 27 | `C-CYBER-9` | Cyber & critical infrastructure | 4 | 3 | 4 | 5.97 | DPRK Treasury Line |
| 28 | `C-IW-4` | Information warfare | 4 | 3 | 4 | 5.97 | Adversary Campaign COA |
| 29 | `C-IW-2` | Information warfare | 2 | 5 | 3 | 5.63 | Belief Drift |
| 30 | `C-GEO-1` | Geopolitical instability | 3 | 4 | 3 | 5.59 | Elite Defection Cascade |
| 31 | `C-IW-1` | Information warfare | 3 | 4 | 3 | 5.59 | Dark Figure |
| 32 | `C-CYBER-5` | Cyber & critical infrastructure | 4 | 3 | 3 | 5.55 | Q-Model attribution |
| 33 | `C-CYBER-8` | Cyber & critical infrastructure | 2 | 4 | 3 | 5.17 | Regional hospital triage |
| 34 | `C-IW-8` | Information warfare | 2 | 4 | 3 | 5.17 | Synthetic Media Surge |
| 35 | `C-TRADECRAFT-7` | Analytic tradecraft QA | 2 | 4 | 3 | 5.17 | The Ledger |
| 36 | `C-ADV-3` | Adversary decision-making | 3 | 3 | 3 | 5.14 | Belief Gap |
| 37 | `C-CYBER-1` | Cyber & critical infrastructure | 3 | 3 | 3 | 5.14 | Activation Clock |
| 38 | `C-CYBER-7` | Cyber & critical infrastructure | 3 | 3 | 3 | 5.14 | Chokepoint force flow |
| 39 | `C-GEO-5` | Geopolitical instability | 3 | 3 | 3 | 5.14 | Alignment Drift |
| 40 | `C-IW-5` | Information warfare | 3 | 3 | 3 | 5.14 | Campaign dose-response |
| 41 | `C-IW-6` | Information warfare | 3 | 3 | 3 | 5.14 | Attribution Support |
| 42 | `C-GEO-7` | Geopolitical instability | 4 | 3 | 2 | 5.13 | Collapse Consequence Fan |
| 43 | `C-ADV-4` | Adversary decision-making | 2 | 3 | 3 | 4.72 | Regime Survival Constraint |
| 44 | `C-ADV-6` | Adversary decision-making | 3 | 3 | 2 | 4.72 | Counter-COA |
| 45 | `C-GEO-4` | Geopolitical instability | 3 | 3 | 2 | 4.72 | Ceasefire Survival |
| 46 | `C-TRADECRAFT-3` | Analytic tradecraft QA | 3 | 3 | 2 | 4.72 | Red Mirror |
| 47 | `C-TRADECRAFT-8` | Analytic tradecraft QA | 3 | 3 | 2 | 4.72 | Tournament + router |
| 48 | `C-CYBER-3` | Cyber & critical infrastructure | 3 | 2 | 3 | 4.68 | Rung response options |
| 49 | `C-ADV-9` | Adversary decision-making | 2 | 3 | 2 | 4.30 | Sustainment Ceiling |
| 50 | `C-GEO-6` | Geopolitical instability | 2 | 3 | 2 | 4.30 | Water-food stress pathway |
| 51 | `C-TECHECON-6` | Technoeconomic statecraft | 2 | 3 | 2 | 4.30 | Control-Backfire Counterfactual |
| 52 | `C-TECHECON-9` | Technoeconomic statecraft | 2 | 3 | 2 | 4.30 | Financial-Rail Escape |
| 53 | `C-ADV-8` | Adversary decision-making | 2 | 2 | 2 | 3.85 | Tail Watch |
| 54 | `C-IW-3` | Information warfare | 1 | 3 | 1 | 3.47 | Resilience Playbook |
| 55 | `C-TECHECON-10` | Technoeconomic statecraft | 1 | 2 | 1 | 3.02 | GDP Nowcast |
| 56 | `C-ADV-10` | Adversary decision-making | 1 | 1 | 1 | 2.56 | Leader Digital Twin |
| 57 | `C-CYBER-10` | Cyber & critical infrastructure | 1 | 1 | 1 | 2.56 | Warning Board |
| 58 | `C-GEO-10` | Geopolitical instability | 1 | 1 | 1 | 2.56 | Global Instability Heat Map |
| 59 | `C-IW-10` | Information warfare | 1 | 1 | 1 | 2.56 | Domestic radicalization scoring |
| 60 | `C-TRADECRAFT-10` | Analytic tradecraft QA | 1 | 1 | 1 | 2.56 | Bias / insider-risk scorer |
