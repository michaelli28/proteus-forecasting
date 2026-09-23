# Real-storm check: pre-registration

Written before any 2022–2025 outage curve was read, apart from the 3 MB 2024
head disclosed in §3.
Git history is the timestamp. The loader and the check implement exactly these
choices. The results doc reports against them and lists every deviation, dated.

Michael made the choices marked _(Michael)_ on 2026-09-22 and 2026-09-23, each
time picking from options with the spike evidence beside them. The rest is
carried over from spikes S1 (EAGLE-I curves) and S3 (what curves can reveal), in
`proteus-restoration-spikes/` in the Cohort 0 prep repo. Two independent audits
checked the draft against that code before the freeze. §14 lists what they
changed.

## 1. Question

A county-scale restoration simulator is fitted on 2018–2021 storms only. Do the
real 2022–2025 restoration curves look like draws from it? The rank check is
Proteus's existing misspecification check (`engine/src/metrics/rank-check.ts`),
pointed at real data for the first time. The unit is the storm.

## 2. Data

- **EAGLE-I**, figshare article 24237376, version 4 (still the latest on
  2026-09-23), under CC BY 4.0. A file is used only if its MD5 matches figshare's
  `computed_md5`. All ten matched on 2026-09-23. `DQI.csv` was downloaded but
  is not used.

  | File                                           | MD5                                |
  | ---------------------------------------------- | ---------------------------------- |
  | `eaglei_outages_2018.csv`                      | `726543e4a392e220108b035ba4c52e43` |
  | `eaglei_outages_2019.csv`                      | `0ff77af0106486eb7bdc6c5051bd916a` |
  | `eaglei_outages_2020.csv`                      | `3b1e76e7ff0445da2b9a2fe4819c0e88` |
  | `eaglei_outages_2021.csv`                      | `b5a5912be793ca22dddcc73ca2c3379d` |
  | `eaglei_outages_2022.csv`                      | `0cd04f23ac90ec4ec20ce3a63dcfa25a` |
  | `eaglei_outages_2023.csv`                      | `4ef3f9290884b4151a43333d28f67369` |
  | `eaglei_outages_2024.csv`                      | `13183facf56c196c061a238303c87973` |
  | `eaglei_outages_2025.csv`                      | `cd2feb1282a42fb048cb6885398bc1cc` |
  | `MCC.csv` (customers per county, "as of 2022") | `7e30d47d44cae46b3342cdabf7c84b7f` |
  | `coverage_history.csv`                         | `33ef0c8549a95bcc1ef52b61c2463271` |

- **OpenFEMA** `DisasterDeclarationsSummaries` v2, declaration metadata only.
  It was fetched once, at 2026-09-23T05:12Z, and is never fetched again. Each
  SHA-256 below is of the merged, id-sorted JSON the fetch script writes.
  - Query 1 gave 6,252 rows, SHA-256 `1e958000…6c4c88`:
    `(incidentType eq 'Hurricane' or incidentType eq 'Tropical Storm' or incidentType eq 'Typhoon' or incidentType eq 'Coastal Storm' or incidentType eq 'Tropical Depression') and incidentBeginDate ge '2017-06-01T00:00:00.000Z'`
  - Query 2 gave 230 rows, SHA-256 `45c2a213…2c7482`:
    `incidentBeginDate ge '2017-06-01T00:00:00.000Z' and incidentType ne 'Hurricane' and incidentType ne 'Tropical Storm' and incidentType ne 'Typhoon' and incidentType ne 'Coastal Storm' and incidentType ne 'Tropical Depression' and (contains(declarationTitle,'TROPICAL') or contains(declarationTitle,'HURRICANE') or contains(declarationTitle,'REMNANTS') or contains(declarationTitle,'TYPHOON'))`
- **Where things live.**
  - The data sits in `engine/.cache/eaglei/`, which git ignores.
  - The two fetch scripts are committed as `engine/python/eaglei/fetch.sh` and
    `fetch_fema.sh`.
  - Nothing else is used.

## 3. Keeping the held-out years sealed

