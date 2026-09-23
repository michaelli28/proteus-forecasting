"""Exploratory: milestone ratios of real training counties against the fitted simulator (Checkpoint 3).

Run from engine/:  .venv/bin/python -m python.eaglei.diag_ratios
Real: kept training county-events with p1 >= 5k and t95 reached. Simulated: 4,000 draws from the fitted
spread on a 40k-customer county with 12k out and a full 168-h window, and the same county at zero delay.
Training data only.
"""
from __future__ import annotations

import json

import numpy as np

from .county_sim import CENSORED, features, unit_quantiles
from .fit import OUT, population, rng_for, spread_draws, training_events

Q = (10, 50, 90)


def main() -> None:
    ev = training_events()
    big = ev[ev["p1"] >= 5000]
    real = big[big["t95"] < CENSORED]
    spread = population(json.loads((OUT / "spread.json").read_text())["sim"]["storms"])
    th = spread_draws(spread, 4000, rng_for("diag/ratios/theta"))
    Qu = unit_quantiles(40_000, 12_000, 4000, rng_for("diag/ratios/worlds"))
    f = features(th[:, 0], th[:, 1], Qu, 672)
    ok = f[:, 2] < CENSORED
    out = {
        "real_n": len(real),
        "real_t90_t50": np.percentile(real["t90"] / real["t50"], Q).round(2).tolist(),
        "real_t95_t50": np.percentile(real["t95"] / real["t50"], Q).round(2).tolist(),
        "real_t95_unreached": [int((big["t95"] >= CENSORED).sum()), len(big)],
        "sim_t90_t50": np.percentile(f[ok, 1] / f[ok, 0], Q).round(2).tolist(),
        "sim_t95_t50": np.percentile(f[ok, 2] / f[ok, 0], Q).round(2).tolist(),
        "sim_t95_unreached_share": float(1 - ok.mean()),
        "unit_zero_delay_ratios": (np.median(Qu[:, 1:], axis=0) / np.median(Qu[:, 0])).round(2).tolist(),
    }
    (OUT / "diag-ratios.json").write_text(json.dumps(out, indent=2))
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
