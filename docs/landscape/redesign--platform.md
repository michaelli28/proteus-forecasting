# The PROTEUS Platform: Generalized Config-Driven Architecture

**Document class:** architecture design. Not code, not a plan of record.
**Build-state legend used throughout:** `[BUILT]` = verified in source this session, cited `file:line`. `[DESIGN]` = specified here, not built. `[CORRECTION]` = a recorded belief that the code contradicts.

---

## In Plain English

One machine, many jobs. Today PROTEUS answers a question by running the same imagined world hundreds of times with the adversary behaving differently each time, then putting a panel of checkers over the results and refusing to answer when the evidence is too thin.

This document generalizes that machine. It says plainly that it is really **three** machines wearing one name — one that simulates a decision, one that re-reads a fixed pile of evidence several defensible ways, and one that models a physical process with the adversary as weather rather than as a chooser — and that the last two can be graded much more honestly than the first.

It then defines the single configuration file ("Scenario Pack") that describes a new job without touching the engine, fixes three flaws we confirmed in our own code, and adds the eight to ten missing parts that turn "our tool is configurable" into "our tool is auditable" — including a record of who approved the panel that judged a run, a rule that lowers confidence when judges are lost, and a public ledger of predictions written down *before* the answer arrives.

Where the honest answer is "we have not built this yet" or "we have not measured that," it says so in the same sentence.

---

## 1. The three architectures the platform actually contains

The landscape sweep established that 60 candidate capabilities collapse to roughly 12 kernel families and 22 distinct capabilities. That collapse is the config-not-code argument. But the *sweep also found* that the catalog conflates three legitimately different shapes. Pitching them as one product is the exact evidence-class inflation this platform exists to prevent: a system whose central claim is "we label what our numbers mean" cannot open by mislabelling what its numbers are about.

Each is claimed on its own terms below.

### 1.1 Class A — Simulate-and-adjudicate

**Definition.** A decision process whose state evolves under an explicit rule over discrete ticks. The adversary is a *modeled chooser*: its parameters enter the transition function and change the trajectory.

**What varies across the ensemble.** Decision profiles — the actor's disposition. Today: `riskTolerance` and `escalationPropensity`, each 0–100 `[BUILT — src/agents/framer.ts:41]`, re-interpreted per domain rather than reinvented `[BUILT — src/pipeline/recruitment-binding.ts:12-18, src/sim/adapters/influence-ops/mapping.ts:8-14]`.

**The oracle.** For a synthetic world, exact: the kernel's own ground-truth stream, read by `readQuantity` at the resolution tick `[BUILT — src/pipeline/types.ts:59-60]`. For the real world, *there is no oracle for intent*. What resolves is a proxy — an observable consequence of the decision, not the decision.

**Why its oracle is the weakest of the three.** The quantity of interest (did the adversary decide X) is never published by anyone. The resolvable quantity is downstream of the decision, of the adversary's operational competence, and of a reporting process. Three unknowns between the claim and the resolution.

**Build state.** Implemented end to end, two domain packs (influence operations; targeted recruitment) `[BUILT — src/sim/adapters/{influence-ops,recruitment}]`. All published skill numbers are `synthetic_oracle`.

### 1.2 Class B — Estimate-and-adjudicate

**Definition.** An estimator over a *fixed* evidence set. Nothing evolves; there is no tick. The output is a statement about the corpus's implication, not about a future world state.

**What varies across the ensemble.** Interpretive hypotheses, not psychology:
- **evidence partition** — which subset of the corpus is treated as the reliable base (sensitivity to a single dominant source);
- **model choice** — the estimator itself (count vs. rate vs. capture-recapture; linear vs. hazard);
- **deception hypothesis** — the branch in which some fraction of the source base is planted, mis-attributed, or laundered;
- **coding rule** — the boundary of the category being counted.

**The oracle.** *Constructible.* A second analyst, given the same corpus and the same coding rule, can build the answer by hand. Disagreement is measurable as inter-coder reliability — Krippendorff's alpha is already implemented `[BUILT — src/metrics/agreement.ts:67]`. This is the family the sweep identified as making claims about the **source base** rather than about the world, and therefore the family that will actually field: it does not require anyone to represent a machine judgment about a foreign leader's intent in a coordination meeting.

**Build state.** `[DESIGN — no class-B pack built.]` The machinery it needs — ACH with diagnosticity weighting, the abstention gate, contradiction detection, provenance accounting, calibration — is built and is domain-free. What is missing is the estimator-family binding and the interpretive ensemble dimension (§3.3).

### 1.3 Class C — Consequence twin

**Definition.** A physical or operational process — a network, a logistics chain, a treatment plant, a fab, a grid segment — where the adversary enters as a **boundary condition**: an input schedule, an outage, a denied component, a manipulated setpoint. The adversary is not modeled as choosing; the analyst *supplies* the choice as a scenario.

**What varies across the ensemble.** Parameter draws over physically-estimable quantities (capacities, lead times, failure rates, buffer levels, substitution elasticities) and, separately, causal structure (which dependency edges exist).

**The oracle.** *Physically measured, by a third party, on a schedule.* Outage minutes, tonnage, throughput, lead time, port calls, published inventories. This is the strongest oracle available anywhere in the catalog and it is the structural selection criterion the sweep isolated: the resolution source is a third party's published artifact on a known cadence.

**Build state.** `[DESIGN — no class-C pack built.]` The kernel driver is already domain-agnostic and accepts any `init/step/observe` triple `[BUILT — src/sim/kernel.ts:26-37]`; a consequence twin is a legal adapter today. Nothing in the platform assumes the state contains an adversary.

### 1.4 The comparison, stated so an evaluator can check it

| | **A. Simulate-and-adjudicate** | **B. Estimate-and-adjudicate** | **C. Consequence twin** |
|---|---|---|---|
| Adversary is | a modeled chooser | a hypothesis about the source base | a boundary condition |
| Ensemble varies | decision profiles | evidence partition, model choice, deception branch | parameter draws, causal structure |
| Time | discrete ticks, state evolves | none — fixed corpus | discrete ticks, state evolves |
| Oracle | proxy only; exact in synthetic worlds | **constructible** — recountable by hand | **measured** — published by a third party |
| Best reachable regime, realistically | `synthetic_oracle` now; `live_post_cutoff` on proxies later | `historical_backtest` immediately; `live_post_cutoff` on survey/report waves | `live_post_cutoff` on published operational series |
| ICD 203 posture | judgment about intent — needs coordination | judgment about sourcing — ICD 206 territory | judgment about physics — least contested |
| Failure mode | elegant world, unfalsifiable claim | coding rule drift | mis-specified boundary condition |
| Built? | yes, 2 packs | no | no |

### 1.5 Why they are claimed separately

Three reasons, in descending order of how much they matter to this buyer:

1. **The regimes cannot be pooled, so the architectures cannot be either.** The metrics layer already refuses to let a number travel without its regime tag `[BUILT — src/metrics/index.ts:41-45, 112-116]`. If a bid pools a class-C forecast graded against published outage minutes with a class-A forecast graded against a synthetic oracle, the tag is defeated by the sales deck. The discipline has to hold above the code.
2. **They have different buyers inside the building.** Class B lands on a source-summary statement and an ICD 206 discussion. Class C lands on a stockpile decision, a rule annex, a watch list. Class A lands on a coordinated estimative judgment — which is the hardest artifact in the IC to get a machine's name onto.
3. **Only claiming them separately makes the negative control meaningful.** Our strongest measured result is that a deliberately misspecified arm scores *worse* than the base rate (−0.4561, coverage@1 0.123, `synthetic_oracle`). That result is evidence about a class-A kernel. It says nothing about a class-B estimator, and asserting otherwise would be exactly the inflation the platform exists to catch.

---

## 2. The Scenario Pack — the config contract

### 2.1 Layered architecture

