# Repair-order lab: pre-registration

Written before any repair-order lab code or result existed. Git history is the
timestamp. The code implements exactly these choices. The results doc reports
against them, and any deviation is listed there as a deviation.

Choices in §3 and §5 were made by Michael on 2026-09-22 from options with the
spike S2 evidence beside them. Everything else is carried over from spike S2
(`proteus-restoration-spikes/S2-repair-math/` in the Cohort 0 prep repo) so the
two can be compared.

## 1. Question

A storm damages a synthetic radial power feeder. How many more customer-hours
without power do simple repair-order rules cost than the best possible schedule,
with 1 to 4 repair crews? This is asked **inside the model only**: nothing here
says what a real utility does or should do.

## 2. The model

- **Feeder.** A random tree of buses rooted at the substation (bus 0).
  - Style is drawn uniformly from two:
    - _recursive_: each new bus hangs off a uniformly random earlier bus;
    - _lateral_: with probability 0.55 it extends the previous bus, otherwise it
      hangs off a uniformly random earlier bus.
  - Bus count: a uniform integer in [max(k+1, 12), max(k+2, 60)).
- **Customers per bus.** 0 with probability 0.25, otherwise
  max(1, round(exp(N(2.5, 1.2)))). The substation has none.
- **Damage.** k segments are broken (segment v is the line into bus v). k is a
  uniform integer in the cell's range. The broken buses are drawn without
  replacement from 1…n−1.
- **Critical facilities.** Two buses are drawn without replacement from 1…n−1,
  independently of the damage. A broken segment is _on a critical path_ if it
  lies between a critical bus and the substation.
- **Repair times.** Counted in 15-minute ticks: round(exp(ln 6 + σ·z)) with
  z ~ N(0, 1), clipped to 1–16 ticks (15 min to 4 h). The median is 1.5 h.
- **Crews.**
  - Crews are identical and all start at tick 0.
  - A crew never idles while any repair is still unassigned.
  - There is no travel time.
  - A crew does one repair at a time and finishes it once started.
- **Soft precedence.** A crew may repair a segment while one upstream of it is
  still broken. Customers come back only when every broken segment between them
  and the substation is repaired.
- **Objective.** Customer-hours without power: the sum of customers × hours
  until their power is back.
- The instance generator is spike S2's `make_instance`, ported to TypeScript,
  and every result is conditional on it. For k = 50 the feeder has only 51–59
  buses, so nearly every line is down. That is a property of this generator, not
  of real storms.

## 3. The rules, exactly

Whenever a crew is free, it takes one segment that no crew has started. If
several crews are free at once, the lowest-numbered crew chooses first.

1. **Most customers first**, read as _"who comes back now"_. This is the number
   of customers who would regain power the moment this repair finishes, counting
   every repair already under way as finished.
   - Tie-breaks, in order: most customers downstream in total, then nearest the
     substation (fewest hops), then the lowest segment index.
2. **Critical facilities first.** Pick among unstarted segments on a critical
   path.
   - Tie-breaks, in order: nearest the substation, then most customers
     downstream, then the lowest index.
   - Once none are left, the crew uses rule 1.
3. **Nearest first (travel not modelled).**
   - Pick the segment with the fewest feeder hops from the crew's last repair.
     The substation counts as the crew's position at the start.
   - Tie-breaks, in order: nearest the substation, then the lowest index.
   - Travel time is not modelled. Distance only sets the order.
4. **Upstream first.**
   - Pick the segment nearest the substation.
   - Tie-breaks, in order: most customers downstream, then the lowest index.
5. **Horn-order.**
   - Horn's one-crew order is computed as if every repair took the median 1.5 h.
     Each free crew takes the next repair on that list.
   - It uses no information about repair times.
6. **Horn-order (hindsight).**
   - The same list, but computed from the true repair times.
   - No dispatcher could know these, so it is labelled hindsight wherever it
     appears. The gap between rules 5 and 6 is what knowing repair times would
     be worth.

The rules use repair times only as stated above. Every schedule is then played
out with the true repair times.

## 4. The reference ("best possible")

Every reference is **hindsight: it knows the true repair times.**

- **1 crew.** Horn's algorithm (Horn 1972) on the true repair times. This is the
  exact optimum, and the tests check it against brute force over every order.
- **2–4 crews, cells with k ≤ 12.**
  - Solver: the time-indexed MILP (one yes/no variable per segment per start
    tick, with soft precedence), solved by HiGHS through scipy 1.18.0.
  - Settings: HiGHS's default relative gap of 1e-4, and a 60 s limit per storm.
  - If HiGHS proves the solution, the reference is the cheapest of the MILP's
    schedule and every rule's schedule, since all of them are feasible. This
    stays within the proven gap.
  - If it does not prove it, the reference is the LP floor.
- **2–4 crews, cells with k = 20 and k = 50.** Only the LP floor of the same
  time-indexed formulation (drop-order item 1 in the plan).
- A gap measured against the LP floor is an upper bound on the gap to the best
  possible. It is always worded "at most X% above".

## 5. Cells, storms and seeds

| Cell          | k    | σ   | Role        |
| ------------- | ---- | --- | ----------- |
| primary       | 6–12 | 0.6 | headline    |
| equal times   | 6–12 | 0   | sensitivity |
| wide spread   | 6–12 | 1.0 | sensitivity |
| twenty breaks | 20   | 0.6 | sensitivity |
| fifty breaks  | 50   | 0.6 | sensitivity |

- **Crews:** 1, 2, 3 and 4 in every cell.
- **Storms:** 200 per cell, with run seeds `restoration-lab/storm-0` …
  `restoration-lab/storm-199`.
  - The seeds are shared by every rule and every crew count, so each comparison
    is paired storm by storm.
  - Across the three k 6–12 cells, a seed draws the same feeder, damage,
    customers and z-values. Only σ differs.

## 6. Statistics

- **Headline, per rule.** Extra customer-hours over the reference, as
  (Σ rule − Σ reference) ÷ Σ reference across the 200 storms.
  - It comes with a 95% percentile bootstrap that resamples storms: 2,000
    resamples, seed `restoration-lab/<cell>/<crews>/<rule>`.
- **Ties with the reference.** Storms where the rule's customer-ticks equal the
  reference's. Both are whole numbers. Ties are counted only against an exact
  reference, never against the LP floor.
- **Better / tie / worse, per storm.**
  - Every rule against most customers first.
  - The same split for every pair of rules, primary cell in the results doc,
    every cell in the results file.
- **Secondary, descriptive only.** The median per-storm gap, with 0 ÷ 0 counted
  as 0. It is there to line up with spike S2's medians.
- Every number is a customer-hour figure or a share of one. Solver time is
  reported beside the results and is not a result.

## 7. What can and cannot be concluded

- **Can:** statements inside the model about these six rules, on feeders from
  this generator, at these k and σ.
- **Cannot:**
  - which order any real utility uses, or should use;
  - "optimal" for 2–4 crews, except on storms HiGHS proved within its 1e-4 gap;
  - that Horn-order is best beyond 2–3 crews;
  - anything about travel, switching, crew arrival or power flow, none of which
    is modelled.
- **Evidence class:** (b) local runs on synthetic feeders. Nothing here is
  live-verified or checked against real outage data. That is Phase 2's job.

## 8. Checkpoint 1

- Tables for every cell and crew count.
- The test suite.
- One worked schedule for Michael to check by hand: the first storm (lowest seed
  index) in the primary cell with k = 6, at 2 crews. It shows most customers
  first beside the reference, with every start, finish and restoration tick
  printed.