- **Read before this file was committed:**
  - **The training years, 2018–2021, in full.** Spike S1 read 2020–21, and this
    loader ran on all four years to test its code. Training data is open by
    design.
  - **A 3 MB head of the 2024 file, read in research on 2026-09-22.**
    - The 2024 file turned out to be sorted by county, not by time. That head
      held all of 2024 for counties 01001, 01003, 01005 and 01007, and 01009
      through 2024-08-09. This was checked from codes and timestamps only.
    - All four are declared for Helene. So Helene × {01001, 01003, 01005, 01007}
      is dropped as `seen` (§8).
    - 01009's head ends before any held-out window.
  - **Nothing else from 2022–2025.** Downloading a file and checking its MD5 does
    not count as reading it: no value was parsed.
- **Allowed right after this commit:** a schema read of the 2022–2025 files. It
  covers the header and the sorted list of distinct `fips_code` values. It
  includes no row counts, no timestamps and no values.
- **Phase 2 on the held-out years runs once, from committed code.**
  - It writes only per-storm county-event counts, per-step drop counts, and
    per-file loader stats (rows, duplicates, zero rows, zero-heavy counties,
    first and last slot).
  - It records the git HEAD it ran from, and refuses to run while the loader
    code or this file has uncommitted edits.
  - It never writes flag counts, curves, features or plots.
  - Any rerun is a dated deviation.
- **Unsealing, at Phase 4:**
  - **The addendum.** `docs/RESTORATION-ADDENDUM.md` (§10) records the SHA-256
    of the fitted-spread file. That file is built from training data only, with
    fixed seeds.
  - **The gate.** Held-out feature code takes `--addendum <commit>`. It refuses
    to run unless three things hold:
    - that commit is an ancestor of HEAD;
    - that commit contains the addendum;
    - the spread file on disk matches the recorded hash.
  - **The log.** The first held-out write appends (UTC time, commit) to
    `engine/.cache/eaglei/unseal.log`, and the results doc quotes it.

## 4. Storms

- **Which declaration rows count.** A row is kept when its `incidentType` is
  Hurricane, Tropical Storm, Typhoon or Tropical Depression, or when its
  upper-cased `declarationTitle` matches `HURRICANE|TROPICAL|TYPHOON|CYCLONE`.
  Filtering on "Hurricane" alone would keep 87.6% of training pairs but only
  59.6% of test pairs (S1).
- **A storm is one FEMA `incidentId`.** There is no merging by name. For
  2018–2025 this gives the same storms as S1's name merge, which never fired in
  those years. Laura and Marco share one id, so they are one storm.
- **Split.** A storm's year is the year of its earliest `incidentBeginDate`
  (UTC). 2018–2021 is training and 2022–2025 is held out.
- **One hazard.** Only tropical systems are checked. No other hazard is added if
  storms run short (§9) _(Michael, 2026-09-23)_.
- **The list.** Each entry gives the incidentId, the name, the states, and the
  number of declared counties under §5, counted before the MCC match.
  - **Training (21):** 2018081701 Lane HI 4; 2018090602 Florence NC,SC,VA 279;
    2018090604 Olivia HI 4; 2018100601 Michael AL,FL,GA,NC,VA 217;
    2019070902 Barry LA 41; 2019082401 Dorian FL,GA,NC,SC,VI 228;
    2019091902 Imelda TX 7; 2020060302 Cristobal LA 64; 2020072001 Douglas HI 4;
    2020072502 Hanna TX 32; 2020072601 Isaias CT,DE,FL,MD,NC,NJ,NY,VI 153;
    2020081804 Laura (and Marco) AR,LA,MS,TX 225; 2020091301 Sally AL,FL,LA,MS 169;
    2020100501 Delta LA,MS 93; 2020102601 Zeta AL,GA,LA,MS 119;
    2020110501 Eta FL,NC 32; 2021070101 Elsa FL 37; 2021080901 Fred FL,NC,NY 43;
    2021081902 Henri CT,NY,RI,VT 53; 2021082601 Ida CT,DE,LA,MS,NJ,NY,PA 200;
    2021091001 Nicholas LA 64.
  - **Held out (14):** 2022092201 Ian FL,NC,SC 213; 2022110701 Nicole FL 61;
    2023081703 Hilary CA 5; 2023082403 Idalia FL,GA,SC 127; 2023090401 Lee MA,ME 30;
    2024070302 Beryl TX 67; 2024072801 Debby FL,GA,NC,NY,PA,SC,VT 274;
    2024080901 Ernesto VI 3; 2024090902 Francine LA 64;
    2024100401 Potential Tropical Cyclone Eight NC 6;
    2024092301 Helene AL,FL,GA,KY,NC,SC,TN,VA,WV 505; 2024100501 Milton FL 51;
    2025070501 Chantal NC 7; 2025101101 Remnants of Typhoon Halong AK 6.
  - **Dropped ids.** Nine more ids have rows only in Puerto Rico or the Pacific
    territories, so they have no counties here. Three of them are held out:
    Fiona (2022091201, PR) and two Guam/Marianas typhoons (2023051801 and
    2023100501).

