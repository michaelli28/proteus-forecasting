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

## 16. Amendment after Checkpoint 3 (dated deviation, 2026-09-23)

Written after Checkpoint 3's NO-GO and before any held-out outage value was
read. Michael chose to amend on 2026-09-23. The other options were to stop, or
to test the failed model.

**In plain English.** The model failed its own self-test on the training
storms. This section changes five things the diagnosis pointed at:

- counties in one storm get their own repair pace;
- the fitting distance stops over-weighting censored milestones;
- small counties are pooled without losing half of them;
- two inputs to the minimum-size study are corrected;
- three structural settings (crews, repair-time shape, and the size of
  counties whose outages exceed their customer count) are picked together by
  a fixed rule.

The self-test then runs once more. If it fails, the real-data test stops
there.

**Words used here.**

- **θ:** a county's two fitted numbers, (log W, delay). W is the work rate of
  §10, and delay is the start delay in hours.
- **B:** how much storms differ from each other in θ.
- **C:** how much counties in one storm differ from each other in θ.
- **Energy score:** a score for a forecast of several numbers at once. Lower
  is better. A forecast that is too vague, or too confident, scores worse on
  average than the true one, provided it is scored on data it was not fitted
  to.
- **ABC** (approximate Bayesian computation): fitting by simulating many
  candidate settings and keeping the ones whose milestones land closest to the
  real ones.
- **Common random numbers:** the same random draws in every compared setting,
  so differences come from the settings, not from luck.

### What this replaces

