# Repair-order lab: Checkpoint 1 results

Local runs on synthetic feeders, 2026-09-23, at code commit `3dafe2c`.

- The design and every choice below are fixed in `RESTORATION-LAB-PREREG.md`
  (commit `5ea8597`, written before any code).
- Its §9 (commit `dbdec80`) recorded three choices the code had to make, before
  the lab runner existed.

**Evidence class (b):** local runs on synthetic feeders. Nothing here is checked
against real outage data.

## In plain English

- **What this does:** it breaks power lines on made-up neighbourhood networks
  (feeders). The storms have 6–12, 20 or 50 broken lines, with 200 storms per
  setting. Repair crews, 1 to 4 of them, fix the lines under six rules for
  choosing what to fix next. Five are rules a dispatcher could follow. The sixth
  knows every repair's true length in advance and is there only as a yardstick.
  Each rule is compared with the best possible order, worked out afterwards
  knowing every repair's length. For big storms with several crews, only an upper
  limit on the gap is known.
- **What it found, inside this model only:**
  - With 6–12 broken lines and typical variation in repair times, "fix whatever
    brings the most people back right now" costs 5–9% more customer-hours than
    the best possible, depending on the number of crews. When repair times vary
    more, it costs up to 12% more.
  - That gap grows fast with the damage: with one crew, about 25% at 20 broken
    lines and 45% at 50.
  - A rule that plans the whole order up front stays within 5% with one crew at
    every storm size (6.5% when repair times vary widely). It weighs how many
    customers each chain of repairs brings back, and treats every repair as the
    same typical length.
  - Two rules are the worst in every setting tested: fixing the nearest line, and
    fixing the line closest to the substation. Crews have no travel time in this
    model, so being close saves nothing.
- **Why it matters:** the repair-order simulator and its scoring now work, and
  pass 107 unit and property tests. Phase 2 loads the real county outage records,
  and Phases 3–4 check a county-scale version of this simulator against them.
  This rule comparison itself is never checked against real data.

## Words used here

- **Customer-hours:** customers × hours without power, averaged per storm.
  **Customer-ticks:** the same count in 15-minute ticks (4 ticks = 1 hour).
- **Best possible:** the cheapest schedule, worked out afterwards knowing every
  repair's true length. It is hindsight; no dispatcher could follow it.
  - With 1 crew it comes from Horn's 1972 method, which is exact.
  - With 2–4 crews it comes from an optimisation solver (HiGHS). "Proven" means
    the solver guarantees it is within 0.01% of the true best.
- **LP floor:** a lower limit no schedule can beat. It stands in for the best
  possible where the exact solve is too slow: 20 and 50 broken lines with 2–4
  crews. A gap against it is an upper limit, so it is always worded "at most".
- **k:** the number of broken lines. **σ:** how much repair times vary; 0 means
  every repair takes 1.5 h.
- **[a, b] after a figure:** a 95% interval. If the 200 storms were drawn again,
  the figure would very likely land in that range.
- **Horn-order:** Horn's one-crew order, computed as if every repair took the
  typical 1.5 h. Each free crew takes the next repair on that list.
  **Horn-order (hindsight)** is the same list computed from the true lengths.

## Headline, in the pre-registered form

Inside the model, with one crew, most customers first (who comes back now) costs
**9.2% [7.1%, 11.5%]** more customer-hours than the best possible (hindsight:
knows the true repair times). It ties the best possible on **32 of 200** storms,
at 6–12 broken segments and σ 0.6.

The same cell with more crews:

| Crews | Most customers first: extra over best possible [95% interval] | Storms tied with best possible | Best possible proven by HiGHS |
| ----- | ------------------------------------------------------------- | ------------------------------ | ----------------------------- |
| 1     | 9.2% [7.1%, 11.5%]                                            | 32 of 200                      | exact (Horn)                  |
| 2     | 8.0% [6.2%, 9.8%]                                             | 36 of 200                      | 200 of 200                    |
| 3     | 6.4% [4.9%, 7.8%]                                             | 48 of 200                      | 200 of 200                    |
| 4     | 5.0% [3.8%, 6.3%]                                             | 70 of 200                      | 200 of 200                    |

- **"Extra"** is the total extra customer-hours across the 200 storms, as a share
  of the best possible's total.
- **The interval** comes from 2,000 resamples of whole storms.
- **No storm fell back to the LP floor** in any 6–12-break cell, and no rule's
  schedule ever came in below the solver's.

## What the tables show

Every statement here is inside the model, on this generator's feeders.

1. **Most customers first, against the best possible.**
   - At 6–12 broken lines it gets closer as crews are added: 9.2% → 5.0%.
   - It falls further behind as damage grows. With one crew: 9.2% at 6–12, 25.3%
     [22.3%, 28.3%] at 20, and 44.6% [41.0%, 48.3%] at 50.
   - With 2–4 crews at 20 and 50, only upper limits exist: at most 22–28% and at
     most 45–50%, against the LP floor.
2. **Repair-time spread widens the gap with one or two crews.**
   - 1 crew: 6.9% when every repair takes the same time (σ 0), 9.2% at σ 0.6, and
     11.8% at σ 1.0.
   - 2 crews: 6.6%, 8.0% and 8.9%.
   - With 3–4 crews it makes little difference. At 4 crews it is 5.1%, 5.0% and
     4.7%.
   - With equal repair times, most customers first matches the best possible on
     116 of 200 one-crew storms.
3. **Horn-order, planned on the typical repair time only, had the smallest gap of
   the five rules that use no hindsight**, at every crew count in every table.
   - Primary cell: 3.7%, 3.4%, 2.7% and 1.9% for 1–4 crews.
   - Against most customers first, it cost less on 72, 73, 67 and 59 storms and
     more on 20, 17, 20 and 17. The rest were ties.
   - With one crew at 20 and 50 broken lines it stays at 4.8%.
   - This describes these simulated storms only. The pre-registration forbids
     calling Horn-order the best rule beyond 2–3 crews, and no test of the
     difference between rules was pre-registered.