## 5. Counties

- **Which counties belong to a storm.** Its county-level rows
  (`fipsCountyCode` ≠ `000`). Both major-disaster (DR) and emergency-only (EM)
  declarations count _(Michael)_.
- **County code `000`.** These rows are tribal-area designations, not statewide
  ones. They are dropped, never expanded to a whole state.
- **Territories.** The Virgin Islands are in. Puerto Rico is out: it had 0%
  coverage in 2018–2020 and reported only 7 region codes in 2021.
- **The recode.** 02270 → 02158 and 51515 → 51019. It applies to both FEMA
  and outage-file codes, before (storm, county) pairs are formed. Where two codes
  merge, the pair keeps the earliest begin and the latest end.
- **Matching.** Counties are matched on `fips_code` only, since state names
  differ between years.
- **Counties that drop:**
  - **`no_mcc`:** the county has no MCC count.
    - This drops six western North Carolina counties (37075, 37087, 37099,
      37113, 37173, 37175) for Florence, Dorian, Isaias, Ian and Helene.
    - It drops four of them (37075, 37087, 37099, 37175) for Fred.
    - It drops 51720 (Norton, VA) for Florence and Helene.
  - **`not_in_file`:** the county's code never appears in that year's outage
    file. In training this covers three of Hawaii's four counties for Lane
    and Olivia, one for Douglas, and six others. Without this rule they would look like "no
    outage".
- **Connecticut.** Its 2022 planning-region codes cannot come up. Every
  Connecticut tropical declaration is from 2020–21 and uses county codes that
  MCC has.

## 6. Reading the outage files

- **Columns.** Only `fips_code`, `customers_out` and `run_start_time` are used.
  The denominator is MCC for every year. An in-file customer count, which the
  2024 file has, is ignored.
- **Time.**
  - `run_start_time` is read as UTC wall-clock time and floored to its 15-minute
    slot.
  - Every row must parse under `%Y-%m-%d %H:%M:%S` or `%m/%d/%y %H:%M`, or the
    run stops.
  - Duplicate (county, slot) rows keep their maximum. A blank loses to a value.
- **Missing vs zero.**
  - A **blank** `customers_out` is missing.
  - An **absent** row is zero, except in three cases, where it is missing:
    - **A nationwide dip:** the slot's row count, blank rows included, is below
      half the centred 97-slot rolling median of rows per slot over that year's
      file. Partial windows are used at the file ends.
    - **Outside the file's time span.** Each 2018–21 file stops at Dec 31 00:00.
    - **A county that stores zeros itself:** at least 10% of that county's rows
      in that year have `customers_out` = 0.
  - The loader reports zero rows and zero-heavy counties for every year. 2018–21
    have none.
- **Bridging.** Interior missing runs of up to 8 slots (2 h), with a value on
  both sides, are filled by linear interpolation. Everything below uses the
  bridged series unless it says otherwise.
- **One year per window.** Each window reads only its own year's file, and none
  crosses a year end (checked on declaration dates). The loader stops if one
  would.

## 7. County-events

For each (storm, county) pair, with `x` the bridged series:

