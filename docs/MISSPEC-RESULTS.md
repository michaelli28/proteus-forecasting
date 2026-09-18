# Misspecification check: confirmatory results (proteus-v1)

Local runs on the synthetic oracle, 2026-09-18. Design and chosen values:
`MISSPEC-PREREG.md` (§5 lists what was added or disclosed after the run).
Sections 1–3 and the first line of each section-4 row are pre-registered;
everything marked EXPLORATORY or "added after" is not.

Reproduce (about 10 minutes on 4 workers; `$D` is any scratch directory):

```bash
cd engine
for k in 0 1 2 3; do DOTENV_CONFIG_PATH=/dev/null node --import tsx scripts/misspec-data.ts dose proteus-v1 80 256 $k/4 $D/dose & done; wait
for k in 0 1 2 3; do DOTENV_CONFIG_PATH=/dev/null node --import tsx scripts/misspec-data.ts arms proteus-v1 80 256 $k/4 $D/arms & done; wait
echo '{"channels":["burstiness","surgeRatio"],"primaryT0":30,"anyLooks":[20,40,60,80],"bandwidth":0.5,"blindThreshold":0.65}' > $D/prereg.json
DOTENV_CONFIG_PATH=/dev/null node --import tsx scripts/misspec-analyze.ts report $D/dose $D/arms $D/prereg.json
```

```text
REPORT — pre-registered: channels [burstiness, surgeRatio], primary t0 30 (89 ticks before resolution), any-look {20,40,60,80}, h 0.5, blind threshold 0.65
80 dose questions, 240 well-specified questions, N = 256 draws, α = 0.05

1. Dose–response (same root seeds; δ = 30 is the benchmark's misspecified arm)
   δ     old gate   check @t0            any-look             control t0=9   pipeline Brier  skill    ΔBrier vs δ0  unresolved
   0     0/80       7/80 [4%,17%]        4/80 [2%,12%]        2/80           0.0969          0.483    —             0
   3     0/80       9/80 [6%,20%]        4/80 [2%,12%]        2/80           0.1055          0.438    +0.0086       0
   6     0/80       16/80 [13%,30%]      8/80 [5%,19%]        2/80           0.1164          0.379    +0.0238       2
   12    0/80       41/80 [40%,62%]      27/80 [24%,45%]      2/80           0.1465          0.218    +0.0557       3
   24    0/80       62/80 [67%,85%]      62/80 [67%,85%]      2/80           0.2232          -0.190   +0.1314       7
   30    0/80       69/80 [77%,92%]      74/80 [85%,97%]      2/80           0.2730          -0.456   +0.1813       7

   Paired headline at δ=30: old gate 0/80 → check 69/80 on the same questions (exact McNemar p = 3.39e-21).

2. Blind spot — truth counts adoption at 0.65 instead of 0.6; parameters and seed as δ=0
   check alarms 7/80 [4%,17%]; p-values identical to δ=0 on every question: true
   pipeline Brier 0.2439 (skill -0.301), ΔBrier vs δ0 +0.1504, unresolved 11/80

3. Rank histogram at primary t0 — well-specified arms (p-values in tenths; uniform expected)
   δ=0 (dose seeds)      12   8  10  13   6   6   6   5   7   7   χ²=8.5 (df 9, 5% critical 16.9)   alarms 7/80 [4%,17%]
   narrow                 4  11   7   9   6   9  10   9  10   5   χ²=6.3 (df 9, 5% critical 16.9)   alarms 3/80 [1%,10%]
   medium                 9   3   9  10  10   4  11  11   5   8   χ²=9.8 (df 9, 5% critical 16.9)   alarms 4/80 [2%,12%]
   wide-control          13   7   8   5   6  13   6   8   3  11   χ²=12.8 (df 9, 5% critical 16.9)   alarms 6/80 [3%,15%]
   all well-specified    38  29  34  37  28  32  33  33  25  31   χ²=4.4 (df 9, 5% critical 16.9)   alarms 20/320 [4%,9%]

4. Reweighting by early telemetry (h = 0.5), weighted vs unweighted on the SAME 256 draws
   narrow               n=80  weighted 0.1100  unweighted 0.1028  Δ +0.0072 [0.0009, 0.0141]  ESS median 61.6, min 5.6
                              shrink-only control 0.1037  weighted − control +0.0062 [-0.0000, 0.0129]
   medium               n=80  weighted 0.0966  unweighted 0.1022  Δ -0.0056 [-0.0130, 0.0017]  ESS median 60.8, min 2.7
                              shrink-only control 0.1034  weighted − control -0.0068 [-0.0138, -0.0001]
   wide-control         n=80  weighted 0.1486  unweighted 0.1658  Δ -0.0172 [-0.0293, -0.0047]  ESS median 91.7, min 1.0
                              shrink-only control 0.1642  weighted − control -0.0156 [-0.0263, -0.0036]
   δ=0                  n=80  weighted 0.0962  unweighted 0.0880  Δ +0.0082 [0.0009, 0.0162]  ESS median 56.5, min 1.7
                              shrink-only control 0.0909  weighted − control +0.0053 [-0.0007, 0.0122]
   δ=12                 n=77  weighted 0.1286  unweighted 0.1360  Δ -0.0074 [-0.0255, 0.0106]  ESS median 13.0, min 1.0
                              shrink-only control 0.1333  weighted − control -0.0048 [-0.0155, 0.0053]
   δ=30 (misspecified)  n=73  weighted 0.2067  unweighted 0.2827  Δ -0.0761 [-0.0987, -0.0531]  ESS median 1.2, min 1.0
                              shrink-only control 0.2120  weighted − control -0.0053 [-0.0148, 0.0032]
   (flat 1/4 forecast: Brier 0.1875. "shrink-only control" and "weighted − control" were added after the pre-registered run.)

5. EXPLORATORY (not pre-registered). Power and ΔBrier by prior box, primary t0
   box (25,30)   δ0:1/20            δ3:1/20 (-0.009)   δ6:1/20 (+0.005)   δ12:1/20 (-0.022)  δ24:2/20 (+0.059)  δ30:9/20 (+0.195)  
   box (45,60)   δ0:3/20            δ3:3/20 (+0.031)   δ6:5/20 (+0.045)   δ12:15/20 (+0.067) δ24:20/20 (+0.096) δ30:20/20 (+0.121) 
   box (65,40)   δ0:2/20            δ3:2/20 (+0.000)   δ6:3/20 (+0.003)   δ12:11/20 (+0.096) δ24:20/20 (+0.280) δ30:20/20 (+0.303) 
   box (80,75)   δ0:1/20            δ3:3/20 (+0.012)   δ6:7/20 (+0.044)   δ12:14/20 (+0.087) δ24:20/20 (+0.097) δ30:20/20 (+0.097) 

6. EXPLORATORY. Questions the Day-1 pilot never touched (misspecified and narrow 21–80)
   δ=30: old gate 0/60 → check 53/60 [78%,94%]
   right prior: false alarms 17/280 [4%,10%]
```

