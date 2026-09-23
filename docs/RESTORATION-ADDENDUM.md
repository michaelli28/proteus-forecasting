# Real-storm check: Phase 4 addendum

Dated 2026-09-23. Written after the amended Checkpoint 3 passed
(`docs/RESTORATION-CHECK-RESULTS.md`, "Checkpoint 3, amended"). The check has not
yet read any held-out value.

**What was known of 2022–25 when this was written:**

- the 3 MB head of the 2024 file read in research before the protocol
  (protocol §3). Its
  four counties are dropped as `seen`;
- protocol §3's schema read: headers and county codes;
- Checkpoint 2's output. That is per-storm and per-step counts, and per-file loader
  stats, which include the explicit-zero counts this file's §6 responds to. The counts
  file also breaks each storm's drops down by reason.

Every number below comes from training data, except two, each marked where used:
held-out Y and the held-out coverage drop rate, both Checkpoint 2 counts.

Protocol §3 and §10 require this file before Phase 4 unseals anything.

**How the gate uses this file:**

- it reads §1's hashes and the code commit below from the commit passed as
  `--addendum`;
- that commit must contain this file and be an ancestor of HEAD;
- the one run passes the commit that adds this file, and `unseal.log` records
  which commit was used;
- any later edit to this file is a dated deviation.

**Code commit:** `14dd44e77bdb47d9ae85d172deea558cbda0a7f4`

**In plain English.** Before the sealed 2022–25 storms are opened, this file
freezes three things:

- exactly which fitted model they are tested against;
- the code that tests them. The gate refuses to run if that code has changed;
- the test's settings and seeds.

It is the last thing written before the answer is known. Everything the protocol
left open is decided here.

## 1. The files the check runs on

- **The four `phase3-amended/` files** were written at commit `7a71a8b`.
  `phase3-amended/runs.log` records each one with no deviation.
- **`train-events.csv`** is Checkpoint 2's training output, written earlier at
  `51b3dd4`. Every Phase 3 file records its hash, and the zero-format run at
  `062740e` reproduced it byte for byte (§6).
- Paths are relative to `engine/.cache/restoration-check/`.

| File                            | SHA-256                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| `train-events.csv`              | `f70774206170031585203cf0f2d6abdfe202ab85607ebbae9ca33e0524b62353` |
| `phase3-amended/selection.json` | `d7e5a89ef1a91f204bcf52618c77834f9d288910a9e656b98229b5e3f99ce5da` |
| `phase3-amended/spread.json`    | `b9bb502120566769db848deb3e5aa7c38b6792b40596fc0b50aed5053b211e0d` |
| `phase3-amended/shrinkage.json` | `bc8922419f4bb8ec5db97f195f9f0fa321d790f33dd59071fb8ad4e2591e31d2` |
| `phase3-amended/loo.json`       | `43e03f983f315fa35895de9a95798cc807673cc7889a3963d740b53dc59ebc06` |

The gate also requires the null's computed `go` in `loo.json`, which is `true`,
computed on these same files.

## 2. The fitted model

These values are read from the files in §1, and nothing here changes them.

- **The structural cell** (§16.5):
  - crews √6 × ¼ per 10k customers;
  - repair-time Weibull shape 0.6;
  - county size max(MCC, p₁).
  - It is a fitting choice, not an estimate of crews or shape (§13).
  - Both crews and shape sit at the grid's lowest value (§16.5). At ¼, the three
    shapes score within 0.002 of each other, so shape is not really chosen.
- **The minimum county size is 3,000** customers out at the peak. Smaller
  county-events are pooled within their storm (§16.3).
- **Two other values:**
  - the undercount share s is 0.2755. It is unused under this cell's sizing;
  - the peak share is 0.362.
- **The spreads** (§16.1) are on (log W, delay in hours) for the simulator and on
  (log τ, delay) for the exponential baseline. Each world draws a storm effect
  η ~ N(μ, B), and each county adds its own scatter ~ N(0, C):

  | Model       | μ              | B (between storms)             | C (within a storm)              |
  | ----------- | -------------- | ------------------------------ | ------------------------------- |
  | Simulator   | (0.083, 9.33)  | [[0.545, 1.868], [1.868, 9.41]] | [[2.90, 4.76], [4.76, 206.1]]   |
  | Exponential | (1.294, 9.68)  | [[1.151, 3.351], [3.351, 13.75]] | [[2.43, 11.01], [11.01, 262.0]] |