1. **Windows.**
   - The county's begin is its earliest `incidentBeginDate` for that storm. Its
     end is the latest `incidentEndDate`, or begin + 7 d where that is null.
   - **Onset window:** [begin − 1 d, min(end, begin + 7 d) + 1 d].
   - **Data window:** [onset start − 2 d, E]. E is the earlier of onset end +
     21 d and the slot before this county's onset window for its next storm in
     §4. This uses declaration dates only, in either split.
   - Every search in §7–8 stays inside the data window. No two onset windows
     overlap, and no training window reaches a held-out storm.
2. **Threshold.** T = max(1% of MCC, 1 customer).
3. **Events.**
   - An event starts at the first slot in the onset window with `x ≥ T`.
   - It ends at the first slot of the first run of 48 slots (12 h) with `x < T`.
     A missing slot breaks the run.
   - The next event is searched for from its end + 48 slots.
4. **One-hour level and peak.**
   - The one-hour level h(i) is min(x[i..i+3]). It is undefined if any of those
     slots is missing.
   - The peak p₁ is the largest h over [onset, event end], or over [onset, data
     window end] if the event never ends. The peak slot is the first slot that
     reaches it.
5. **Several events.** If more than one event starts in the onset window, the one
   with the largest p₁ is kept. Ties go to the earliest.
6. **Substantial.** p₁ ≥ 1,000 customers and p₁ ≥ 5% of MCC.
7. **Feature window [peak, c].** c is the earliest of:
   - peak + 168 h;
   - the slot before the first slot after the event end whose h ≥ T;
   - the data window's end.

   Simulated time 0 is the observed peak slot, and every simulated curve for this
   county-event is cut at c − peak.

8. **Milestones t50, t90 and t95** _(Michael: t99 dropped)_.
   - t_q is the hours from the peak slot to the first slot i where slots i..i+7
     are all inside [peak, c], all non-missing, and all ≤ (1 − q)·p₁.
   - If no such slot exists, t_q is 168.25 h, in real and simulated curves alike.
   - **Why t99 is out.** Its level (1% of p₁) sits below T (1% of MCC) whenever
     p₁ < MCC. That is every event except those flagged `over_mcc`. There it
     measures everyday small outages, which the simulator does not model.
   - The 95% level sits below T when p₁ < 20% of MCC. That held for 37% of S1's
     326 events from 2020–21.

## 8. Drops

Each drop is a reason code in the drop manifest, applied in this order:

1. `seen`: Helene × {01001, 01003, 01005, 01007} (§3).
2. `no_mcc`, then `not_in_file` (§5).
3. `no_event`: nothing crosses T in the onset window.
4. `no_peak`: no one-hour level is defined anywhere in any event's peak range.
5. `left_censored`: the event was already under way when the onset window
   opened. Either the kept event starts at the window's first slot, or that slot
   is missing and the last value at or before it is ≥ T. A missing first slot
   with no earlier value in the data window does not count as censored.
6. `not_substantial`.
7. `spike`: the raw maximum over the peak range is more than 2 × p₁.
8. `resurge`: t50 is reached, and some h > 0.5 × p₁ after the t50 slot and
   before the event end (or before the data window's end, if the event never
   ended). If t50 is not reached, this test does not apply.
9. `coverage`: more than 10% of the slots in [peak, c] are missing before
   bridging.

**An event is dropped for data quality or attribution, never for being slow.**
These are kept and only flagged:

- `over_mcc`: p₁ > MCC, and the county is sized max(MCC, p₁);
- `never_ended`;
- `cut_early`: c came before peak + 168 h;
- each milestone not reached.

**Reference counts** from the pre-freeze training run (class (b): local runs on
public data):

- **2018–2021:** 2,068 pairs gave 640 county-events from 18 storms, 16 of them
  with ≥ 5 events.
- **2020–21 alone:** 396 events, 13 storms, 11 with ≥ 5.
- **Against S1:** S1's chain gave 326 / 13 / 11 on the same years. It dropped
  slow events as "not clean" (over MCC, right-censored, t90 not reached).

## 9. Checkpoint 2 and the headline switch

- **Reported per split:**
  - storms and county-events;
  - the drops at each step;
  - for training only, 10 curves drawn uniformly from the substantial events
    before the shape filter, seed `restoration-protocol/checkpoint2-curves`,
    each marked with the filter's verdict;
  - for the held-out split, counts only (§3).
