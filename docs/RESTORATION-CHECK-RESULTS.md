# Real-storm check: Checkpoint 2 results

These are local runs on public data, done on 2026-09-23 at code commit
`51b3dd4`.

- **The rules** are fixed in `RESTORATION-PROTOCOL.md`: frozen at commit
  `2020f07`, with §15 (a schema-read clarification) added at `51b3dd4`.
- **The held-out years (2022–2025)** ran once, from that commit, and gave counts
  only (§3).
- **Evidence class (b):** local runs on the public EAGLE-I and OpenFEMA files.
  No model has been fitted or checked yet; that is Phases 3–4.

## In plain English

- **What this does:** it turns DOE's county power-outage records (customers out
  in nearly every US county, every 15 minutes) into one clean restoration curve
  per county per tropical storm, with a written reason for every curve thrown out. It
  does the full job on the 2018–2021 storms, which the model will learn from.
  For the 2022–2025 storms, which the model will be tested on, it only counts
  how many curves survive. Nobody looks at those curves until the model is
  frozen.
- **What it found:**
  - **Training:** 640 usable county curves from 18 storms, 16 of which have
    at least 5.
  - **Held out:** 553 usable curves from 13 storms, but only **9 storms have at
    least 5**. That is one short of the pre-set bar of 10, as the protocol
    predicted from FEMA's county lists alone. So the headline will be the share
    of county-level looks the check flags, not a count of storms.
  - **The data changed format between the two periods.** The 2018–2021 files
    never record a zero ("nobody out"). The 2022–2025 files do, over a million
    times a year. The rule decided before the freeze handled it mechanically, but
    the change is the biggest risk to a fair test (see "Findings").
- **Why it matters:** this is the first time Proteus's check pipeline touches
  real outcomes; the check itself runs in Phase 4. Every choice was committed
  before the check read any held-out outage value. §3 discloses a 3 MB peek at
  the 2024 file, and §15 followed a header-only read. The code enforces the
  seal, so the results can't be quietly tuned: any change after this point is a
  dated deviation.

## Words used here

- **County-event:** one county's outage curve for one storm, from its peak for
  7 days, or until another outage or the county's next storm begins.
- **Drop:** a curve thrown out, always for a data reason, never for being slow.
  Every drop is logged with its reason.
- **Held-out (sealed):** the 2022–2025 storms. They stay unread until the model
  is fitted and frozen; only counts are allowed out before that.
- **Y:** held-out storms with at least 5 county-events.

## Counts per split

| Step                                       | Training (2018–21) | Held out (2022–25) |
| ------------------------------------------ | -----------------: | -----------------: |
| Declared storm–county pairs                |              2,068 |              1,419 |
| `seen` (2024 file head, §3)                |                  0 |                  4 |
| `no_mcc` (no customer count)               |                 23 |                 13 |
| `not_in_file`                              |                 13 |                  8 |
| `no_event` (never crossed 1% of customers) |                455 |                187 |
| `no_peak`                                  |                  0 |                  0 |
| `left_censored` (already out)              |                 30 |                 17 |
| `not_substantial` (< 1,000 or < 5%)        |                799 |                469 |
| `spike`                                    |    7 (0.9% of 748) |    8 (1.1% of 721) |
| `resurge`                                  |  83 (11.1% of 748) |  91 (12.6% of 721) |
| `coverage` (> 10% missing)                 |   18 (2.4% of 748) |   69 (9.6% of 721) |
| **Kept county-events**                     |            **640** |            **553** |
| Storms with ≥ 1 event                      |                 18 |                 13 |
| Storms with ≥ 5 events                     |                 16 |              **9** |

The percentages divide by the substantial events that reached the shape
filters: kept plus `spike`, `resurge` and `coverage`.

**Per storm (pairs → kept):**

- **Training:**
  - 2018–19: Lane 4 → 0; Florence 279 → 48; Olivia 4 → 0; Michael 217 → 118;
    Barry 41 → 23; Dorian 228 → 50; Imelda 7 → 5.
  - 2020: Cristobal 64 → 5; Douglas 4 → 0; Hanna 32 → 8; Isaias 153 → 68;
    Laura 225 → 70; Sally 169 → 35; Delta 93 → 55; Zeta 119 → 52; Eta 32 → 4.
  - 2021: Elsa 37 → 8; Fred 43 → 11; Henri 53 → 6; Ida 200 → 70;
    Nicholas 64 → 4.
