"""Exploratory, not pre-registered: does one (work rate, delay) per storm fit its counties?

Run from engine/:  .venv/bin/python -m python.eaglei.diag_county_theta
Protocol §10 draws one (W, delay) per world and shares it across the storm's counties. The plan marks
that as ASSUMED and names the leave-one-out null as its check, and that null failed. This script:
1. fits every county-event alone (ABC, same settings);
2. compares how far a storm's counties sit apart with how uncertain each county's own fit is;
3. reruns the leave-one-out null with an independent (W, delay) per county, drawn from a spread
   fitted across counties;
4. with `hier`: reruns it with a two-level draw, a storm effect plus county scatter around it.
Training data only. Nothing here changes the frozen pipeline.
"""
from __future__ import annotations

import json

import numpy as np
from scipy.stats import binomtest

from .fit import (ALPHA, M_ABC, OUT, POOL, _loo_event, _pooled_look, abc, county_rate_ci, ensemble_size,
                  pmap, pools_for, population, pooled_members, prior_draws, rng_for, spread_draws,
                  training_events)
from .rank import min_p_combined, pooled_mahalanobis, rank_p_all


def _county_abc(args: tuple) -> dict:
    key, x, pool, c_rel = args
    rng = rng_for(f"diag/county-abc/{key}")
    post = abc([(x, pool, c_rel)], "sim", prior_draws("sim", M_ABC, rng), rng)
    return {"mean": post.mean(axis=0).tolist(), "cov": np.cov(post.T).tolist()}


def county_fits(ev) -> dict:
    path = OUT / "diag-county-fits.json"
    if path.exists():
        return json.loads(path.read_text())
    pools = pools_for(ev, POOL, "abc-worlds")
    tasks = [(f"{r.storm_id}/{r.fips}", np.array([r.t50, r.t90, r.t95]), pools[i], r.c_rel)
             for i, r in zip(ev.index, ev.itertuples())]
    fits = dict(zip([t[0] for t in tasks], pmap(_county_abc, tasks)))
    path.write_text(json.dumps(fits))
    return fits


def two_level(fits: dict, exclude: str | None = None) -> dict:
    """Method of moments on per-county posteriors, grouped by storm (storms with at least 2 counties):
    within = mean within-storm covariance of county means plus the mean county posterior covariance;
    between = covariance of storm means minus within / mean county count, floored at a tenth of its diagonal."""
    by_storm: dict[str, list[dict]] = {}
    for k, v in fits.items():
        storm = k.split("/")[0]
        if storm != exclude:
            by_storm.setdefault(storm, []).append(v)
    groups = [g for g in by_storm.values() if len(g) >= 2]
    within = (np.mean([np.cov(np.array([c["mean"] for c in g]).T) for g in groups], axis=0)
              + np.mean([c["cov"] for g in groups for c in g], axis=0))
    storm_means = np.array([np.mean([c["mean"] for c in g], axis=0) for g in groups])
    n_bar = np.mean([len(g) for g in groups])
    between = np.cov(storm_means.T) - within / n_bar
    w, V = np.linalg.eigh(between)
    between = (V * np.maximum(w, 0.1 * np.min(np.diag(np.cov(storm_means.T))))) @ V.T
    return {"mean": storm_means.mean(axis=0).tolist(), "between": between.tolist(), "within": within.tolist()}


def hier_main() -> None:
    ev = training_events()
    fits = county_fits(ev)
    min_size = json.loads((OUT / "shrinkage.json").read_text())["min_size"]
    members = pooled_members(ev, min_size)
    big = ev[ev["p1"] >= min_size]
    storms = {}
    for storm in sorted(ev["storm_id"].unique()):
        tl = two_level(fits, exclude=storm)
        g = big[big["storm_id"] == storm]
        mem = members.get(storm, [])
        m = len(g) + (1 if mem else 0)
        N = ensemble_size(m)
        storm_effect = spread_draws({"mean": tl["mean"], "cov": tl["between"]}, N,
                                    rng_for(f"diag/hier-storm/{storm}"))
        jobs, obs = [], []
        looks = [(r.fips, r) for r in g.itertuples()] + ([("pooled", None)] if mem else [])
        thetas = {}
        for key, _ in looks:
            scatter = np.random.default_rng(rng_for(f"diag/hier-county/{storm}/{key}").integers(2**63)) \
                .multivariate_normal(np.zeros(2), tl["within"], N)
            th = storm_effect + scatter
            th[:, 1] = np.maximum(th[:, 1], 0.0)
            thetas[key] = th
        for key, r in looks:
            if r is not None:
                jobs.append((r.size, r.p1, r.c_rel, f"restoration-addendum/loo-worlds/{storm}/{r.fips}", thetas[key], "sim"))
                obs.append(np.array([r.t50, r.t90, r.t95]))
        sims = pmap(_loo_event, jobs)
        if mem:
            x, f = _pooled_look((mem, thetas["pooled"], "sim", f"restoration-addendum/loo-pooled/{storm}"))
            obs.append(x)
            sims.append(f)
        scores = [pooled_mahalanobis(np.vstack([x, f])) for x, f in zip(obs, sims)]
        look_p = [float(rank_p_all(s)[0]) for s in scores]
        storms[storm] = {"looks": m, "N": N, "p": min_p_combined(np.array(scores)),
                         "county_flags": int(sum(p <= ALPHA for p in look_p)), "look_p": look_p}
    flags = sum(s["p"] <= ALPHA for s in storms.values())
    out = {"two_level_all_storms": two_level(fits), "storm_flags": int(flags), "storms": len(storms),
           "binomial_p_vs_5pct": float(binomtest(int(flags), len(storms), 0.05, alternative="greater").pvalue),
           "county_flags": sum(s["county_flags"] for s in storms.values()),
           "looks": sum(s["looks"] for s in storms.values()),
           "county_rate_ci95": county_rate_ci(storms), "per_storm": storms}
    (OUT / "diag-hier.json").write_text(json.dumps(out, indent=2))
    print(json.dumps({k: v for k, v in out.items() if k != "per_storm"}, indent=2))