- **Y** = held-out storms with at least 5 county-events after §8.
- **Y ≥ 10.**
  - Headline: X of Y storms flagged.
  - The model is rejected when an exact one-sided binomial test of X against 5%
    gives p < 0.05.
- **Y < 10.** This is the likely case, _(Michael, 2026-09-23)_.
  - **Why it is likely.** Only 9 held-out storms have 30 or more declared
    counties. In training, storms of that size turned 6–59% of their counties
    into events. The five small held-out storms have 3–7 counties each, and of
    the four small training storms, only Imelda (5 of 7) reached 5.
  - **Headline:** the county-event flag rate, Σflags ÷ Σlooks, over every
    held-out look. That includes storms with fewer than 5 county-events, and a
    pooled look counts once.
  - **Its interval** is a 95% storm-resampled interval (§11).
  - **Rejection:** the model is rejected when that interval lies entirely above
    5%.
  - X of Y is still printed, with its interval.

## 10. The model and its fit (Phase 3). These rules are fixed now.

- **County build.**
  - Each county is sized max(MCC, p₁).
  - Damage is set so the simulated peak equals the observed p₁. The peak is an
    input and is never tested.
  - Simulated time 0 is the observed peak slot.
- **Free parameters: two.** The log work rate W (mean repair hours ÷ crews per
  10k customers) and the start delay. Delay draws below 0 are set to 0.
- **Fixed parameters.**
  - **Crews per 10k: √6 ≈ 2.45, S3's reference point.** The milestone features
    cannot pin crews down. With the delay unknown, S3's classifier told "few fast
    crews" from "many slow crews" apart only 50.4% of the time, which is chance,
    on its four summary features. Noise-free full curves did separate them
    (86–91%), so the limit is the features.
  - **Repair-time Weibull shape: 1.5**, with sensitivity rows at 0.6 and 3.0.
- **The spread describes how storms differ.**
  - Only training storms with at least 1 county-event are fitted. Each is fitted
    with ABC, all its county-events jointly.
  - The spread is a bivariate normal on (log W, delay). Its mean is the mean of
    the per-storm posterior means. Its covariance is the covariance of those
    means plus the mean of the per-storm posterior covariances.
  - Each simulated world draws one (W, delay), shared by all of the storm's
    counties.
  - A one-storm spread gave 76.2% false alarms in S3.
- **Minimum county size.**
  - It is the smallest size on the grid of 1k, 2k, 3k, 5k, 7.5k, 10k, 15k and
    20k customers out at the peak where the median work-rate shrinkage
    (1 − posterior variance ÷ prior variance) reaches 0.8. If none does, it is
    20k.
  - A storm's county-events below that size are pooled into one look:
    - The real pooled curve is the slot-by-slot sum of their bridged series, from
      the earliest member peak to the earliest member c. A pooled slot is
      missing if any member's slot is. p₁ and the milestones are taken from
      §7, applied to the sum.
    - Each world's pooled curve sums its members' simulated curves, each started
      at that member's observed peak slot. Before its own peak slot, a member's
      simulated curve equals its observed bridged series.
- **Exponential baseline:** a simple exponential-decay curve, fitted the same
  way.
- **Addendum.** The rest goes in the dated addendum `docs/RESTORATION-ADDENDUM.md`,
  written from training data only and committed before Phase 4 unseals anything
  (§3). It covers:
  - the feeder build;
  - the repair rule (a most-customers-first priority list, as in S3);
  - the ABC prior, which sets the shrinkage;
  - the seeds;
  - the exponential baseline's form;
  - the Brier conditioning.

## 11. The check (Phase 4)

- **Score.**
  - Each look is scored with `pooledMahalanobis` on (t50, t90, t95), over the
    observed curve and N simulated worlds.
  - `rankPValue` then gives its p-value. Ties count against the alarm
    (`rank-check.ts:16-29`).
  - Ranks may be computed by sorting; that gives the same p-values as the
    pairwise code at O(N log N).
- **Storm p-value.** `minPCombined` across the storm's looks
  (`rank-check.ts:31-50`). World j is the same parameter draw in every county.
