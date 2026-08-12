# The Generalized Adversary Model

A whitepaper section describing what Proteus models when it is pointed at
something other than water, what it deliberately refuses to model, and what a
sponsor would have to supply to make it useful against their own systems.

---

## 🧑 In Plain English

**What this does.** You describe a system your organisation depends on — a power
grid, a port, a benefits programme, a call centre. You say who might come after
it. The software then plays out the next six months thousands of times and tells
you three things: which parts of that system an adversary would actually go for,
when they would move, and which defensive measures would change their mind for
the least money.

**Why it matters.** Most vulnerability assessments tell you what could go wrong.
This tells you what an adversary would _choose_, which is a much smaller and more
useful list. A system can have fifty weaknesses and still only be worth attacking
in two places, because the other forty-eight are not worth the exposure to the
people who would have to order it.

**What's new under the hood.** Three things. The engine no longer knows anything
about water — the domain arrives as data, so the same model runs against any
system you can describe. Adversaries are no longer a pair of dials called "risk"
and "aggression"; each one carries a researched profile of how that specific
institution weighs cost, exposure, allied opinion, and time, with a source behind
every number. And you can now watch a run happen, decision by decision, including
the moves the adversary rejected and the reason it rejected them.

**The honest caveat, stated once and repeated everywhere in the product.** Only
the water domain has a real physics engine behind its damage estimates. Every
other domain currently produces _structured guesses_ — internally consistent,
reproducible, and not evidence about the world. The software labels which is
which on every screen and every number, and will not let the two pool together.

---

## 1. What changed, and why

The prior system modelled one adversary against one water utility. The adversary
had two parameters — risk tolerance and escalation propensity — swept over a grid
of nine postures. That was enough to explore an attack surface. It was not enough
to answer the question a government evaluator actually asks, which is not "what
could happen here" but:

> _Which_ adversary, against _which_ of our systems, and what would change their
> decision?

Answering that required three changes.

### 1.1 The domain became data

`sim/adapters/contested-system/` is the water model with the water removed. An
actor chooses an **asset**, a **rung** of an escalation ladder, and a
**duration**. Assets, ladder, and consequences are all supplied by the scenario,
so the kernel ranks vulnerabilities in a grid, a port, a payment system, or an
election apparatus without a line of new dynamics code.

The escalation ladder being _data_ rather than a constant is most of what
generalizes the engine. The water model hardcoded five hydraulic instrument bands
because every run was a water run. A port has a different ladder with different
visibility and different reversibility; hardcoding either one forces a fork.

### 1.2 Adversaries became institutions

`actors/doctrine.ts` gives every actor eleven decision propensities on a common
scale — own-cost tolerance, restraint toward noncombatants, attribution aversion,
proxy preference, escalation-control belief, time horizon, decision
centralization, loss-frame risk acceptance, legitimacy weight, signalling
preference, reciprocity — plus a separate rationality precision and a set of
non-negotiable commitments.

Nine profiles ship, researched from open sources: five states and four non-state
archetypes, carrying 232 citations between them.

### 1.3 Reasoning became visible

Every actor's per-tick deliberation is recorded as a first-class event: every
move it scored, the cost decomposition of each, what it rejected, what a
commitment removed before scoring, and whether it acted or waited. A live page
streams this as the run happens.

---

## 2. What this deliberately does not model

This matters more than the feature list, because a proposal that cannot say what
it refuses to do is not a proposal a security organisation should accept.

**No techniques, ever, enforced structurally.** There is no field anywhere in the
scenario format for a technique, exploit, protocol, credential, payload, command
sequence, vendor, firmware version, or network address. No code path can emit an
attack procedure because there is none in the data model to emit. This is not a
filter that could be bypassed by prompting; it is an absence.

**No real targets.** Asset identifiers are opaque scenario-local labels over
synthetic systems. When the scenario compiler is given a request naming a real
facility, it models a synthetic system of the same _class_ and records that
substitution in its assumptions.

**No claims about peoples.** The doctrine layer describes regimes, institutions,
and doctrine. There is no field for an ethnicity, a religion, or a population's
character. This is a modelling decision with an analytic justification, not only
an ethical one — see §3.1.

**No operational planning value.** The model answers "which of my assets is worth
an adversary's exposure, and what changes that". It cannot tell anyone how to
attack anything, and its outputs are useless for that purpose by construction.

---

## 3. The doctrine layer

### 3.1 Why "culture X doesn't value life" is not modelled

A common request is to encode cultural or religious attitudes toward death as an
adversary parameter — typically framed as some societies valuing life less, and
therefore accepting more casualties.

This is not modelled, for two reasons, and the second is the load-bearing one.

It is empirically wrong as stated: it conflates a mobilisation narrative with a
decision rule, and the same regimes described this way have demonstrably behaved
with caution when their own survival was at stake. An assessment built on it
would mispredict exactly the cases that matter most.

