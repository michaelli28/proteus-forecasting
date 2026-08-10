# PROTEUS

Calibrated forecasting against a simulated world, with an evidence-gated
abstention path.

You ask a question about a quantity. PROTEUS partitions the answer space into
outcome bands, runs a Monte Carlo ensemble of simulations, and returns a
probability over those bands — plus a BLUF, the assumptions that would falsify
it, and the evidence each claim rests on. When the evidence cannot separate the
leading bands, it **abstains** instead of guessing.

Everything it currently forecasts comes from a **synthetic world**. Numbers here
describe how honestly the pipeline propagates its own uncertainty. They are not
evidence of real-world forecasting skill, and the system says so in the first
line of every run.

---

## Layout

| Path         | What it is                                                    |
| ------------ | ------------------------------------------------------------- |
| `engine/`    | The forecasting pipeline, its CLI, and 601 tests              |
| `dashboard/` | Next.js app rendering the calibration benchmark at `/metrics` |
| `docs/`      | `ARCHITECTURE-PROTEUS.md` — the full design record            |

Inside `engine/src/`:

| Directory   | Responsibility                                                          |
| ----------- | ----------------------------------------------------------------------- |
| `sim/`      | Deterministic simulation kernel + the influence-ops domain adapter      |
| `corpus/`   | Synthetic document corpus with an as-of cutoff (no post-cutoff leakage) |
| `evidence/` | ICD 203 probability language, ACH, contradiction detection, abstention  |
| `agents/`   | Framer, panel, red team, scope — the model-in-the-loop analytic layer   |
| `pipeline/` | Orchestration: one question in, one analytic product out                |
| `metrics/`  | Brier, Murphy decomposition, calibration, ensemble quality, baselines   |
| `artifact/` | Content-addressed store — every run reproducible from its seed          |
| `llm/`      | Provider-agnostic client interface + Anthropic backend + offline stub   |

---

## Run it

```bash
cd engine && npm install
npm test                 # 597 pass, 4 skipped (2 need a key, 2 need PROTEUS_BENCH)
npm run preflight        # which credentials actually work right now
```

One forecast, no model, no network:

```bash
cd engine
npx tsx src/cli.ts forecast "Where does adoption land by the resolution tick?" --offline
```

With a model in the loop (needs `ANTHROPIC_API_KEY` in `engine/.env`):

```bash
npx tsx src/cli.ts forecast "<question>" --measure adoptionRate --bands 4 --runs 16
```

Useful flags: `--tick` (when the outcome resolves), `--range lo,hi` (the outcome
range the bands tile), `--seed` (same seed ⇒ same run), `--as-of YYYY-MM-DD`
(information cutoff), `--json` (machine-readable product).

## The dashboard

```bash
cd dashboard && npm install && npm run dev   # http://localhost:3000/metrics
```

It renders `dashboard/data/benchmark-snapshot.json`, which the benchmark
publishes. To regenerate that file from a fresh benchmark run:

```bash
cd engine && npm run snapshot
```

The dashboard never recomputes a score — a reliability curve derived twice is
two implementations of calibration that will eventually disagree.

---

## Known edges

- **`src/llm/claude.ts` is not wired in.** It's a complete Agent SDK backend, but
  nothing imports it; `src/llm/anthropic.ts` is the live path. It exists for the
  model-agnosticism comparison and needs a call site to earn its keep.
- **The adjudication panel refuses in this domain.** The ensemble forecast is the
  primary path and stands uncross-checked; runs report this rather than hiding it.
- **Only the synthetic oracle is measured.** Historical-backtest and live
  post-cutoff accuracy are NOT YET MEASURED and must never be pooled with the
  synthetic numbers.