- **Held out:**
  - 2022–23: Ian 213 → 74; Nicole 61 → 20; Hilary 5 → 1; Idalia 127 → 44;
    Lee 30 → 11.
  - 2024: Beryl 67 → 28; Debby 274 → 89; Ernesto 3 → 2; Francine 64 → 22;
    Potential Tropical Cyclone Eight 6 → 1; Helene 505 → 229; Milton 51 → 28.
  - 2025: Chantal 7 → 4; Halong 6 → 0.

## The pre-registered decision

**Y = 9, below 10.** So under §9 the headline is the county-event flag rate over
all held-out looks, with a storm-resampled interval. The model is rejected if
that interval lies entirely above 5%. X of 9 is still printed with its
Clopper–Pearson interval. At 0 of 9 flagged, the upper bound would be 33.6%.

§9 predicted this from FEMA's county lists alone. The nine storms with 5 or
more events are exactly the nine with 30 or more declared counties: Ian, Nicole,
Idalia, Lee, Beryl, Debby, Francine, Helene and Milton.

## Training curves

The 10 curves were drawn at random from the 748 substantial training events
before the shape filter (seed `restoration-protocol/checkpoint2-curves`):

![Ten training county-events](restoration-checkpoint2-curves.png)

- Nine are kept. The tenth is a `coverage` drop: Fred in Calhoun County, FL,
  where the feed has gaps after about 50 h.
