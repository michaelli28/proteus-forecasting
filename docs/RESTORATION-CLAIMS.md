# Storm-restoration build: claims ledger

- **Date:** 2026-09-23, updated 2026-09-24. Branch `build/restoration-lab`, pushed to origin, not merged to `master`.
- **What this is:** every claim the build makes, with its status and its evidence. The status words are fixed: Holds; Holds, with limits; Not shown; Failed; Withdrawn; Waiting.
- **Evidence class (b) throughout:** local runs on public data (DOE EAGLE-I county outage records, OpenFEMA disaster declarations) and on synthetic feeders. Nothing is live-verified. A line that rests on unit tests alone says class (a).
- **[a, b]** after a figure is its 95% interval.
- **Sources:** LAB-PREREG, LAB-RESULTS, PROTOCOL, ADDENDUM and CHECK are `docs/RESTORATION-LAB-PREREG.md`, `-LAB-RESULTS.md`, `-PROTOCOL.md`, `-ADDENDUM.md` and `-CHECK-RESULTS.md` in this repo. PLAN is `research/plans/proteus-restoration-plan.md` in the cohort-prep repo, an untracked local file with no history or remote.
- **Words used here:**
  - **County-event:** one county's outage curve in one storm. **Look:** one county-event, or a storm's small ones (under 3,000 customers out) pooled, scored against its simulated worlds.
  - **Milestones t50, t90, t95:** hours from the peak until 50%, 90% and 95% of the customers out at the peak are back, and stay back for 2 h.
  - **Spread:** how much fitted repair pace and start delay vary between storms and between counties. **Corner:** the storm spread's 2.5% (fast) or 97.5% (slow) point on both.
  - **σ:** in the lab, how much repair times vary (0 means every repair takes 1.5 h); in the arms, the width of a same-mean random multiplier on repair times.
  - **Over-MCC:** an outage peak above the county's customer count on file (MCC.csv).
  - **Spikes S1–S4:** the four throwaway prototypes that tested the plan's riskiest assumptions. **First-hour limit:** real milestones cannot fall in the first hour; simulated ones can.

## In plain English