4. **What knowing the true repair times is worth** (Horn-order (hindsight)
   against Horn-order):
   - 1 crew: hindsight is the best possible, so the gap falls to 0 in every cell.
   - Primary cell, 2 crews: 3.4% → 2.1%, cheaper on 103 storms and dearer on 45.
   - Primary cell, 3 and 4 crews: little or no gain.
     - 3 crews: 2.7% vs 2.4%, cheaper on 68 storms and dearer on 70.
     - 4 crews: 1.9% vs 2.0%, cheaper on 46 and dearer on 69.
   - At 20 and 50 broken lines it still helps with 3–4 crews. At 4 crews it was
     cheaper on 128 and 191 of 200 storms.
     - _Correction, 2026-09-23 (Phase 5 ledger, L7):_ it was dearer on 69 and 9, with 3 and 0 ties
       (`results-200.json`). So 128 against 69 is a weaker win than the line above suggests.
   - Why it fades in the small storms is not tested here. One possible reason
     (ASSUMED): Horn's list is the best order for one crew only.
5. **Nearest first and upstream first are the two worst rules in every table.**
   - They cost from 14% to at most 97% more than the best possible. At 20 and 50
     broken lines with 2–4 crews these are upper limits.
   - Nearest first here ignores travel, which is not modelled. So this says
     nothing about real crews driving between jobs.
6. **Critical facilities first** is scored on customer-hours only, which is not
   what it is for. In every table it costs more on average than most customers
   first.

## Against spike S2

Spike S2 ran the same rules in Python on its own random storms. Here are the
median per-storm gaps for most customers first in the primary cell:

| Crews | This run (200 storms) | Spike S2 (100 storms per crew count) | This run, 95% range of the median over 100-storm resamples |
| ----- | --------------------- | ------------------------------------ | ---------------------------------------------------------- |
| 1     | 4.5%                  | 4.9%                                 | 2.8–6.0%                                                   |
| 2     | 3.0%                  | 3.1%                                 | 1.7–4.6%                                                   |
| 3     | 1.9%                  | 2.4%                                 | 1.0–3.1%                                                   |
| 4     | 0.9%                  | 1.4%                                 | 0.2–1.9%                                                   |

Each spike median falls inside the range that redrawing 100 of this run's storms
gives. So the two agree.

The spike's by-size figures are lower than this run's: 14.5% at k = 20 and 28.5%
at k = 50 (one crew), against 19.3% and 38.7% here.

- **Feeder size: CONFIRMED.** The spike's by-size run used larger feeders
  (`n_nodes = max(3k, 40)` in `run_onecrew_scale.py`). The pre-registered
  generator has 51–59 buses at k = 50. Re-running the spike's own code with the
  pre-registered size, on that run's seeds, gives 18.4% and 33.8%.
- **The rest at k = 50: consistent with sample noise, not a separate cause.**
  - The spike's code on 8 further sets of 200 storms (seeds 1000–1007) gives
    medians of 34.8–39.4%. That range contains this run's 38.7%.
  - Pooled over those sets, its storm statistics match this run's: the share of
    segments below another break is 0.922 vs 0.918, and the mean repair ticks
    are 6.89 in both.

## Deviations from the pre-registration

None. Additions, none of which changes a number:

- **The test suite** (pre-registration §8). At `3dafe2c`:
  - 107 restoration tests in 7 files pass;
  - the whole engine suite passes, 930 passed and 4 skipped;
  - 16 Python solver tests pass.

  Evidence class (a): unit and property tests.

- **Solver time** is printed under each table. It is not a result.
- **The results file keeps enough to recompute every number.** For each storm it
  stores the problem and the LP floor. It also stores the cost of HiGHS's
  schedule after it is handed out again in start order (§9.3), not HiGHS's raw
  cost. So every table number can be recomputed from the file alone.
- **Development runs came first.** While the runner was being built and
  reviewed, smoke runs of 10–20 storms (the first seeds) were made. No
  pre-registered choice changed after them. The only code change after the
  runner existed was to output wording and input guards, and it was checked to
  leave all 24,000 schedules byte-identical.

## What cannot be concluded

- Anything about what a real utility does or should do. These are six rules on
  one synthetic generator's feeders.
- "Optimal" for 2–4 crews, except on storms HiGHS proved. That is every
  6–12-break storm here. At 20 and 50 broken lines with 2–4 crews, every gap is
  **at most** the figure shown.
- That Horn-order is the best rule beyond 2–3 crews.
- Anything about travel, switching, crew arrival or power flow, none of which is
  modelled.
- The best possible is hindsight throughout: it knows the true repair times.

## Checkpoint 1: one schedule to check by hand

The pre-registered storm is `restoration-lab/storm-0`: the first seed in the
primary cell with 6 broken lines, at 2 crews. Everything needed is below. A
segment's customers come back when it **and every broken segment above it** is
repaired.

- **Most customers first:** 76×15 + 616×14 + 220×14 + 0×34 + 15×19 + 2×21 =
  **13,171** customer-ticks (3,292.8 customer-hours).
- **Best possible:** 76×4 + 616×14 + 220×15 + 0×34 + 15×19 + 2×21 = **12,555**
  (3,138.8).
- **The 616-tick difference:** the best possible repairs segment 0 (4 ticks, 76
  customers) before segment 2 (11 ticks, 220 customers).
  - The 76 come back 11 ticks sooner, which saves 836 customer-ticks.
  - The 220 come back 1 tick later, which costs 220.
- **Why most customers first does it the other way:** at tick 0, crew 0 takes
  segment 1 (616 back). Crew 1 then counts segment 1 as under way, so segment 2
  brings back 220 "now", against 76 for segment 0.

A 38-bus lateral feeder. Bus 0 is the substation, segments and crews are numbered from 0, and one tick is 15 minutes.

Feeder parent of each bus:

`[-1,0,0,2,3,4,2,6,2,8,9,5,8,5,12,14,15,16,17,4,17,6,21,5,3,24,0,14,27,15,18,30,31,0,10,34,35,18]`

Customers at each bus:

`[0,76,27,0,0,52,2,89,0,0,17,19,0,81,0,15,45,10,33,5,12,3,13,0,19,0,0,19,15,12,181,0,2,0,60,5,111,6]`

| Segment | Line into bus | Broken segment upstream | Repair ticks | Customers behind it (up to the next break) |
| ------- | ------------- | ----------------------- | ------------ | ------------------------------------------ |
| 0       | 1             | —                       | 4            | 76                                         |
| 1       | 2             | —                       | 14           | 616                                        |
| 2       | 18            | 1                       | 11           | 220                                        |
| 3       | 25            | 1                       | 15           | 0                                          |
| 4       | 28            | 1                       | 5            | 15                                         |
| 5       | 32            | 2                       | 6            | 2                                          |

