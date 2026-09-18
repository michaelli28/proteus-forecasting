# Misspecification check: pre-registration

Written before any dev-seed result was looked at. The values in §4 are filled
in by the rules in §3, from the dev run alone, and committed before the
confirmatory run on `proteus-v1` starts. Git history is the timestamp.

## 1. Question

The abstention gate flagged 0 of 80 questions whose prior was deliberately
wrong. Does a rank-based prior-predictive check on early telemetry flag them,
how early, and at what false-alarm rate when the prior is right?

## 2. Fixed design (not tuned)

- **Worlds.** The benchmark's own world, quantity and partition: `adoptionRate`
  at tick 119, range [0.35, 0.65], 4 bands, the 400-agent reference config.
- **Draws.** N = 256 independent draws from each question's prior box, made by
  the same `drawFromBox` as the truth (same uniforms, same `toFixed(2)`),
  seeds `<rootSeed>/check-draw/<i>`, simulated under run seed
  `<rootSeed>/check::draw-<i>`.
- **Statistic.** Squared Mahalanobis distance of every member of truth + draws
  from the pooled mean, covariance shrunk 10% toward its diagonal, per-channel
  ridge. p = share of members scoring at least the truth. Alarm iff p ≤ 0.05.
  With N = 256 the exact false-alarm rate under a right prior is
  ⌊0.05·257⌋/257 = 12/257 = 4.67% (lower when scores tie), averaged over the
  prior, not for a fixed θ.
- **Any-look alarm.** Min-p over looks {20, 40, 60, 80}, every member's min-p
  ranked (`minPCombined`). Secondary to the primary t0.
- **Negative control.** t0 = 9 on every arm. No campaign starts before tick 10,
  so it must alarm at chance even when the prior is wrong.
- **Dose–response.** The benchmark's misspecified root seeds 1–80. Truth drawn
  from the prior box shifted by δ ∈ {0, 3, 6, 12, 24, 30} in both parameters
  (capped at 95 as the benchmark caps it), with the same truth-draw seed and
  the same simulation seed at every δ. δ = 30 is exactly the benchmark's
  misspecified truth (the data script asserts it). δ = 0 is the false-alarm arm.
- **Cost of being wrong.** The pipeline's shipped forecast (32-run sweep,
  Laplace α = 1) scored against each δ's truth, one-vs-rest Brier as the
  benchmark scores it; unresolved truths reported, not scored.
- **Blind spot.** δ = 0 parameters and seed, but the truth counts adoption at a
  different threshold. Telemetry is byte-identical, so the prediction is that
  its p-values equal δ = 0's on every question and power equals the false-alarm
  rate, while the forecast's Brier gets worse.
- **Uniformity.** Rank histogram (p in tenths, χ², df 9) on the well-specified
  narrow, medium and wide-control arms (80 each) and on δ = 0.
- **Reweighting.** Gaussian kernel on the squared Mahalanobis distance to the
  truth at the primary t0, forecast p_k = (ESS·W̃_k + 1)/(ESS + 4), compared
  with equal weights on the SAME 256 draws. A Brier gain is claimed only where
  the question-bootstrap 95% CI of the paired difference excludes 0.
  Reweighting cannot put probability outside the prior box; under a wrong
  prior the right action is to abstain, not to reweight.

## 3. Selection rules, applied to the dev seed `proteus-dev` only

Dev: 40 of the misspecified-arm root seeds from `benchmarkQuestions(40, "proteus-dev")`.
They share the benchmark's four prior-box centres with `proteus-v1`; only the
randomness differs.

1. **Channels and primary t0.** Over {all four channels, burstiness + surge
   ratio} × t0 ∈ {20, 30, 40, 50, 60, 80, 100}, pick the pair with the highest
   power averaged over δ ∈ {6, 12, 24, 30}. Ties go to the earlier t0, then to
   fewer channels.
2. **Bandwidth h.** From {0.5, 1, 2, 4, 8}, the one with the lowest mean
   weighted Brier on dev δ = 0.
3. **Blind-spot threshold.** From {0.5, 0.55, 0.65, 0.7}, the one with the
   largest Brier damage to the pipeline forecast among those leaving at most
   10% of dev truths unresolved.

## 4. Chosen values

Filled in from the dev run in the next commit.