- **§10:**
  - the county size max(MCC, p₁), for over-MCC counties, when 16.5 picks
    "share" sizing (also §8's note on `over_mcc`);
  - "crews per 10k: √6" and "shape: 1.5", which 16.5 now chooses. §10's
    sensitivity rows at shape 0.6 and 3.0 are part of 16.5's grid, and
    Phase 4 runs the chosen cell only;
  - "each storm is fitted with ABC, all its county-events jointly", and the
    spread built from per-storm posteriors. 16.1 replaces both;
  - "each simulated world draws one (W, delay), shared by all of the storm's
    counties";
  - the pooled window, which 16.3 replaces.
- **§11:** "World j is the same parameter draw in every county" now reads
  "World j shares the storm effect η in every county" (16.1).
- **§12:** "the spread", as 16.7 defines it.
- Everything else stands (16.10).

### Why

- **The §10 model failed its own leave-one-storm-out null.**
  - It flagged 15 of 18 training storms.
  - After one ×4 widening of the spread, 6 of 18 were flagged. The plan
    allowed "widen and re-check"; the factor 4 was chosen after the base run
    failed and before its result was seen.
  - The details are in `RESTORATION-CHECK-RESULTS.md`, Checkpoint 3 (commit
    `a61b061`).
- **What informed this section: training data only.**
  - All of Checkpoint 3's diagnosis:
    - the cliff-shaped restoration: per-county t90/t50 of 1.75 in sample,
      against 2.5 real;
    - the scatter of county fits within a storm;
    - the over-MCC looks;
    - the pooled-window and distance-floor defects;
    - the shape-0.6 run, with 14 of 18 storms flagged;
    - the alternative distance scalings.
  - Two exploratory reruns of the null with a county-level draw, built on 640
    per-county fits that used the old distance:
    - 4.9% and 5.4% of looks were flagged;
    - 5 of 18 storms each, which would already fail 16.6's first check
      (binomial p = 0.0015);
    - the five storms were Florence, Laura and Ida, each through one over-MCC
      county, and Barry and Nicholas, each through their pooled look. 16.3 and
      16.5 aim at exactly these.
  - A comparison of over-MCC and other county-events. Among the 98 over-MCC
    events, the peak is a median 1.43× MCC; up to 45× among those with
    p₁ ≥ 5k; and 419× overall, where MCC records as few as 6 customers.
  - **Two pre-commit reviews of this section's drafts.** Independent reviewers
    checked them on synthetic data and on the Checkpoint 3 numbers already on
    disk. Three of their findings changed the rules below:
    - The first draft chose 16.5's cell by scoring each county against its own
      fit. On synthetic data where the true cell was known, that rule picked a
      few-crews or shape-3 corner whatever the truth.
    - The second draft's multiplicity-adjusted bootstrap interval let a luckily
      better cell through about 6 to 12 times too often on synthetic data. An
      exact sign-flip test replaced it.
    - Under 16.4's prior, the minimum size is likely to fall to 1–2k.
  - Nothing from the held-out years beyond what §3 and Checkpoint 2 list.
- **This null is weaker evidence than the first.** The changes were chosen
  after seeing the training failures, and they aim at the storms that failed.
  Passing it is a gate, not validation. Only the held-out test is clean.

### 16.1 A county-level draw

- **Each world** draws a storm effect η ~ N(μ, B).
  - Each county look in that storm draws its own θ = η + ε, with ε ~ N(0, C),
    independent across looks and worlds.
  - A delay below 0 is set to 0.
- **The fit.** Each training county-event is fitted alone, by rejection ABC:
  - prior: uniform on log W ∈ [ln 0.01, ln 100] and delay ∈ [0, 72] h. For
    the exponential baseline, log τ ∈ [ln 0.1, ln 1000] instead of log W;
  - 100,000 prior draws; the 500 nearest are kept;
  - 512 unit worlds per county-event, drawn with replacement;
  - 16.2's distance.

  That gives a posterior mean m and a covariance V per county-event.

- **The estimator.** Method of moments (matching sample spreads to what the
  model implies), with storm as a random effect, over all 640 county-events.
  Storm s has n_s county-events and storm mean m̄_s.
  - μ = the mean of the storm means. Each storm counts once.
  - C₀ = the pooled within-storm covariance of county means:
    Σ_s Σ_c (m_c − m̄_s)(m_c − m̄_s)ᵀ ÷ Σ_s (n_s − 1).
  - C = C₀ + the mean of V. As in §10, estimation noise is added, not
    subtracted, so C errs wide.
  - B starts from S − C₀ × mean(1/n_s), where S is the covariance of the storm
    means. That difference is scaled to S's correlations and its eigenvalues
    are floored at 0.1, so the floor does not depend on units. B is not made
    to err wide.
  - μ, B and C are plugged in as if known. With 17 or 18 storms, B in
    particular is uncertain.
- **The exponential baseline** is fitted and drawn the same way, on
  (log τ, delay).

### 16.2 A censoring-aware ABC distance

This replaces the scaling disclosed at Checkpoint 3, whose 0.25 h floor bound
for 179 of 640 events.

- Each feature's scale is 1.4826 × the MAD (median absolute deviation) of the
  prior-predictive draws that are not censored at 168.25 h, floored at
  0.25 h.
- If fewer than 100 draws are uncensored for a feature, the scale is 0.25 h.
- The distance is the sum of squared scaled differences.

### 16.3 Pooled looks

This replaces §10's pooled window, which left 154 of 287 members untested.

- A storm's county-events below the minimum size still form one look.
- **Hindsight features** are the p₁-weighted means of the members' own t50,
  t90 and t95.
  - Each is measured in the member's own [peak, c] (§7).
  - A censored milestone enters as 168.25 h.
- **Each world** simulates every member at its own size and p₁, with its own
  county draw (16.1), cut at its own c, and takes the same weighted means.
- **Phase 4's other looks.** The during-storm look, and the looks at +12, +24
  and +48 h, use the p₁-weighted mean of each member's shares.
  - A member is left out of a look under §11's rule, applied to its own c and
    its own read values.
  - If no member remains, the pooled look is left out.
  - The Brier score stays per county-event: pooled members are scored one by
    one.
  - §11's m counts one pooled look like any other look.
- So every member is tested, and nothing is read outside a member's window.

### 16.4 Two settings corrected

- **The shrinkage study's peak share** is computed, not typed. It is the median
  of p₁ ÷ size over kept training county-events, under the chosen cell's
  sizing: 0.362 under §10's sizing (0.32 had been used), and 0.2755 under
  "share" sizing.
- **The shrinkage study's prior** for one county is the county-level marginal
  N(μ, B + C): the spread a new county's θ is drawn from.
  - **Direction:** this prior is wider than Checkpoint 3's storm spread.
    Shrinkage therefore rises, and the minimum size and the pooling will likely
    fall.
  - **Preview:** a synthetic preview, built from Checkpoint 3's exploratory
    numbers, gave a minimum of 1–2k.
  - **How strong the check is:** 16.6's shrinkage check is close to automatic
    by construction. The minimum size is the first grid size that reaches 0.8,
    so the check can only fail if a larger size dips below 0.8, or if 0.8 is
    never reached.
  - **Pooled looks are exempt.** Their members all sit below the minimum by
    construction.

### 16.5 The one structural choice: crews, shape, and over-MCC sizing

Three settings are compared on a fixed grid. One cell is chosen by a fixed
rule, before the null runs.

- **The grid has 24 cells:**
  - crews per 10k: √6 × ¼, ½, 1 or 2;
  - the repair-time Weibull shape: 0.6, 1.5 or 3.0 (§10's base and its
    sensitivity values);
  - over-MCC sizing: max(MCC, p₁), as in §10; or p₁ ÷ s for over-MCC counties.
    Here s is the median p₁ ÷ MCC over kept training county-events that are
    not over-MCC (0.2755).
- **Crews.** Every simulated county keeps at least one crew. Below about 6k
  customers, the ¼, ½ and 1 cells therefore give the same crew count: one
  crew for 94 of 640 events, counted from expected customers under §10's
  sizing. The output reports each cell's one-crew events.
- **Over-MCC sizing.**
  - **Why it is on the grid.** A peak many times the recorded customer count
    says MCC is an undercount for these counties. Sizing them to p₁ makes them
    100% out, which in the simulator damages nearly every section. Sizing them
    to p₁ ÷ s treats them as typically damaged counties of unknown size.
  - **The jump.** The rule switches at p₁ = MCC. A county just under MCC stays
    sized at MCC and nearly 100% out: 44 kept events sit between 0.8 and
    1.0 × MCC.
- **What each cell runs:**
  1. Every training county-event gets its own ABC fit (16.1–16.2).
  2. Each county-event is then scored **out of sample**. Its forecast is 511
     worlds from the county-level marginal N(μ, B + C) of a spread fitted
     without its storm, each with a fresh unit world. The score is the energy
     score of its (t50, t90, t95), on log hours floored at 1 h, since real
     milestones are never under 1 h (§7.4).
  3. Also reported, as description:
     - each cell's share of county-events whose rank p (§11's statistic)
       against those worlds is ≤ 0.05, split into over-MCC and other;
     - the ratios t90/t50 and t95/t50 of real and forecast milestones, for
       p₁ ≥ 5k with t95 reached.
  4. Cells share seeds, so they are compared on common random numbers. The
     exception is the 98 over-MCC events under the two sizings, whose county
     sizes differ.
