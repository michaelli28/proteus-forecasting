# Storm-restoration build: talking points

Every number comes from the claims ledger, `docs/RESTORATION-CLAIMS.md`, cited by its ID; [a, b] is a 95% interval, and all of it is evidence class (b): local runs on public data and synthetic feeders, nothing live-verified.

## The 30-second version

I built a simulator of storm-repair crews. On made-up networks, "fix whatever brings the most
customers back now" costs 5–9% more customer-hours (customers × hours without power) than the best
order found in hindsight, in small storms. A county version, fitted on 2018–21 tropical storms, was
tested once on sealed 2022–25 outage records: do real recoveries match the model's? The rule fixed
in advance did not reject it, but 3 of 9 larger storms were flagged [7.5%, 70.1%]; I report both.
The point is discipline: everything frozen first, and a model that failed its self-test and got one
dated amendment before earning the real test.

## Talking points

### The sealed years opened once, after the model, the code and the seeds were frozen

The check's rules were committed before any 2022–25 curve was read, apart from one disclosed 3 MB
head of the 2024 file. Before unsealing, an addendum pinned the fitted model files, the code commit
and every seed. The run refuses to unseal unless the code in use is that exact commit, the input
checksums match and a clean rehearsal on training storms ran from the same code.

- **The number:** one unseal, logged once, after six conditions were checked; a rerun would need a
  `--deviation` flag and be reported beside it (H1).
- **The honest limit:** "nothing else from 2022–25 was read" is a self-report checked from codes and
  timestamps; the 3 MB head's 4 storm-county pairs were dropped by a rule fixed in advance (D2).
- **If asked:** "Why pin the code, not just the model?" The scorer is part of the test: a frozen
  model scored by edited code is a test picked after the fact. The one change to that commit, before
  unsealing, added a county record per look and let intervals skip empty resamples; it is logged as
  a dated deviation, and no number moved (H1).

### The rule fixed in advance does not reject the model; the storm count would; both are reported

The protocol fixed which number decides before any curve was read. With 10 or more larger storms
(5 or more usable county records each), the count of flagged storms decides. With fewer, the share
of flagged looks decides (a look is one county, or one pooled group of a storm's small counties,
flagged when it is atypical of its simulated worlds), and it rejects only if its whole interval
sits above 5%. The count came out at 9, so the look rate decided. The storm count, 3 of 9 [7.5%, 70.1%]
(Ian, Beryl and Francine), is the more worrying signal.

- **The number:** 17 of 434 looks flagged, 3.9% [1.7%, 5.2%] (H2); 3 of 9 storms [7.5%, 70.1%],
  p = 0.008 (H3).
- **The honest limit:** the pass is one-sided and its power (how often it catches a real error) was
  never measured; planted errors barely move look rates (5.6% at +24 h of delay), so it means "not
  detectably miscalibrated", never "validated" (H2, A6). Why three storms flagged is untested: a
  county or storm spread (how much repair pace and start delay vary) too narrow, the model's
  structure, drift between periods, or data quirks; the run cannot tell which (H3).
- **If asked:** "Why not switch to the storm count, the sharper test?" That would be choosing the
  test after the result; the 9 was fixed from counts first. And so few storms prove little even when
  they pass: 0 of 9 flagged would still allow up to 33.6% (D4). The look rate rests on 13 storms,
  and Helene alone is 188 of the 434 looks and 9 of the 17 flags (H2).

### The first model failed its own self-test and got one dated amendment

Before the sealed years could open, the model had to pass a self-test on training storms: score each
one against a spread fitted without it. The pre-registered model failed badly, and so did the
plan's one remedy, widening the spread once (covariance ×4, so each standard deviation doubled; the
factor was picked after the base run failed, before its own result was seen). An exploratory
diagnosis on training data found curves restoring too steeply, counties within a storm scattering
widely and a pooling defect; which caused the failure is untested. The held-out years stayed
sealed; I chose one amendment over stopping, and a second failure would have ended the test.