- **Ensemble size.**
  - Each storm gets one ensemble. N + 1 is the smallest power of two at least
    max(1024, 50·m), where m is the storm's largest number of combined score
    vectors (the three-look check).
  - α = 0.05. Each storm's alarm bound is ⌊α(N+1)⌋/(N+1), just under 5%.
  - Rates are tested against 5%, which is at least every storm's bound.
  - _Why N grows with m:_
    - On each look, one member (a world or the observed curve) is the most
      extreme, barring ties. So up to m members share the floor p = 1/(N+1).
    - A storm that is the most extreme on one look therefore gets p = k/(N+1),
      where k ≤ m counts the members at the floor, itself included.
    - At N = 256 it cannot flag once k ≥ 13. With N + 1 ≥ 50m, k/(N+1) ≤ 2%, so
      such a storm always flags.
- **Primary result.** The hindsight check, with a storm flagged when its p ≤ α.
  Decision rules are in §9. X of Y always carries its two-sided 95%
  Clopper–Pearson interval, `scipy.stats.binomtest(…).proportion_ci(method="exact")`.
- **Secondary results:**
  - **County-event flag rate:** a look is flagged when its own p ≤ α. The
    storm-resampled interval uses `stratifiedBootstrap` with:
    - one item per storm, in a single stratum;
    - the statistic Σflags ÷ Σlooks;
    - 2,000 resamples;
    - seed `restoration-protocol/county-event-rate`.
  - **During-storm check at peak + 12 h.**
    - Its features are the share of p₁ still out at +3, +6, +9 and +12 h, each
      read as h.
    - It is pseudo-prospective: the peak and the filters use hindsight.
    - It is the L = 12 look below, with the same exclusion rule.
  - **Min-p across looks at +12, +24 and +48 h.**
    - The look at L uses the shares at L/4, L/2, 3L/4 and L.
    - All county × look vectors go into one `minPCombined`.
    - An event is left out of the look at L, in real and simulated curves alike,
      if c < peak + L h 45 min or if any read value is missing.
  - **The exponential baseline**, through the same check.
  - **A Brier score** for "t95 ≤ 72 h", issued at +12 h, against the exponential
    baseline and the training base rate. Events with c < peak + 73 h 45 min are
    left out, because showing t95 ≤ 72 h needs a 2-hour hold that starts by
    72 h.
- **Descriptive only:** the storm-level rank histogram.

## 12. Synthetic arms (on training-storm inputs only)

- **Null arms:**
  - the plain null, which is a code test because it passes by construction;
  - fixed-setting arms at the spread's centre and at its 2.5% and 97.5% quantile
    corners of (log W, delay);
  - the leave-one-training-storm-out null. It fails when an exact one-sided
    binomial test of its flags against 5% gives p < 0.05.
- **Planted errors.** Each dose runs 1,000 paired replicates at storm level.
  - **Prolonged small failures:** each out node, with probability p, gets
    +Exponential(mean 72 h) added to its own restore time. p = 2%, 5% and 10%.
  - **Heavier tail:** repair times are multiplied by a mean-one lognormal, with
    σ = 0.5, 1.0 and 1.5.
  - **Delay shift:** +12, +24 and +48 h. Flags are split by whether the shifted
    delay lies inside the spread's 2.5–97.5% delay range.
  - **δ\*** is the smallest dose whose Wilson 95% lower bound on power is above
    50%. If no dose reaches it, the report says "> largest dose".
- **Blind spot.**
  - The truth repairs critical facilities first, using Phase 1's definition. It
    uses the same draws as most customers first and is paired with it.
  - Reported: the paired difference in flag rate, and an exact McNemar test,
    `binomtest(b, b + c, 0.5)` (a test on the cases where the two runs disagree).
  - S3's toy saw 7.3% against 4.6% in a big county (p = 3.5e-6), and no
    difference in a small one.

## 13. What can and cannot be concluded

- **What a flag means:** "atypical under the training spread", not "the model's
  structure is wrong".
- **The false-alarm bound** is an average over the spread. It holds only if
  held-out storms are exchangeable with training storms, and the
  leave-one-storm-out null is the only check on that.