**Most customers first** — 13171 customer-ticks = 3292.8 customer-hours

| Segment | Crew | Start | Finish | Customers back at |
| ------- | ---- | ----- | ------ | ----------------- |
| 0       | 1    | 11    | 15     | 15                |
| 1       | 0    | 0     | 14     | 14                |
| 2       | 1    | 0     | 11     | 14                |
| 3       | 0    | 19    | 34     | 34                |
| 4       | 0    | 14    | 19     | 19                |
| 5       | 1    | 15    | 21     | 21                |

Reference: HiGHS proved this storm within its 1e-4 gap; its schedule, handed out again in its start order (pre-registration §9.3), is the reference.

**Best possible (hindsight: knows the true repair times)** — 12555 customer-ticks = 3138.8 customer-hours

| Segment | Crew | Start | Finish | Customers back at |
| ------- | ---- | ----- | ------ | ----------------- |
| 0       | 0    | 0     | 4      | 4                 |
| 1       | 1    | 0     | 14     | 14                |
| 2       | 0    | 4     | 15     | 15                |
| 3       | 1    | 19    | 34     | 34                |
| 4       | 1    | 14    | 19     | 19                |
| 5       | 0    | 15    | 21     | 21                |

## Reproduce

About 4 minutes on a laptop:

```bash
cd engine
RESTORATION_LAB_COMMIT=$(git rev-parse HEAD) DOTENV_CONFIG_PATH=/dev/null node --import tsx scripts/restoration-lab.ts > .cache/restoration-lab/tables-200.md
```

This writes `.cache/restoration-lab/results-200.json`, which is gitignored. The table rows below are this run's output at `3dafe2c`, verbatim; only the headings were re-levelled.

## Tables: primary cell

### primary: k 6–12, σ 0.6

#### 1 crew

| Rule                                                   | Mean customer-hours | Extra over best possible [95% CI] | Ties with best possible | vs most customers first (better/tie/worse) | Median storm gap |
| ------------------------------------------------------ | ------------------- | --------------------------------- | ----------------------- | ------------------------------------------ | ---------------- |
| Best possible (hindsight: knows the true repair times) | 1833.1              | —                                 | —                       | —                                          | —                |
| Most customers first                                   | 2001.8              | 9.2% [7.1%, 11.5%]                | 32/200                  | —                                          | 4.5%             |
| Critical facilities first                              | 2205.9              | 20.3% [15.9%, 25.3%]              | 17/200                  | 39/66/95                                   | 9.2%             |
| Nearest first (travel not modelled)                    | 2882.9              | 57.3% [49.8%, 65.7%]              | 2/200                   | 18/2/180                                   | 49.7%            |
| Upstream first                                         | 2703.6              | 47.5% [41.6%, 53.9%]              | 5/200                   | 14/9/177                                   | 37.7%            |
| Horn-order                                             | 1900.9              | 3.7% [3.0%, 4.5%]                 | 40/200                  | 72/108/20                                  | 2.3%             |
| Horn-order (hindsight)                                 | 1833.1              | 0.0% [0.0%, 0.0%]                 | 200/200                 | 168/32/0                                   | 0.0%             |

Better / tie / worse count storms against most customers first; better means fewer customer-hours.

Reference: Horn's algorithm on the true repair times, exact for one crew.

#### 2 crews

| Rule                                                   | Mean customer-hours | Extra over best possible [95% CI] | Ties with best possible | vs most customers first (better/tie/worse) | Median storm gap |
| ------------------------------------------------------ | ------------------- | --------------------------------- | ----------------------- | ------------------------------------------ | ---------------- |
| Best possible (hindsight: knows the true repair times) | 1147.1              | —                                 | —                       | —                                          | —                |
| Most customers first                                   | 1238.8              | 8.0% [6.2%, 9.8%]                 | 36/200                  | —                                          | 3.0%             |
| Critical facilities first                              | 1310.6              | 14.2% [11.1%, 17.9%]              | 23/200                  | 32/76/92                                   | 6.8%             |
| Nearest first (travel not modelled)                    | 1618.0              | 41.0% [36.0%, 46.4%]              | 4/200                   | 18/7/175                                   | 35.4%            |
| Upstream first                                         | 1534.4              | 33.8% [29.4%, 38.6%]              | 5/200                   | 20/11/169                                  | 26.8%            |
| Horn-order                                             | 1185.7              | 3.4% [2.8%, 4.0%]                 | 42/200                  | 73/110/17                                  | 1.5%             |
| Horn-order (hindsight)                                 | 1170.8              | 2.1% [1.6%, 2.6%]                 | 55/200                  | 127/41/32                                  | 0.6%             |

Better / tie / worse count storms against most customers first; better means fewer customer-hours.

HiGHS proved 200 of 200 storms within its 1e-4 gap (60 s limit each); 0 use the LP floor.
Solver time per storm (not a result): MILP median 0.02 s, max 1.85 s; LP floor median 0.00 s, max 0.01 s.

#### 3 crews

| Rule                                                   | Mean customer-hours | Extra over best possible [95% CI] | Ties with best possible | vs most customers first (better/tie/worse) | Median storm gap |
| ------------------------------------------------------ | ------------------- | --------------------------------- | ----------------------- | ------------------------------------------ | ---------------- |
| Best possible (hindsight: knows the true repair times) | 953.2               | —                                 | —                       | —                                          | —                |
| Most customers first                                   | 1013.8              | 6.4% [4.9%, 7.8%]                 | 48/200                  | —                                          | 1.9%             |
| Critical facilities first                              | 1040.6              | 9.2% [7.1%, 11.6%]                | 37/200                  | 28/100/72                                  | 4.2%             |
| Nearest first (travel not modelled)                    | 1233.4              | 29.4% [25.5%, 34.0%]              | 7/200                   | 19/10/171                                  | 24.5%            |
| Upstream first                                         | 1183.7              | 24.2% [20.8%, 27.6%]              | 8/200                   | 21/15/164                                  | 18.2%            |
| Horn-order                                             | 979.3               | 2.7% [2.1%, 3.4%]                 | 52/200                  | 67/113/20                                  | 1.1%             |
| Horn-order (hindsight)                                 | 976.6               | 2.4% [1.9%, 3.0%]                 | 41/200                  | 94/48/58                                   | 1.1%             |

Better / tie / worse count storms against most customers first; better means fewer customer-hours.