```
                          ┌──────────────────────────────────────────────┐
                          │  ANALYST                                     │
                          │  asks · disagrees · edits one line · reruns   │
                          └───────┬──────────────────────────▲───────────┘
                                  │                          │
 LAYER 0  DECLARATION             ▼                          │ rerun-diff, dissent record
┌────────────────────────────────────────────────────────────┴─────────────────────────┐
│  SCENARIO PACK  (YAML → canonical JSON → packHash)                                    │
│  question · resolution · ensemble.dimension · actors · kernel · corpus · observation   │
│  panel · thresholds · redLines · stylizedFacts · estimator: on every number            │
└──────────────────────────────────┬───────────────────────────────────────────────────┘
                                   │  LOAD-TIME REFUSALS — throw, never warn
                                   │  ✗ schema invalid        ✗ a number lacks `estimator:`
                                   │  ✗ stylized fact missed  ✗ resolution source unverified
                                   │  ✗ panel not in registry → FLAGGED (runs, counted)
 LAYER 1  IDENTITY                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  runId = H( packHash ∥ panelSpecHash ∥ ensembleDimHash ∥ corpusSnapshotId ∥ kernelVer )│
│  identityVersion: 2                            [today: config ∥ corpus ∥ kernelVer]   │
└──────────────────────────────────┬───────────────────────────────────────────────────┘
 LAYER 2  ENSEMBLE                 ▼        one member per point on the declared dimension
┌──────────────────────────────────────────────────────────────────────────────────────┐
│   FRAMER ── N mutually exclusive members along ensemble.dimension                      │
│      ▼                                                                                │
│   KERNEL  init → step → observe        sfc32 seeded, no wall clock, forked per system  │
│      ▼                                                                                │
│   OBSERVATION-CORRUPTION WRAPPER   delay · censor · bias · quantize · deceive · launder│
│      │        (wraps observe() only — the ground-truth stream is never touched)        │
│      ▼                                                                                │
│   TRUTH STREAM  ─────────────────────────► oracle (synthetic packs only)               │
│   TELEMETRY STREAM ──► restricted view ──► everything downstream                       │
└──────────────────────────────────┬───────────────────────────────────────────────────┘
 LAYER 3  EVIDENCE                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  as-of corpus (hard date filter)  →  ACH matrix, Heuer diagnosticity  →  contradictions│
│  ▼                                                                                    │
│  ABSTENTION GATE  — fires BEFORE any likelihood exists                                 │
│    insufficient_diagnostic_evidence · hypotheses_indistinguishable                     │
│    unresolved_contradictions · incomplete_provenance                                   │
│    + spread_from_unestimated_parameters  [NEW]   + scope_refusal_rate  [NEW]           │
└──────────────────────────────────┬───────────────────────────────────────────────────┘
 LAYER 4  ADJUDICATION             ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  PANEL from the approved registry — ACH · key assumptions · devil's advocate ·         │
│  premortem · red team (bounded rerun authority)                                        │
│  per-judge normalization → outlier detection → PANEL SURVIVAL RECORD [NEW]             │
│  confidence = weakest link over 5 drivers; panel driver now GRADED, not boolean        │
└──────────────────────────────────┬───────────────────────────────────────────────────┘
 LAYER 5  PRODUCT                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  BLUF · likelihood ⟂ confidence (no function collapses them) · I&W with LRs ·          │
│  key assumptions each with a REQUIRED falsifier · provenance per claim ·               │
│  panel-survival line · dissent footnotes                                               │
└──────────────────────────────────┬───────────────────────────────────────────────────┘
 LAYER 6  RECORD                   ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  content-addressed artifact (manifest = sha256 per file)  ·  COMMIT-THEN-RESOLVE       │
│  REGISTER (append-only, hash-chained, head published)  ·  regime-tagged metrics        │
│  ·  rerun-diff  ·  dissent ledger  ·  ablation results                                 │
└──────────────────────────────────────────────────────────────────────────────────────┘

 CROSS-CUTTING, ALWAYS ON:  determinism guard (source scan bans Math.random/Date.now in
 sim/ and pipeline/)  ·  leakage guard (retrieval filter + runtime assertion on the
 finished product)  ·  regime tag required on every report  ·  scope/red-line preamble
```

### 2.2 The config schema

```yaml
# ─────────────────────────────────────────────────────────────────────────────
# SCENARIO PACK v1  — canonicalized and hashed to packHash
# Every numeric leaf in this file MUST carry `estimator:` (§4.3) or the pack
# fails to load. That is a throw, not a warning.
# ─────────────────────────────────────────────────────────────────────────────
pack:
  id: string                       # stable, e.g. "ics-water-tasking"
  version: semver
  architecture: simulate_and_adjudicate | estimate_and_adjudicate | consequence_twin
  owner: string                    # a named human. Machine judgments need a signatory.
  classification: string           # pack metadata only; no classified content in packs
  trl:
    platform: integer              # today: 4
    pack: integer                  # today: 2–3 for every pack. Two columns, always.

question:
  text: string
  measure:
    id: string
    description: string            # what a person would count
    units: string
    bounds: [number, number]       # fractions, not counts, unless a denominator is fixed
    codingRule: string             # REQUIRED for architecture: estimate_and_adjudicate
  partition:
    bands: [{ id, statement, lower, upper }]   # ascending; MECE checked structurally
    mecePolicy: exhaustive_over_bounds
  asOf: date                       # information cutoff. Enforced by the leakage guard.
  horizon:
    resolveAtTick: integer         # kernel time
    tickCalendar: { epoch: date, tickDuration: iso8601-duration }   # ticks → dates
    resolveAtDate: date            # derived; must equal epoch + tick*duration

resolution:                        # the single strongest buyability discriminator
  sourceKind: third_party_scheduled | oracle_synthetic | internal_measurement
  publisher: string
  artifact: string                 # the dated thing with a signature block
  url: uri
  cadence: string                  # "monthly, second Tuesday" — the schedule, stated
  adjudicationRule: string         # exactly how the published artifact maps to a band
  disputePolicy: string            # what happens if the publisher revises
  verifiedAt: date | null          # ← null blocks registration for any live arm

ensemble:
  dimension:                       # §3.3 — the fan-out generalizes past psychology
    kind: actor_profile | parameter_draw | evidence_partition |
          causal_structure | interpretive_hypothesis
    declaration: string            # what a member MEANS along this dimension
    mece: structural | declared_disjoint | none   # `none` caps confidence at moderate
  size: integer
  design: full_factorial | latin_hypercube | framer_generated
  seedPolicy: { rootSeed: string, forkNames: [string] }
  secondaryDimensions: [ … ]       # same shape; crossed with the primary

actors:                            # present only for actor_profile packs
  - id: string
    knobs:
      riskTolerance:        { range: [0,100], estimator: {…} }
      escalationPropensity: { range: [0,100], estimator: {…} }
    packKnobs:                     # domain knobs the two generic ones cannot carry
      - { name: string, range: [n,n], meaning: string, estimator: {…} }

kernel:
  family: string                   # one of the ~12 families; reuse claimed HERE
  adapter: module-path             # implements init/step/observe
  version: semver                  # bumped on any semantic change; enters run identity
  config: { … }                    # the adapter's own typed config, every number with estimator
  stylizedFacts:                   # §4.4 — the pack refuses to forecast if these miss
    - id: string
      statement: string
      citation: uri
      statistic: function-name     # computed over kernel output
      target: number
      tolerance: number
      regime: synthetic_oracle | historical_backtest

corpus:
  snapshotId: sha256               # pinned. "Same seed, same answer" is empty without it.
  asOfFilter: hard                 # only setting permitted
  sources: [{ id, description, credibility, estimator: {…} }]
  readingCredibility: { value: number, estimator: {…} }   # was a global constant

observation:                       # §4.1 — wraps ANY kernel
  delayTicks:   { value: integer, estimator: {…} }
  censoring:    { kind: mar | mnar, rate: number, drivenBy: state-path, estimator: {…} }
  sourceBias:   [{ sourceId, multiplicative, additive, estimator: {…} }]
  quantization: { kind: round | bucket | threshold_report, param: number }
  deception:    { policy: none | mask | inflate | shift, budget: number, estimator: {…} }
  laundering:   { enabled: bool, reattributionMap: {…} }

panel:                             # §3.1 — content-addressed, approved, hashed into identity
  specRef: sha256                  # points at packs/<id>/panels/<hash>.json
  quorum: integer
  requiredTechniques: [ach, key_assumptions, devils_advocate, premortem, red_team]
  degradation: { highAtLeast: 0.75, moderateAtLeast: 0.5, requireTechniqueDiversity: true }
  rerunAuthority: { maxReruns: integer, grantedTo: [red_team] }

thresholds:                        # measured by sweep, never chosen in a prompt
  minDiagnosticEvidence: 3
  minSeparation: 0.05
  maxUnresolvedRate: 0.5
  minProvenanceCompleteness: 0.8
  maxUnestimatedVarianceShare: 0.5     # NEW — §4.3
  maxScopeRefusalRate: 0.6             # NEW — refusals are information, not noise

redLines:
  scopeStatement: string           # prepended to every model call
  forbiddenMeasures: [string]      # e.g. anything naming a real person or target
  refusalIsData: true              # a deterministic decline is counted, never retried

evaluation:
  regime: synthetic_oracle | historical_backtest | live_post_cutoff
  baselines: [persistence, base_rate, { external: uri }]   # never the customer's own calls
  commitRegister: { enabled: bool, ref: path }
  ablation: { dimension: string, mode: freeze_mean | shuffle | replace_with_baseline }
```

