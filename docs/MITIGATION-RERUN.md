# Mitigation rankings: 6 seeds vs 200 shared seeds

Local runs on the synthetic packs, 2026-09-18. `dashboard/data/arm-comparisons.json`
ranks each pack's mitigations by median harm over six seeds against the pack's
worst actor. This replays every arm on 200 seeds shared across arms, after first
reproducing the published six-seed arrays exactly. Not pre-registered.

What holds up, judged head to head on the same seeds:

- Every mitigation lowers mean harm against no mitigation (all 12 intervals exclude 0).
- port-throughput: the order changes and every adjacent gap is separated; the published #2 is the weakest.
- regional-grid: by mean, the published #1 stays first; #2 and #3 swap, separated. The median order is not stable.
- benefits-delivery: no adjacent pair is separated, so 200 seeds cannot rank its four.

Reproduce (about 30 seconds):

```bash
cd engine && DOTENV_CONFIG_PATH=/dev/null node --import tsx scripts/mitigation-rerun.ts 200
```

```text
Mitigation rankings: published (median of 6 seeds) vs 200 shared seeds. Local runs, synthetic packs.

regional-grid vs Ideologically-motivated violent non-state actor (ideological-nonstate) — harm in customer-hours without supply; six-seed arrays reproduced exactly: true
   no mitigation: mean 851.1k, median 975.6k, zero-harm seeds 7/200
   mitigation                                   published (6 seeds)      re-run (200 seeds): won/tied/lost   sign-test p   mean Δ harm [95% CI]            median
   1. crews running the system by hand          median 387.0k   beat 5/6   165/7/28                          7.9e-25       -366.7k [-409.6k, -318.7k]      678.1k
   2. alerts for unusual activity               median 589.9k   beat 4/6   127/36/37                         9.5e-13       -233.6k [-291.3k, -179.9k]      621.9k
   3. regular password and key changes          median 603.3k   beat 4/6   141/23/36                         6.9e-16       -316.3k [-372.3k, -259.1k]      524.4k
   4. control network kept in separate zones    median 615.9k   beat 3/6   99/60/41                          1.0e-6        -136.8k [-188.8k, -85.3k]       710.1k
   rank by mean over 200:   1 > 3 > 2 > 4   (published order = 1 > 2 > 3 > 4)
   rank by median over 200: 3 > 2 > 1 > 4
   share of seed-resamples ranking each first — by mean: #1 98%, #2 0%, #3 2%, #4 0%; by median: #1 14%, #2 4%, #3 81%, #4 0%
   #1 vs #3 head to head: mean Δ -50.4k [-94.8k, -5.2k] — separated; seeds #1 better/tied/worse 103/12/85
   #3 vs #2 head to head: mean Δ -82.7k [-121.1k, -46.8k] — separated; seeds #3 better/tied/worse 68/110/22
   #2 vs #4 head to head: mean Δ -96.8k [-149.8k, -45.6k] — separated; seeds #2 better/tied/worse 100/45/55

port-throughput vs People's Republic of China (china) — harm in container-hours of delayed throughput; six-seed arrays reproduced exactly: true
   no mitigation: mean 319.3k, median 325.5k, zero-harm seeds 7/200
   mitigation                                   published (6 seeds)      re-run (200 seeds): won/tied/lost   sign-test p   mean Δ harm [95% CI]            median
   1. regular password and key changes          median 173.3k   beat 6/6   150/17/33                         5.1e-19       -141.0k [-164.4k, -118.3k]      162.8k
   2. operations network kept in separate zones median 232.0k   beat 5/6   108/26/66                         1.8e-3        -37.6k [-61.3k, -12.5k]         270.0k
   3. alerts for unusual activity               median 295.1k   beat 4/6   143/19/38                         1.6e-15       -127.9k [-151.2k, -103.7k]      184.0k
   4. separate backup record of every box       median 298.3k   beat 5/6   147/7/46                          1.7e-13       -88.2k [-109.7k, -67.9k]        239.2k
   rank by mean over 200:   1 > 3 > 4 > 2   (published order = 1 > 2 > 3 > 4)
   rank by median over 200: 1 > 3 > 4 > 2
   share of seed-resamples ranking each first — by mean: #1 99%, #2 0%, #3 1%, #4 0%; by median: #1 100%, #2 0%, #3 1%, #4 0%
   #1 vs #3 head to head: mean Δ -13.1k [-24.5k, -1.8k] — separated; seeds #1 better/tied/worse 50/113/37
   #3 vs #4 head to head: mean Δ -39.7k [-58.8k, -21.1k] — separated; seeds #3 better/tied/worse 120/7/73
   #4 vs #2 head to head: mean Δ -50.6k [-67.2k, -35.0k] — separated; seeds #4 better/tied/worse 140/7/53

benefits-delivery vs People's Republic of China (china) — harm in beneficiary-hours of incorrect or absent service; six-seed arrays reproduced exactly: true
   no mitigation: mean 154.96M, median 182.55M, zero-harm seeds 3/200
   mitigation                                   published (6 seeds)      re-run (200 seeds): won/tied/lost   sign-test p   mean Δ harm [95% CI]            median
   1. regular review of who has admin access    median 132.73M  beat 6/6   135/8/57                          1.8e-8        -29.67M [-39.26M, -19.75M]      145.54M
   2. independent spot-checks of decisions      median 138.75M  beat 6/6   168/3/29                          5.4e-25       -33.91M [-40.39M, -27.41M]      144.25M
   3. alerts for unusual payments               median 143.59M  beat 5/6   139/11/50                         6.9e-11       -24.36M [-32.95M, -15.83M]      149.67M
   4. service split into separate parts         median 177.73M  beat 3/6   111/25/64                         4.7e-4        -19.58M [-28.49M, -10.93M]      159.19M
   rank by mean over 200:   2 > 1 > 3 > 4   (published order = 1 > 2 > 3 > 4)
   rank by median over 200: 2 > 1 > 3 > 4
   share of seed-resamples ranking each first — by mean: #1 13%, #2 85%, #3 1%, #4 0%; by median: #1 42%, #2 56%, #3 3%, #4 0%
   #2 vs #1 head to head: mean Δ -4.24M [-11.65M, 3.62M] — NOT separated; seeds #2 better/tied/worse 125/3/72
   #1 vs #3 head to head: mean Δ -5.31M [-13.58M, 3.23M] — NOT separated; seeds #1 better/tied/worse 94/38/68
   #3 vs #4 head to head: mean Δ -4.78M [-13.61M, 3.95M] — NOT separated; seeds #3 better/tied/worse 105/22/73
```
