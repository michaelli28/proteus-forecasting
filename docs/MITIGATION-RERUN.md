# Mitigation rankings: 6 seeds vs 200 shared seeds

Local runs on the synthetic packs, 2026-09-18. `dashboard/data/arm-comparisons.json`
ranks each pack's mitigations by median harm over six seeds against the pack's
worst actor. This replays every arm on 200 seeds shared across arms, after first
reproducing the published six-seed arrays exactly. Not pre-registered.

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

port-throughput vs People's Republic of China (china) — harm in container-hours of delayed throughput; six-seed arrays reproduced exactly: true
   no mitigation: mean 319.3k, median 325.5k, zero-harm seeds 7/200
   mitigation                                   published (6 seeds)      re-run (200 seeds): won/tied/lost   sign-test p   mean Δ harm [95% CI]            median
   1. regular password and key changes          median 173.3k   beat 6/6   150/17/33                         5.1e-19       -141.0k [-164.4k, -118.3k]      162.8k
   2. operations network kept in separate zones median 232.0k   beat 5/6   108/26/66                         1.8e-3        -37.6k [-61.3k, -12.5k]         270.0k
   3. alerts for unusual activity               median 295.1k   beat 4/6   143/19/38                         1.6e-15       -127.9k [-151.2k, -103.7k]      184.0k
   4. separate backup record of every box       median 298.3k   beat 5/6   147/7/46                          1.7e-13       -88.2k [-109.7k, -67.9k]        239.2k
   rank by mean over 200:   1 > 3 > 4 > 2   (published order = 1 > 2 > 3 > 4)
   rank by median over 200: 1 > 3 > 4 > 2

benefits-delivery vs People's Republic of China (china) — harm in beneficiary-hours of incorrect or absent service; six-seed arrays reproduced exactly: true
   no mitigation: mean 154.96M, median 182.55M, zero-harm seeds 3/200
   mitigation                                   published (6 seeds)      re-run (200 seeds): won/tied/lost   sign-test p   mean Δ harm [95% CI]            median
   1. regular review of who has admin access    median 132.73M  beat 6/6   135/8/57                          1.8e-8        -29.67M [-39.26M, -19.75M]      145.54M
   2. independent spot-checks of decisions      median 138.75M  beat 6/6   168/3/29                          5.4e-25       -33.91M [-40.39M, -27.41M]      144.25M
   3. alerts for unusual payments               median 143.59M  beat 5/6   139/11/50                         6.9e-11       -24.36M [-32.95M, -15.83M]      149.67M
   4. service split into separate parts         median 177.73M  beat 3/6   111/25/64                         4.7e-4        -19.58M [-28.49M, -10.93M]      159.19M
   rank by mean over 200:   2 > 1 > 3 > 4   (published order = 1 > 2 > 3 > 4)
   rank by median over 200: 2 > 1 > 3 > 4
```