And it is _unnecessary_, because the behaviour such a claim is reaching for
decomposes cleanly into parameters that are documented, auditable, and
measurable:

| The intuition                    | The modelled parameter                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| "accepts heavy losses"           | `ownCostTolerance` — demonstrated tolerance for own personnel, materiel, and economic pain          |
| "doesn't mind civilian deaths"   | `counterpartHarmRestraint` — declaratory policy, targeting practice, legal review, observed conduct |
| "will do anything when cornered" | `lossFrameRiskAcceptance` — additional risk accepted in the domain of losses                        |
| "fights through others"          | `proxyPreference` — documented delegation to surrogates                                             |
| "has things it won't trade"      | redlines — non-negotiable commitments that do not respond to price                                  |

Every one of these is sourced per actor. Every one produces the behavioural
differences the cruder framing was reaching for, without a claim an evaluator
would be right to reject.

### 3.2 How the profiles were built

Three passes, 9/9 actor coverage at each:

1. **Research.** One analyst agent per actor against the eleven declared
   parameters, restricted to open sources, primary doctrine preferred.
2. **Adversarial challenge.** An independent agent tried to break each profile:
   verifying citations against primary documents, auditing for essentialism,
   flagging values asserted more confidently than their basis supports.
3. **Structuring.** Redlines converted from prose into machine-readable
   constraints, with the challenge corrections folded in.

The challenge pass earned its cost. Representative findings:

- A US profile quoted the 2025 National Security Strategy in a way that cut the
  clause carrying the document's own stated reasoning about allied reliability,
  changing what the document was attributing the doubt to. The challenger pulled
  the primary PDF, found the full passage, and required it be quoted accurately
  or not at all.
- Five of seven candidate US redlines were demoted to weighted interests with
  specific evidence — including that the 2025 NSS contains no occurrence of
  "Article 5" at all, and that the freedom-of-navigation commitment is gated by
  an economic-consequence clause in the immediately preceding sentence.
- The generic "ideologically-motivated non-state actor" archetype was found to be
  calibrated almost entirely on one movement's cases while claiming generality,
  and to use a faith-specific governance term as its generic structural
  descriptor. Both were corrected; the calibration limit is stated in the
  profile.

**Two agent corrections were themselves rejected**, and both are recorded in the
build script rather than silently applied:

- The challenger "corrected" the US rationality precision from 8.0 to 0.8,
  reasoning that a value outside [0,1] in an object of unit-scaled values was an
  integration defect. Sound in general, wrong here: that field is deliberately a
  softmax inverse temperature on a 1–12 scale. Applying the correction would have
  modelled the United States as behaving nearly at random.
- The criminal-syndicate redline bound `attributability <= 0.2` while its own
  text says _"Attribution to the BRAND is the opposite of constrained… only
  legal-identity attribution is refused."_ The constraint inverted its own intent
  and made the archetype completely inert. The engine has no attribute expressing
  "identifies principals as legal persons", so the commitment is carried as prose.

### 3.3 An honest finding about redlines

Only four of the nine actors produced a redline that mechanically constrains
behaviour. This is not a gap in the research — the agents were instructed not to
invent constraints, and correctly declined.

The finding is that **most documented non-negotiables constrain what an actor
will trade away at a negotiating table, not which operational move it will
refuse.** Regime survival, nuclear release authority, territorial claims,
recognition of another state: these are commitments about settlements, not about
targeting. They belong in a model of negotiation. In a model of operational
choice they are prose, and the honest thing is to carry them as prose rather than
to manufacture a threshold that makes the mechanism look more powerful than the
evidence supports.

---

## 4. Consequences, and the evidence class problem

The water domain prices damage with EPANET — a real hydraulic solver, run
thousands of times. Most domains have no equivalent sitting on a shelf. The
temptation is to substitute a plausible formula and print the output in the same
table as the solved numbers.

`ConsequenceOracle` makes that impossible. Every estimate carries the class of
evidence that produced it, and the class travels with the number into the ranking
and out to the product:

| Class        | Meaning                                         | Standing                                                                                                                                      |
| ------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `solved`     | A domain solver ran and its output was recorded | Reproducible and verifiable — but **not validated**: where the solver is both predictor and answer key, measured skill is 1.0 by construction |
| `supplied`   | The evaluator provided the figures              | As good as their data; the model asserts nothing beyond it                                                                                    |
| `parametric` | An analytic stand-in with no solver behind it   | A **structured guess**. Reproducible from the seed, not evidence about the world                                                              |

All three shipped generalization packs are `parametric`, and say so on every
screen. A run whose oracle mixes classes reports the weakest one.