HiGHS proved 200 of 200 storms within its 1e-4 gap (60 s limit each); 0 use the LP floor.
Solver time per storm (not a result): MILP median 0.01 s, max 0.70 s; LP floor median 0.00 s, max 0.00 s.

#### 4 crews

| Rule                                                   | Mean customer-hours | Extra over best possible [95% CI] | Ties with best possible | vs most customers first (better/tie/worse) | Median storm gap |
| ------------------------------------------------------ | ------------------- | --------------------------------- | ----------------------- | ------------------------------------------ | ---------------- |
| Best possible (hindsight: knows the true repair times) | 879.5               | —                                 | —                       | —                                          | —                |
| Most customers first                                   | 923.3               | 5.0% [3.8%, 6.3%]                 | 70/200                  | —                                          | 0.9%             |
| Critical facilities first                              | 932.6               | 6.0% [4.5%, 7.7%]                 | 56/200                  | 26/108/66                                  | 2.3%             |
| Nearest first (travel not modelled)                    | 1050.2              | 19.4% [16.5%, 22.6%]              | 14/200                  | 18/17/165                                  | 15.3%            |
| Upstream first                                         | 1024.1              | 16.4% [13.9%, 19.3%]              | 12/200                  | 24/22/154                                  | 10.7%            |
| Horn-order                                             | 896.1               | 1.9% [1.5%, 2.3%]                 | 72/200                  | 59/124/17                                  | 0.6%             |
| Horn-order (hindsight)                                 | 897.5               | 2.0% [1.6%, 2.5%]                 | 51/200                  | 74/74/52                                   | 0.8%             |

Better / tie / worse count storms against most customers first; better means fewer customer-hours.

HiGHS proved 200 of 200 storms within its 1e-4 gap (60 s limit each); 0 use the LP floor.
Solver time per storm (not a result): MILP median 0.01 s, max 0.29 s; LP floor median 0.00 s, max 0.00 s.

## Tables: sensitivity cells

### equal-times: k 6–12, σ 0

#### 1 crew

| Rule                                                   | Mean customer-hours | Extra over best possible [95% CI] | Ties with best possible | vs most customers first (better/tie/worse) | Median storm gap |
| ------------------------------------------------------ | ------------------- | --------------------------------- | ----------------------- | ------------------------------------------ | ---------------- |
| Best possible (hindsight: knows the true repair times) | 1619.0              | —                                 | —                       | —                                          | —                |
| Most customers first                                   | 1730.1              | 6.9% [4.8%, 9.1%]                 | 116/200                 | —                                          | 0.0%             |
| Critical facilities first                              | 1886.8              | 16.5% [13.0%, 20.7%]              | 60/200                  | 23/66/111                                  | 6.7%             |
| Nearest first (travel not modelled)                    | 2510.3              | 55.1% [48.8%, 62.0%]              | 1/200                   | 11/3/186                                   | 49.1%            |
| Upstream first                                         | 2355.7              | 45.5% [40.3%, 50.9%]              | 7/200                   | 8/9/183                                    | 40.0%            |
| Horn-order                                             | 1619.0              | 0.0% [0.0%, 0.0%]                 | 200/200                 | 84/116/0                                   | 0.0%             |
| Horn-order (hindsight)                                 | 1619.0              | 0.0% [0.0%, 0.0%]                 | 200/200                 | 84/116/0                                   | 0.0%             |

Better / tie / worse count storms against most customers first; better means fewer customer-hours.

Reference: Horn's algorithm on the true repair times, exact for one crew.

#### 2 crews

| Rule                                                   | Mean customer-hours | Extra over best possible [95% CI] | Ties with best possible | vs most customers first (better/tie/worse) | Median storm gap |
| ------------------------------------------------------ | ------------------- | --------------------------------- | ----------------------- | ------------------------------------------ | ---------------- |
| Best possible (hindsight: knows the true repair times) | 989.2               | —                                 | —                       | —                                          | —                |
| Most customers first                                   | 1054.2              | 6.6% [4.9%, 8.5%]                 | 118/200                 | —                                          | 0.0%             |
| Critical facilities first                              | 1121.4              | 13.4% [10.3%, 17.1%]              | 66/200                  | 25/80/95                                   | 4.7%             |
| Nearest first (travel not modelled)                    | 1424.5              | 44.0% [38.8%, 49.3%]              | 8/200                   | 8/12/180                                   | 35.8%            |
| Upstream first                                         | 1356.3              | 37.1% [32.6%, 41.8%]              | 11/200                  | 11/14/175                                  | 29.6%            |
| Horn-order                                             | 994.1               | 0.5% [0.3%, 0.7%]                 | 161/200                 | 73/116/11                                  | 0.0%             |
| Horn-order (hindsight)                                 | 994.1               | 0.5% [0.3%, 0.7%]                 | 161/200                 | 73/116/11                                  | 0.0%             |

Better / tie / worse count storms against most customers first; better means fewer customer-hours.

HiGHS proved 200 of 200 storms within its 1e-4 gap (60 s limit each); 0 use the LP floor.
Solver time per storm (not a result): MILP median 0.01 s, max 0.51 s; LP floor median 0.00 s, max 0.00 s.

#### 3 crews

| Rule                                                   | Mean customer-hours | Extra over best possible [95% CI] | Ties with best possible | vs most customers first (better/tie/worse) | Median storm gap |
| ------------------------------------------------------ | ------------------- | --------------------------------- | ----------------------- | ------------------------------------------ | ---------------- |
| Best possible (hindsight: knows the true repair times) | 797.2               | —                                 | —                       | —                                          | —                |
| Most customers first                                   | 842.0               | 5.6% [3.8%, 7.6%]                 | 125/200                 | —                                          | 0.0%             |
| Critical facilities first                              | 865.2               | 8.5% [6.4%, 11.0%]                | 91/200                  | 25/95/80                                   | 1.3%             |
| Nearest first (travel not modelled)                    | 1078.4              | 35.3% [30.7%, 39.8%]              | 11/200                  | 3/14/183                                   | 29.9%            |
| Upstream first                                         | 1032.3              | 29.5% [25.9%, 33.4%]              | 18/200                  | 8/22/170                                   | 24.4%            |
| Horn-order                                             | 806.6               | 1.2% [0.8%, 1.6%]                 | 156/200                 | 61/124/15                                  | 0.0%             |
| Horn-order (hindsight)                                 | 806.6               | 1.2% [0.7%, 1.6%]                 | 156/200                 | 61/124/15                                  | 0.0%             |