- **The rule:**
  1. Take the cell with the lowest mean energy score over the 640
     county-events.
  2. Keep §10's cell (√6, shape 1.5, max(MCC, p₁)) unless that best cell beats
     it clearly.
     - "Clearly" is an exact one-sided sign-flip test over storms. Each
       storm's summed paired difference (best minus §10's cell) may flip sign
       at random. The p value is the share of all 2¹⁸ sign patterns whose total
       is at most the observed total.
     - The best cell wins if p ≤ 0.025 ÷ 23, an adjustment for picking one of
       23 alternatives (Bonferroni). The test is deterministic, so it needs no
       seed.
     - Each cell's paired difference is also reported with a storm-resampled
       95% interval (2,000 resamples, seed `restoration-amendment/select/<cell>`),
       as description only.
- **Where the chosen cell applies:** the fit, the shrinkage study, the null and
  Phase 4.
- **Checked before any real run,** on synthetic county-events drawn from known
  cells.
  - The setup: 6 data sets of about 200 events in 14 storms, scored with this
    commit's scoring code over 5 of the 24 cells, then judged by this rule. The
    check script lives in the session scratchpad, not the repo.
  - The lowest mean score went to the true cell, or to a cell with the true
    crew density, in 5 of 6.
  - The rule never clearly picked a wrong cell. With that little data it kept
    §10's cell every time, so its power to leave §10's cell at 640 events is
    unknown.
  - The first draft's in-sample rule, run the same way in the review, picked
    a corner whatever the truth.
- **It is a fitting choice, not an estimate.**
  - Crews and shape are still never reported as findings (§13).
  - A choice at the grid's edge is reported as sitting at the edge.
- §10's shape-3.0 row is part of this grid. The identifiability probe (the
  plan's test of whether whole curves can reveal crews and shape) is still not
  run.

### 16.6 The null and Checkpoint 3's gate