def main() -> None:
    ev = training_events()
    fits = county_fits(ev)

    # 1. Within a storm: spread of county means vs each county's own posterior spread.
    rows = []
    for storm, g in ev.groupby("storm_id"):
        if len(g) < 5:
            continue
        keys = [f"{storm}/{f}" for f in g["fips"]]
        means = np.array([fits[k]["mean"] for k in keys])
        within = np.mean([np.diag(fits[k]["cov"]) for k in keys], axis=0)
        between = means.var(axis=0, ddof=1)
        rows.append({"storm": storm, "counties": len(g), "between_var": between.tolist(),
                     "within_var": within.tolist(), "ratio": (between / within).tolist()})

    # 2. Leave-one-storm-out with an independent draw per county-look.
    min_size = json.loads((OUT / "shrinkage.json").read_text())["min_size"]
    members = pooled_members(ev, min_size)
    big = ev[ev["p1"] >= min_size]
    storms = {}
    for storm in sorted(ev["storm_id"].unique()):
        others = {k: v for k, v in fits.items() if not k.startswith(storm + "/")}
        spread = population(others)
        g = big[big["storm_id"] == storm]
        mem = members.get(storm, [])
        m = len(g) + (1 if mem else 0)
        N = ensemble_size(m)
        jobs, obs = [], []
        for r in g.itertuples():
            theta = spread_draws(spread, N, rng_for(f"diag/loo-theta/{storm}/{r.fips}"))
            jobs.append((r.size, r.p1, r.c_rel, f"restoration-addendum/loo-worlds/{storm}/{r.fips}", theta, "sim"))
            obs.append(np.array([r.t50, r.t90, r.t95]))
        sims = pmap(_loo_event, jobs)
        if mem:
            theta = spread_draws(spread, N, rng_for(f"diag/loo-theta/{storm}/pooled"))
            x, f = _pooled_look((mem, theta, "sim", f"restoration-addendum/loo-pooled/{storm}"))
            obs.append(x)
            sims.append(f)
        scores = [pooled_mahalanobis(np.vstack([x, f])) for x, f in zip(obs, sims)]
        look_p = [float(rank_p_all(s)[0]) for s in scores]
        storms[storm] = {"looks": m, "N": N, "p": min_p_combined(np.array(scores)),
                         "county_flags": int(sum(p <= ALPHA for p in look_p)), "look_p": look_p}
    flags = sum(s["p"] <= ALPHA for s in storms.values())
    out = {
        "within_storm": rows,
        "county_spread": population(fits),
        "loo_independent_county_theta": {
            "storm_flags": int(flags), "storms": len(storms),
            "binomial_p_vs_5pct": float(binomtest(int(flags), len(storms), 0.05, alternative="greater").pvalue),
            "county_flags": sum(s["county_flags"] for s in storms.values()),
            "looks": sum(s["looks"] for s in storms.values()),
            "county_rate_ci95": county_rate_ci(storms), "per_storm": storms,
        },
    }
    (OUT / "diag-county-theta.json").write_text(json.dumps(out, indent=2))
    print(json.dumps({"within_storm_ratio_median": np.median([r["ratio"] for r in rows], axis=0).tolist(),
                      **{k: v for k, v in out["loo_independent_county_theta"].items() if k != "per_storm"}},
                     indent=2))


if __name__ == "__main__":
    import sys
    hier_main() if sys.argv[1:] == ["hier"] else main()