### 2.3 Worked example

The customer's own worked example is Iran and US water infrastructure. The pack below keeps that subject and makes it *resolvable*, which changes the question from one nobody can grade to one a third party grades on a schedule.

```yaml
pack:
  id: ics-water-tasking
  version: 1.0.0
  architecture: simulate_and_adjudicate
  owner: "<named analyst>"
  trl: { platform: 4, pack: 2 }

question:
  text: >
    In the quarter ending 2026-12-31, how many distinct US water/wastewater
    systems will appear in publicly attributed OT/ICS intrusion disclosures?
  measure:
    id: disclosed_water_ot_intrusions
    description: distinct utilities named in a public, attributed disclosure
    units: count
    bounds: [0, 40]
    codingRule: >
      One utility counted once per quarter; an advisory naming a vendor product
      but no utility does not count; a disclosure naming a parent authority
      counts as one.
  partition:
    bands:
      - { id: b0, statement: "no disclosed intrusions",      lower: 0,  upper: 0.5 }
      - { id: b1, statement: "1–2 utilities disclosed",      lower: 0.5, upper: 2.5 }
      - { id: b2, statement: "3–6 utilities disclosed",      lower: 2.5, upper: 6.5 }
      - { id: b3, statement: "7 or more utilities disclosed", lower: 6.5, upper: 40 }
  asOf: 2026-09-30
  horizon:
    resolveAtTick: 91
    tickCalendar: { epoch: 2026-10-01, tickDuration: P1D }
    resolveAtDate: 2026-12-31

resolution:
  sourceKind: third_party_scheduled
  publisher: "US CISA"
  artifact: "published ICS advisories and public sector disclosures"
  url: https://www.cisa.gov/news-events/cybersecurity-advisories
  cadence: "continuous publication; quarter closed 14 days after period end"
  adjudicationRule: >
    Count distinct utilities named in advisories or CISA-referenced public
    disclosures published on or before 2027-01-14 with an incident date inside
    the quarter.
  disputePolicy: "publisher revision within 30 days supersedes; register keeps both"
  verifiedAt: null      # ← UNVERIFIED. Pack cannot register a live arm until a human
                        #   confirms the publisher's actual cadence and coding rule.

ensemble:
  dimension:
    kind: actor_profile
    declaration: "adversary disposition toward attributable access against US OT"
    mece: structural
  size: 24
  design: framer_generated
  secondaryDimensions:
    - kind: interpretive_hypothesis
      declaration: >
        Is a low count low activity, or low reporting? Members differ in the
        disclosure-rate hypothesis, not in the world.
      mece: declared_disjoint

actors:
  - id: primary
    knobs:
      riskTolerance:
        range: [0, 100]
        meaning: "tolerance for attributable access vs. deniability"
        estimator: { kind: elicited, method: "structured analyst elicitation, 3 experts",
                     uncertainty: { dist: beta, params: [2,2] }, lastRefreshed: 2026-08-01 }
      escalationPropensity:
        range: [0, 100]
        meaning: "willingness to convert access into effect"
        estimator: { kind: elicited, method: "same panel", uncertainty: { dist: beta, params: [2,3] } }
    packKnobs:
      - name: deniabilityBudget
        range: [0, 1]
        meaning: "share of operations routed through deniable proxies"
        estimator: { kind: assumed, uncertainty: { dist: uniform, params: [0,1] } }

kernel:
  family: staged-funnel-with-heterogeneous-agents
  adapter: src/sim/adapters/ics-tasking
  version: 0.1.0
  stylizedFacts:
    - id: heavy-tailed-campaign-size
      statement: "intrusion campaign sizes are heavy-tailed, not normal"
      citation: <uri>
      statistic: tailIndexOfCampaignSizes
      target: 1.8
      tolerance: 0.4
      regime: historical_backtest

observation:
  delayTicks: { value: 45, estimator: { kind: fitted, method: "median disclosure lag,
                 historical advisories", uncertainty: { dist: lognormal, params: [3.8, 0.6] } } }
  censoring:
    kind: mnar
    rate: 0.55
    drivenBy: state.utility.size          # small utilities under-report
    estimator: { kind: assumed, uncertainty: { dist: beta, params: [3,3] } }
  quantization: { kind: threshold_report, param: 1 }
  deception: { policy: mask, budget: 0.2,
               estimator: { kind: none } }   # ← triggers the §4.3 gate if it drives the spread
  laundering: { enabled: true, reattributionMap: { proxy_a: unknown } }

panel:
  specRef: sha256:<panelSpecHash>
  quorum: 3
  requiredTechniques: [ach, key_assumptions, devils_advocate, premortem, red_team]
  degradation: { highAtLeast: 0.75, moderateAtLeast: 0.5, requireTechniqueDiversity: true }

evaluation:
  regime: live_post_cutoff
  baselines: [persistence, base_rate]
  commitRegister: { enabled: true, ref: register/ics-water-tasking.jsonl }
  ablation: { dimension: actor_profile, mode: freeze_mean }
```

Two features of this example carry the argument. First, `resolution.verifiedAt: null` means the pack **cannot** register a live arm — the discipline of citing a real, scheduled publisher is enforced by the loader, not by a reviewer's diligence. Second, `deception.estimator.kind: none` is left deliberately in place: if the ensemble's spread turns out to be driven mainly by that unestimated knob, the run abstains (§4.3) rather than shipping a confident number whose confidence came from a parameter nobody measured.

### 2.4 Honesty: what "everything is config" actually means

Measured in this repository, this session:

| | lines | share |
|---|---|---|
| Domain-free core (`src/` minus adapters and bindings) | 8,748 | 74.6% |
| Domain adapters (`src/sim/adapters/**`, two domains) | 2,529 | 21.6% |
| Domain bindings (`src/pipeline/*-binding.ts`) | 446 | 3.8% |
| **Total `src/`** | **11,723** | |

**"Everything is config" is genuinely true in five places.** Each of these changes a run's behavior with no code edit:

