# Demo cases

Runnable cases with the inputs and the output to expect. Written for someone
evaluating whether this is credible, not for someone who already believes it.

Every output below was produced by running the command shown. Nothing is
illustrative.

Run everything from `engine/`. All cases are `--offline` — no API key, no
network, sub-second.

---

## 🧑 In Plain English

**What these are:** eight things you can type to see the system behave, and what
it should print back. Four show it working. Four show it refusing to work, or
failing in ways worth knowing about.

**Read the refusals first.** Anyone can demo a system producing an answer. The
cases where it declines to answer, and says what it would need instead, are the
ones worth your time.

---

## Case 1 — Determinism

The claim: the same seed reproduces the same run, byte for byte.

```bash
for d in .caseA .caseB; do
  npx tsx src/cli.ts forecast "Where does adoption land?" \
    --offline --runs 6 --seed audit --store ./$d >/dev/null
  python3 -c "
import json, glob
for m in sorted(glob.glob('$d/*/manifest.json')):
    j = json.load(open(m))
    print(j['runId'][:16], j['artifactHash'][:16])
" > /tmp/$d.txt
done
diff /tmp/.caseA.txt /tmp/.caseB.txt && echo "IDENTICAL"
```

**Expect:** `IDENTICAL` — matching run ids _and_ matching artifact hashes, e.g.

```
2de9bb467dc2fb39  1feedbd5112cf337
79e5aca6f6e32b99  686ae9ffe9e4aa06
8ccfaf2b4918e5c5  ffa0e86a584ab98d
```

Two separate stores, so nothing is reused between the runs. The run id is the
hash of everything that determined the run and the artifact hash is the hash of
everything it emitted; a re-run either reproduces both or it is a bug, and there
is no third outcome.

This is the fastest credibility win in the whole system. It takes five seconds
and it is the property a government auditor cares about most.

---

## Case 2 — The system refuses to answer

The claim: "insufficient evidence" is a first-class verdict, reached before any
probability is computed.

```bash
npx tsx src/cli.ts forecast "Exactly what share of clearance-holders reach tasking?" \
  --domain recruitment --measure taskedCleared --tick 179 \
  --range 0,0.06 --bands 16 --runs 8 --seed gate --offline --store ./.case2
```

**Expect** — verbatim from the run:

```
BLUF: Insufficient evidence to issue a judgement. Too little evidence
discriminates between the hypotheses. Volume of consistent evidence does not
substitute. The leading hypotheses score too closely to separate. Reporting a
winner here would be reporting noise.

WHAT WOULD CHANGE THIS:
  - Collect evidence that would be INCONSISTENT with at least one hypothesis;
    corroborating detail will not move the estimate.
  - Either narrow the hypothesis set or collect against the specific
    observables that discriminate between the leaders.
```

**Why it fires:** 16 bands over a 0–6% range asks the model to resolve
differences finer than its own noise. The gate runs on mechanically-derived
evidence _before_ any likelihood exists, so a model that declines to adjudicate
cannot turn "we should not answer" into "we could not check."

**The line that matters to an evaluator:** it does not just refuse, it says what
collection would change the answer.

---

## Case 3 — The counterintelligence question

The claim: a second domain, the MSS/LinkedIn recruitment funnel, runs through
the same pipeline. See `CASE-MSS-LINKEDIN.md` for sourcing.

```bash
npx tsx src/cli.ts forecast \
  "How many of our clearance-holders reach paid tasking before the campaign is detected?" \
  --domain recruitment --measure taskedCleared --tick 179 \
  --range 0,0.06 --bands 4 --runs 8 --seed demo --offline --store ./.case3
```

**Expect** — verbatim:

```
BLUF: taskedCleared between 0.000 and 0.015 — unlikely (20%–45%), moderate confidence.

HYPOTHESES
  h1  unlikely (20%–45%)      taskedCleared between 0.000 and 0.015
  h2  unlikely (20%–45%)      taskedCleared between 0.015 and 0.030
  h3  very unlikely (5%–20%)  taskedCleared between 0.030 and 0.045
  h4  very unlikely (5%–20%)  taskedCleared between 0.045 and 0.060

INDICATORS & WARNINGS
  employerConcentration above 0.2698 → favours h1 (LR 8.75)
  acceptanceRate above 0.2267        → favours h1 (LR 0.18)
  accountYouth above 0.0863          → favours h1 (LR 0.18)
```

**Read the indicators, not the BLUF.** Every channel named is one a platform
could actually compute — how concentrated approaches are on one employer, how
many get replies, how many senders are new accounts. None of them mentions who
was compromised, because a defender cannot see that.

`--range 0,0.06` matters: the measure is a fraction of a 2,000-person workforce
and realistic values sit near 0.01. Partitioning the full 0–1 range puts every
scenario in one band and produces a forecast that is trivially right.