Better / tie / worse count storms against most customers first; better means fewer customer-hours.

HiGHS proved 200 of 200 storms within its 1e-4 gap (60 s limit each); 0 use the LP floor.
Solver time per storm (not a result): MILP median 0.00 s, max 0.77 s; LP floor median 0.00 s, max 0.00 s.

#### 4 crews

| Rule                                                   | Mean customer-hours | Extra over best possible [95% CI] | Ties with best possible | vs most customers first (better/tie/worse) | Median storm gap |
| ------------------------------------------------------ | ------------------- | --------------------------------- | ----------------------- | ------------------------------------------ | ---------------- |
| Best possible (hindsight: knows the true repair times) | 707.7               | —                                 | —                       | —                                          | —                |
| Most customers first                                   | 743.7               | 5.1% [3.6%, 6.7%]                 | 140/200                 | —                                          | 0.0%             |
| Critical facilities first                              | 757.8               | 7.1% [5.1%, 9.4%]                 | 107/200                 | 23/107/70                                  | 0.0%             |
| Nearest first (travel not modelled)                    | 900.6               | 27.2% [23.8%, 31.0%]              | 15/200                  | 8/21/171                                   | 23.6%            |
| Upstream first                                         | 875.3               | 23.7% [20.3%, 26.9%]              | 21/200                  | 11/24/165                                  | 18.5%            |
| Horn-order                                             | 711.1               | 0.5% [0.2%, 0.8%]                 | 177/200                 | 54/133/13                                  | 0.0%             |
| Horn-order (hindsight)                                 | 711.1               | 0.5% [0.2%, 0.7%]                 | 177/200                 | 54/133/13                                  | 0.0%             |

Better / tie / worse count storms against most customers first; better means fewer customer-hours.

HiGHS proved 200 of 200 storms within its 1e-4 gap (60 s limit each); 0 use the LP floor.
Solver time per storm (not a result): MILP median 0.00 s, max 0.10 s; LP floor median 0.00 s, max 0.00 s.

### wide-spread: k 6–12, σ 1

#### 1 crew

| Rule                                                   | Mean customer-hours | Extra over best possible [95% CI] | Ties with best possible | vs most customers first (better/tie/worse) | Median storm gap |
| ------------------------------------------------------ | ------------------- | --------------------------------- | ----------------------- | ------------------------------------------ | ---------------- |
| Best possible (hindsight: knows the true repair times) | 1958.8              | —                                 | —                       | —                                          | —                |
| Most customers first                                   | 2190.7              | 11.8% [9.4%, 14.5%]               | 23/200                  | —                                          | 8.3%             |
| Critical facilities first                              | 2413.9              | 23.2% [18.0%, 28.8%]              | 11/200                  | 42/66/92                                   | 13.3%            |
| Nearest first (travel not modelled)                    | 3121.6              | 59.4% [51.2%, 67.9%]              | 3/200                   | 21/2/177                                   | 53.9%            |
| Upstream first                                         | 2938.7              | 50.0% [43.2%, 57.9%]              | 5/200                   | 23/8/169                                   | 40.2%            |
| Horn-order                                             | 2085.3              | 6.5% [5.4%, 7.6%]                 | 28/200                  | 66/105/29                                  | 5.0%             |
| Horn-order (hindsight)                                 | 1958.8              | 0.0% [0.0%, 0.0%]                 | 200/200                 | 177/23/0                                   | 0.0%             |

Better / tie / worse count storms against most customers first; better means fewer customer-hours.

Reference: Horn's algorithm on the true repair times, exact for one crew.

#### 2 crews

| Rule                                                   | Mean customer-hours | Extra over best possible [95% CI] | Ties with best possible | vs most customers first (better/tie/worse) | Median storm gap |
| ------------------------------------------------------ | ------------------- | --------------------------------- | ----------------------- | ------------------------------------------ | ---------------- |
| Best possible (hindsight: knows the true repair times) | 1248.8              | —                                 | —                       | —                                          | —                |
| Most customers first                                   | 1360.6              | 8.9% [7.1%, 11.0%]                | 28/200                  | —                                          | 3.8%             |
| Critical facilities first                              | 1426.5              | 14.2% [11.0%, 17.9%]              | 20/200                  | 32/80/88                                   | 8.1%             |
| Nearest first (travel not modelled)                    | 1741.3              | 39.4% [34.0%, 45.2%]              | 6/200                   | 25/7/168                                   | 34.1%            |
| Upstream first                                         | 1665.0              | 33.3% [28.7%, 38.6%]              | 8/200                   | 25/11/164                                  | 27.1%            |
| Horn-order                                             | 1304.4              | 4.4% [3.7%, 5.2%]                 | 31/200                  | 69/109/22                                  | 2.5%             |
| Horn-order (hindsight)                                 | 1272.6              | 1.9% [1.5%, 2.4%]                 | 49/200                  | 136/27/37                                  | 0.8%             |

Better / tie / worse count storms against most customers first; better means fewer customer-hours.

HiGHS proved 200 of 200 storms within its 1e-4 gap (60 s limit each); 0 use the LP floor.
Solver time per storm (not a result): MILP median 0.01 s, max 3.26 s; LP floor median 0.00 s, max 0.01 s.

#### 3 crews

| Rule                                                   | Mean customer-hours | Extra over best possible [95% CI] | Ties with best possible | vs most customers first (better/tie/worse) | Median storm gap |
| ------------------------------------------------------ | ------------------- | --------------------------------- | ----------------------- | ------------------------------------------ | ---------------- |
| Best possible (hindsight: knows the true repair times) | 1054.9              | —                                 | —                       | —                                          | —                |
| Most customers first                                   | 1120.3              | 6.2% [4.7%, 7.7%]                 | 35/200                  | —                                          | 2.4%             |
| Critical facilities first                              | 1146.4              | 8.7% [6.7%, 11.1%]                | 26/200                  | 31/99/70                                   | 4.6%             |
| Nearest first (travel not modelled)                    | 1337.1              | 26.7% [22.7%, 31.1%]              | 9/200                   | 21/12/167                                  | 21.6%            |
| Upstream first                                         | 1283.9              | 21.7% [18.5%, 25.3%]              | 11/200                  | 29/16/155                                  | 14.5%            |
| Horn-order                                             | 1085.7              | 2.9% [2.4%, 3.5%]                 | 37/200                  | 64/114/22                                  | 1.8%             |
| Horn-order (hindsight)                                 | 1078.7              | 2.3% [1.9%, 2.7%]                 | 28/200                  | 104/40/56                                  | 1.5%             |

