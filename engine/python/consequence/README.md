# Cyber-water consequence twin

A synthetic red-team domain for the Proteus engine. It models **when a
boundedly-rational adversary that already holds access to water-system control
components decides to spend it**, and **what that does to the water** — the
latter solved by real EPANET hydraulics — then ranks the biggest vulnerabilities
and the defenses that buy the most per dollar.

It never attacks anything. The adversary is parameters (how many components are
held, how long, at what attribution risk), never an exploit, a protocol, or a
technique. The networks are generated in `archetypes.py`; none is a real utility.

## What it answers

Four rankings, all as deltas against a paired baseline run on identical seeds:

1. **Chokepoint components** — which components do the most harm if compromised,
   whether or not the modeled adversary chose them. This is the "biggest
   vulnerabilities" view, and it surfaces sleepers the rational adversary skips.
2. **Attack paths** — which (component, instrument-band) routes the adversary
   actually picks, weighted by consequence.
3. **Defense ROI** — person-hours of outage averted per budget unit, per
   mitigation. Backfires (controls that _accelerate_ activation) are flagged,
   not hidden.
4. **Judge disagreement** — where an adjudication panel splits on the forecast.

## The two honesty rules that matter

- **Verifiable, not validated.** EPANET is both the predictor and the answer key
  for the consequence stage, so measured skill on it is 1.0 by construction. The
  numbers are reproducible; they are _not_ checked against a real attacked
  utility, and the report says so.
- **The required_pressure sweep is mandatory.** WNTR's PDD default
  (`required_pressure` 0.07 m) makes a pressure-dependent run collapse to a
  demand-driven one. Every consequence is reported as a range across a sweep of
  at least two distinct pressures; a single-point run is not expressible.

## Run it

```bash
cd engine
python3.12 -m venv .venv && .venv/bin/pip install wntr    # one time
npm run consequence:build        # solve the EPANET table (minutes) → .cache/
npm run consequence:test         # 9 solver tests
npm run vulnerability -- --archetype district_multizone
```

`--archetype` is one of `rural_gravity`, `municipal_pumped`, `district_multizone`.
Add `--json` for machine output, `--seeds N` to change ensemble size.