- The Nassau County, NY (Isaias) panel shows a slow event kept, not dropped. It
  peaks at 140k customers out, and a week later it is still about 5% of its peak
  (roughly 2% of the county's customers).

**Training features across the 640 kept events** (hours from the one-hour peak):

| Milestone | 25th pct | Median | 75th pct | Not reached in 7 days |
| --------- | -------: | -----: | -------: | --------------------: |
| t50       |      4.0 |    9.6 |     29.1 |                    10 |
| t90       |     11.3 |   31.4 |     73.3 |                    34 |
| t95       |     13.5 |   36.6 |     83.8 |                    44 |

- **Flags on kept events:**
  - 98 are `over_mcc`: the peak exceeded the county's modelled customer count.
    These are kept.
  - 16 never ended.
  - 244 are `cut_early`: another outage started, or the county's next storm
    arrived, before 168 h.

## Findings

1. **The held-out files record zeros, and the training files don't.**
   - **What was seen.**
     - 2018–2021 contain 0 rows with `customers_out` = 0.
     - 2022, 2023, 2024 and 2025 contain 1.28M, 1.31M, 1.09M and 1.14M.
     - In 834, 947, 702 and 76 counties respectively, zeros make up at least 10%
       of the county's rows.
   - **What the rule does.** Under the pre-registered rule (§6), those counties'
     absent rows count as missing instead of zero.
   - **The likely effect.** The `coverage` drop rate is 9.6% held out against
     2.4% in training, and this is the likely cause. That is ASSUMED: the seal
     allows only counts, so it was not checked by county.
   - **Why it matters for Phase 4.** Gaps longer than 2 h are not bridged
     (§6), and they break the 2-hour hold a milestone needs. In zero-storing
     counties, real curves may therefore reach milestones later than they really
     did. The check would then score them as slower than the simulated worlds,
     which means false flags.
   - **What Phase 3 can do.** This is an addition, not part of the
     pre-registration. On training data only, it can compute a worst-case bound:
     treat the absent rows in training curves as missing and recompute the
     milestones. In 2018–21 an absent row is usually a real zero, so this
     overstates the effect. Nothing can be fixed on held-out data without a dated
     deviation.
   - The schema read could not see this, because it reads no values.
2. **Other format changes:**
   - The 2023 file calls the count column `sum` (§15).
   - The 2024 file adds `total_customers`.
   - The held-out files run to Dec 31 23:45, while 2018–2021 stop at Dec 31
     00:00. No window reaches Dec 31 (the latest data windows end on 6–7 Dec, for
     Nicole and Eta), so this has no effect here.
   - 2019 and 2025 hold 131 and 121 duplicate rows, which keep their maximum.
3. **The 2024 file is sorted by county, not by time.**
   - A 3 MB head read during research therefore held four Alabama counties' whole
     2024, Helene included.
   - Those four were dropped as `seen` at the run's first step, by a rule fixed
     before the run.
   - Checked from codes and timestamps only.
4. **Some Hawaii counties never appear in a file.** Hawaii, Kauai and Maui are
   missing from 2018, and Hawaii County from 2020. They make up 7 of the 13
   `not_in_file` training pairs. The other 6 are 51520 (Florence), 01033 and
   01049 (Sally), and 28081, 28117 and 28141 (Ida). Without the rule, they would
   have passed as "no outage".
5. **The spike S1 cross-check.** On 2020–21 this loader keeps 396 events from 13
   storms, 11 of them with ≥ 5. S1 had 326 / 13 / 11.
   - The two chains differ in several pre-registered ways (§14).
   - The largest known difference is that S1 dropped slow and over-count events,
     which this protocol keeps: 58 of the 396.
   - The rest is ASSUMED to come from the other differences. The two sets were
     not reconciled event by event.

## Deviations from the protocol

None.

- **§15** records a column name found by the pre-registered schema read, before
  any held-out value was read.
- **The training run before the freeze** is disclosed in §3. The training numbers
  above come from a rerun at `51b3dd4`, and they match §8's reference counts.
- **The raw held-out counts file** (git-ignored) also breaks the per-storm drop
  counts down by reason. This doc does not publish that breakdown. Under a
  strict reading of §3's "per-step drop counts", it goes slightly further than
  §3 allows. It holds counts only, with no curves or features.

## What this does not show

- **Nothing about the model yet.** No fit and no check have run.
- **Whether the zero-format change will bias the check.** Finding 1 names the
  risk. Phase 3 can bound it on training data, as a worst case.
- **Anything per county or per storm about held-out restoration speed.** No
  held-out curve or feature exists outside the sealed run.

## Reproduce

From `engine/`:

```bash
bash python/eaglei/fetch.sh                                   # download + MD5 check (about 9.7 GB)
.venv/bin/python -m pytest python/eaglei/ -q -p no:cacheprovider
.venv/bin/python -m python.eaglei.checkpoint2 train           # about 70 s, writes .cache/restoration-check/
.venv/bin/python -m python.eaglei.checkpoint2 held_out        # counts only; a rerun is a dated deviation (§3)
```

The FEMA snapshot was fetched once, by `python/eaglei/fetch_fema.sh`, and is not
re-fetched. Package versions: numpy 2.5.2, pandas 3.0.5, scipy 1.18.0 and
matplotlib 3.11.1.

---

# Checkpoint 3: the model fit, on training storms only

These are local runs on the 2018–2021 training files, done on 2026-09-23. The code is under
`engine/python/eaglei/` (`county_sim`, `fit`, `pooling`, `rank`, plus the `diag_*` scripts). No
held-out file was opened in this phase: the only outage-file reads are in `fit.pooled_members`,
which is guarded to 2018–2021, and in `plot_insample`, which sees training storms only.

**Evidence class (b):** local runs on public data and synthetic feeders.

## In plain English

- **What this does.** It fits the county simulator, and a simple exponential-decay curve beside it,
  to the 18 training storms. Then it runs the protocol's self-check before any test storm is
  opened: hide one training storm, fit on the other 17, and ask the check about the hidden one.
  If the model is right, the check should flag a storm only about 5% of the time.
- **What it found.**
  - **The self-check fails.** The simulator gets flagged on 15 of 18 hidden training storms, and on
    53% of county-level looks.
  - **The pre-registered remedy doesn't rescue it.** Widening the fitted spread brought that down to
    6 of 18, which is still far above 5%.
  - **So the test is not run on this model.** Phase 4 is held back, and the held-out storms stay
    sealed.
- **What's wrong, as far as training data shows.**
  - **The fitted simulator restores like a cliff.** It gives a long wait, then nearly everyone back
    at once. Real counties come back gradually, with long tails.
  - **Counties in one storm come out very differently when fitted one by one.** The protocol has
    them all share one setting per storm.
  - **Freeing each county helps a lot,** but it doesn't fix the cliff. Even fitted alone, a county's
    simulated curve is steeper than its real one.
  - **The rule for pooling small counties has a defect.** Half the pooled counties never enter the
    window that gets tested.
- **Why it matters.** Catching this is what the check is for. Because the protocol was frozen and
  the test storms were sealed, the model failed on its own training data first, with the test set
  untouched and still usable for a fixed model.

## What was fitted

These settings were fixed in code before the leave-one-out null ran, except where marked. The code
itself is committed only with this document, so git records those settings from here on.

- **Simulator** (`county_sim.py`). It is spike S3's structure:
  - 60-section random feeders, with about 17 customers per section;
  - damage set so the customers out at t = 0 reach the observed peak (median overshoot 2–5%);
  - √6 crews per 10k customers;
  - Weibull(1.5) repair times, worked through a static most-customers-first list.
  - Restore times are affine in (scale, delay). So a world is simulated once, at unit scale, and
    every (W, delay) is arithmetic on it. A test checks this against re-simulation.
- **Exponential baseline.** Customers out = p₁·exp(−(t − delay)/τ) after the delay.
- **ABC fit per storm.**
  - Draws: 100,000 from a uniform prior: log W on [ln 0.01, ln 100], or log τ on [ln 0.1, ln 1000],
    and delay on [0, 72] h.
  - Selection: keep the 500 draws closest to the storm's milestones, summed over its
    county-events. Rejection ABC weights every kept draw equally, so the ESS is 500 per storm.
  - Distance: each feature is scaled by 1.4826 × MAD of the prior predictive.
  - Worlds: 512 unit worlds per county-event, drawn with replacement.
- **Known defect in the distance.** A 0.25 h floor was meant only for features the prior predictive
  never moves. It also applies whenever at least half the prior draws are censored at 168.25 h:
  179 of 640 county-events, spread across all 18 storms. Such a feature then outweighs the others
  by about 25,000×. Under two other scalings the audit tried, Barry's fitted delay moves from 6.9 h
  to 20–24 h, but the cliff survives all three. The verdict does not depend on it. Any amendment
  should scale on uncensored draws.
- **Spread** (§10). The mean of the per-storm posterior means, and the covariance of those means
  plus the mean posterior covariance. The simulator's spread has log W mean −1.90 (sd 1.23) and
  delay mean 9.5 h (sd 12.6). The spread file's SHA-256 is `ae98ca82…6511be37`.
- **Rank check in Python** (`rank.py`). It reproduces `rank-check.ts` exactly: the p-values are
  identical in a test that runs both. It sorts instead of comparing every pair, so it scales to
  thousands of worlds.

## Minimum county size and pooling

The median work-rate shrinkage of one county-event, against the fitted spread (100 truths each, at a
peak share of 0.32):

| Customers out at the peak | 1k   | 2k   | 3k     | 5k   | 7.5k | 10k  | 15k  | 20k  |
| ------------------------- | ---- | ---- | ------ | ---- | ---- | ---- | ---- | ---- |
| Shrinkage                 | 0.61 | 0.66 | 0.7995 | 0.81 | 0.86 | 0.88 | 0.87 | 0.90 |

- **The minimum size is 5,000.** The 3,000 row misses 0.8 by 0.0005. That knife edge is why the
  rule was fixed in advance.
- **Two inputs were not what they were meant to be.**
  - The peak share of 0.32 was meant to be the median p₁ ÷ county size, but the actual median is
    0.362. The audit reran the study at 0.362 (3k gives 0.79, 5k gives 0.83), and the minimum is
    still 5,000.
  - The study measures shrinkage against the fitted spread, not the wide ABC prior. Against a very
    wide prior, shrinkage is high for any county.
- **Pooling.** 287 of the 640 training county-events (44.8%) are pooled, one pooled look per storm.
  That leaves 371 looks.
- **Defect: the pooled window (§10) is too short.** §10's pooled window runs from the earliest
  member's peak to the earliest member's c.
  - 154 of the 287 pooled members (54%) peak after that window closes. They contribute only their
    observed series, which is identical in the real curve and in every world, so they are never
    tested.
  - 11 of the 18 pooled looks peak below 5,000 customers.
  - Ida's and Fred's pooled looks never reach a milestone at all, so their p is always 1.

## The leave-one-storm-out null (pre-registered, §12)

| Model                                      | Storms flagged | Binomial p vs 5% | County-level looks flagged     |
| ------------------------------------------ | -------------- | ---------------- | ------------------------------ |
| Simulator                                  | 15 / 18        | 2e-17            | 195 / 371 = 52.6% [43.7, 59.7] |
| Exponential baseline                       | 10 / 18        | 3e-9             | 247 / 371 = 66.6% [50.0, 77.6] |
| Simulator, spread × 4                      | 6 / 18         | 2e-4             | 47 / 371 = 12.7% [7.5, 18.1]   |
| Exponential, spread × 4                    | 4 / 18         | 0.011            | 22 / 371 = 5.9% [1.4, 10.8]    |
| Simulator, shape 0.6 (§10 sensitivity row) | 14 / 18        | 1.5e-15          | 189 / 371 = 50.9% [42.3, 58.3] |

- **Intervals** resample whole storms. They are computed in Python with their own seed; the Phase 4
  check would use `stratifiedBootstrap`.
- **Ensembles** are 1,023–4,095 worlds per storm.
  - §11's rule is applied to the number of hindsight looks. §11 defines m by the three-look check,
    which is not run here.
  - The null's validity does not depend on N.
- **Unflagged storms.** The three storms the simulator does not flag all have 1–3 looks: Cristobal,
  Eta and Elsa. Nicholas, with 1 look, is flagged.
- **The remedy** is "widen the spread and re-check" (plan, Checkpoint 3). One step of ×4 on the
  covariance (×2 on each standard deviation) was chosen after the base run failed and before its
  own result was seen. There was no second step: an ever-wider spread eventually passes any storm,
  and then it can catch no error at all.
- **Robustness of the verdict.** Two of the six storms still flagged after widening, Barry and
  Nicholas, are flagged through their pooled look. Dropping both still leaves 4 of 17 (binomial
  p = 0.009).
- **§10's shape-3.0 sensitivity row was not run.**

## Checkpoint 3 go/no-go

| Criterion (plan, Checkpoint 3)                     | Result                                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Work-rate shrinkage ≥ 0.8 at the county sizes used | Pass for county looks ≥ 5k. Not met by pooled looks: 11 of 18 peak below 5k, and 154 pooled members never enter a tested window |
| Not most county-events pooled                      | Pass: 44.8%                                                                                                                     |
| Leave-one-out rate not clearly above 5%            | **Fail:** 15/18, and 6/18 after widening                                                                                        |

**NO-GO.** Phase 4 does not run on the pre-registered model.

- `docs/RESTORATION-ADDENDUM.md` is deliberately **not** written. It is the file whose hash unseals
  the held-out storms (§3), and nothing should be unsealed for a model that fails its own null.
- The held-out split remains sealed.

## What goes wrong (diagnosis, exploratory, training data only)

1. **The fitted simulator restores like a cliff.** CONFIRMED by measurement
   (`diag_ratios.py`). The table compares real counties with p₁ ≥ 5k and t95 reached (n = 314)
   against 4,000 worlds from the fitted spread, for a 40k-customer county with 12k out:

   | Ratio                       | Real: 10th / median / 90th | Simulated: 10th / median / 90th |
   | --------------------------- | -------------------------- | ------------------------------- |
   | Hours to 90% ÷ hours to 50% | 1.46 / 2.50 / 5.08         | 1.01 / 1.09 / 2.2               |
   | Hours to 95% ÷ hours to 50% | 1.65 / 3.08 / 6.16         | 1.01 / 1.14 / 2.9               |
   - Among real counties with p₁ ≥ 5k, 39 of 353 had not reached 95% within the week. That is 36,
     or 10%, if the three cut early are left out. Almost no simulated world missed it.
   - The simulated 90th percentiles move by about ±0.1 from one seed to the next.

   The figure shows real curves against each storm's own in-sample band. It is in-sample by
   construction, so it shows what the model can fit at all:

   ![Real training curves against the simulator's and the exponential's in-sample bands](restoration-checkpoint3-insample.png)

2. **The shape family alone is not the cause.** At zero delay, the simulator's median unit restore
   times give ratios of 2.4 and 3.0 (`diag_ratios.py`). That is close to the real medians, so the
   storm-level fit's long delays make the cliff much worse.
3. **But fitting each county alone still leaves it too steep.** Per-county in-sample t90/t50 has a
   median of 1.75 (10th–90th percentile 1.27–2.12), against the real 2.50. Storm-shared fits give
   1.15. So sharing a setting deepens the cliff, and something in the shape is still missing
   (ASSUMED: for example, the fixed √6 crews per 10k, see item 4).
4. **Counties' fits scatter widely within a storm.** CONFIRMED as a measurement: fitted alone, the
   variance of county means within a storm is a median 6.7× each county's own posterior variance
   for log W, and 2.5× for delay. Restricted to counties the distance floor doesn't touch, it is
   6.0× and 3.5×.
   - Part of that scatter tracks county size (r = 0.42) and early cutting (r = −0.26). Size, peak
     share and cut-early explain 22% of it.
   - That the counties truly restore at different paces is ASSUMED. Some of the scatter may be a
     size effect of the model itself.
5. **Reruns of the null** (exploratory, training only):
   - **A separate draw for each county,** from a spread fitted across counties: 5 of 18 storms are
     flagged (binomial p = 0.0015), and 18 of 371 looks (4.9% [3.2, 7.0]).
   - **A storm effect plus county scatter** (two levels, method of moments on the per-county
     fits): 5 of 18 storms, and 20 of 371 looks (5.4% [3.2, 8.0]). The between-storm SDs are 0.83
     for log W and 4.2 h for delay, against 1.68 and 12.2 h within storms.
     - The estimator subtracts slightly too much. Corrected, the between-storm SDs are 0.74 and
       3.6 h, and the conclusion doesn't change.
   - **Both runs gave all members of a pooled look one shared draw,** not one draw per county.
   - **The overall 4.9–5.4% is an average of two groups:**

     | Looks             | Flagged        |
     | ----------------- | -------------- |
     | Over-MCC counties | 8 / 78 = 10.3% |
     | All other looks   | 7 / 275 = 2.5% |

     All three county looks with p ≤ 1/512 are over-MCC counties: more customers out than their
     modelled count, about 100% out.

   - **Each leftover flagged storm is flagged by a single outlier look:**
     - Florence, Laura and Ida by an over-MCC county;
     - Barry and Nicholas by their pooled look.

     So these runs do not show a shared storm component beyond one storm effect.

## Options for Michael

**(a) Amend the model before unsealing.** It is a dated deviation, refit and re-checked on
training storms. Write the addendum and run Phase 4 once only if the null passes. The candidates,
from the diagnosis:

- a county-level draw, with or without a storm effect;
- a pooled window that covers every member;
- a treatment for over-MCC counties;
- a censoring-aware ABC distance;
- a look at the crew-density assumption behind the remaining steepness.

The held-out storms stay clean for this, because nothing about their outcomes informed the change.
What has been seen of them so far:

- the schema read (headers and county codes);
- the Checkpoint 2 counts;
- the per-file loader stats, including the explicit-zeros finding;
- the 2024 head, whose four counties are excluded as `seen`.

About 1–2 sessions.

**(b) Stop the real-data test here.** Publish the lab, the synthetic check, and this negative
Checkpoint 3 as the finding. The frozen protocol caught a wrong modelling assumption on training
data, before any test outcome.

**(c) Run Phase 4 on the failed model anyway.** This is not recommended. The result is
predictable, since it would flag most storms, so it teaches nothing new.

## What this does not show

- **The exploratory reruns are not pre-registered.** They point to a design; they don't validate it.
- **Crews and repair-time shape are never reported.** Neither identifiability probe was run: not the
  noisy one (drop order, item 4) and not the clean one.
- **Nothing about held-out storms.** No held-out value was read in Phase 3.
- **The explicit-zeros risk from Checkpoint 2 is not yet bounded.** Real curves can have missing
  slots, and simulated curves never do. On training data this changes no milestone. It will matter
  on the held-out years.

## Notes

- **The macOS sandbox blocks Python's process pool,** so every stage ran in a single process. This
  changes timing only; the seeds are per task.
- **The first "spread × 4" run silently reran the unwidened model.** A text patch missed its target.
  Its output matched the base run to every digit, which is what gave it away. It was fixed and
  rerun, and the table above shows the real rerun.
- **An independent audit reproduced the results.** It reran the committed code, and the base null
  matched bit-for-bit on 10 storms × both models. It is the source of the defects listed above.

## Reproduce (Checkpoint 3)

From `engine/`, after Checkpoint 2's training run:

```bash
.venv/bin/python -m python.eaglei.fit abc shrink loo        # about 15 min; writes .cache/restoration-check/phase3/
.venv/bin/python -m python.eaglei.fit loo --widen 4         # the pre-registered remedy
.venv/bin/python -m python.eaglei.fit abc loo --shape 0.6   # §10's sensitivity row
.venv/bin/python -m python.eaglei.diag_ratios               # exploratory: the milestone-ratio table
.venv/bin/python -m python.eaglei.diag_county_theta         # exploratory: per-county fits and draws
.venv/bin/python -m python.eaglei.diag_county_theta hier    # exploratory: two-level draws
.venv/bin/python -m python.eaglei.plot_insample
```