- **The null.** For each training storm:
  - fit μ, B and C without it;
  - draw N worlds under 16.1, with N by §11's rule on its number of looks;
  - score each look;
  - the storm's p is `minPCombined` over its looks.
- **Still fitted on all 18 storms, the left-out one included:** the chosen
  cell, s, the peak share and the minimum size. This is one more reason the
  null is a gate, not validation.
- **The amended simulator goes to Phase 4 only if all four hold:**
  1. §12: the exact one-sided binomial test of storm flags against 5% gives
     p ≥ 0.05. That means at most 3 of 18 flagged.
  2. The county-look flag rate's storm-resampled 95% interval does not lie
     entirely above 5%. This is §9's rule for the held-out headline, computed
     here in Python with 2,000 resamples and seed
     `restoration-amendment/loo-county-rate`.
  3. The median work-rate shrinkage is at least 0.8 at every grid size at or
     above the minimum size, and that minimum was reached (see 16.4).
  4. Fewer than half of the county-events are pooled.
- **The code computes the gate** (`fit loo`), so it is not read off by eye.
- **The gate is one-sided.**
  - A spread that is too wide cannot fail it.
  - So a pass reads "not detectably miscalibrated at this power".
  - The storm-flag rate's Clopper–Pearson interval and the mean look p (0.5
    when calibrated) are reported beside it. The power arms of §12 come in
    Phase 4.
- **The exponential baseline** runs through the same null and is reported. It
  is not a gate.

### 16.7 What Phase 4 inherits

- **Held-out worlds** use:
  - 16.1's draw;
  - 16.3's pooled looks;
  - μ, B, C, the minimum size and the chosen cell, all from training. s is
    training's value.
- **§12's arms under 16.1:**
  - The fixed-setting arms fix the storm effect η at the centre, and at the
    2.5% and 97.5% corners, of N(μ, B). Counties still draw their own scatter
    from N(0, C).
  - The delay-shift arm adds the shift to each county's delay, after the clip
    at 0. County-look flags are split by whether that county's shifted delay
    lies inside the 2.5–97.5% delay range of the county-level marginal
    N(μ, B + C). Storm flags are reported unsplit.
- **The zero-format bound** from Checkpoint 2 is computed on training data
  before unsealing and reported. It is a worst case for how much the held-out
  files' explicit zeros could delay real milestones. It is report-only: it changes no rule, and a
  large effect goes into the write-up as a caveat.
- **§3's addendum and gate are unchanged, with two additions:**
  - the addendum records the SHA-256 of the amended spread, shrinkage,
    selection and null files, and of the training-events file they all read;
  - the unseal gate also requires the null's computed `go`.

### 16.8 One run, enforced

- **From the command line, every fit stage:**
  - refuses to run while this file or `engine/python/eaglei` has uncommitted
    edits;
  - records the commits it ran from.
- **Every result write is logged** in `runs.log`, with its hash and commits.
- **Selection and null files are written once.** A second write needs
  `--deviation "<reason>"`. Once the selection exists, a grid cell also reruns
  only with `--deviation`.
- **Inputs are chained by hash.**
  - Every result records the hash of the training-events file.
  - The fit records the selection file's hash, and the shrinkage study the
    fit's.
  - The fit refuses if the data changed since selection. The shrinkage study
    and the null refuse if the selection file or the data on disk differ from
    what the fit used. The null also refuses if the shrinkage study used
    another fit.
- **Selection refuses** unless all 24 cells record one commit (from the
  command line, a commit must be recorded) and one training-events file.
- **A bug fix after the null result** is allowed only if it is shown on unit or
  synthetic inputs. Both runs are then reported.

### 16.9 Known limits this amendment does not fix

- **Real milestones cannot fall in the first hour; simulated ones can.** The
  peak is a level held for 1 h (§7.4), while the simulator restores from
  t = 0. Only 16.5's score floors at 1 h; §11's rank check does not.
- **The cut c depends on the outcome** (§7.7). A cut-early event had to end,
  12 h below T, before c. Simulated worlds are cut at the same c with no such
  condition.
- **B is estimated from 17 or 18 storms** and plugged in as known (16.1).
- **The minimum-size check is close to automatic** (16.4).

### 16.10 Not changed

- The data, storms and counties.
- Reading the files, the events and the drops.
- The features.
- §11's score and ensemble rule.
- §9's headline switch.
- §3's seal.
