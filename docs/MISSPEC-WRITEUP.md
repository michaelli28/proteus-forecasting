# The model is wrong, and now it knows

## 🧑 In Plain English

**What this does:** Proteus forecasts by simulating a world many times under
assumptions about an attacker. When those assumptions were deliberately wrong,
its "I'm not sure" rule never fired. A new check compares the first 30 of 120
steps of activity with what the forecaster expected, and flags a wrong
assumption long before the answer is known.

**Why it matters:** the check needs no labeled examples, and its false-alarm
rate is fixed in advance by a counting argument. That is the same problem an AI
agent faces when deciding whether to stop and ask: is my picture of this task wrong?

**Where it fails:** it cannot see a mistake that leaves the activity data
unchanged, and in one of four scenarios it misses most errors. Both are
measured below.

Everything here is a local run on a simulated world. None of it is real-world
forecasting skill.

## The problem

On the benchmark's 80 questions with a deliberately wrong starting assumption
(the `misspecified` arm), the abstention gate declined 0. The shipped forecast
scored Brier skill −0.456 [−0.574, −0.323] against a flat guess, on the 73
questions whose outcome landed inside the partition. The other 7 landed just
above the top band (0.655–0.708) and cannot be scored. The gate cannot see this
failure by design: it judges how the ensemble spreads, and a wrong prior gives a
tight, confident ensemble.

## The check

Draw N = 256 worlds from the prior the forecaster assumed, exactly as the
benchmark draws its truth. Compute each member's telemetry signature (burstiness
and surge ratio) from ticks 0..t0 only. Score every member, truth included,
by squared Mahalanobis distance from the pooled mean under a shrunk pooled
covariance, and let p be the share of members scoring at least the truth's.

- **Why the false-alarm rate is bounded.** If the truth really came from the
  prior, the 257 members are exchangeable and any statistic computed
  symmetrically from all of them has a uniformly distributed rank. So P(p ≤ α)
  ≤ ⌊α(N+1)⌋/(N+1) = 12/257 = 4.67%. Ties only lower it.
- **What the bound does not say.** It holds on average over the prior, not for a
  fixed true setting, and it says nothing about power. A truth whose
  escalation sits near the edge of its range may alarm more often
  (exploratory, one of two splits tried: 7/60 = 11.7% vs 13/260 = 5.0%,
  p ≈ 0.07; by overall position in the box, the outermost tenth alarms
  3/56 = 5.4%).
- **No peeking.** `signaturesUpTo(result, t0)` reads telemetry events up to t0
  and nothing else. A test shows that tampering with any later event changes
  nothing.
- **Negative control.** No campaign starts before tick 10, so at t0 = 9 the
  check must alarm at chance even when the prior is wrong. It alarmed on 2/80
  at every shift.

The settings (channels, t0 = 30, bandwidth, blind-spot threshold) were chosen on
a separate dev seed by rules committed first. `MISSPEC-PREREG.md` §5 discloses
where that fell short: the two-channel candidate came from a pilot on 20 of the
headline questions. On the 60 questions the pilot never touched, the headline
holds: 53/60.

## Results (pre-registered, `MISSPEC-RESULTS.md`)

| Prior off by δ           | Gate declined | Check flagged at t0 = 30 | Forecast skill |
| ------------------------ | ------------- | ------------------------ | -------------- |
| 0 (right)                | 0/80          | 7/80                     | 0.48           |
| 3                        | 0/80          | 9/80                     | 0.44           |
| 6                        | 0/80          | 16/80                    | 0.38           |
| 12                       | 0/80          | 41/80 [40%, 62%]         | 0.22           |
| 24                       | 0/80          | 62/80                    | −0.19          |
| 30 (the benchmark's arm) | 0/80          | **69/80 [77%, 92%]**     | −0.46          |

- **Paired headline:** on the same 80 questions the gate flagged 0 and the check
  flagged 69 (exact McNemar p = 3.4e-21), 89 ticks before resolution.
- **False alarms with the right prior:** 20/320 = 6.3% [4%, 9%], consistent
  with the 4.67% bound. The rank histograms are flat (pooled χ² = 4.4 against a
  5% critical value of 16.9).

## Where it fails

1. **Mistakes the data cannot show.** The truth counts adoption at 0.65, not
   0.6. That changes what is counted, never how beliefs move, so the telemetry
   is byte-identical. The check's p-values equal the right-prior ones on all
   80 questions (7/80 flagged), while the forecast's skill falls to −0.30.
2. **One of four scenarios.** In the prior box centred at (25, 30) the check
   flagged 1/20 at δ = 12, 2/20 at δ = 24 and 9/20 at δ = 30, against 20/20 in
   the other three boxes at δ = 24 and 30. ASSUMED mechanism: that box's
   campaigns start around ticks 29–33, about when the check looks.
3. **Stated power is pooled over four boxes.** It does not transfer to other
   kinds of wrongness.

## It flagged. Now what?

Abstaining is priced against a flat 1/4 fallback. When the prior is right the
check answers 91% of questions, costing +0.008 Brier per question. At δ = 24 and
30 it saves 0.040 and 0.064. At δ = 12 abstaining costs slightly (+0.005),
because a moderately wrong forecast still beats a flat guess.

Chow's rule on the shipped forecast is blind to a wrong prior by construction,
because that forecast ignores the early data. Chow on the telemetry-weighted
forecast does about as well as the check (post-hoc). But its threshold had to
be picked after seeing the data, and the check's false-alarm rate did not.

Reweighting the prior draws by early telemetry cannot put probability outside
the prior box. Under a badly wrong prior the weights collapse to about one world
(ESS 1.2), and the forecast still loses to a flat guess. A flag is a reason to
abstain, not a fix.

## Other flaws found and fixed along the way

- **Reversed evidence.** Indicators printed "favours h2 (LR 0.31)", which is
  evidence against h2. Mechanical indicators now report the complementary event;
  model-written ones below 1 print "weighs against".
- **Claims the code did not support.** "Detection precision is measured" was
  false in five places; `detectCampaign` runs only in a unit test.
- **Defense rankings.** Six seeds ranked by median, and ties were counted as
  losses ("worse in 3 of 6" was 3 wins, 2 ties, 1 loss). With 200 shared seeds
  the published order was wrong where the data can tell. Against the attackers
  the page now uses, 11 of 12 defenses lower average harm by more than chance
  (not port's alerts against the criminal syndicate); against the old ones all
  12 did. See `MITIGATION-RERUN.md`.

## What this does not claim

- Real-world forecasting skill, or "calibrated" without "by construction".
- ≤ 5% false alarms for any fixed setting, or when the model is wrong.
- Power beyond the two kinds of wrongness tested (a shifted prior, a changed
  adoption threshold).
- That detection precision was measured, or that a flag fixes the forecast.

## Reproduce

- Tests: `cd engine && npx vitest run`
- Check data and report: the commands in `MISSPEC-RESULTS.md` (about 10 minutes)
- Benchmark with intervals: `cd engine && PROTEUS_BENCH=1 npx vitest run tests/benchmark/calibration`
- Defense rankings: `cd engine && DOTENV_CONFIG_PATH=/dev/null node --import tsx scripts/mitigation-rerun.ts 200`

Built with Claude Code, which wrote most of the lines. Four adversarial review
passes by independent agents checked these claims against the code and data;
every confirmed finding was fixed or is disclosed above.