Better / tie / worse count storms against most customers first; better means fewer customer-hours.

HiGHS proved 200 of 200 storms within its 1e-4 gap (60 s limit each); 0 use the LP floor.
Solver time per storm (not a result): MILP median 0.01 s, max 0.53 s; LP floor median 0.00 s, max 0.00 s.

#### 4 crews

| Rule                                                   | Mean customer-hours | Extra over best possible [95% CI] | Ties with best possible | vs most customers first (better/tie/worse) | Median storm gap |
| ------------------------------------------------------ | ------------------- | --------------------------------- | ----------------------- | ------------------------------------------ | ---------------- |
| Best possible (hindsight: knows the true repair times) | 980.0               | —                                 | —                       | —                                          | —                |
| Most customers first                                   | 1026.1              | 4.7% [3.5%, 6.1%]                 | 56/200                  | —                                          | 1.3%             |
| Critical facilities first                              | 1033.0              | 5.4% [4.0%, 7.2%]                 | 46/200                  | 29/109/62                                  | 2.0%             |
| Nearest first (travel not modelled)                    | 1147.9              | 17.1% [14.3%, 20.2%]              | 15/200                  | 22/16/162                                  | 11.1%            |
| Upstream first                                         | 1119.0              | 14.2% [11.6%, 17.0%]              | 14/200                  | 30/21/149                                  | 8.2%             |
| Horn-order                                             | 1000.7              | 2.1% [1.7%, 2.6%]                 | 55/200                  | 61/121/18                                  | 1.0%             |
| Horn-order (hindsight)                                 | 1001.6              | 2.2% [1.7%, 2.7%]                 | 36/200                  | 74/61/65                                   | 1.2%             |

Better / tie / worse count storms against most customers first; better means fewer customer-hours.

HiGHS proved 200 of 200 storms within its 1e-4 gap (60 s limit each); 0 use the LP floor.
Solver time per storm (not a result): MILP median 0.01 s, max 0.49 s; LP floor median 0.00 s, max 0.00 s.

### twenty-breaks: k 20, σ 0.6

#### 1 crew

| Rule                                                   | Mean customer-hours | Extra over best possible [95% CI] | Ties with best possible | vs most customers first (better/tie/worse) | Median storm gap |
| ------------------------------------------------------ | ------------------- | --------------------------------- | ----------------------- | ------------------------------------------ | ---------------- |
| Best possible (hindsight: knows the true repair times) | 5513.5              | —                                 | —                       | —                                          | —                |
| Most customers first                                   | 6906.6              | 25.3% [22.3%, 28.3%]              | 0/200                   | —                                          | 19.3%            |
| Critical facilities first                              | 7409.9              | 34.4% [30.9%, 38.3%]              | 0/200                   | 46/18/136                                  | 26.6%            |
| Nearest first (travel not modelled)                    | 10115.6             | 83.5% [75.8%, 92.4%]              | 0/200                   | 24/0/176                                   | 73.4%            |
| Upstream first                                         | 9452.0              | 71.4% [65.2%, 78.1%]              | 0/200                   | 15/0/185                                   | 65.4%            |
| Horn-order                                             | 5776.5              | 4.8% [4.2%, 5.3%]                 | 2/200                   | 180/1/19                                   | 4.0%             |
| Horn-order (hindsight)                                 | 5513.5              | 0.0% [0.0%, 0.0%]                 | 200/200                 | 200/0/0                                    | 0.0%             |

Better / tie / worse count storms against most customers first; better means fewer customer-hours.

Reference: Horn's algorithm on the true repair times, exact for one crew.

#### 2 crews

| Rule                                | Mean customer-hours | Extra over best possible, at most [95% CI] | Ties with best possible | vs most customers first (better/tie/worse) | Median storm gap (at most) |
| ----------------------------------- | ------------------- | ------------------------------------------ | ----------------------- | ------------------------------------------ | -------------------------- |
| LP floor                            | 2949.8              | —                                          | —                       | —                                          | —                          |
| Most customers first                | 3785.6              | 28.3% [25.1%, 31.6%]                       | —                       | —                                          | 21.8%                      |
| Critical facilities first           | 3981.4              | 35.0% [31.6%, 38.6%]                       | —                       | 53/20/127                                  | 30.5%                      |
| Nearest first (travel not modelled) | 5308.8              | 80.0% [73.5%, 86.8%]                       | —                       | 15/0/185                                   | 72.9%                      |
| Upstream first                      | 4957.6              | 68.1% [62.6%, 74.1%]                       | —                       | 15/0/185                                   | 61.9%                      |
| Horn-order                          | 3214.4              | 9.0% [8.2%, 9.7%]                          | —                       | 182/1/17                                   | 8.1%                       |
| Horn-order (hindsight)              | 3120.9              | 5.8% [5.2%, 6.5%]                          | —                       | 195/0/5                                    | 4.6%                       |

Better / tie / worse count storms against most customers first; better means fewer customer-hours.

Reference: the LP floor. No schedule costs less, so each gap is at most what is shown.
Solver time per storm (not a result): LP floor median 0.01 s, max 0.04 s.

#### 3 crews

| Rule                                | Mean customer-hours | Extra over best possible, at most [95% CI] | Ties with best possible | vs most customers first (better/tie/worse) | Median storm gap (at most) |
| ----------------------------------- | ------------------- | ------------------------------------------ | ----------------------- | ------------------------------------------ | -------------------------- |
| LP floor                            | 2231.9              | —                                          | —                       | —                                          | —                          |
| Most customers first                | 2795.3              | 25.2% [22.6%, 28.3%]                       | —                       | —                                          | 19.8%                      |
| Critical facilities first           | 2883.7              | 29.2% [26.3%, 32.4%]                       | —                       | 57/25/118                                  | 24.5%                      |
| Nearest first (travel not modelled) | 3742.4              | 67.7% [62.3%, 73.7%]                       | —                       | 18/0/182                                   | 60.3%                      |
| Upstream first                      | 3498.5              | 56.8% [52.1%, 61.7%]                       | —                       | 22/0/178                                   | 50.0%                      |
| Horn-order                          | 2410.6              | 8.0% [7.3%, 8.7%]                          | —                       | 180/1/19                                   | 6.8%                       |
| Horn-order (hindsight)              | 2377.5              | 6.5% [5.8%, 7.2%]                          | —                       | 189/0/11                                   | 5.3%                       |