## 3. The items §10 leaves to this file

- **Feeder build** (`engine/python/eaglei/county_sim.py`, unchanged from spike S3):
  - A county is F = max(1, round(size ÷ 1,020)) radial feeders of 60 sections.
  - Section i hangs off section i − Geometric(0.35), clipped at the root.
  - Customers per section are max(1, round(LogNormal(ln 17 − 0.32, 0.8))).
  - **Damage:**
    - each section draws U ~ Uniform(0, 1) and is broken when U ≤ q;
    - a section's customers are out when any section on its path to the
      substation is broken;
    - q is the smallest level at which the customers out reach p₁, capped at
      the whole county.
    - So a world's peak is at least p₁.
  - **Crews:** max(1, round(crews per 10k × the world's simulated customers ÷
    10,000)). They are counted per world, not from the county's size.
- **Repair rule:**
  - identical crews work one static list, most customers first, where a
    section's priority is its downstream customer count, with a random
    tie-break;
  - there is no travel;
  - a customer is back when every broken section on its path is repaired.
- **ABC prior:** §16.1, unchanged.
  - The simulator uses log W ∈ [ln 0.01, ln 100]. The exponential baseline
    uses log τ ∈ [ln 0.1, ln 1000].
  - Delay ∈ [0, 72] h for both.
  - 100,000 draws; the 500 nearest by §16.2's distance are kept.
- **Seeds.**
  - **Python streams.** Every one is NumPy's `default_rng`, seeded with the
    first 8 bytes, read big-endian, of the SHA-256 of a label, as in Phase 3.
  - **TypeScript streams.** The two storm-resampled flag-rate intervals, §11's
    headline and the +12 h rate, run in the engine's `stratifiedBootstrap`. Its
    `Rng` (cyrb128 into sfc32, `engine/src/sim/rng.ts`) is seeded with the label
    string itself.
  - **Where labels start.** Phase 4's labels start `restoration-phase4/`, and
    §4 and §5 list them. The training rehearsal uses the held-out labels with
    `rehearsal-train` in place of `held-out`.
  - **The headline's seed.** §11's headline interval keeps its own,
    `restoration-protocol/county-event-rate`.
  - **Labels that are prefixes.** A θ label below is a prefix. `fit.world_draws`
    seeds the storm effect η with `<prefix>/storm` and each county's scatter
    with `<prefix>/<county>`. When η is fixed, the `/storm` draw is skipped.
  - **The placeholders:**
    - `<model>` is `sim` or `exp`;
    - `<storm>` is the FEMA incident id;
    - `<county>` is the 5-digit county code;
    - `<arm>` is the arm's name exactly as in `arms.ARMS`;
    - `<group>` is `inside`, `outside` or `pooled`.
  - **Reuse is deliberate.** All 14 arms share their truth labels, so the arms
    are paired. The simulator and the baseline share each rate interval's seed,
    so both are resampled on the same storm draws. No other label repeats.
- **Exponential baseline:**
  - out(t) = p₁ until the delay, then p₁·exp(−(t − delay) ÷ τ);
  - its milestones and reads come from the same grid rules as the simulator's.
- **Brier conditioning** _(Michael, 2026-09-23: "nearest worlds")_:
  - **The forecast.** It is issued at peak + 12 h. It is the share, among the
    county's own simulated worlds, whose t95 ≤ 72 h. Only the nearest worlds
    count: the 10% of the storm's N worlds, and at least 100, whose reads at
    +3, +6, +9 and +12 h lie closest to the real reads by Euclidean distance.
    Ties keep world order.
  - **The exponential baseline** is conditioned the same way, on its own worlds.
  - **The base rate** is 0.648: 363 of the 560 training county-events with
    c ≥ peak + 73 h 45 min reached t95 by 72 h.
  - **Which events are scored.** Every held-out county-event, with pooled
    members scored one by one (§16.3). An event is left out if
    c < peak + 73 h 45 min, or if any of its four +12 h reads is missing,
    since it then has nothing to condition on.
  - **The outcome** is the real t95 ≤ 72 h.

## 4. The held-out check, as coded (`engine/python/eaglei/held_out.py`)

