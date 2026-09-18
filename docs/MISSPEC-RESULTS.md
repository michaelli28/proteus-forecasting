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