---

## Case 4 — The finding: what the detector misses

The claim that makes the domain worth having. Four campaign profiles, 8 seeds
each, detector threshold 0.50 over a 20-tick baseline:

| Campaign profile                        | Detected        | Cleared personnel compromised at detection |
| --------------------------------------- | --------------- | ------------------------------------------ |
| Loud — 10 new accounts, fast escalation | 8/8, by tick 20 | 0                                          |
| Reference                               | 8/8, by tick 22 | 0                                          |
| **Patient — 2 aged accounts, slow**     | **0/8**         | **18**                                     |
| **Begins before the baseline period**   | **0/8**         | **36**                                     |

**The detector catches everything noisy and nothing patient — and the patient
campaigns are the ones that compromise people.**

Both blind spots are structural, not tuning artefacts. A deviation detector
cannot see a campaign that was already running while it learned what normal
looks like, and it cannot see one whose volume never departs from normal.

**Caveat that must travel with this table:** the model does not simulate
response. Detection stops nothing — it marks the point after which a defender
_could_ have acted. "Compromised at detection" is damage already done when the
alarm rings, not total damage.

---

## Case 5 — See inside a run

```bash
npx tsx src/cli.ts trace --all --store ./.caseA --out ../dashboard/data/run-traces.json
cd ../dashboard && npm run dev     # then open /runs
```

**Expect:** a per-run page with a tick scrubber. Drag it and watch the belief
distribution reorganise. The page is built around a hard divider: ground truth
on the left, what a defender could observe on the right.

`/runs` reads influence-ops runs only. Pointed at a recruitment store it refuses
by name rather than rendering a page of zeros; the recruitment domain is visible
through Cases 3 and 4, not here.

---

## Case 6 — Provenance and the information cutoff

The claim: nothing published after the cutoff can be cited, enforced in code.

```bash
npx tsx src/cli.ts forecast "Where does adoption land?" \
  --offline --runs 4 --as-of 2026-01-15 --json --store ./.case6 \
  | python3 -c "import json,sys; d=json.load(sys.stdin); \
    print('claims:', len(d['claims'])); \
    print('all dated on/before cutoff:', all(r['publishedAt'] <= '2026-01-15' \
      for c in d['claims'] for r in c['support']))"
```

**Expect:** `all dated on/before cutoff: True`.

This is a hard throw, not a warning — a product citing a document from after its
cutoff has an invalid score, and shipping it produces a number that looks fine
and means nothing.

---

## Case 7 — Calibration, measured

```bash
npm run bench     # PROTEUS_BENCH=1, several minutes
```

Or read the published numbers at `/metrics` in the dashboard. Six arms scored
separately and never pooled, a reliability diagram, and the abstention gate's
operating curve.

**What to look for:** the `indistinguishable` arm abstains on 80/80 questions
and renders as "nothing to score" rather than as a blank that could be mistaken
for a good number. The regime caveat is printed above the first figure.

---

## Case 8 — With a model in the loop

```bash
npm run preflight     # confirm ANTHROPIC_API_KEY is valid first

npx tsx src/cli.ts forecast \
  "Will the campaign push adoption above one third by the resolution tick?" \
  --measure adoptionRate --bands 4 --runs 8 --tick 60 --store ./.case8
```

**Expect:** roughly **6 minutes** and **$0.30**. The forecast itself is ready in
under a second — all of the wall clock is the analytic layer. See
`IO-AND-DEMO.md` §4.1.

**The moment worth waiting for** is the red team attacking its own answer. From
a real run:

> Zero runs in h1/h2 across 16 simulations indicates structural model
> constraint, not empirical impossibility… This is a sampling artifact
> masquerading as evidence.

A system that publishes the best argument against its own conclusion is doing
something a briefing slide cannot.

---

## What none of this establishes

| Claim                                                      | Status                                   |
| ---------------------------------------------------------- | ---------------------------------------- |
| The pipeline propagates its own uncertainty honestly       | measured, synthetic oracle               |
| The abstention gate fires when evidence is thin            | measured, with its false-abstention cost |
| Same seed ⇒ identical artifact                             | measured                                 |
| The recruitment funnel's **rates** match any real campaign | **no** — see `CASE-MSS-LINKEDIN.md` §4   |
| Contradiction detection on real prose                      | **unknown**                              |
| Historical backtest accuracy                               | **not yet measured**                     |
| Live post-cutoff accuracy                                  | **not yet measured**                     |
| Skill against a human analyst                              | **not yet measured**                     |

The recruitment model describes the funnel's _structure_, not any real
campaign's _rates_. The defensible claims from it are comparative — this defence
beats that one, this campaign profile evades detection and that one does not.