- **The one run.** `held_out --addendum <this file's commit>` runs once.
  - **Before the gate**, in this order:
    - **The commit check.** The run refuses while any of these has
      uncommitted edits: the protocol, `engine/python/eaglei`, or the two
      TypeScript files that compute the headline interval
      (`engine/src/metrics/bootstrap.ts`, `engine/src/sim/rng.ts`).
    - **The rehearsal.** It refuses unless `held_out --rehearse` has run from
      the same clean HEAD.
      - The rehearsal runs every step of the check itself on training storms,
        the TypeScript call included.
      - It does not run the MD5 check, the gate, the log or the comparison
        with Checkpoint 2's counts. `test_unseal.py` covers the gate on
        synthetic repositories.
    - **The files.** It refuses unless the four held-out outage files and
      `MCC.csv` match protocol §2's MD5s. Hashing a file is not reading it
      (§3).
  - **The gate** (`unseal.py`) checks five things:
    - that commit is an ancestor of HEAD and contains this file;
    - the code commit named above is an ancestor of HEAD. The protocol,
      `engine/python/eaglei` and the two TypeScript files must be identical to
      it at HEAD;
    - the five hashes in §1 match the files on disk;
    - `loo.json` records those same spread, shrinkage, selection and training
      hashes, so its go belongs to these files;
    - `loo.json` says go.
  - **The log.** The gate then appends (UTC time, addendum commit, HEAD) to
    `engine/.cache/eaglei/unseal.log`. That happens before any held-out value
    is read.
  - **A second run** needs `--deviation`, and so does a second unseal.
    - A rerun never replaces the first result. The first file is kept, named
      by the hash `runs.log` already records, and both are reported (§16.8).
    - The per-storm lines the run prints while it works are captured with
      `tee` to `phase4/held-out.stdout`. The same values are in
      `held-out.json`, which is the record.
- **Events.**
  - The run applies Checkpoint 2's held-out chain again, in memory, and keeps
    each kept event's bridged series.
  - It stops before any check if its per-storm kept counts or its per-file
    loader stats differ from Checkpoint 2's `held_out-counts.json`.
  - Sizes follow the cell: max(MCC, p₁).