1. **Question contract** — measure, band count, range, resolution tick, as-of `[BUILT — src/cli.ts:27-49]`.
2. **Ensemble** — size, root seed, and the generated run specs `[BUILT — src/cli.ts:41-44; src/agents/framer.ts]`.
3. **Abstention thresholds** — all four, swept rather than chosen `[BUILT — src/evidence/abstention.ts:25-51]`.
4. **Panel size and composition** `[BUILT — src/pipeline/run-question.ts:92]`.
5. **Corpus snapshot and as-of date** `[BUILT — src/cli.ts:49; src/corpus/as-of.ts]`.

**It is false everywhere else, and a new pack ships new code.** Concretely, per domain: an adapter of ~1,200–1,330 lines across 5–7 files, plus one binding file of ~190–260 lines. The influence-operations adapter is 1,204 lines; recruitment is 1,325. Anyone claiming a new mission area is "just a YAML file" is describing a system we do not have.

**The claim we do make is kernel-family reuse.** The 60→12→22 collapse means a new capability usually reaches for a kernel family that already exists — bounded-confidence opinion dynamics on a clustered network, or a staged funnel with heterogeneous agents, to name the two implemented — and pays for a *parameterization and a binding*, not a new engine. The 74.6% of the system that is orchestration, evidence, adjudication, calibration, metrics, artifacts and product takes **zero** change per domain, and that is verifiable by reading the two adapter directories against `src/pipeline/`.

---

## 3. Fixing the three confirmed gaps

### 3.1 Panel provenance: `panelSpecHash` joins the run identity

**The gap, confirmed in code.** `PanelPlan` carries an LLM-generated `systemPrompt` per adjudicator `[BUILT — src/agents/panel.ts:36, 40-45]`; the plan is created inside `adjudicate()` and used at `src/agents/panel.ts:208`; it is never written to the artifact store — the only `writeFile` on the run path writes the per-member summary `[BUILT — src/pipeline/ensemble.ts:168]`. Run identity is `{config, corpusSnapshotId, kernelVersion}` `[BUILT — src/artifact/store.ts:28-35]` and `runId = hashCanonical(identity)` `[BUILT — src/artifact/store.ts:123-125]`. **Two runs judged by different generated rubrics therefore share a run id.**

**The fix.**

```ts
// src/agents/panel.ts  — NEW
export interface PanelSpec {
  readonly specVersion: 1;
  readonly adjudicators: readonly {
    readonly name: string;
    readonly technique: AdjudicationTechnique;
    readonly focus: string;
    readonly systemPrompt: string;      // verbatim, as sent
    readonly promptHash: string;        // sha256 of the prompt after withScope()
  }[];
  readonly quorum: number;
  readonly planner: { model: string; promptHash: string; seed: string } | null;
}

// src/artifact/store.ts — EXTEND
export interface RunIdentity {
  readonly identityVersion: 2;          // v1 artifacts stay readable, never re-hashed
  readonly packHash: string;            // NEW
  readonly panelSpecHash: string;       // NEW
  readonly ensembleDimensionHash: string; // NEW — §3.3
  readonly config: unknown;
  readonly corpusSnapshotId: string;
  readonly kernelVersion: string;
}
```

The spec is canonicalized with the existing deterministic serializer `[BUILT — src/artifact/canonical.ts:22]`, written as `panel.json` inside the run directory so it enters the manifest hash `[BUILT — src/artifact/store.ts:90-105]`, and its hash joins the identity.

**The registry.** `packs/<pack-id>/panels/<panelSpecHash>.json` plus `approvals.json`:

```json
{ "panelSpecHash": "sha256:…", "approvedBy": "<named reviewer>",
  "approvedAt": "2026-08-04", "scope": "ics-water-tasking@1.x",
  "supersedes": "sha256:…", "rationale": "…" }
```

**An unapproved panel is flagged and counted, never blocked.** The run proceeds, `product.panelApproval = "unapproved"`, the panel confidence driver is capped at `moderate`, and the metrics report carries `unapprovedPanelRuns / totalRuns`. Blocking would do two harmful things: it would push analysts to a tool that lets them experiment (the non-adoption failure, §4.8), and it would destroy the data that tells us whether generated panels differ from approved ones at all — which is itself a measurable question.

**Why this is the line between "configurable" and "auditable" for this buyer.** Configurable means the judge can be changed. Auditable means the record says *which* judge judged, that a reviewer can reproduce the run under exactly that judge, and that a different judge cannot masquerade as the same run. ICD 203 requires that products "properly describe quality and credibility of underlying sources, data, **and methodologies**" and that significant differences in analytic judgment be surfaced. A generated rubric that vanishes after use is an undescribed methodology. It is also the answer to the coordination question the sweep raised: an approval record with a named human on it is the beginning of an answer to "who represents this machine judgment in a coordination meeting."

**Cost, stated.** Changing the identity invalidates every existing run id. Hence `identityVersion`: v1 artifacts remain readable and comparable to each other, v2 runs are a new comparison set, and no function pools them — the same rule the regime tag already enforces.

### 3.2 Graded degradation: confidence must fall as the panel is lost

**The gap, confirmed in code.** `available: results.length > 0` `[BUILT — src/pipeline/run-question.ts:680]` feeds `adjudicationAvailable: boolean` `[BUILT — src/pipeline/analysis.ts:171]`, which produces `level: input.adjudicationAvailable ? "high" : "moderate"` `[BUILT — src/pipeline/analysis.ts:240]`. One surviving adjudicator of eight scores identically to a full panel of eight. Partial panel loss is not an edge case: our own live measurements show an adjudicator refusal rate of 5/5 on the influence-ops task, and later 2 of 3 declining. **Partial loss is the normal operating condition.**

**The fix.**

```ts
// src/pipeline/analysis.ts — EXTEND
export interface PanelSurvival {
  readonly planned: number;
  readonly returned: number;
  readonly refused: number;      // deterministic scope declines — information, not failure
  readonly errored: number;      // transport/parse — failure
  readonly quorum: number;
  readonly techniquesReturned: number;
}

function panelDriverLevel(s: PanelSurvival): ConfidenceLevel {
  if (s.returned === 0) return "low";
  const fraction = s.returned / s.planned;
  if (s.returned < s.quorum) return "low";
  if (s.techniquesReturned < 2) return "moderate";   // an ACH-only panel is not a panel
  if (fraction >= 0.75) return "high";
  if (fraction >= 0.5) return "moderate";
  return "low";
}
```

Three properties of this rule matter:

- **Quorum is a floor, fraction is a slope.** Below quorum, no amount of eloquence from one survivor buys `high`.
- **Technique diversity is separate from count.** Five surviving adjudicators all running ACH are one cross-check, not five. Diversity is what a panel is *for*.
- **Refusals and errors are graded differently.** A deterministic scope refusal is a measurement about the question. When `refused / planned` exceeds `thresholds.maxScopeRefusalRate`, the correct response is not lower confidence — it is the abstention gate firing with the new `scope_refusal_rate` reason, because the system is telling us the question is outside what it will judge.

**Why weakest-link aggregation still holds.** The confusion to head off: weakest link is not an aggregation over *judges*, it is an aggregation over *dimensions of confidence* — source corroboration, unresolved contradiction, source quality, panel cross-check, red-team survival `[BUILT — src/pipeline/analysis.ts:213-259]`. Grading happens **inside** the panel dimension, before the minimum is taken across dimensions. Averaging across dimensions would still be wrong for exactly the reason the code already documents: four comfortable dimensions outvoting the one that is broken is how a product ends up reporting high confidence on an evidence base its own sources dispute.

**The product must say it.** A new line, and only when it can differ from a neighbor:

```
PANEL: 3 of 8 returned (2 declined on scope, 3 errored) — 2 techniques.
       Confidence capped at MODERATE by panel survival.
```

That line passes the deletion test: remove it and the reader cannot tell whether `moderate` came from thin evidence or from a panel that mostly did not answer. Those are different worlds and imply different next actions.

**The check already exists for the ensemble arm and should be reused for the panel arm.** `degradationCheck()` computes `failedToDegrade` when runs are lost and confidence holds steady `[BUILT — src/metrics/operations.ts:159-195]`. Instantiating it a second time over panel survival makes "our confidence degrades gracefully" a test assertion rather than a sentence in a bid.