Better / tie / worse count storms against most customers first; better means fewer customer-hours.

Reference: the LP floor. No schedule costs less, so each gap is at most what is shown.
Solver time per storm (not a result): LP floor median 0.01 s, max 0.03 s.

#### 4 crews

| Rule                                | Mean customer-hours | Extra over best possible, at most [95% CI] | Ties with best possible | vs most customers first (better/tie/worse) | Median storm gap (at most) |
| ----------------------------------- | ------------------- | ------------------------------------------ | ----------------------- | ------------------------------------------ | -------------------------- |
| LP floor                            | 1898.0              | —                                          | —                       | —                                          | —                          |
| Most customers first                | 2320.5              | 22.3% [20.0%, 24.9%]                       | —                       | —                                          | 18.5%                      |
| Critical facilities first           | 2359.2              | 24.3% [21.6%, 27.0%]                       | —                       | 59/32/109                                  | 20.7%                      |
| Nearest first (travel not modelled) | 2950.5              | 55.5% [51.1%, 60.1%]                       | —                       | 22/0/178                                   | 48.6%                      |
| Upstream first                      | 2779.8              | 46.5% [42.6%, 50.2%]                       | —                       | 29/0/171                                   | 42.0%                      |
| Horn-order                          | 2038.3              | 7.4% [6.7%, 8.1%]                          | —                       | 181/2/17                                   | 6.2%                       |
| Horn-order (hindsight)              | 2026.8              | 6.8% [6.1%, 7.5%]                          | —                       | 185/0/15                                   | 5.8%                       |

Better / tie / worse count storms against most customers first; better means fewer customer-hours.

Reference: the LP floor. No schedule costs less, so each gap is at most what is shown.
Solver time per storm (not a result): LP floor median 0.01 s, max 0.02 s.

### fifty-breaks: k 50, σ 0.6

#### 1 crew

| Rule                                                   | Mean customer-hours | Extra over best possible [95% CI] | Ties with best possible | vs most customers first (better/tie/worse) | Median storm gap |
| ------------------------------------------------------ | ------------------- | --------------------------------- | ----------------------- | ------------------------------------------ | ---------------- |
| Best possible (hindsight: knows the true repair times) | 21477.2             | —                                 | —                       | —                                          | —                |
| Most customers first                                   | 31065.8             | 44.6% [41.0%, 48.3%]              | 0/200                   | —                                          | 38.7%            |
| Critical facilities first                              | 31977.8             | 48.9% [44.4%, 53.8%]              | 0/200                   | 69/0/131                                   | 43.1%            |
| Nearest first (travel not modelled)                    | 41076.6             | 91.3% [84.8%, 98.3%]              | 0/200                   | 21/0/179                                   | 87.0%            |
| Upstream first                                         | 39331.7             | 83.1% [77.9%, 88.2%]              | 0/200                   | 12/0/188                                   | 77.3%            |
| Horn-order                                             | 22501.1             | 4.8% [4.4%, 5.1%]                 | 0/200                   | 200/0/0                                    | 4.6%             |
| Horn-order (hindsight)                                 | 21477.2             | 0.0% [0.0%, 0.0%]                 | 200/200                 | 200/0/0                                    | 0.0%             |

Better / tie / worse count storms against most customers first; better means fewer customer-hours.

Reference: Horn's algorithm on the true repair times, exact for one crew.

#### 2 crews

| Rule                                | Mean customer-hours | Extra over best possible, at most [95% CI] | Ties with best possible | vs most customers first (better/tie/worse) | Median storm gap (at most) |
| ----------------------------------- | ------------------- | ------------------------------------------ | ----------------------- | ------------------------------------------ | -------------------------- |
| LP floor                            | 10703.2             | —                                          | —                       | —                                          | —                          |
| Most customers first                | 16040.8             | 49.9% [45.8%, 54.0%]                       | —                       | —                                          | 43.5%                      |
| Critical facilities first           | 16452.4             | 53.7% [49.3%, 59.0%]                       | —                       | 74/0/126                                   | 47.1%                      |
| Nearest first (travel not modelled) | 21077.6             | 96.9% [90.5%, 103.3%]                      | —                       | 19/0/181                                   | 87.1%                      |
| Upstream first                      | 19981.9             | 86.7% [81.4%, 92.3%]                       | —                       | 12/0/188                                   | 80.0%                      |
| Horn-order                          | 11745.4             | 9.7% [9.3%, 10.2%]                         | —                       | 200/0/0                                    | 9.1%                       |
| Horn-order (hindsight)              | 11276.6             | 5.4% [4.9%, 5.8%]                          | —                       | 200/0/0                                    | 4.7%                       |

Better / tie / worse count storms against most customers first; better means fewer customer-hours.

Reference: the LP floor. No schedule costs less, so each gap is at most what is shown.
Solver time per storm (not a result): LP floor median 0.34 s, max 0.87 s.

#### 3 crews

| Rule                                | Mean customer-hours | Extra over best possible, at most [95% CI] | Ties with best possible | vs most customers first (better/tie/worse) | Median storm gap (at most) |
| ----------------------------------- | ------------------- | ------------------------------------------ | ----------------------- | ------------------------------------------ | -------------------------- |
| LP floor                            | 7513.6              | —                                          | —                       | —                                          | —                          |
| Most customers first                | 11090.5             | 47.6% [44.1%, 51.3%]                       | —                       | —                                          | 40.9%                      |
| Critical facilities first           | 11317.4             | 50.6% [46.3%, 55.5%]                       | —                       | 77/0/123                                   | 44.1%                      |
| Nearest first (travel not modelled) | 14387.6             | 91.5% [86.1%, 97.7%]                       | —                       | 13/0/187                                   | 85.0%                      |
| Upstream first                      | 13549.0             | 80.3% [75.6%, 85.6%]                       | —                       | 17/0/183                                   | 74.7%                      |
| Horn-order                          | 8237.2              | 9.6% [9.2%, 10.0%]                         | —                       | 200/0/0                                    | 9.1%                       |
| Horn-order (hindsight)              | 7963.8              | 6.0% [5.6%, 6.4%]                          | —                       | 200/0/0                                    | 5.4%                       |

Better / tie / worse count storms against most customers first; better means fewer customer-hours.

