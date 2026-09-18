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
| `engine/`    | The forecasting pipeline, its CLI, and 798 tests              |
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
npm test                 # 794 pass, 4 skipped (2 need a key, 1 PROTEUS_BENCH, 1 PROTEUS_SCALE)
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

## Any system, any adversary

The influence-ops and cyber-water domains are purpose-built. The
**contested-system** engine is the same model with the domain taken out: an actor
chooses an asset, a rung of an escalation ladder, and a duration, and the
scenario supplies all three. Three worked packs ship — `regional-grid`,
`port-throughput`, `benefits-delivery` — plus nine researched actor profiles.

Watch one run, decision by decision:

```bash
cd engine && npm run build
node dist/cli.js simulate --pack regional-grid --actors russia --respondents us
```

Useful flags: `--defense <kind>` (run a mitigation arm), `--delay <ms>` (pace it
for watching), `--seed`, `--stream` (newline-delimited JSON), `--actors a,b`
(more than one adversary at once).

Compile a scenario nobody has built yet, from a plain-language description:

```bash
node dist/cli.js compile "A regional hospital network's patient records and
  scheduling systems, contested over four months." --retrieve
```

`--retrieve` grounds the scenario in live public sources and keeps the cited
passages. Needs `ANTHROPIC_API_KEY`; without it, compile still works from the
description alone.

The actor profiles are **data**, at `engine/data/doctrine-profiles.json`, carrying
the source behind every parameter. Disagree with one and edit it — nothing needs
rebuilding but the manifest (`node dist/cli.js manifest`).

See `docs/GENERALIZED-ADVERSARY.md` for what this models, what it refuses to
model, and what each number is worth.

## Seeing inside a run

Every run writes 120 ticks of ground truth and platform telemetry to its
artifact directory. To turn those into something you can look at:

```bash
cd engine
npx tsx src/cli.ts trace --list                 # what's in the store
npx tsx src/cli.ts trace 7de16c50               # one run, by id or prefix
npm run traces                                  # every run → the dashboard
```

Then open `/runs` in the dashboard. Each run page has a tick scrubber; drag it
and watch the belief distribution reorganise — the ends empty out and interior
humps form, which is bounded confidence producing polarization on its own rather
than being told to.

The page is built around one distinction. **Ground truth** — every belief, the
distribution, who converted — scores the forecast and no defender can see it.
**Telemetry** — activity volume, active accounts, degree ratios, cluster shares
— is the detector's entire input. They travel in separate event kinds, separate
objects in the trace, and separate panes on the page, so a detector's precision
could be measured without it being a tautology. None has been measured yet:
`detectCampaign` has hand-set weights and runs only in a unit test.

## The dashboard

```bash
cd dashboard && npm install && npm run dev
```

| Route        | What it shows                                                     |
| ------------ | ----------------------------------------------------------------- |
| `/live`      | Watch a run happen — every decision, and every option it rejected |
| `/metrics`   | Calibration benchmark — reliability, the gate's operating curve   |
| `/runs`      | How the model works, and every published run                      |
| `/runs/<id>` | One run, tick by tick, with the scrubber                          |

`/live` is the only page that does not read pre-published JSON: it spawns the
same CLI you would run in a terminal and forwards its stream. The engine stays
the single source of truth, so the page can only fail to render something —
never compute something the engine did not.

It renders `dashboard/data/*.json`, which the engine publishes. To regenerate:

```bash
cd engine && npm run snapshot   # benchmark → /metrics
cd engine && npm run traces     # run traces → /runs
```

The dashboard never recomputes a measure — a reliability curve derived twice is
two implementations of calibration that will eventually disagree, and the same
goes for a detection signature.

---

## Known edges

- **Model-agnosticism is a seam, not a measurement.** `src/llm/client.ts` is the
  provider interface, but `src/llm/anthropic.ts` is the only live implementation;
  model-swap cost is NOT YET MEASURED.
- **`/runs` renders influence-ops runs only.** The trace projector reads that
  domain's truth vocabulary and refuses any other by name; a recruitment run is
  visible through its forecast, not through the run pages.
- **The adjudication panel refuses in this domain.** The ensemble forecast is the
  primary path and stands uncross-checked; runs report this rather than hiding it.
- **Only the synthetic oracle is measured.** Historical-backtest and live
  post-cutoff accuracy are NOT YET MEASURED and must never be pooled with the
  synthetic numbers.