### 3.3 The two knobs are not enough — and the fan-out was never about psychology

**The gap.** `riskTolerance` and `escalationPropensity` are hard-wired into the framer's output schema `[BUILT — src/agents/framer.ts:41]` and are the *only* thing the ensemble varies. Four of six mission lenses re-bound or bypassed them. Two domains already re-interpret them in prose rather than in types `[BUILT — src/pipeline/recruitment-binding.ts:12-18; src/sim/adapters/influence-ops/mapping.ts:8-14]`.

**The fix — a generic profile plus a declared ensemble dimension.**

```ts
// src/agents/framer.ts — EXTEND
export const ENSEMBLE_DIMENSIONS = [
  "actor_profile",          // A: what the adversary is disposed to do
  "parameter_draw",         // C: what the world's constants might be
  "evidence_partition",     // B: which subset of the corpus we trust
  "causal_structure",       // B/C: which dependency edges exist
  "interpretive_hypothesis" // B: what the same evidence could mean
] as const;
export type EnsembleDimension = (typeof ENSEMBLE_DIMENSIONS)[number];

export interface EnsembleMemberSpec {
  readonly id: string;
  readonly label: string;
  readonly dimension: EnsembleDimension;
  readonly rationale: string;
  /** actor_profile members only. */
  readonly profile?: { riskTolerance: number; escalationPropensity: number;
                       packKnobs?: Readonly<Record<string, number>> };
  /** every other dimension: the pack's own typed member payload. */
  readonly payload?: unknown;
}
```

The framer's contract generalizes from "produce N actor profiles" to "produce N members along the declared dimension, structurally mutually exclusive where the dimension admits a partition." Its existing separation check — currently a normalized distance in the 100×100 knob square `[BUILT — src/agents/framer.ts:157-164]` — becomes a per-dimension separation function the pack declares.

Backward compatibility is exact: existing packs declare `dimension: actor_profile` and behave identically. The dimension declaration is canonicalized and hashed into `ensembleDimensionHash`, so a run cannot silently change what its ensemble means.

**Why this is a strength, stated as such.** The fan-out was never fundamentally about adversary psychology. It is about *what could differ and still be consistent with what we know* — and in classes B and C that is evidence partitions and physical parameters, which are exactly the dimensions with better oracles. Generalizing the dimension is what lets the platform's measurement machinery (Brier skill, coverage@N, tail recall, diversity, abstention rates) be pointed at claims that can actually be graded. It also makes §4.5's ablation harness meaningful: you can freeze the actor dimension and keep the others, and find out whether the adversary model earned its place.

---

## 4. New first-class components

### 4.1 The observation-corruption layer

Today's honest position: false abstention is measured at 7% at the shipped threshold across 6 arms; true abstention is 80/80 on a provably unanswerable arm. Both numbers come from one capability's benchmark. For every other pack, abstention behavior is **asserted**.

**Design.** A wrapper, not a fork:

```ts
// src/sim/observe/corrupt.ts — NEW
export interface CorruptionPolicy {
  readonly delayTicks: number;
  readonly censoring: { kind: "mar" | "mnar"; rate: number; drivenBy?: string };
  readonly sourceBias: readonly { sourceId: string; multiplicative: number; additive: number }[];
  readonly quantization: { kind: "round" | "bucket" | "threshold_report"; param: number };
  readonly deception: { policy: "none" | "mask" | "inflate" | "shift"; budget: number };
  readonly laundering: { enabled: boolean; reattributionMap: Readonly<Record<string,string>> };
}

/** Wraps ANY adapter. observe() only — the ground-truth stream is untouched. */
export function withObservationCorruption<C, S>(
  adapter: SimulationAdapter<C, S>,
  policy: CorruptionPolicy,
): SimulationAdapter<C, S>;
```

Four properties make it safe and useful:

- **It wraps `observe`, never `step` and never the truth stream.** The oracle stays exact, so a corrupted run still has a right answer to be graded against. The existing separation — truth stream vs telemetry stream, structurally unable to reach each other — is what makes this possible `[BUILT — src/pipeline/types.ts:61-68; verified by the passing test "NEVER leaks belief data into the telemetry stream"]`.
- **It draws from a named RNG fork** (`root.fork("observe")`), so adding corruption cannot shift the simulation's own draws `[BUILT — src/sim/kernel.ts:70-75]`. Determinism holds; the source-scan guard applies to it automatically.
- **Deception is a declared policy with a budget**, not free-form. It is a state-dependent transform the adversary can afford some amount of. That is what makes it estimable at all, and what stops it becoming an unfalsifiable "maybe everything is fake."
- **Laundering is attribution scrubbing**: a reattribution map that rewrites source ids. This is the operator that makes the class-B deception hypothesis testable — you can generate a corpus where you *know* which claims were laundered, and measure whether the system's contradiction detection and provenance accounting notice.

**What every pack gets for free.** Run the same world twice — clean and corrupted — and the difference in the abstention verdict, the Brier score, and the confidence level is a *measured* false-positive and false-abstention rate for that pack. `[DESIGN — not built.]`

### 4.2 "The Range" — synthetic-world generation as infrastructure

**Not a product. A test range.** A generator that emits worlds with exact ground truth plus declared difficulty knobs: signal-to-noise, base rate, regime shift at a known tick, adversary adaptivity, corpus density. Its output is `(worldSeed, corrupted corpus, question set, sealed answer key)`.

**Why it is infrastructure and not a claim.** Calibration statistics need occupancy — an ECE with three forecasts in a bin is noise, which is why bin occupancy is already reported `[BUILT — src/metrics/calibration.ts:12-22]`. Getting n into the thousands is only possible synthetically. Our scale measurement (15,832 simulations in 305 s) is what makes The Range practical rather than aspirational.