Reference: the LP floor. No schedule costs less, so each gap is at most what is shown.
Solver time per storm (not a result): LP floor median 0.16 s, max 0.58 s.

#### 4 crews

| Rule                                | Mean customer-hours | Extra over best possible, at most [95% CI] | Ties with best possible | vs most customers first (better/tie/worse) | Median storm gap (at most) |
| ----------------------------------- | ------------------- | ------------------------------------------ | ----------------------- | ------------------------------------------ | -------------------------- |
| LP floor                            | 5937.6              | —                                          | —                       | —                                          | —                          |
| Most customers first                | 8635.7              | 45.4% [42.1%, 48.9%]                       | —                       | —                                          | 38.9%                      |
| Critical facilities first           | 8775.4              | 47.8% [43.7%, 52.3%]                       | —                       | 79/0/121                                   | 41.4%                      |
| Nearest first (travel not modelled) | 11021.1             | 85.6% [80.7%, 91.1%]                       | —                       | 16/0/184                                   | 76.4%                      |
| Upstream first                      | 10357.0             | 74.4% [69.9%, 79.2%]                       | —                       | 18/0/182                                   | 69.6%                      |
| Horn-order                          | 6509.0              | 9.6% [9.2%, 10.1%]                         | —                       | 200/0/0                                    | 9.0%                       |
| Horn-order (hindsight)              | 6344.9              | 6.9% [6.4%, 7.3%]                          | —                       | 200/0/0                                    | 6.2%                       |

Better / tie / worse count storms against most customers first; better means fewer customer-hours.

Reference: the LP floor. No schedule costs less, so each gap is at most what is shown.
Solver time per storm (not a result): LP floor median 0.10 s, max 0.31 s.

## Tables: primary cell, rule against rule

Storms where the row rule costs fewer / the same / more customer-hours than the column rule.

#### 1 crew

| Rule (row) vs rule (column)            | 1         | 2         | 3         | 4         | 5         | 6        |
| -------------------------------------- | --------- | --------- | --------- | --------- | --------- | -------- |
| 1. Most customers first                | 0/200/0   | 95/66/39  | 180/2/18  | 177/9/14  | 20/108/72 | 0/32/168 |
| 2. Critical facilities first           | 39/66/95  | 0/200/0   | 166/3/31  | 149/8/43  | 23/57/120 | 0/17/183 |
| 3. Nearest first (travel not modelled) | 18/2/180  | 31/3/166  | 0/200/0   | 57/12/131 | 7/1/192   | 0/2/198  |
| 4. Upstream first                      | 14/9/177  | 43/8/149  | 131/12/57 | 0/200/0   | 5/8/187   | 0/5/195  |
| 5. Horn-order                          | 72/108/20 | 120/57/23 | 192/1/7   | 187/8/5   | 0/200/0   | 0/40/160 |
| 6. Horn-order (hindsight)              | 168/32/0  | 183/17/0  | 198/2/0   | 195/5/0   | 160/40/0  | 0/200/0  |

#### 2 crews

| Rule (row) vs rule (column)            | 1         | 2         | 3         | 4         | 5         | 6         |
| -------------------------------------- | --------- | --------- | --------- | --------- | --------- | --------- |
| 1. Most customers first                | 0/200/0   | 92/76/32  | 175/7/18  | 169/11/20 | 17/110/73 | 32/41/127 |
| 2. Critical facilities first           | 32/76/92  | 0/200/0   | 165/4/31  | 151/8/41  | 16/66/118 | 26/23/151 |
| 3. Nearest first (travel not modelled) | 18/7/175  | 31/4/165  | 0/200/0   | 44/28/128 | 7/6/187   | 5/6/189   |
| 4. Upstream first                      | 20/11/169 | 41/8/151  | 128/28/44 | 0/200/0   | 7/11/182  | 6/9/185   |
| 5. Horn-order                          | 73/110/17 | 118/66/16 | 187/6/7   | 182/11/7  | 0/200/0   | 45/52/103 |
| 6. Horn-order (hindsight)              | 127/41/32 | 151/23/26 | 189/6/5   | 185/9/6   | 103/52/45 | 0/200/0   |

#### 3 crews

| Rule (row) vs rule (column)            | 1         | 2         | 3         | 4         | 5         | 6         |
| -------------------------------------- | --------- | --------- | --------- | --------- | --------- | --------- |
| 1. Most customers first                | 0/200/0   | 72/100/28 | 171/10/19 | 164/15/21 | 20/113/67 | 58/48/94  |
| 2. Critical facilities first           | 28/100/72 | 0/200/0   | 164/7/29  | 149/11/40 | 18/85/97  | 38/36/126 |
| 3. Nearest first (travel not modelled) | 19/10/171 | 29/7/164  | 0/200/0   | 32/47/121 | 8/8/184   | 9/9/182   |
| 4. Upstream first                      | 21/15/164 | 40/11/149 | 121/47/32 | 0/200/0   | 9/15/176  | 12/13/175 |
| 5. Horn-order                          | 67/113/20 | 97/85/18  | 184/8/8   | 176/15/9  | 0/200/0   | 70/62/68  |
| 6. Horn-order (hindsight)              | 94/48/58  | 126/36/38 | 182/9/9   | 175/13/12 | 68/62/70  | 0/200/0   |

#### 4 crews

| Rule (row) vs rule (column)            | 1         | 2         | 3         | 4         | 5         | 6         |
| -------------------------------------- | --------- | --------- | --------- | --------- | --------- | --------- |
| 1. Most customers first                | 0/200/0   | 66/108/26 | 165/17/18 | 154/22/24 | 17/124/59 | 52/74/74  |
| 2. Critical facilities first           | 26/108/66 | 0/200/0   | 155/14/31 | 149/18/33 | 17/95/88  | 45/49/106 |
| 3. Nearest first (travel not modelled) | 18/17/165 | 31/14/155 | 0/200/0   | 38/65/97  | 11/14/175 | 13/16/171 |
| 4. Upstream first                      | 24/22/154 | 33/18/149 | 97/65/38  | 0/200/0   | 9/22/169  | 12/19/169 |
| 5. Horn-order                          | 59/124/17 | 88/95/17  | 175/14/11 | 169/22/9  | 0/200/0   | 69/85/46  |
| 6. Horn-order (hindsight)              | 74/74/52  | 106/49/45 | 171/16/13 | 169/19/12 | 46/85/69  | 0/200/0   |