- **The outcome:** the restoration model, fitted only on 2018–21 storms, was tested once on sealed 2022–25 storms (do real recovery curves look like the model's?) and was **not rejected**. 3.9% of county-level looks were flagged [1.7%, 5.2%], and the rule fixed in advance rejects only if that whole range sits above 5%.
- **The storm count is worse:** 3 of the 9 larger storms were flagged [7.5%, 70.1%], more than a 5% false-alarm rate would give. "Not rejected" does not mean the model is right.
- **What was built:** a simulator of crews repairing storm-damaged power lines on made-up neighbourhood networks (feeders), and a county-scale version checked against real outage records.
- **Inside the simulator,** "fix whatever brings the most customers back right now" costs 5–9% more customer-hours than a perfect order worked out in hindsight in small storms, and, with one crew, far more in big ones (25% at 20 damaged segments, 45% at 50). That is never checked against real utilities.
- **Fixed:** five figures from Proteus's earlier water-network model, shown on its dashboard, measured a simulation fault, not an outage. The fault is fixed on this branch and the figures re-run; four rows are back, and one stays withdrawn.

## The claim, filled in

The plan's claim to earn (PLAN, "The claim to earn at the end"), with every placeholder filled in bold. Under each bullet: where the result differs from what the plan assumed.

"I built a storm-restoration simulator on synthetic power feeders and pointed Proteus's model check at real county outage records (DOE's EAGLE-I).

1. Fitted only on 2018–2021 storms, it flagged **3 of 9** held-out 2022–2025 storms **[7.5%, 70.1%]**. Across **434** held-out looks, **3.9%** were flagged **[1.7%, 5.2%]** (interval from resampling whole storms). The simple exponential-decay curve was flagged in **1 of 9 [0.3%, 48.2%]**.
   - The 553 held-out county-events make 434 looks.
   - The plan expected Y, the storms with enough data, to be about 10–12. Y came out at 9, fixed by the counts before any curve was read. Below 10, the pre-registered rule makes the look rate the headline, and it rejects only if the whole interval lies above 5%. It does not: **not rejected**.
   - The storm count fails where the rate passes. 3 of 9 against a 5% false-alarm rate gives p = 0.008 (exact binomial, one-sided). With 10 or more storms the protocol would have used this test, and it would reject.
   - The baseline flags more looks than the simulator, 7.6% [1.1%, 11.8%], but fewer storms.
2. When the model is right, the check false-alarms **4.2% [3.1%, 5.6%]** of the time, averaged over how much storms varied in training. It does not hold for any single storm: at fixed settings it runs from **2.3% [1.5%, 3.4%]** to **14.3% [12.3%, 16.6%]**.
   - As the plan warned. The range is far narrower than spike S3's toy gave (0% to 99.8%).
3. It catches planted **prolonged small failures** **74.5% [71.7%, 77.1%]** of the time once they reach **10% of out nodes** (δ\*, the smallest dose whose 95% lower bound on the catch rate is above 50%). A shifted start delay, reported separately as "outside the training spread", is flagged **61.6% [58.5%, 64.6%]** of the time at **+48 h**.
   - The plan's other kind, a **heavier repair-time tail, is not caught at any tested dose**: at most 17.0% [14.8%, 19.5%].
   - δ\* rests on intervals that ignore shared simulation draws, so it may be optimistic. These are powers of the storm-level flag. No arm measured the power of the look-rate rule that actually decided.
4. Inside the model, with one crew, most customers first (pre-registered as "who comes back now") costs **9.2% [7.1%, 11.5%]** more customer-hours than the optimum. It ties the optimum on **32 of 200** shared storms, at **6–12** damaged segments per feeder and **σ 0.6** repair-time spread. With 2–4 crews, the reference is the schedule the HiGHS solver proved within 0.01% of the best on **200 of 200** storms at each crew count: **8.0%, 6.4% and 5.0%**, with ties on **36, 48 and 70** of 200. The optimum is hindsight: it knows the true repair times.
   - "Provable optimum" is exact for one crew only (Horn's method). For 2–4 crews it means "proven within 0.01%".
   - The plan's fallback, the LP floor (a lower limit no schedule can beat), never fired at 6–12 segments: 0 of 1,800 storms. At 20 and 50 segments it was used by design, so those gaps are only "at most 22–28%" and "at most 45–50%".
   - The plan's placeholder figures (3.7% at 8 segments; 8.3–21.6% by spread, at 20 segments) are spike S2 **medians** on larger feeders. 9.2% is the pre-registered total gap; the lab's own median is 4.5%. Do not set them side by side.
5. What it cannot see: **which repair order a utility used**. A planted critical-facilities-first order was flagged on 3.9% of synthetic storms, against 4.2% with nothing planted (p = 0.68). Nor does it report **how many crews there were**."
   - "Cannot see how spread out repair times were" is too strong. The check barely sees it: 10.7% at σ 1.0 and 17.0% at σ 1.5, against 4.2%.
   - "Cannot see how many crews there were" is not shown. To first order, milestones depend only on μ/c (mean repair time ÷ crews), but the fit's score fell at every step down in crew density (F4). In spike S3's toy, the first 48 h of noise-free 15-minute curves in one big county told crew counts 4× apart 85.6% of the time (2× apart: 66.9%), against 50.4%, chance, from four summary features (PLAN, S3; PROTOCOL §10). The identifiability probe never ran, so crews are never reported.

## Ledger

| ID  | Claim                                                                                    | Status             |
| --- | ---------------------------------------------------------------------------------------- | ------------------ |
| L1  | The lab was pre-registered before any code, with no deviations                           | Holds, with limits |
| L2  | One crew: most customers first costs 9.2% more than the hindsight optimum                | Holds, with limits |
| L3  | 2–4 crews: the gap shrinks to 5.0%, every reference proven by HiGHS                      | Holds, with limits |
| L4  | One crew: the gap grows fast with damage (2–4 crews: upper limits only)                  | Holds, with limits |
| L5  | More repair-time spread widens the gap with one crew                                     | Holds, with limits |
| L6  | Horn-order has the smallest gap of the five rules without hindsight                      | Holds, with limits |
| L7  | Knowing the true repair times adds little at 3–4 crews in small storms                   | Holds, with limits |
| L8  | Nearest first and upstream first are the worst rules                                     | Holds, with limits |
| L9  | The lab agrees with spike S2; S2's smaller by-size gaps come from bigger feeders         | Holds, with limits |
| L10 | Tests pass, and every table number recomputes from the raw file                          | Holds              |
| L11 | The storm-0 worked schedule is right                                                     | Waiting            |
| D1  | The inputs are public files, hash-checked and fetched once                               | Holds              |
| D2  | The rules were frozen before any 2022–25 curve was read, bar one disclosed 3 MB head     | Holds, with limits |
| D3  | The 2023 column fix is a clarification, not a deviation                                  | Holds, with limits |
| D4  | Y = 9, so the look rate became the headline                                              | Holds              |
| D5  | The held-out files store explicit zeros; the training files never do                     | Holds              |
| D6  | That zero format caused the higher held-out coverage drops                               | Not shown          |
| D7  | A fallback to ice storms and derechos if storms ran short                                | Withdrawn          |
| F1  | The pre-registered county model failed its own self-test (NO-GO)                         | Holds              |
| F2  | Simulated curves restore too steeply, before and after the amendment                     | Holds              |
| F3  | One dated amendment (protocol §16), five changes, committed before any amended fit       | Holds              |
| F4  | The chosen crews and shape are a fitting choice at the grid's edge                       | Holds, with limits |
| F5  | The amended model passes its self-test                                                   | Holds, with limits |
| F6  | Over-MCC counties remain a weak spot                                                     | Holds              |
| A1  | False alarms average about 5%, but not for every storm                                   | Holds, with limits |
| A2  | The check catches prolonged small failures at 10%                                        | Holds, with limits |
| A3  | The check catches a heavier repair-time tail                                             | Not shown          |
| A4  | A start delay is flagged once it leaves the training spread                              | Holds, with limits |
| A5  | The check cannot see a critical-facilities-first repair order                            | Holds              |
| A6  | The power of the look-rate rule that decided                                             | Not shown          |
| H1  | Model, code and seeds were frozen and gated, and the check ran once                      | Holds              |
| H2  | Headline: not rejected                                                                   | Holds, with limits |
| H3  | 3 of 9 larger storms flagged [7.5%, 70.1%], p = 0.008: the storm-count test would reject | Holds, with limits |
| H4  | The exponential baseline flags more looks but fewer storms                               | Holds              |
| H5  | The over-MCC prediction, on rates                                                        | Holds              |
| H6  | The over-MCC prediction, on storms (CHECK's reading)                                     | Failed             |
| H7  | At peak + 12 h both models flag the same five storms                                     | Holds, with limits |
| H8  | The "95% restored within 3 days" forecast beats both comparisons                         | Holds, with limits |

### The repair-order lab

- **L1. Pre-registered before any code, with no deviations.** Holds, with limits.
  - Pre-registration `5ea8597`; three code choices recorded at `dbdec80` before the runner existed; code `3dafe2c`; results `f77c364`. After the only post-runner change (output wording, input guards), all 24,000 schedules were byte-identical.
  - Evidence: LAB-RESULTS, "Deviations from the pre-registration".
  - Limit: smoke runs of 10–20 storms came first. "No pre-registered choice changed after them" is the doc's own statement.
- **L2. One crew: most customers first costs 9.2% more.** Holds, with limits.
  - 9.2% [7.1%, 11.5%] more customer-hours (customers × hours without power) than the optimum (hindsight: knows the true repair times): 2,001.8 against 1,833.1 per storm. It is total over total: the extra customer-hours summed over 200 storms ÷ the optimum's sum. Ties on 32 of 200. The median storm's gap is 4.5%.
  - Evidence: LAB-RESULTS, "Headline, in the pre-registered form"; LAB-PREREG §6; `f77c364`.
  - Limit: inside the model only, on one synthetic feeder generator.
- **L3. 2–4 crews: the gap shrinks, and every reference was proven.** Holds, with limits.
  - 8.0% [6.2%, 9.8%], 6.4% [4.9%, 7.8%] and 5.0% [3.8%, 6.3%] for 2, 3 and 4 crews; ties on 36, 48 and 70 of 200. HiGHS proved all 1,800 multi-crew references (hindsight: knows the true repair times) at 6–12 segments; none fell back to the LP floor.
  - Evidence: LAB-RESULTS, headline table; PLAN, Checkpoint 1.
  - Limit: "proven" means within 0.01% of the true best. HiGHS's schedule is handed out again in start order before scoring, which never makes it costlier (LAB-PREREG §9).
- **L4. One crew: the gap grows fast with damage.** Holds, with limits.
  - One crew: 25.3% [22.3%, 28.3%] at 20 segments and 44.6% [41.0%, 48.3%] at 50, with no ties. With 2–4 crews only upper limits exist: at most 28.3%, 25.2% and 22.3% at 20 segments; 49.9%, 47.6% and 45.4% at 50.
  - Evidence: LAB-RESULTS, "What the tables show", item 1, and the k = 20 and k = 50 tables.
  - Limit: at 50 segments the feeder has only 51–59 buses (network nodes), so nearly every line is down. That is the generator, not real storms (LAB-PREREG).
- **L5. More repair-time spread widens the gap with one crew.** Holds, with limits.
  - One crew: 6.9% [4.8%, 9.1%] at σ 0, 9.2% at σ 0.6, 11.8% [9.4%, 14.5%] at σ 1.0. Four crews: 5.1%, 5.0%, 4.7%. With equal repair times, most customers first ties the optimum on 116 of 200 one-crew storms.
  - Evidence: LAB-RESULTS, "What the tables show", item 2.
  - Limit: tested at 6–12 segments only, and no test between cells was pre-registered. At two crews the point estimates rise (6.6%, 8.0%, 8.9%), but the intervals overlap ([4.9%, 8.5%] at σ 0 against [7.1%, 11.0%] at σ 1.0): not shown.
- **L6. Horn-order has the smallest gap of the five rules without hindsight.** Holds, with limits.
  - Horn-order is Horn's one-crew list, computed as if every repair took the typical 1.5 h. Primary cell, 1–4 crews: 3.7% [3.0, 4.5], 3.4% [2.8, 4.0], 2.7% [2.1, 3.4], 1.9% [1.5, 2.3]. Against most customers first it was cheaper on 72, 73, 67 and 59 storms, dearer on 20, 17, 20 and 17. One crew: 4.8% [4.2%, 5.3%] at 20 segments, 4.8% [4.4%, 5.1%] at 50, 6.5% [5.4%, 7.6%] at σ 1.0.
  - Evidence: LAB-RESULTS, "What the tables show", item 3.
  - Limit: no test between rules was pre-registered, and calling it best beyond 2–3 crews is forbidden. LAB-RESULTS's "stays within 5% with one crew at every storm size" holds for point estimates only: the upper ends are 5.3% and 5.1%.
- **L7. Knowing the true repair times adds little at 3–4 crews in small storms.** Holds, with limits.
  - Horn-order with hindsight against Horn-order, primary cell. With one crew, the hindsight list is the optimum itself. 2 crews: 3.4% → 2.1% (cheaper on 103 storms, dearer on 45). 3 crews: 2.7% against 2.4% (68 against 70). 4 crews: 1.9% against 2.0% (46 against 69). At 4 crews it was cheaper on 128 (20 segments) and 191 (50 segments) of 200.
  - Evidence: LAB-RESULTS, "What the tables show", item 4.
  - Limit: the doc first omitted the dearer counts at 20 and 50 segments. They are 69 and 9 (`results-200.json`, now noted there), so 128 against 69 is a weaker win than the prose suggests. Why the value fades is ASSUMED: Horn's list is best for one crew only.
- **L8. Nearest first and upstream first are the worst rules in every table.** Holds, with limits.
  - From 14.2% (σ 1.0, 4 crews, upstream first) to 96.9% [90.5%, 103.3%] (50 segments, 2 crews, nearest first, an upper limit). Evidence: LAB-RESULTS, item 5.
  - Limit: travel is not modelled, so this says nothing about real crews driving between jobs.
- **L9. The lab agrees with spike S2.** Holds, with limits.
  - Median per-storm gaps, primary cell, 1–4 crews: 4.5 / 3.0 / 1.9 / 0.9% against S2's 4.9 / 3.1 / 2.4 / 1.4%, each inside the lab's resampling range. S2's smaller by-size medians (14.5% and 28.5%, against 19.3% and 38.7%) come from its larger feeders, CONFIRMED: S2's own code at the pre-registered size gives 18.4% and 33.8%.
  - Evidence: LAB-RESULTS, "Against spike S2".
  - Limit: medians are descriptive only. The rest of the gap at 50 segments is "consistent with sample noise, not a separate cause" (8 further storm sets give 34.8–39.4%).
- **L10. Tests pass, and every table number recomputes.** Holds.
  - 107 restoration tests in 7 files and 16 Python solver tests pass; the engine suite is 930 passed, 4 skipped (823 / 4 at Phase 0); `tsc` is clean. Class (a). An independent script recomputed every table number from the raw results file: 0 mismatches.
  - Evidence: LAB-RESULTS, "Deviations"; PLAN, Checkpoint 1. As reported at `3dafe2c`; not re-run for this ledger.
- **L11. The storm-0 worked schedule.** Waiting.
  - 6 segments, 2 crews: most customers first costs 13,171 customer-ticks (3,292.8 h; a tick is 15 minutes) against the optimum's 12,555 (3,138.8 h), 616 more.
  - Evidence: LAB-RESULTS, "Checkpoint 1: one schedule to check by hand".
  - Waiting on Michael's hand check. A read-only re-derivation of the inputs and both sums agreed; that is not the hand check.

### Data and sealing

- **D1. The inputs are public, hash-checked and fetched once.** Holds.
  - EAGLE-I (DOE's county outage counts; figshare article 24237376 v4, CC BY 4.0): all 10 files matched their published MD5 on 2026-09-23. One OpenFEMA declarations snapshot, fetched once at 2026-09-23T05:12Z (6,252 and 230 rows, SHA-256 recorded).
  - Evidence: PROTOCOL §2; CHECK, Checkpoint 2.
  - Limit: MCC.csv's customers-per-county count ("as of 2022") is the denominator for every year. 98 training events peak above it; they are flagged over-MCC, not dropped, because events are dropped for data quality or attribution, never for being slow (PROTOCOL §8).
- **D2. The rules were frozen before any 2022–25 curve was read, bar one disclosed 3 MB head.** Holds, with limits.
  - Protocol `2020f07` (01:48:16 −0400), loader `58dda63` (01:48:22 −0400), column fix `51b3dd4` (01:49:29 −0400), each an ancestor of the next (checked with git). After the freeze, the held-out files were read for headers and county codes, then once by Phase 2 for per-storm counts, drop counts and per-file loader stats (rows, zero rows); until the unseal (H1), never for flags, curves or features (PROTOCOL §3).
  - Disclosed exposure: a 3 MB head of the 2024 file, read during research, held four counties' whole 2024, Helene included. Those 4 pairs are dropped as `seen` by a rule fixed in advance.
  - Evidence: PROTOCOL §3 and §14; CHECK, Checkpoint 2.
  - Limit: the training years were read in full, by design. "Nothing else from 2022–25 was read" is a self-report, checked from codes and timestamps only. That the Phase 2 held-out count run ran once rests on the doc; no run log exists.
- **D3. The 2023 column fix is a clarification.** Holds, with limits.
  - The schema read found that the 2023 file names its customers-out column `sum`. The loader now reads `sum` when `customers_out` is absent. It was recorded as PROTOCOL §15 at `51b3dd4` with one new unit test, 67 s after the loader and before any held-out value was read.
  - Limit: it is a loader change after the freeze, classed as a clarification rather than a deviation.
- **D4. Y = 9, so the look rate became the headline.** Holds.
  - Training: 2,068 storm-county pairs → 640 kept county-events; 18 of 21 storms have one, 16 have 5 or more. Held out: 1,419 → 553; 13 of 14 storms have one, 9 have 5 or more (Y).
  - Y < 10 was predicted from FEMA's county lists alone: the nine are exactly the nine storms with 30 or more declared counties. Under PROTOCOL §9 the headline becomes flags ÷ looks, rejected only if its whole-storm interval lies above 5%. X of 9 is still printed with its interval; even 0 of 9 flagged would allow up to 33.6%.
  - Evidence: CHECK, Checkpoint 2, "Counts per split" and "The pre-registered decision"; PROTOCOL §9.
  - Limit: Helene is 229 of the 553 held-out events (41%).
- **D5. The held-out files store explicit zeros; the training files never do.** Holds.
  - Zero rows ("nobody out"): 0 in 2018–21, against 1.28M, 1.31M, 1.09M and 1.14M in 2022–25.
  - Evidence: CHECK, Checkpoint 2, which calls it "the biggest risk to a fair test".
- **D6. The zero format caused the higher held-out coverage drops.** Not shown.
  - Coverage drops (events dropped for missing data): 9.6% held out (69 of 721) against 2.4% in training (18 of 748).
  - The cause is ASSUMED: the seal allowed counts only, so it was not checked by county. A worst-case bound on training storms (`062740e`) found that treating absent rows as missing barely moves the milestones but drops the fast events: 354 dropped, median t95 21.62 h, against 83.75 h for those kept. So the risk is selection, and its net effect on the flag rate is unknown.
  - Evidence: CHECK, Checkpoint 2 and Checkpoint 4, "The zero-format bound".
- **D7. A fallback to ice storms and derechos.** Withdrawn.
  - Chosen on 2026-09-22 (PLAN, "Decisions", item 3). Withdrawn by Michael on 2026-09-23, before the freeze (PROTOCOL §14, item 11): no FEMA title ever says "derecho", and FEMA's "Winter Storm" type first appears in November 2022. Only tropical systems are checked.

### The fit

- **F1. The pre-registered county model failed its own self-test.** Holds.
  - Leave-one-storm-out on training (each storm scored against a spread fitted without it): 15 of 18 storms flagged (58.6–96.4%, computed; the source prints no interval), p = 2e-17. The plan's one remedy, widening the spread once (covariance ×4, so each standard deviation doubled; the factor was picked after the base run failed and before its result was seen), still flagged 6 of 18 (13.3–59.0%, computed). The exponential baseline flagged 10 of 18 (30.8–78.5%, computed). Verdict NO-GO; the held-out split stayed sealed.
  - Evidence: CHECK, Checkpoint 3; code `075f8b7`, write-up `a61b061`.
- **F2. Simulated curves restore too steeply, before and after the amendment.** Holds.
  - t90/t50 (time to 90% restored ÷ time to 50%): real median 2.50 (10th–90th percentile 1.46–5.08); the original simulator 1.09 (4,000 worlds for one typical county); the amended forecasts 1.67 (1.05–3.33). t95 is never reached within the week in 28% of amended forecast worlds, against 11% of real counties with at least 5,000 out.
  - Evidence: CHECK, the Checkpoint 3 diagnosis and "Checkpoint 3, amended". The steepness is measured, CONFIRMED.
  - Limit: the cause is ASSUMED, for example the fixed crews per 10,000 customers. The held-out run did not measure shape.
- **F3. One dated amendment (protocol §16), with five changes, committed before any amended fit.** Holds.
  - After the NO-GO, Michael chose (2026-09-23) to amend once rather than stop or test the failed model. §16 makes five changes: a county-level draw, a censoring-aware fitting distance, pooled looks that test every member, two corrected settings, and a fixed rule that picked crews, repair-time shape and over-MCC sizing together from 24 cells (F4). It was committed at `7a71a8b` (12:19 −0400), before the first amended fit wrote anything (12:46 −0400). All 28 fit writes record `7a71a8b` and no deviation. Only training data informed it. Had the self-test failed again, the real-data test would have stopped.
  - Evidence: PROTOCOL §16; CHECK, "Checkpoint 3, amended"; `phase3-amended/runs.log`.
  - Limit: §16 was designed after seeing which storms failed, so its own pass is not out-of-sample. Its code guards (clean-tree refusal, write-once, hash chain) were not exercised for this ledger.
- **F4. The chosen crews and shape are a fitting choice at the grid's edge.** Holds, with limits.
  - The fixed selection rule chose ¼ × √6 crews per 10,000 customers and repair-time shape 0.6 over the pre-registered cell. Mean energy score (a forecast-error score; lower is better): 1.205 against 1.266; paired difference −0.060 [−0.083, −0.040]; sign-flip p 7.6e-6 against a bar of 0.0011.
  - At ¼, 383 of 640 county-events have one crew. The forecasts' 90th-percentile t90/t50 is 3.33, against 2.60 in the pre-registered cell, which also differs in shape; at shape 0.6 that ratio falls as crews fall (4.04, 3.88, 3.50, 3.33 from 2× to ¼×; `selection.json`).
  - Evidence: CHECK, "The structural choice (§16.5)"; `selection.json`.
  - Limit: ¼ is the grid's lowest crew density and 0.6 its lowest shape. The three shapes at ¼ score within 0.002 of each other. A reader's recount of `selection.json`, not stated in the doc, finds the score falling at every step down in crews in all six shape × sizing pairs, so the best setting may lie below the grid. Why the rule moved crew density is ASSUMED: every county keeps at least one crew, so at ¼ most sit at that floor, where the μ/c scaling breaks. It is not a longer tail: at shape 0.6, fewer crews give shorter ones. It says nothing about how many crews utilities sent.
- **F5. The amended model passes its self-test.** Holds, with limits.
  - 2 of 18 storms flagged [1.4%, 34.7%], p = 0.23; 14 of 473 looks, 3.0% [1.5%, 5.1%]; mean look p 0.46 (0.5 is calibrated). All four gate criteria pass, computed in code (`go: true`).
  - Evidence: CHECK, "Checkpoint 3 go/no-go, amended"; `loo.json`.
  - Limit: a gate, not validation. The chosen cell, the undercount share s, the peak share and the minimum size were fitted on all 18 storms, the left-out one included; the spread itself was refitted without the left-out storm. The gate is one-sided: "a spread wide enough can pass anything". County-to-county spread covering the real curves, rather than the right shape, could explain the pass; no run has tested that.
- **F6. Over-MCC counties remain a weak spot.** Holds.
  - Among 98 training events, over-MCC peaks are a median 1.43× the recorded count. 9 of 89 of their looks flagged, 10.1% (4.7–18.3%, computed), against 5 of 384 other looks, 1.3% (0.4–3.0%, computed). Both flagged training storms flagged through one over-MCC county each.
  - Evidence: PROTOCOL §16, "Why" (the 1.43× median); CHECK, "Checkpoint 3, amended". The ADDENDUM named them, before unsealing, as where held-out flags were expected.
  - Limit: the computed intervals treat looks as independent, which they are not.

### The synthetic arms

Each arm plants one known error in 1,000 simulated storms built on the 18 training storms, and counts how often the check flags them. The simulator alone runs them. All finished before unsealing (`arms.json` at `b1e3b44`).

- **A1. False alarms average about 5%, but not for every storm.** Holds, with limits.
  - Null arm (nothing planted): 42 of 1,000 = 4.2% [3.1%, 5.6%], by construction. Fixed settings: centre 4.8% [3.6%, 6.3%], fast corner 2.3% [1.5%, 3.4%], slow 97.5% corner 14.3% [12.3%, 16.6%].
  - The design effect, from this arm, is 1.38: look flags correlate within a storm (ρ 0.0078) over a size-weighted 49.6 looks per storm, so a storm's looks count as fewer independent looks than they seem.
  - Evidence: CHECK, "The synthetic arms".
  - Limit: a storm as slow as the slow corner is flagged about three times as often as 5%. Why the corners move so little is ASSUMED: the fitted spread is mostly county-to-county (delay variance 206 within a storm, 9.4 between storms).
- **A2. The check catches prolonged small failures once 10% of out nodes carry them.** Holds, with limits.
  - Storms flagged: 6.1% [4.8%, 7.8%] at 2%, 18.9% [16.6%, 21.4%] at 5%, 74.5% [71.7%, 77.1%] at 10%. Looks flagged at 10%: 18.0%.
  - Limit: the Wilson intervals ignore that one storm's replicates share an ensemble, so δ\* may be optimistic.
- **A3. The check catches a heavier repair-time tail.** Not shown.
  - 5.4% [4.2%, 7.0%] at σ 0.5, 10.7% [8.9%, 12.8%] at σ 1.0, 17.0% [14.8%, 19.5%] at σ 1.5. It never passes 50%, so δ\* lies beyond σ 1.5.
- **A4. A start delay is flagged once it leaves the training spread.** Holds, with limits.
  - Storms flagged: 4.0% [3.0%, 5.4%] at +12 h, 12.6% [10.7%, 14.8%] at +24 h, 61.6% [58.5%, 64.6%] at +48 h. At +48 h every shifted county delay lies outside the county-level spread's 2.5–97.5% delay range (−19.4 to 38.1 h, before delays below 0 are set to 0); county looks flag 11.3% [8.3%, 16.6%] and pooled looks 79.3% [61.8%, 94.1%].
  - Evidence: CHECK, "The synthetic arms" (the delay split); ADDENDUM §5 for the delay range.
  - Limit: reported as "outside the training spread", never as a caught structural error. Why pooled looks flag it more often is ASSUMED: averaging small counties removes their noise.
- **A5. The check cannot see a critical-facilities-first repair order.** Holds.
  - 3.9% [2.9%, 5.3%] against the null's 4.2%; McNemar p = 0.68 (a paired test; 13 replicates flagged only under the null, 10 only under this arm).
  - Limit: spike S3's toy did see it in one big county (7.3% against 4.6%).
- **A6. The power of the rule that decided.** Not shown.
  - No arm ran the look-rate rule on a 13-storm sample. Look rates barely move under planted errors (5.6% at +24 h of delay). The +12 h, multi-look and Brier checks have no arm either.
  - Evidence: CHECK, "What this does not show".

### The held-out check

- **H1. Model, code and seeds were frozen and gated, and the check ran once.** Holds.
  - The ADDENDUM (`e62bac1`, audited by three independent readers) pinned five file hashes (the four fitted Phase 3 files and the training-events file), the code commit and every seed. Unsealing required six conditions (CHECK's list): the gate's own checks (`unseal.py`), including that the check's code at HEAD equals `7f842e4`, plus matching input MD5s and a clean training rehearsal from the same HEAD, both checked just before the gate. `unseal.log` holds one line: 2026-09-23T21:44:35Z, at `b1e3b44`, no deviation. The arms and a training rehearsal were written before it, and the held-out result at 23:23:32Z. Kept counts matched Checkpoint 2.
  - One dated deviation, before unsealing: the named code commit moved from `14dd44e` to `7f842e4`, which adds a per-look county record and intervals that skip empty resamples. Scoring did not change, and no number moved.
  - Evidence: CHECK, Checkpoint 4, "Before unsealing" and "Deviations and corrections"; ADDENDUM §1 and §4; `unseal.log`, `runs.log`.
  - Limit: a rerun needs `--deviation` and must be reported beside this one. The gate's tests use synthetic repositories, class (a).
- **H2. Headline: not rejected.** Holds, with limits.
  - 17 of 434 looks flagged, 3.9% [1.7%, 5.2%], from 2,000 whole-storm resamples. The rule rejects only if the whole interval lies above 5%. Helene alone is 188 of the 434 looks and 9 of the 17 flags.
  - Evidence: CHECK, "The pre-registered result" and its storm table; `held-out.json`.
  - Limit: one-sided, and the power of this rule was never measured (A6): planted errors barely move look rates (5.6% at +24 h of delay). It means "not detectably miscalibrated", never "validated".
- **H3. 3 of the 9 larger storms were flagged: Ian, Beryl and Francine.** Holds, with limits.
  - 3 of 9 [7.5%, 70.1%]; 3 of all 13 with a county-event [5.0%, 53.8%]; exact binomial p = 0.008 against 5%. Debby (p = 0.0505) and Helene (0.0511) just missed. CONFIRMED from `held-out.json`: Ian and Beryl each have one county look beyond every simulated world (16,383 and 8,191 worlds); Francine flags through its pooled look (look p 0.005).
  - Limit: reported, not decisive, since Y = 9 was fixed before any curve was read. The cause is ASSUMED, and the run cannot separate the candidates: county spread too narrow, storm spread too narrow (from only 18 storms, and partly set by a preset minimum), model structure, drift between periods, or data quirks.
- **H4. The exponential baseline flags more looks but fewer storms.** Holds.
  - 33 of 434 looks, 7.6% [1.1%, 11.8%]; 1 of 9 storms [0.3%, 48.2%] (Debby), p = 0.37. It would pass both rules.
  - Limit: 27 of its 33 look flags come from Helene (`held-out.json`; not printed in CHECK).
- **H5. The over-MCC prediction held on rates.** Holds.
  - Written before unsealing (ADDENDUM §7). Simulator: over-MCC looks 7 of 81, 8.6% [4.8%, 17.9%], against 10 of 353, 2.8% [1.1%, 3.9%]. Baseline: 19.8% against 4.8%.
  - Limit: pooled looks count as "other".
- **H6. The over-MCC prediction for storms.** Failed.
  - Over-MCC looks give 7 of the 17 flags, but none of the three storm flags depends on one. ADDENDUM §7 wrote only that held-out flags from over-MCC counties were expected. CHECK reads it as also expecting storms to flag through them, as both flagged training storms did: "That part did not hold."
- **H7. At peak + 12 h, both models flag the same five storms.** Holds, with limits.
  - Simulator: 38 of 434 looks, 8.8% [3.9%, 17.8%]; 5 of 13 storms [13.9%, 68.4%]. Baseline: 5.5% [3.0%, 9.5%] of looks and the same 5 of 13: Ian, Debby, Helene, Milton and Chantal. The lowest p across +12, +24 and +48 h flags the same five for both.
  - Limit: it uses the peak and the event filters in hindsight, so this is not a real-time forecast, and no arm tests it. Why the models agree is ASSUMED (see "Still open").
- **H8. The "95% restored within 3 days" forecast beats both comparisons.** Holds, with limits.
  - Issued at +12 h for 481 of 553 events (12 storms). Brier score (squared forecast error; lower is better): simulator 0.127, the baseline conditioned the same way 0.172, the training base rate 0.229. Differences: −0.045 [−0.068, −0.005] and −0.102 [−0.123, −0.049].
  - Limit: it uses the peak and the event filters in hindsight, and no arm tests it. Why it scores better is ASSUMED: its curve shapes after 12 h fit better.

## Not claimed

- **That the model is right, or "validated".** The pass is one-sided, and the storm count says whole storms are atypical more often than 5%.
- **That a flag means the model's structure is wrong.** A flag means "atypical under the training spread", and the 5% bound assumes held-out storms behave like training storms.
- **A flat storm-level histogram as evidence of fit.** It is descriptive only, over 13 storms.
- **Crew counts or repair-time shape.** The identifiability probe never ran, and the chosen cell is a fitting choice at the grid's edge.
- **That the check "catches" a delay shift as a structural error.** It is reported apart, as "outside the training spread".
- **"Optimal" for 2–4 crews beyond the storms HiGHS proved.** At 20 and 50 segments only "at most" is allowed.
- **That Horn-order is the best rule beyond 2–3 crews.** No test between rules was pre-registered.
- **What any real utility does or should do, or which repair order it used.** The lab is synthetic, and the check cannot see order (A5).
- **Anything about travel, switching, crew arrival or power flow.** None is modelled.
- **That the optimum is achievable.** It is hindsight: it knows the true repair times.
- **A real-time forecast.** The +12 h check and the Brier score use the peak and the event filters in hindsight.
- **That the zero format did or did not move the result.** Its net effect is unknown (D6).
- **A false-alarm rate of 5% or less for every storm.** It holds on average over the spread only (A1).
- **Any per-county result or ranking.** Results are published as storm-level counts and rates only, a defensive rule.
- **Anything beyond evidence class (b).** Nothing is live-verified.

## The water model's rows: fixed and re-run

Spike S4 found that the water simulation staged outages wrongly. A "stopped" pump kept running, because its tank-refill switch was checked at every calculation step while the outage rule was checked every 6 minutes; a stopped main pump still delivered 91% of its normal water. Each outage also ended by forcing the link open, which gave idle pumps a fake restart surge. S4's reruns CONFIRMED both faults for pumps; the explanation inside EPANET's code (the water-physics solver) is ASSUMED. The same forced opening also left throttle valves unthrottled, which `test_a_valve_outage_ends_with_the_valve_back_at_its_setting` pins. Five dashboard rows were withdrawn on 2026-09-22 (`0f75c4c`, a cherry-pick of `ce25870`) because they "measured the leak, not the outage". Harm is in person-hours of lost water service.

- **The fix** (`0e0e81b`, then `beea1ce` after review, 2026-09-23):
  - the refill switches are low-priority rules, checked every 60 s;
  - pumps get no forced restart, valves get their setting back, and pipes still reopen;
  - 35 outage tests: 34 pass and 1 is a strict expected failure (the booster, below). The 12 pump-flow checks step through every hydraulic solve, and a held pump runs 0 h in all 12. The 6 direct pump stops among them fail on the pre-fix code; the idle-pump and level-spoof rows guard the new code.
- **The table build** (`de16f53`, `beea1ce`): the committed build wrote a file the loader rejected. It now writes the solver's full reply, validated, and reads it back.
- **The rule step matters.** With the switches as rules, how often rules are checked sets how fast a pump reacts. At WNTR's default of 6 minutes, tanks overshot their bands and short-outage figures moved by up to about 70% (the main pump at 6 h, a reviewer's run reproduced by a second reader). The 60 s step keeps every tank within 0.05 m of its band. Tank A sits above its band only because its pump never needs to run.
- **The re-run** (`02739fe`): the old table reproduces the old dashboard data byte for byte, so every change comes from the fix. Figures are robust–pessimistic person-hours, from the sweep's low and high ends, at the 60 s step.

| Row (system)                            | Before the fix   | After                      | Attacker targets it | Status             |
| --------------------------------------- | ---------------- | -------------------------- | ------------------- | ------------------ |
| Main pump controller (mid-size city)    | 290–94,135       | 158,410–365,552.5          | 201 of 216 runs     | Holds, with limits |
| South pump controller (large district)  | up to 68,927.5   | 251,276.75–359,243         | 157 of 216          | Holds, with limits |
| North pump controller (large district)  | up to 887.5      | 0                          | 0 of 216            | Holds, with limits |
| Storage tank sensor A (large district)  | up to 887.5      | 0                          | 0 of 216            | Holds, with limits |
| Booster pump controller (mid-size city) | up to 30,245     | not shown (39,145–110,445) | 24 of 216           | Withdrawn          |

- **The north pump and tank-A zeros** hold only for this layout. The north pump never runs in the baseline, and the tank-A spoof only silences that pump. Whether the layout should make it serve the north is open (see "Still open").
- **The booster stays withdrawn**, in both tables that could show it. Before the fix, 9 of its 12 values (4 durations × 3 settings) were negative, down to −10,837.5 at 48 h. After it, one is: 6 h at the 28 m setting, −1,195. At that setting it had been −347.5, so the fix made that one value more negative while clearing the rest. The cause is not found.
- **The three home-page figures, re-run.** Holds, with limits.
  - Running the plant by hand cuts lost service by 71% on the mid-size system (226,301 of 319,345 person-hours; it was 65%) and by 68% on the large district. It is still the cheapest defense. The caption no longer names a fraction; it points at the figure.
  - The tank-C level sensor is hit in 76% of runs (164 of 216). The south pump controller is now hit in 73% (157 of 216). One attack can hit both, and the card now names both.
  - The transfer-valve blind spot still strands up to 5,213 people and is never targeted (0 of 216).
  - No intervals are printed, and the seed-to-seed spread of these shares is not measured.
- **Limits.** All of it is synthetic networks, evidence class (b). Six table cells are still negative and are floored at 0 before use: the booster case above, four transfer-valve cells (−587.5 to −2,797) and one tank-B cell (−931.75). Closing the north–central valve relieves pressure in the south zone. A mapping agent's control run at the old 6-minute step made those deltas 0 once the north's demand was zeroed. So a real pressure-relief effect in this layout is supported but not isolated (ASSUMED). Tank B's cause is ASSUMED to be the same.
- **Where it lives:** on `build/restoration-lab` only, not merged. `master` and the other `origin/*` branches still show "nearly half" and the five old rows. The dashboard's browser suite passes (46 tests) against a local production build. Whether the dashboard is publicly deployed is unverified. The older branch `fix/water-artefact-rows` is superseded.

## Still open

- **Michael's hand check of the storm-0 schedule** (L11). Checkpoint 1 waits on it.
- **The identifiability probe:** can whole 15-minute curves, clean and with EAGLE-I-like noise, tell crew counts and repair-time shapes apart? It has never run; only spike S3's noise-free toy has tried it (claim item 5). Until it does, crews and shape stay fixed and are never reported.
- **The water model, after the fix:**
  - the booster's −1,195 at 6 h and 28 m;
  - whether to accept the transfer-valve and tank-B negatives as real, or to recalibrate the large district so its north pump serves the north;
  - scoring harm at a fixed service line instead of at each sweep setting. It is a separate decision, because it changes published figures: the blind spot would go from 5,213 to 1,951 people (a reader's in-memory run at the old 6-minute step, not reproduced here).
- **Phase 6, the optional cell-site extension:** drive cell-site backup checks with the observed EAGLE-I Helene series and compare them with FCC DIRS county reports. One storm is a single data point, so it needs DIRS reports from more storms; whether they exist is unverified. It inherits the missing-MCC rule.
- **Unexplained:**
  - Both models flag the same five storms at +12 h (H7). The cause is untested. ASSUMED candidates: something in those storms or the data, or what the two models share (the fitted delay spread, the first-hour limit).
  - The amended simulator's look p-values bunch between 0.1 and 0.2: 81 looks against about 47 expected. The cause is not identified. Ruled out: censored looks tied at the 7-day cap (only 6 of the 73 county looks in that band). The baseline bunches more (154 of 473).
  - Which candidate cause drives the storm count (H3).
  - Whether a crew density below the grid would score better (F4).
- **Record fixes, applied 2026-09-23:**
  - PLAN: the withdrawn fallback (D7) and the Checkpoint 4 line on Francine (H3), edited directly.
  - LAB-RESULTS: a dated correction adds the dearer counts (L7).
  - CHECK: a dated "Record corrections" section at the end covers the "not coded yet" gate line and PROTOCOL §10's unsourced 86–91% (S3 gives 85.6% and 66.9%). The frozen protocol is untouched.