**The government precedent matters, and it is this customer's own research arm.** IARPA's FOCUS program states plainly: *"Because we can't re-run history in the real world, FOCUS methods were evaluated by having hundreds of people make predictions about outcomes in complex simulations."* ([IARPA FOCUS](https://www.iarpa.gov/research-programs/focus)) The evaluation regime we are proposing is one the customer's own research organization has already accepted and paid for, with Johns Hopkins APL as the T&E partner.

**The non-claim, stated in the same breath.** Every number from The Range is `synthetic_oracle` forever. No function pools it with anything else `[BUILT — src/metrics/index.ts:41-45]`. Performance on The Range is evidence about the *machinery* — that the abstention gate fires when it should, that skill tracks evidence quality, that a misspecified kernel is punished — and is not evidence about the world. `[DESIGN — not built as a component; the existing synthetic corpus generator `src/corpus/synthetic.ts` is its seed.]`

### 4.3 The `estimator:` field and the variance-attribution gate

**The objection this answers.** "Your ensemble diversity is decoration — you are varying knobs nobody measured, so your spread is an artifact of your own imagination." It is the right objection. Today the platform can be asked it and has only rhetoric to reply with.

**The mechanism.** Every knob, prior and parameter declares how its value would be measured:

```yaml
estimator:
  kind: measured | elicited | fitted | assumed | none
  source: uri | dataset-id        # required for measured/fitted
  method: string                  # required for elicited/fitted
  uncertainty: { dist: string, params: [number] }
  lastRefreshed: date
```

Load-time: a numeric leaf without `estimator:` fails the pack. Run-time: decompose the ensemble's outcome variance across the design's dimensions (first-order sensitivity indices; because we control the design, a crossed or Latin-hypercube layout gives this cheaply), then:

```ts
// src/metrics/attribution.ts — NEW
if (shareAttributedTo(["none", "assumed"]) > thresholds.maxUnestimatedVarianceShare) {
  abstain("spread_from_unestimated_parameters");
}
```

A new member joins `ABSTENTION_REASONS` `[BUILT — src/evidence/abstention.ts:17-23]`, and the product's "what would change this" section names the specific parameter and what would have to be measured to un-block the question. That is an actionable collection requirement, which is a thing this customer buys.

**This is the same move as the leakage guard.** The as-of guard converted "we promise not to use post-dated evidence" into a runtime assertion that throws `[BUILT — src/corpus/as-of.ts:8-10, 151-153]`. This converts "we promise our diversity is meaningful" into a runtime assertion that abstains. **Honest cost:** it requires a structured experimental design, so ensemble sizes grow, and the attribution is only as trustworthy as the design. Both belong in the bid. `[DESIGN — not built.]`

### 4.4 The stylized-facts gate

**What separates "we fit a model" from "our model is consistent with what is already known."** Each kernel config carries published empirical regularities with citations and tolerances (schema in §2.2). Before any forecast, the runner computes each declared statistic over kernel output and refuses on violation:

```ts
// src/sim/validate/stylized.ts — NEW
export class StylizedFactViolation extends Error {}   // same shape as LeakageError
```

Refusal, not warning — matching the platform's existing pattern of turning discipline into throws. The gate runs at pack-load time on a fixed validation seed set, so it costs nothing per question.

Suitable facts are domain-specific and each needs a citation: heavy-tailed cascade sizes and fragmentation thresholds for opinion-dynamics kernels; funnel conversion-rate ranges for staged-funnel kernels; queueing and lead-time regularities for consequence twins. **`[DESIGN — not built; and no stylized facts have yet been selected or cited for either shipped pack. Any bid must say that.]`**

The strategic value is specific: it is the honest answer to "your agent-based model is made up." The reply is not "trust us," it is "here are five published regularities, here are the tolerances, here is the run that refuses to proceed when the kernel misses them."

### 4.5 The decision-layer ablation harness

**The question every evaluator will ask and no vendor volunteers:** does the adversary model do anything, or would a statistical baseline do as well?

```yaml
evaluation:
  ablation: { dimension: actor_profile, mode: freeze_mean }
```

Modes: `freeze_mean` (knobs pinned at their means — the decision layer stops varying), `shuffle` (profiles randomly reassigned across members — destroys the mapping, preserves the marginal spread), `replace_with_baseline` (the whole layer replaced by the fitted marginal distribution of outcomes).

Reported: ΔBrier, ΔCRPS, Δcoverage@N, Δtail recall, with intervals, regime-tagged. **If Δ ≤ 0, the honest answer is to ship the statistical model** — and saying so before being asked is the most credible sentence available in a bid whose entire thesis is measurement honesty.

Implementation note that makes it cheap: an ablation is just another run identity, so it is byte-reproducible and cacheable. `[DESIGN — not built.]`

### 4.6 The commit-then-resolve register

**Without this, a "live post-cutoff" arm is not evidence class (c).** A forecast that can be edited after the fact, or selected from a drawer of forecasts after the fact, is not a track record.

```
register/<pack-id>.jsonl        # append-only, hash-chained
{ "seq": 41, "prev": "sha256:…", "committedAt": "2026-10-01T12:00:04Z",
  "questionId": "…", "packHash": "…", "panelSpecHash": "…",
  "runId": "…", "artifactHash": "…", "asOf": "2026-09-30",
  "abstained": false, "probabilities": [0.05,0.34,0.46,0.15],
  "resolution": { "source": "…", "expectedBy": "2027-01-14" } }
```

Rules: entries are never amended — a correction is a new entry referencing the old. Resolution is written by a separate process that reads only the register and the published resolution artifact. The chain head is published periodically (a public hash is sufficient; no content need leave the enclave), so a third party can verify that entry 41 existed on 2026-10-01 without seeing it.

The artifact store already provides content-addressing and manifest hashing `[BUILT — src/artifact/store.ts:85-112]`, so this is a thin layer over machinery that exists. `[DESIGN — not built.]`

### 4.7 The rerun-diff: from reproducibility to attributable change

**The process being displaced is a loop.** The analyst reads the product, disagrees with an assumption, changes it, and reruns. Today PROTEUS can prove that the same seed gives a byte-identical artifact hash. That is a claim about *reproducibility*. The operationally valuable claim is about **attributable change**.

```
$ proteus diff run/8f3a… run/c21b…

CONFIG DELTA (2 lines)
  actors.primary.knobs.escalationPropensity.range   [0,100] → [40,100]
  observation.delayTicks.value                      45 → 30

OUTCOME DELTA
  BLUF band            b2 (3–6 utilities)  →  b3 (7 or more)      ← MOVED
  probability vector   L1 distance 0.38
  confidence           moderate → moderate                         (unchanged)
  abstention           PROCEED → PROCEED                           (unchanged)

ATTRIBUTION  (one-at-a-time reruns, each cached by identity hash)
  escalationPropensity.range   →  moves the BLUF band.   L1 0.36
  observation.delayTicks       →  does not move the band. L1 0.04
```

This is exact, not narrated, and it is exact *because* identity is a hash of the full config and runs are deterministic: each one-at-a-time rerun is confounded with nothing. The k re-runs it costs are cached by identity, so the second analyst who asks the same counterfactual pays nothing.

**This is the one thing an LLM-narrating competitor structurally cannot offer.** When their system is rerun with a changed assumption, everything changes at once — the sampling, the retrieval order, the prose — and no line of the output can be attributed to the line of input the analyst edited. Extends the existing trace command `[BUILT — src/cli.ts:107-125]`. `[DESIGN — not built.]`

### 4.8 The dissent-and-override channel

**IC analytic tools die of non-adoption far more often than of inaccuracy.** A tool that only speaks is a tool an analyst routes around. A tool that records the analyst's disagreement *as a typed object, scored alongside the machine on the same resolution source*, is a tool an analyst has a reason to use.

```ts
// src/dissent/types.ts — NEW
export interface Dissent {
  readonly id: string;
  readonly runId: string;
  readonly artifactHash: string;          // pins exactly what was disagreed with
  readonly analyst: string;               // a named human
  readonly submittedAt: string;
  readonly target: { kind: "assumption" | "band" | "probability" | "indicator" | "panel_judgment";
                     ref: string };
  readonly claim: { kind: "wrong" | "incomplete" | "unfalsifiable"; statement: string };
  readonly proposedChange: { configPath: string; from: unknown; to: unknown } | null;
  readonly falsifier: string;             // REQUIRED — same rule the product's assumptions obey
  readonly resolvesAt: string;
  readonly outcome: "pending" | "analyst_right" | "machine_right" | "both_wrong" | "unresolvable";
}
```

Three behaviors:

1. A dissent carrying a `proposedChange` **automatically triggers a rerun-diff** (§4.7). That is the analyst's actual loop, closed.
2. A dissent is **committed to the register** (§4.6) alongside the machine's forecast, and graded on the same published artifact. Over a program's life this produces the only genuinely interesting number in the space: how often the machine and the analyst disagree, and who is right when they do.
3. A surviving dissent appears in the product as a footnote with the analyst's name on it.

**This is a direct implementation of ICD 203's Alternatives standard**, which requires that products "identify and assess plausible alternative hypotheses," that this is "particularly important when major judgments must contend with significant uncertainties, or complexity (e.g., forecasting future trends)," and that "significant differences in analytic judgment ... should be fully considered and brought to the attention of customers" ([ICD 203, tradecraft standards 4 and 7](https://donohueintellaw.ll.georgetown.edu/sites/default/files/assets/ICD%20203%20Analytic%20Standards.pdf)). It is also our answer to the coordination problem: the dissent object *is* the dissent footnote, and it has a human's name on it. `[DESIGN — not built.]`

### 4.9 Composition semantics: decision → activation → consequence

Chaining is where evidence classes get silently laundered, so the rules are strict.

```yaml
compose:
  stages:
    - { pack: ics-water-tasking@1.0.0,   regime: live_post_cutoff }
    - { pack: access-to-effect@0.2.0,    regime: synthetic_oracle }
    - { pack: treatment-plant-twin@0.1.0, regime: historical_backtest }
  joins:
    - from: ics-water-tasking.measure.disclosed_water_ot_intrusions
      to:   access-to-effect.input.taskedUtilities
      mapping: { kind: declared, function: disclosureToTaskingPrior,
                 estimator: { kind: assumed } }        # ← the join is itself an assumption
```

**Rule 1 — the regime does not collapse; it becomes a vector.** `CompositeRegime = readonly EvaluationRegime[]`, one entry per stage, printed in full on every report. A composite may be called `live_post_cutoff` **only if every stage is**. There is no function that reduces the vector to a single tag — the same structural refusal the platform already applies to pooling `[BUILT — src/metrics/index.ts:41-45]`.

**Rule 2 — the join is a first-class assumption with its own estimator.** It enters the confidence assessment as its own driver and is subject to the §4.3 gate. A composite whose spread is dominated by an unestimated mapping abstains. This is the failure mode that kills chained models everywhere else: three defensible stages joined by two invented arrows.

**Rule 3 — confidence aggregates by weakest link across stages *and* joins**, unchanged in kind from the single-pack rule.

**Rule 4 — probability composes by pushforward, not by multiplication of point estimates.** Stage B is run per surviving stage-A member (n_A × n_B, or a declared coupling to control cost), so correlation between stages is carried rather than assumed away. This is precisely why class C is defined with the adversary as a boundary condition: a consequence twin's input signature is designed to accept an upstream distribution.

**Rule 5 — the composite gets its own run identity**, hashing the stage list, the joins, and every stage's `packHash`. A composite is reproducible and diffable like anything else. `[DESIGN — not built.]`

---

## 5. What stays exactly as it is

These are load-bearing and correct. Changing them would be the regression.

| Component | Evidence | Why no change |
|---|---|---|
| **Domain-agnostic kernel driver** | `src/sim/kernel.ts:26-37, 64-97` | `init/step/observe` already admits all three architectures. A consequence twin is a legal adapter today with zero core change. |
| **Seeded PRNG with named forks** | `src/sim/rng.ts`; `root.fork("init")`, `root.fork("step")` at `kernel.ts:73-74` | Adding a draw in one subsystem cannot shift another — the failure that makes an unrelated change look like a real effect. Every new component (§4.1) forks rather than reseeds. |
| **Determinism guard** | `tests/sim/determinism-guards.test.ts` — source scan bans `Math.random()`, `Date.now()`, `new Date()` across `src/sim/` **and** `src/pipeline/` | It catches the class of bug no behavioral test can: the run still works, it just stops being the same run twice. |
| **Leakage guards** | `src/corpus/as-of.ts:8-10` (retrieval filter, accessor tests, runtime assertion), throw at `:151` | The model for every guard added in §4. Discipline as an exception, not a promise. |
| **Abstention gate before scoring** | `src/evidence/abstention.ts` — thresholds measured by sweep at `:36-51` | The gate cannot depend on an adjudicator that may decline. New reasons are added; the position in the pipeline does not move. |
| **Diagnosticity-weighted ACH** | `src/evidence/ach.ts` | Heuer's formula is domain-free; concentration and spread mean the same thing in every architecture. |
| **Likelihood ⟂ confidence** | `src/evidence/icd203.ts` — no exported function of type `(Judgment) => number` | ICD 203 forbids combining a confidence level with a degree of likelihood. The type system enforces it; nothing here needs relaxing for new architectures. |
| **Two product constructors** | `src/pipeline/product.ts:48, 95` — an abstained product has no `hypotheses` field to hide a likelihood in | "The gate ran before any likelihood existed" is a property of the type, not a promise about control flow. |
| **Weakest-link confidence** | `src/pipeline/analysis.ts:206-259` | Grading moves *inside* the panel dimension (§3.2); the cross-dimension minimum stays. |
| **Regime tagging, never pooled** | `src/metrics/index.ts:36-45, 112-116` | The single most important honesty mechanism in the system, and the one that composition (§4.9) extends rather than replaces. |
| **Metrics suite** | `brier`, `murphy`, `calibration` (with bin occupancy), `scoring-rules`, `ensemble` (coverage@N, tail recall, diversity), `agreement` (Krippendorff), `baselines` | All operate on probability vectors and outcome indices. Zero domain content; classes B and C get them free. |
| **Content-addressed artifacts** | `src/artifact/canonical.ts` (sorted keys, `-0` normalized), `store.ts:85-112` (per-file sha256 → manifest hash), `verify()` at `:176` | The substrate the register (§4.6) and rerun-diff (§4.7) are built on. Only `RunIdentity`'s *fields* change (§3.1), not the mechanism. |
| **The `DomainBinding` seam** | `src/pipeline/types.ts:55-69` | Four functions is the whole contract between orchestrator and domain, and the pipeline's own tests drive it with a toy domain containing no ABM at all — which is what makes "one kernel, many adapters" testable rather than asserted. |

### `[CORRECTION]` — two calibration components are not in this codebase

The platform description in circulation lists **"z-score normalization per judge (severity-bias removal)"** and **"outlier detection (global / dimensional / unique)"** among the parts that stay unchanged. I searched for them this session and they are **not present in `engine/src`**:

- `find` across the whole repository returns **no** `normalize.ts`, `outliers.ts`, or `compute.ts`.
- The only normalization in the adjudication path is `normalizeAssessments` `[src/agents/panel.ts:227-233]`, which rescales **one** adjudicator's probability vector to sum to 1. That is not severity-bias removal across judges — it is a different operation solving a different problem.
- `src/evidence/contradiction.ts:207-211` refers to *"the existing z-score disagreement math from judges"* as though it were present. It is a comment inherited from the pivot plan.
- `docs/ARCHITECTURE-PROTEUS.md:175-176` records both files as **"KEPT — ZERO CODE CHANGE."** That document is a plan written against the predecessor codebase (it cites `api/src/task.ts`, `src/scoring/`, `eval/` — none of which exist here). The plan's record and the code disagree; **the code wins.**
- What did survive the pivot is `cosineSimilarity` `[src/util/vector.ts:9]`, used by `ensembleDiversity` `[src/metrics/ensemble.ts:130-141]`.

**Consequence for the bid:** do not claim per-judge severity-bias correction or three-way outlier detection as shipped capability. They are **NEW work** (or a port from the predecessor system, if that source is still available), and they belong in the same tranche as §3.2 — both concern how a panel's outputs are combined. Their absence is also a live correctness issue: with an ungraded panel (§3.2) *and* no per-judge normalization, a single severe adjudicator currently moves the aggregate more than it should.

---

## 6. Component register

| Component | File / location | Verdict | Reason |
|---|---|---|---|
| Kernel driver | `src/sim/kernel.ts` | **KEEP** | Already admits all three architectures; a consequence twin needs no core change. |
| Seeded RNG, named forks | `src/sim/rng.ts` | **KEEP** | Determinism substrate for every new component. |
| Determinism source scan | `tests/sim/determinism-guards.test.ts` | **KEEP** | Catches the one bug class no behavioral test can. |
| As-of corpus + leakage assertion | `src/corpus/as-of.ts` | **KEEP** | The pattern all new guards copy. |
| Abstention gate | `src/evidence/abstention.ts` | **EXTEND** | Add `spread_from_unestimated_parameters` (§4.3) and `scope_refusal_rate` (§3.2). Position in the pipeline unchanged. |
| ACH + diagnosticity | `src/evidence/ach.ts` | **KEEP** | Domain-free; Heuer's weighting means the same thing in every class. |
| ICD 203 judgment types | `src/evidence/icd203.ts` | **KEEP** | No `(Judgment) => number` exists; the separation is structural. |
| Product constructors | `src/pipeline/product.ts` | **EXTEND** | Add the panel-survival line and dissent footnotes. Both differ run-to-run, so both earn their ink. |
| Weakest-link aggregation | `src/pipeline/analysis.ts:206-259` | **KEEP** | Aggregation is over dimensions, not judges; §3.2 grades within a dimension. |
| `adjudicationAvailable: boolean` | `src/pipeline/analysis.ts:171` | **DELETE** | One survivor of eight scores identically to a full panel. Replaced by `PanelSurvival`. |
| `available: results.length > 0` | `src/pipeline/run-question.ts:680` | **DELETE** | Same defect at its source; replaced by the survival record with refusals and errors graded apart. |
| `degradationCheck()` | `src/metrics/operations.ts:159-195` | **EXTEND** | Instantiate a second time over panel survival so graceful degradation is a test assertion. |
| `RunIdentity` | `src/artifact/store.ts:28-35` | **EXTEND** | `+packHash +panelSpecHash +ensembleDimensionHash +identityVersion:2`. Without them, different rubrics share a run id. |
| Artifact store / canonical JSON | `src/artifact/{store,canonical}.ts` | **KEEP** | Mechanism unchanged; only identity's fields change. |
| Panel planner | `src/agents/panel.ts` | **EXTEND** | Emit a persisted, hashed `PanelSpec`; consult the approved registry; flag-and-count unapproved. |
| `normalizeAssessments` | `src/agents/panel.ts:227-233` | **KEEP** | Correct for what it does (one judge's vector → sum 1). Not a substitute for cross-judge normalization. |
| Per-judge z-score normalization | *absent* | **NEW** | `[CORRECTION]` — recorded as "KEPT, zero change"; not in this codebase. Without it a severe adjudicator over-moves the aggregate. |
| Outlier detection (global/dimensional/unique) | *absent* | **NEW** | Same correction. `cosineSimilarity` survived; the detector did not. |
| Framer | `src/agents/framer.ts` | **EXTEND** | Generalize from actor profiles to any declared ensemble dimension; per-dimension separation check. |
| Hard-wired two-knob schema | `src/agents/framer.ts:41` | **DELETE** | Four of six mission lenses re-bound or bypassed them. Becomes one dimension among five. |
| `SIMULATION_READING_CREDIBILITY = 0.8` | `src/pipeline/types.ts:26` | **DELETE** | A global constant that is an unestimated assumption. Moves to `corpus.readingCredibility` with a required `estimator:`. |
| `DomainBinding` seam | `src/pipeline/types.ts:55-69` | **KEEP** | Four functions; already driven by a toy domain in tests, which is what makes reuse testable. |
| Metrics suite | `src/metrics/**` | **KEEP** | Probability vectors and outcome indices only; classes B and C inherit it free. |
| Regime tag | `src/metrics/index.ts:36-45` | **EXTEND** | Becomes a per-stage vector under composition; still never pooled. |
| Trace command | `src/cli.ts:107-125`, `src/pipeline/trace.ts` | **EXTEND** | Becomes the rerun-diff (§4.7). |
| CLI flag-driven questions | `src/cli.ts:27-59` | **EXTEND** | Flags become a Scenario Pack; `--offline` and the fallback partition stay. |
| Scenario Pack loader + validator | `src/pack/` | **NEW** | The config contract; enforces estimator coverage, stylized facts, resolution verification at load. |
| Panel registry + approvals | `src/panel/registry.ts`, `packs/*/panels/` | **NEW** | The difference between configurable and auditable. |
| Observation-corruption layer | `src/sim/observe/corrupt.ts` | **NEW** | Turns abstention rates from asserted to measured, for every pack, via a wrapper. |
| The Range | `src/range/` | **NEW** | Evaluation infrastructure with exact ground truth; precedent set by IARPA FOCUS. |
| Variance attribution + gate | `src/metrics/attribution.ts` | **NEW** | Makes "your diversity is decoration" a runtime abstention instead of an argument. |
| Stylized-facts gate | `src/sim/validate/stylized.ts` | **NEW** | Separates "we fit a model" from "consistent with what is known." |
| Ablation harness | `src/pipeline/ablate.ts` | **NEW** | Answers the evaluator's question before it is asked; may conclude against us. |
| Commit-then-resolve register | `src/register/` | **NEW** | Without it, `live_post_cutoff` is a claim, not evidence class (c). |
| Dissent channel | `src/dissent/` | **NEW** | Non-adoption kills IC tools; also a direct ICD 203 Alternatives implementation. |
| Composition | `src/pipeline/compose.ts` | **NEW** | Chaining without regime laundering. |
| `docs/ARCHITECTURE-PROTEUS.md` §"scoring/ KEPT" | `docs/ARCHITECTURE-PROTEUS.md:139-141, 175-177` | **DELETE** | Describes a predecessor repo (`api/`, `eval/`, `src/scoring/`) that does not exist here. Leaving it invites the exact claim we must not make. |

---

## 7. What is not built, stated plainly

**Built and verified this session:** the class-A pipeline end to end with two domain packs; determinism and leakage guards; the abstention gate with swept thresholds; ACH with diagnosticity; the metrics suite with regime tagging; content-addressed artifacts.

**Designed here, not built:** every item marked NEW in §6 — the pack loader, panel registry, corruption layer, The Range, the estimator gate, stylized facts, ablation, register, dissent channel, composition — plus the three fixes in §3, plus per-judge normalization and outlier detection.

**Never measured, and always to be labelled so:** historical backtest accuracy; live post-cutoff accuracy; skill versus a human analyst; contradiction detection on real prose. No class-B or class-C pack exists, so both of those architectures are architecture, not evidence.

**TRL, two columns, always.** Platform TRL 4. Every pack TRL 2–3. Counting the platform's maturity as the pack's maturity is the standard way this number gets inflated, and an evaluator who has read three other bids will be looking for exactly that.

**Test-suite evidence class, this session.** Full suite under default parallelism on a loaded machine: **654 passed / 5 failed / 4 skipped (663)** in 1,008 s wall against 5,026 s of cumulative test time — heavy oversubscription. I re-ran one of the failing files in isolation: `tests/sim/influence-ops/behavior.test.ts` → **32/32 passed in 3.87 s**. So the failures are **ASSUMED** to be timeouts under contention rather than defects; I re-ran one file of five, and that is the extent of the evidence. The circulating figure of "659 passing, 4 skipped" does not match what I measured (663 total collected here), and a bid should quote a suite run it can point at, on a machine it controls.

**The classification path is a solved contracting pattern, and determinism makes it cheaper.** IARPA REASON states that "performer teams will conduct research and development to build systems that will be evaluated by an independent testing and evaluation (T&E) team" ([IARPA REASON](https://www.iarpa.gov/research-programs/reason)). Our contribution to that pattern is specific: because a run's identity is the hash of everything that produced it and the artifact hash is the hash of everything it emitted, a cleared T&E team can re-execute an uncleared performer's pack against classified corpora and prove — byte for byte — that it ran the same system, without the performer ever seeing the data or the result.

---

**Sources**

- [IARPA FOCUS — Forecasting Counterfactuals in Uncontrolled Settings](https://www.iarpa.gov/research-programs/focus) — evaluation by having hundreds of people forecast outcomes in complex simulations; T&E partner JHU/APL.
- [IARPA REASON — Rapid Explanation, Analysis and Sourcing Online](https://www.iarpa.gov/research-programs/reason) — independent T&E team evaluates performer systems.
- [ICD 203, Analytic Standards (full text)](https://donohueintellaw.ll.georgetown.edu/sites/default/files/assets/ICD%20203%20Analytic%20Standards.pdf) — likelihood and confidence must not be combined; tradecraft standard 4 (analysis of alternatives); standard 7 (significant differences in analytic judgment brought to customers' attention); standard 1 (describe methodologies).
- [ODNI — Objectivity / IC Analytic Standards](https://www.dni.gov/index.php/how-we-work/objectivity) — the five standards and nine tradecraft standards, revalidated January 2015.