## Abstention: Chow vs the check (Days 5–6, not pre-registered)

Reproduce: `DOTENV_CONFIG_PATH=/dev/null node --import tsx scripts/misspec-analyze.ts abstain $D/dose $D/prereg.json`

```text
ABSTENTION (not pre-registered): 461 resolved question×δ cases from 80 dose questions (19 unresolved dropped), shipped forecast, check at t0=30
   Columns per slice: answered share, mean Brier on answered, cost of abstaining per question
   (cost = mean over ALL cases of [flat 0.1875 − forecast Brier] on the abstained ones; negative = abstaining helped)

   rule                      all δ (equal mix)       δ=0 (model right)       δ=12                    δ=24                    δ=30                    
   old gate                   100%  0.1579 +0.0000    100%  0.0969 +0.0000    100%  0.1465 +0.0000    100%  0.2232 +0.0000    100%  0.2730 +0.0000   
   never abstain              100%  0.1579 +0.0000    100%  0.0969 +0.0000    100%  0.1465 +0.0000    100%  0.2232 +0.0000    100%  0.2730 +0.0000   
   Chow τ=0.556                97%  0.1585 +0.0014     98%  0.0968 +0.0021     97%  0.1464 +0.0009     97%  0.2252 +0.0010     97%  0.2764 +0.0010   
   Chow τ=0.600                80%  0.1584 +0.0062     81%  0.0960 +0.0163     81%  0.1467 +0.0081     79%  0.2283 -0.0033     79%  0.2838 -0.0090   
   Chow τ=0.639                70%  0.1582 +0.0090     71%  0.0923 +0.0228     70%  0.1479 +0.0132     70%  0.2392 +0.0004     70%  0.2838 -0.0182   
   Chow τ=0.686                48%  0.1615 +0.0173     48%  0.0851 +0.0419     48%  0.1486 +0.0223     48%  0.2582 -0.0018     48%  0.3022 -0.0305   
   Chow τ=0.722                35%  0.1709 +0.0239     35%  0.0935 +0.0577     35%  0.1642 +0.0328     34%  0.2666 -0.0086     34%  0.3150 -0.0419   
   Chow τ=0.750                21%  0.1690 +0.0257     21%  0.0864 +0.0691     22%  0.1624 +0.0354     21%  0.2820 -0.0163     21%  0.3625 -0.0496   
   Chow τ=0.806                 7%  0.1415 +0.0266      6%  0.0119 +0.0796      6%  0.0897 +0.0346      7%  0.3202 -0.0266      7%  0.4035 -0.0707   
   Chow τ=0.861                 1%  0.0764 +0.0282      1%  0.0069 +0.0883      1%  0.0069 +0.0386      1%  0.0069 -0.0381      1%  0.4236 -0.0823   
   check alarm                 59%  0.1205 -0.0102     91%  0.0974 +0.0084     49%  0.1148 +0.0051     25%  0.1690 -0.0402     15%  0.3327 -0.0636   
   check or Chow τ=0.600       49%  0.1149 -0.0059     76%  0.0978 +0.0222     42%  0.1073 +0.0076     19%  0.1357 -0.0456     11%  0.3295 -0.0700   
   check or Chow τ=0.686       28%  0.1113 +0.0085     43%  0.0917 +0.0499     23%  0.0977 +0.0200     11%  0.1557 -0.0392      5%  0.3807 -0.0749   
   post-hoc, found by review: Chow on the forecast reweighted by the same t0 telemetry (h from the pre-registration)
   weighted Chow τ=0.500       67%  0.1227 -0.0136     96%  0.0966 +0.0031     65%  0.1334 +0.0058     30%  0.1582 -0.0445     22%  0.2975 -0.0614   
   weighted Chow τ=0.550       60%  0.1152 -0.0138     88%  0.0935 +0.0083     55%  0.1038 -0.0047     27%  0.1618 -0.0427     21%  0.3049 -0.0614   

   The shipped forecast does not use the early telemetry the check reads, so Chow's rule on it abstains on the same
   questions at every δ. That is true by construction, not a finding about confidence-based abstention: Chow on the
   telemetry-weighted forecast (post-hoc rows, τ picked after seeing the data) does about as well as the check.
   What the check has that those rows lack is a false-alarm rate fixed in advance by the rank argument.
   17 distinct shipped max-p̂ values across 80 questions.
```
