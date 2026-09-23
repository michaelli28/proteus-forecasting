"""Checkpoint 3 figure: real training curves against the fitted simulator's in-sample band.

Run from engine/:  .venv/bin/python -m python.eaglei.plot_insample
The band uses each storm's own posterior. It is in-sample by construction, so it shows how well the
model can fit a curve at all, not a check. Training years only.
"""
from __future__ import annotations

import json

import numpy as np

from .checkpoint2 import DATA
from .county_sim import DT
from .fit import OUT, rng_for, training_events
from .outages import bridge, read_year, window
from .pooling import exponential_pooled_curves, simulated_pooled_curves

N_PANELS = 8
N_WORLDS = 300


def main() -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    ev = training_events()
    big = ev[ev["p1"] >= 5000].reset_index(drop=True)
    rng = rng_for("restoration-addendum/insample-panels")
    picks = big.iloc[np.sort(rng.choice(len(big), N_PANELS, replace=False))]
    fitted = json.loads((OUT / "spread.json").read_text())
    fig, axes = plt.subplots(2, 4, figsize=(18, 7), constrained_layout=True)
    years: dict[int, object] = {}
    for ax, r in zip(axes.flat, picks.itertuples()):
        year = int(r.storm_id[:4])
        if year not in years:
            years.clear()
            years[year] = read_year(DATA / "raw" / f"eaglei_outages_{year}.csv")
        start, end = int(r.a + r.peak), int(r.a + r.c)
        x = bridge(window(years[year], int(r.fips), start, end))
        member = {"a": start, "peak": 0, "c": end - start, "mcc": r.mcc, "p1": r.p1, "x": x}
        hours = np.arange(len(x)) * DT
        for model, color in (("sim", "#b33"), ("exp", "#2a7")):
            post = fitted[model]["storms"][r.storm_id]
            th = rng_for(f"insample/{model}/{r.storm_id}/{r.fips}").multivariate_normal(post["mean"], post["cov"], N_WORLDS)
            curves = (simulated_pooled_curves([member], th, rng_for(f"insample-w/{r.fips}"))
                      if model == "sim" else exponential_pooled_curves([member], th))
            lo, mid, hi = np.percentile(curves, [5, 50, 95], axis=0)
            ax.fill_between(hours, lo, hi, color=color, alpha=0.18, lw=0)
            ax.plot(hours, mid, color=color, lw=0.9, label="simulator" if model == "sim" else "exponential")
        ax.plot(hours, x, color="#1f3b73", lw=1.1, label="real")
        ax.set_title(f"{r.title.title()[:24]} {r.fips}", fontsize=9)
        ax.set_xlim(0, min(168, hours[-1]))
    axes.flat[0].legend(fontsize=8)
    fig.supxlabel("hours from the one-hour peak (bands: 5-95% of 300 in-sample worlds from the storm's own posterior)")
    fig.supylabel("customers out")
    path = OUT / "insample-curves.png"
    fig.savefig(path, dpi=110)
    print(path)


if __name__ == "__main__":
    main()