- **Looks** (§11, §16.3):
  - **County looks:** one per county-event with p₁ ≥ 3,000.
  - **The pooled look:** one per storm, over the rest. Its vector is the
    p₁-weighted mean of the members' own features.
  - **Hindsight:** (t50, t90, t95).
  - **The look at L = 12, 24 and 48 h** reads the share of the curve's own peak
    still out at L/4, L/2, 3L/4 and L. For a real curve that peak is p₁; for a
    world it is the world's own simulated peak.
    - Each read is h (§7.4). On a simulated curve, which only falls, h is its
      value 45 min later.
    - This is how this file reads §11's "share of p₁" for a world. A world's
      peak is at least p₁ (§3's damage rule). Each curve is therefore divided
      by its own peak, so the real curve and its worlds go through the same
      function.
  - **Exclusion.** A member is left out of the look at L when
    c < peak + L h 45 min, or when any of its four real reads is missing. A
    pooled look with no member left is left out.
  - **Simulated worlds** use exactly the members the real look kept, so the
    real curve and its worlds go through the same function.
- **Ensembles.**
  - Each storm and model gets one ensemble of N worlds under §16.1.
  - N follows §11's rule, with m the largest of three counts: the hindsight
    looks, the +12 h looks, and all looks at 12, 24 and 48 h together.
  - Seeds:
    - θ: `restoration-phase4/held-out/theta/<model>/<storm>`;
    - unit worlds: `restoration-phase4/held-out/worlds/<storm>/<county>`.
- **Primary result and headline** (§9, §11):
  - The code applies §9's branch by the Y it computes.
    - Y ≥ 10: X of Y, with its exact one-sided binomial test.
    - Y < 10: the county-event rate rule.
    - Held-out Y = 9 (a Checkpoint 2 count), so the headline is the
      county-event flag rate over every hindsight look.
  - Its interval is the engine's `stratifiedBootstrap`, run in TypeScript by
    `ts_bootstrap.ts`, with:
    - one item per storm, in one stratum;
    - 2,000 resamples;
    - seed `restoration-protocol/county-event-rate`.
  - The model is rejected when the whole interval lies above 5%.
  - Also printed:
    - X of Y storms flagged, with its Clopper–Pearson interval;
    - flags among all storms with a county-event.
- **Secondary results** (§11):
  - **The +12 h check:** storm flags, and its look flag rate with the same
    bootstrap (seed `restoration-phase4/held-out/L12-rate`).
  - **The multi-look check:** min-p across the looks at 12, 24 and 48 h, as
    storm flags.
  - **Who counts in these two storm counts.** Both are over the storms with at
    least one look at that check, not over Y. Each count prints its own
    denominator.
  - **The exponential baseline:** through every check above.
  - **The Brier table** (§3 above): Brier scores for the simulator, the
    baseline and the base rate. The simulator's differences from the other two
    come with storm-resampled 95% intervals. So does the share of scored
    events whose t95 ≤ 72 h:
    - 2,000 resamples;
    - seeds `restoration-phase4/held-out/brier/exp`, `…/brier/base` and
      `…/brier/outcome`.
  - **A storm-level histogram** of hindsight p-values in 5 bins. It is
    descriptive only.
- **Keeping it defensive.** The results file holds per-county p-values in the
  git-ignored cache. The results doc publishes counts, rates and storm-level
  results only.

## 5. The synthetic arms, as coded (`engine/python/eaglei/arms.py`)

§12 as amended by §16.7, on training-storm inputs only, with the simulator's
full training spread.

- **Replicates.**
  - Each arm runs 1,000 storm-level replicates. Replicate r takes training
    storm r mod 18, in id order, so each storm gets 55 or 56 replicates.
  - A replicate simulates one "truth" per county-event of that storm, with the
    storm's real sizes, p₁, cut c and pooling. It then runs the hindsight
    check.
- **The ensemble.**
  - It is drawn once per storm: N worlds by §11's rule on its hindsight looks,
    as in the Phase 3 null.
  - Every replicate of that storm is ranked against it.
    - Each replicate's p is valid, because truth and worlds are independent
      draws of one model under the null. A replicate flags with probability at
      most 5%, a little less where ties occur, since ties count against the
      alarm.
    - The replicates of one storm share the ensemble, so their flags are not
      independent.
    - The storm-flag rates carry Wilson intervals, which ignore that sharing.
      They are too narrow, by an amount this run does not measure. δ\*, which
      §12 defines by the Wilson bound, inherits this and may be optimistic.
    - The look-flag rates and the delay split carry intervals from resampling
      whole training storms (2,000 resamples), which does carry it. Seeds:
      `restoration-phase4/arms/look-rate/<arm>` and
      `…/delay-split/<arm>/<group>`.
  - Seeds: `restoration-phase4/arms/ensemble-theta/<storm>` and
    `…/ensemble-worlds/<storm>/<county>`.
- **Truths, and how the arms are paired.**
  - Every arm uses the same draws: the storm effects and county scatter from
    `restoration-phase4/arms/truth-theta/<storm>`, and the unit worlds from
    `…/truth-worlds/<storm>/<county>`.
  - The planted errors draw from `…/truth-worlds/<storm>/<county>/extra`,
    which never touches the other streams. Only the planted change differs
    between arms.
- **The arms:**
  - **Null:** the storm effect η is drawn from N(μ, B). This is a code test.
  - **Fixed settings:** η is fixed and each county still draws its scatter.
    - centre: (0.083, 9.33);
    - fast corner, at the 2.5% quantile of both: (−1.364, 3.32);
    - slow corner, at the 97.5% quantile of both: (1.530, 15.34).
  - **Prolonged small failures, p = 2%, 5% and 10%:** each out node, with
    probability p, gets +Exponential(mean 72 h) on its own restore time.
    - An out node is any node whose customers are out at the peak. That
      includes undamaged nodes cut off upstream.
    - The added time is not passed on to downstream nodes.
    - The doses are nested: the same draws at every p.
  - **Heavier tail, σ = 0.5, 1.0 and 1.5:** each section's repair time is
    multiplied by exp(σz − σ²/2), with z ~ N(0, 1), before crews are
    scheduled.
  - **Delay shift, +12, +24 and +48 h:** the shift is added to each county's
    delay after the clip at 0.
    - County-look flags are split by whether that shifted delay lies in
      N(μ, B + C)'s 2.5–97.5% delay range, [−19.4, 38.1] h.
    - The pooled look is reported apart.
  - **Blind spot:** the truth repairs critical facilities first, using Phase
    1's definition (`RESTORATION-LAB-PREREG.md` §2–3) as a static list.
    - Each feeder has two critical nodes, drawn without replacement from all
      60 sections. Section 0 is the feeder's first section, not the
      substation, which matches Phase 1's buses 1…n−1.
    - There is one list per county. Sections on the path from a critical node
      to the substation go first: nearest the substation first, then most
      customers downstream.
    - Then comes a random tie-break, the same draw as most customers first,
      where Phase 1 uses the lowest index. Tied sections almost always sit on
      different feeders, which are drawn independently.
    - Rule 2's order never changes during a storm, so the static list gives
      the same order as Phase 1's choice each time a crew is free.
    - The remaining sections follow the simulator's static downstream-count
      list, not Phase 1's "who comes back now".
    - It is paired with the null arm. The report gives the paired difference
      in storm-flag rate and McNemar's exact `binomtest(b, b + c, 0.5)`.
      McNemar is §12's inference for that difference, so it carries no
      separate interval.
- **δ\*** is the smallest dose whose Wilson 95% lower bound on storm-level power
  is above 50%, or "> largest dose".
- **The design effect** (§13) is computed from the null arm, so it is the
  model's, not the held-out storms':
  - ρ is the one-way ANOVA intraclass correlation of look flags within a
    replicate;
  - the design effect is 1 + (n_w − 1)ρ. Here n_w = Σn² ÷ Σn is the
    size-weighted number of looks, the variance inflation of a pooled
    flags-over-looks rate over storms of unequal size.
- **Only the simulator** runs the arms. The exponential baseline has no arms.

## 6. The zero-format bound (§16.7, report-only)

- **Where it ran:** at `062740e`, on training data only. The output is
  `phase4/zero-bound.json`, SHA-256 `d2d85b96fe0186123288e9e9707648dd022260a8bc1980d400503e773797b899`.
- **The worst case.** Every training county's absent rows count as missing,
  which is how §6 treats counties that store zeros. The unchanged rule first
  reproduced `train-events.csv` byte for byte, so the comparison isolates this
  one rule.
- **Milestones barely move.** Of the 640 kept training events, 286 stay kept.
  Among those, t50, t90 and t95 are unchanged for 273 of 276, 250 of 253 and
  240 of 243 events that reach them. None becomes censored.
- **Events drop instead.** The other 354 drop out, mostly for `coverage`:
  - `coverage` 323;
  - `resurge` 17;
  - `left_censored` 14.
- **The drops select for slow events.** An event that falls back to zero has
  absent rows to lose, so the fast ones drop.

  | Training events under the worst case | Count | Median t50 / t90 / t95 (h) | t95 not reached |
  | ------------------------------------ | ----- | -------------------------- | --------------- |
  | Still kept                           | 286   | 27.0 / 72.75 / 83.75       | 15%             |
  | Dropped                              | 354   | 5.62 / 15.0 / 21.62        | 0.3%            |

- **What it means for Phase 4.**
  - The held-out files' explicit zeros are unlikely to delay the milestones of
    events that survive.
  - Through which events drop, they could make the surviving held-out events
    slower than training's.
  - The net effect on the flag rate is not known. The check flags curves that
    are atypical in either direction (§13). The model's worlds already leave
    t95 unreached more often than real counties do: 28% against 11%, for
    p₁ ≥ 5k at Checkpoint 3. So a slower sample could raise the flag rate or lower it.
  - This is a worst case. Counties that store zeros have their real zeros as
    rows, so only uncollected slots go missing. The held-out `coverage` drop
    rate was 9.6%, against 2.4% in training (a Checkpoint 2 count).
  - It changes no rule. The write-up carries it as a caveat on the result,
    whether or not the model is rejected.

## 7. Known limits carried into Phase 4

- **The arms test the hindsight check only.** The +12 h, multi-look and Brier
  results have no synthetic power arm.
- **The training rehearsal is a code test, not a result.** `held_out --rehearse`
  runs the same code on training storms, in sample.
- **§16.9's limits stand:**
  - first-hour milestones;
  - the outcome-dependent cut;
  - B from 18 storms;
  - a minimum-size check that is close to automatic (§16.4).
- **Where held-out flags are expected, named before unsealing.**
  - In the training null, over-MCC county looks flagged at 9 of 89 = 10.1%,
    against 5 of 384 = 1.3% for all other looks.
  - Each of the two flagged training storms was flagged through one over-MCC
    county.
  - Held-out flags from over-MCC counties are therefore expected, and the
    results report that split.
- **A pass would not show the curve shape is right.** Simulated curves are still
  steeper than real ones.
- **The gate is one-sided.** A spread too wide cannot fail it, so a pass reads
  as "not detectably miscalibrated".
- **Run order.** The arms run from the same commit as the held-out check, and
  they finish before it unseals anything. So no arm result can depend on the
  held-out answer.
- **The zero-format caveat applies to the held-out results.** §6 above bounds
  it on training data only.