- **The number:** 15 of 18 storms flagged [58.6%, 96.4%], p = 2e-17, and 6 of 18 [13.3%, 59.0%]
  with the widened spread (F1); amended, 2 of 18 [1.4%, 34.7%], p = 0.23 (F5).
- **The honest limit:** the amendment was designed after seeing which storms failed, so its pass is
  not out-of-sample; the gate is one-sided (a wide enough spread can pass anything); and curves are
  still too steep: t90/t50 (hours until 90% are back ÷ hours until 50%) has median 1.67 against a
  real 2.50 (F2, F3, F5).
- **If asked:** "Isn't changing the model after a failure what pre-registration forbids?" Changing
  it quietly is. This was one dated amendment (protocol §16) with five changes, the last a fixed rule
  that picked crews, repair-time shape and over-MCC sizing (how to size counties with more customers
  out than on file) from 24 candidate cells. It was committed before the first amended fit wrote
  anything and used training storms only; all 28 fit writes record that commit (F3, F4).

### A weak spot was named before the test: right about rates, wrong about storms

Some counties have more customers out at the peak than their customer count on file (the "as of
2022" count, MCC); call them over-MCC. Before unsealing, the addendum wrote that held-out flags from
over-MCC counties were expected, since both storms the amended model flagged in training flagged
through one; the results doc reads that as a storm-level prediction too.

- **The number:** over-MCC looks flagged 8.6% [4.8%, 17.9%] against 2.8% [1.1%, 3.9%] (H5); they give
  7 of the 17 flags, but none of the three storm flags depends on one (H6).
- **The honest limit:** pooled looks count as "other", and the storm half is recorded as failed, not
  reread; what does drive the storm flags is untested (H3, H6).
- **If asked:** "A peak above the customer count looks like bad data; why keep them?" The rule fixed
  in advance drops events for data quality, never for being slow, and dropping the hard cases would
  flatter the model. They are kept, sized at their peak, and flagged (D1).

### On training storms, a data-format risk moved which events get scored, not how they are measured

The 2022–25 files write "nobody out" as explicit zero rows; the 2018–21 files never do, and more
held-out events were dropped for missing data, 9.6% against 2.4%. That could bias the check by
changing the measured milestones (t50, t90, t95: hours from the peak until 50%, 90% and 95% of
those out are back), or by changing which events get scored. A worst-case bound, on training storms and before
unsealing, counted every absent row as missing. The milestones barely moved; the fast events
dropped out.

- **The number:** 354 training events drop, with median t95 21.62 h against 83.75 h for those kept
  (D6).
- **The honest limit:** that the zero format caused the extra held-out drops is not shown, and its
  net effect on the flag rate is unknown (D6).
- **If asked:** "Why not change how zeros are read once you saw them?" The reading rules were frozen
  before any held-out curve was read; changing them now would be a rule picked with the data in
  view. The bound shows which way the risk points without touching the seal.

### Planted errors measure what the check can catch before it is trusted

Each arm plants one known error in 1,000 simulated storms built on the 18 training storms and counts
how often the check flags them; all ran before unsealing. The summary is δ\*, the smallest dose
whose 95% lower bound on the catch rate is above 50%. A start delay is kept apart: the model already
has a delay setting, so a late storm is flagged once it leaves the training spread, never "caught"
as a structural error.

- **The number:** for prolonged small failures (some points that lost power stay out far longer),
  δ\* is 10% of those points, caught 74.5% [71.7%, 77.1%] (A2). A +48 h delay is flagged 61.6%
  [58.5%, 64.6%]; it puts every county's delay past 38.1 h, the 97.5% point of a county's delay in
  training (A4). A heavier
  repair-time tail is caught at most 17.0%, against 4.2% with nothing planted (A3).
- **The honest limit:** these are catch rates of the storm-level flag, not of the look-rate rule
  that decided (A6), and δ\* may be optimistic because one storm's replicates share draws (A2).
- **If asked:** "What is the false-alarm rate?" Inside the model, 4.2% [3.1%, 5.6%], averaged over
  how much storms varied in training; that arm passes by construction, so it tests the code. At
  fixed settings it runs from 2.3% to 14.3% [12.3%, 16.6%]. For real storms it holds only if 2022–25
  storms behave like 2018–21 ones. The self-test checks that only among training storms, 2 of 18
  flagged [1.4%, 34.7%]; the held-out run, the direct check, flagged 3 of 9 storms [7.5%, 70.1%],
  more than 5% would give (A1, F5, H3).

### The check cannot see repair order, and crew counts are never reported

One arm planted a utility that repairs critical facilities first, and the check flagged it no more
often than when nothing was planted. My reading, not a tested cause: reordering the same work
shuffles who waits, not when the county gets there. Crews: to first order, milestones depend only on
μ/c, mean repair time ÷ crews, so few fast crews and many slow ones look alike. They are not
identical, since the fit's score fell at every step down in crew density, so crews are a fitting
choice at the grid's edge, never reported (F4).

- **The number:** critical facilities first flagged 3.9% [2.9%, 5.3%] against 4.2% with nothing
  planted; McNemar p = 0.68, a paired test on the runs that disagree (A5).
- **The honest limit:** an earlier throwaway prototype (spike S3) did see repair order in one big
  county, 7.3% against 4.6% (A5).
- **If asked:** "Could full curves tell crew counts apart?" Partly, in a toy: in spike S3, the first
  48 h of noise-free 15-minute curves in one big county told crew counts 4× apart 85.6% of the time
  (2× apart: 66.9%), against 50.4%, chance, from four summary features. Whether that survives real-data noise is the identifiability probe,
  which never ran; until it does, crews and repair-time shape stay fixed and are never reported
  (ledger, claim item 5 and "Still open").

### Most customers first against a hindsight optimum, inside the model

A synthetic feeder is a tree of power lines from a substation. A storm breaks 6–12 segments, and a
repair brings customers back only once every break between them and the substation is fixed. The
reference is hindsight: it knows the true repair times. Horn's algorithm solves one crew exactly,
and for 2–4 crews the HiGHS solver runs a time-indexed MILP (an integer program, one yes/no per
repair per start time), with the LP floor (a lower limit no schedule can beat) as the fallback.

- **The number:** one crew, 9.2% [7.1%, 11.5%] more customer-hours in total across 200 storms; the
  median storm's gap is 4.5%, and 32 tie (L2). 2–4 crews: 8.0%, 6.4% and 5.0%, every reference
  proven within 0.01% on 200 of 200 storms (L3).
- **The honest limit:** inside the model only, on one feeder generator, with no travel, and the
  optimum is hindsight, not achievable (L2, L8).
- **If asked:** "Can a rule without hindsight do better?" Horn-order, Horn's list built as if every
  repair took 1.5 h, had the smallest point-estimate gap of the five such rules, 3.7% at one crew;
  no test between rules was pre-registered, so I don't call it best (L6).

### At 12 hours the forecast beats both comparisons, yet both models flag 5 of 13 storms [13.9%, 68.4%]

Twelve hours after the peak, the model gives each county a probability of being 95% restored within
3 days: the share of the simulated worlds whose first 12 hours look most like the real one that get
there. The Brier score (mean squared gap between that probability and what happened; lower is
better) compares it with an exponential-decay curve conditioned the same way and a fixed training
base rate.

- **The number:** Brier 0.127 against 0.172 and 0.229, differences −0.045 [−0.068, −0.005] and
  −0.102 [−0.123, −0.049] (H8); the same 5 of 13 storms [13.9%, 68.4%] flagged by both, far above
  5% (H7).
- **The honest limit:** it uses the peak and the event filters in hindsight, so it is not a
  real-time forecast, and no arm tests it. At +12 h the simulator flags more looks than the
  full-curve check, 8.8% [3.9%, 17.8%] against 3.9% [1.7%, 5.2%], and why it scores better on Brier is untested (H7, H8).
- **If asked:** "If the simulator forecasts better, why do both flag the same storms?" Untested:
  those storms or their data, or what the models share, the fitted delay spread and the first-hour
  limit (real curves cannot reach a milestone in the first hour; simulated ones can) (H7).

## Whiteboard math

- **Exact binomial and Clopper–Pearson.** For 3 of 9 storms against 5%, P(X ≥ 3) with X ~
  Binomial(9, 5%) is 0.008; inverting the exact test gives [7.5%, 70.1%] (H3). The same math makes
  a pass on 18 storms weak: 2 of 18 still allows up to 34.7% (F5).
- **Design effect.** Looks in one storm move together, so a look rate's variance grows by
  1 + (m − 1)ρ, for m looks per storm with correlation ρ. Measured in the null arm: ρ ≈ 0.0078 over a
  size-weighted 49.6 looks per storm gives 1.38 (A1). Hence whole-storm resampling for [1.7%, 5.2%]
  (H2), and the baseline's wide [1.1%, 11.8%]: 27 of its 33 look flags are Helene (H4).
- **Ranks are uniform when the model is right.** If a real curve is one more draw from the model,
  its rank among the simulated worlds is equally likely to be anywhere, so its p is uniform, mean
  0.5. The amended self-test gave 0.46, but 81 looks between 0.1 and 0.2 against about 47 expected,
  still unexplained (F5; ledger, "Still open").
- **Milestones see μ/c, to first order.** c crews on repairs averaging μ hours finish about c/μ
  repairs an hour, so every milestone scales with μ/c. The selection rule still moved crew density
  (p 7.6e-6). Why is ASSUMED: every county keeps at least one crew, so at ¼ × √6 per 10,000
  customers, 383 of 640 county-events (one county in one storm) sit at that floor, where the scaling
  breaks. Longer tails are not the reason: at the chosen shape, fewer crews gave shorter ones. It is
  a fitting choice at the grid's edge, not a crew count (F4).
- **Brier.** The mean of (p − o)², with o 1 if the county was 95% restored within 3 days, else 0;
  a constant base-rate forecast is the no-skill line (H8).
- **Horn's algorithm and the LP floor.** One crew: moving repair i ahead of its neighbour j changes
  the cost by wⱼ·pᵢ − wᵢ·pⱼ (w customers, p repair hours), so the higher customers-per-hour repair
  goes first (Smith's rule). Horn's algorithm extends this to a tree, repeatedly gluing the
  best-ratio group right behind its parent, which is exact. More crews: the LP floor sits below
  every schedule, so a gap against it is only an upper bound, "at most 28.3%, 25.2% and 22.3%" at
  20 segments (L4).

## Don't say

- Not "the model was validated on real storms". Say "the rule fixed in advance did not reject it,
  3.9% of looks [1.7%, 5.2%], and 3 of 9 larger storms were flagged [7.5%, 70.1%], p = 0.008" (H2,
  H3).
- Not "most customers first is 9.2% worse than optimal". Say "inside the model, with one crew, it
  costs 9.2% more customer-hours than a hindsight optimum" (L2).
- Not "utilities should use Horn-order". Say "in a synthetic lab it had the smallest point-estimate
  gap of the rules without hindsight; no test between rules was pre-registered, so I don't call it
  best, and the check cannot see a utility's order" (L6, A5).
- Not "the check catches delayed crews". Say "a +48 h start delay is flagged 61.6% of the time, once
  it leaves the training spread" (A4).
- Not "it forecasts restoration in real time". Say "12 hours after the peak, using the peak and the
  event filters in hindsight, its 3-day forecast beats both comparisons on Brier score" (H8).
- Not "the check has a 5% false-alarm rate". Say "inside the model, 4.2% [3.1%, 5.6%] averaged over
  the training spread, and 14.3% [12.3%, 16.6%] at its slow corner (the storm-to-storm spread's 97.5%
  point on both pace and delay), if held-out storms behave like training storms" (A1).
- Not "manual operation cut lost water service by nearly half", or the old pump figures. Say "a
  simulation fault made five water figures measure the leak, not the outage; after the fix and a
  re-run, running the plant by hand cuts lost service by 76% in the synthetic model, and one pump
  row stays withdrawn" (ledger, "The water model's rows").