- **Cannot conclude:**
  - which repair order a utility used;
  - crew counts or the repair-time shape;
  - that "0 of about 10 flagged" means nothing is wrong. At Y = 10 the upper
    bound is 30.8%.
- **Evidence class:** (b), local runs on public data and synthetic networks.
- **Always reported:**
  - this file's commit, the addendum's commit, and `unseal.log`;
  - the storm list;
  - the drop manifest for each step and split;
  - every rate with its interval;
  - the design effect (how much counties in one storm move together);
  - the exponential baseline;
  - all synthetic arms;
  - Python package versions;
  - every deviation, dated.

## 14. What the pre-freeze audits changed

Two independent reads of the S1 and S3 code, on 2026-09-23, found that the
draft did not match the code, or could not be implemented as written.

1. **Storm key.** It is now "incidentId, no name merge". The draft cited code
   that also merges by name, although for 2018–2025 the two give the same
   storms.
2. **County-000 rows** are tribal areas. S1 expanded each to a whole state,
   which marked every Alabama county as a major disaster for Sally. They are now
   dropped.
3. **Virgin Islands.** The draft included them, but S1's code dropped them. They
   are now included, in code as well.
4. **Counties missing from MCC.** The draft sized them to their peak, which made
   each 100% out with T = 1 customer. There is now a recode, applied to FEMA and
   outage codes, then a `no_mcc` drop. A new `not_in_file` drop stops missing
   counties from passing as "no outage".
5. **The drop chain is written out**, with the rule "never drop for being slow".
   S1's 326 excluded slow events that the draft meant to keep.
6. **The event is chosen by its one-hour peak.** S1 used the raw peak. Missing
   first slots no longer hide left-censoring.
7. **The windows.**
   - The draft cut features at "the next rise above T". That cut 58% of training
     events before 168 h, and simulated curves were never cut.
   - Data windows also ran into the county's next storm, for 386 pairs.
   - Now there is one data window that ends before the next storm, and one cut
     c shared with the simulator.
8. **Onset** is `x ≥ T`, with T at least 1. The draft said "exceed" and "no
   floor", which does not match the code.
9. **Explicit zeros.** They now need at least 10% of a county's rows. Under the
   first loader draft, a single stray zero would have flipped a whole year.
10. **Ensemble size.** N = 256 is replaced by the §11 rule; its p-value floor
    would make large storms impossible to flag.
11. **The ice-storm and derecho fallback is withdrawn.** No FEMA title ever says
    "derecho". FEMA's "Winter Storm" type first appears in November 2022.
    _(Michael, 2026-09-23.)_
12. **The Y < 10 case now has a rejection rule (§9).** The draft switched the
    headline without saying what would count as a failure.
13. **Sealing (§3) is now mechanical:** counts only in Phase 2; unsealing is
    gated on the addendum's hash; the log is quoted in the results.
14. **The 2024 file is county-sorted.** The research's 3 MB head was not "the
    first hours of January". It held four Helene counties' whole year, and those
    four are now `seen`.
15. **Smaller fixes:**
    - the t99 rationale, which is true by construction;
    - the crews claim, which applies to the features, not to curves;
    - Clopper–Pearson is two-sided;
    - the rank-check citations point at `rank-check.ts`.

## 15. Clarifications after the schema read

Added on 2026-09-23 after the §3 schema read and before any held-out value was
read. The read (`engine/.cache/restoration-check/schema-held-out.json`, run at
loader commit `58dda63`) covered only the headers and the distinct county codes
of 2022–2025. None of these clarifications changes a choice above.

1. **The 2023 file names its customers-out column `sum`.** The other years use
   `customers_out`. The loader reads `sum` as `customers_out` in a file that has
   no `customers_out`. The 2024 file adds `total_customers`, which §6 already
   ignores.
2. **Codes not in MCC.** Every held-out year has the same nine as 2020–21. 2024
   and 2025 add 02063 (Chugach, Alaska), and 2025 adds Connecticut's nine
   planning regions (09110–09190).
   - The only held-out declared counties among them are the `no_mcc` pairs §5
     already lists: six for Ian and seven for Helene.
   - This was checked against the FEMA snapshot. The Virgin Islands' three codes
     appear in every year.