The parametric formula is deliberately simple enough to state in a sentence —
dependent units, times the share that lose service, integrated over effective
hours after buffers, including the recovery tail — so a reader can disagree with
it specifically rather than distrusting it vaguely. Its cells are never marked
`established`, because no sensitivity analysis stands behind a formula.

---

## 5. Third parties

An actor deciding whether to move is pricing who else reacts. A model with no
third parties silently sets that to zero and makes every actor look more
aggressive than it is.

Respondents hold no assets and never attack. They impose cost — which is what
changes the initiator's arithmetic. Each declares an **attribution threshold**:
the confidence at which it will act on what it believes. Below that, it may
suspect and still not move.

That threshold is what makes proxy action rational, and it is visible in the
model as arithmetic rather than asserted as a conclusion. In the shipped tests,
two actors face the same respondent at the same rungs: the one that prefers
surrogates drops its effective attributability below the threshold and the
retaliation term **vanishes** — not shrinks, vanishes — while the actor that
operates directly pays it in full.

Proxy shielding is capped below total. Delegation lowers attributability; it does
not remove it. A model that let it reach 1 would conclude no sponsor is ever
deterrable.

---

## 6. Watching a run

The live page streams a run as it steps. For each actor at each tick it shows the
decision, the rationale, the options weighed, and — for each rejected option —
which cost term held it back.

**Every rationale is generated from the arithmetic that actually ran.** It is a
reading of the numbers, not a narration written alongside them, so what a viewer
reads cannot drift from what the model did. No language model writes any part of
it.

The disclosure discipline is structural. Every event carries the channel it
belongs to:

- `telemetry` — what a defender inside the scenario could observe
- `truth` — what actually happened
- `privileged` — reasoning, both the simulated actors' and the analytic agents'

A consumer standing in for a defender filters to `telemetry`. This is what keeps
detection precision a measured number rather than a tautology: the detector
cannot see the deliberation stream, by construction rather than by convention.

---

## 7. Where real data enters

`retrieval/` opens the seam without pretending it is closed.

**Live public-web retrieval** is implemented. It keeps the _cited passages_ with
resolvable URLs, not the model's prose summary, because a summary cannot be
audited against a source. Anything without a parseable publication date is
discarded rather than admitted with a guessed one — a document that slips past
the as-of guard invalidates the score of every forecast citing it.

**The private-feed connector is specified and NOT implemented**, deliberately. A
sponsor implements one interface, inside their own environment, and nothing else
changes. It carries no classification field on purpose: a connector returning
material Proteus is not cleared to hold has already failed, and adding a marking
field would imply this side is competent to enforce it.

**The gap, stated plainly.** Retrieved documents ground _scenarios_. They do not
yet feed the contradiction-detection and abstention machinery, which needs each
document to carry structured fact assertions with canonicalized subjects and a
declared measurement method. Real prose has neither. Wiring retrieval into that
path without a fact-extraction stage would make every disagreement classify as a
genuine dispute and cause the system to abstain on nearly everything — a failure
that looks like caution and is actually a plumbing bug. That stage is specified
and unbuilt.

---

## 8. What is measured, and what is not

| Claim                                    | Status                                                                                  |
| ---------------------------------------- | --------------------------------------------------------------------------------------- |
| Same seed reproduces a run byte for byte | **Measured** — asserted in tests across the full event stream                           |
| Doctrine changes behaviour               | **Measured** — single-variable tests isolate patience and proxy preference              |
| Reasoning is unavailable to the detector | **Measured** — channel separation asserted per event                                    |
| Generalization across three domains      | **Demonstrated, not validated** — the packs run; no ground truth exists for any of them |
| Water consequence magnitudes             | **Verifiable, not validated** — EPANET is predictor and answer key                      |
| Non-water consequence magnitudes         | **NOT MEASURED** — parametric, labelled as guesses                                      |
| Real-world forecasting skill             | **NOT MEASURED** in any domain                                                          |
| Live retrieval end-to-end                | **Unit-tested against a mocked API; the live path has not been exercised**              |

The last two rows are the ones that matter for a procurement decision, and they
are stated here rather than buried.

---

## 9. What a sponsor would supply

In descending order of how much it would improve the output:

1. **A domain solver** for the system of interest, behind the table interface.
   This is the single change that moves a domain from `parametric` to `solved`.
2. **Access-inventory priors** — how much access an adversary is believed to
   already hold. The model names this as the parameter only privileged reporting
   can set, so downstream confidence caps can point at it by name.
3. **Real mitigation costs.** The defence ROI ranking is only as meaningful as
   its cost figures, which are currently abstract budget units.
4. **A private-feed connector** implementing the specified interface.
5. **Corrections to the actor profiles.** These are the most contestable part of
   the system and are deliberately the easiest to change: they are a JSON file,
   not code. An evaluator with better sourcing replaces it and reruns.
