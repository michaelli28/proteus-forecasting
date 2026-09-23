"""Phase 3: fit the county simulator and the exponential baseline on training storms only.

Protocol §10 fixes what is fitted; docs/RESTORATION-ADDENDUM.md fixes the settings below.
Run from engine/:  .venv/bin/python -m python.eaglei.fit abc|shrink|loo|all
Stages:
- abc: one ABC fit per training storm, all its county-events jointly;
- shrink: the minimum county size;
- loo: the leave-one-training-storm-out null.
Everything reads .cache/restoration-check/train-events.csv. Nothing here can open a held-out year.
"""
from __future__ import annotations

import hashlib
import json
import math
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import binomtest

from .county_sim import CENSORED, exponential_features, features, unit_quantiles
from .pooling import exponential_pooled_curves, pooled_features, real_pooled_curve, simulated_pooled_curves
from .rank import min_p_combined, pooled_mahalanobis, rank_p_all

ENGINE = Path(__file__).resolve().parents[2]
CHECK = ENGINE / ".cache" / "restoration-check"
OUT = CHECK / "phase3"
MODELS = ("sim", "exp")
# ABC prior, uniform on [lo, hi]. The first coordinate is log W for "sim" and log tau for "exp"; the second is delay (h).
PRIOR = {"sim": ((math.log(0.01), math.log(100.0)), (0.0, 72.0)),
         "exp": ((math.log(0.1), math.log(1000.0)), (0.0, 72.0))}
M_ABC = 100_000
KEEP = 500
POOL = 512  # unit worlds per county-event for the ABC fit
MAD_FLOOR = 0.25  # h. Meant for a feature the prior never moves, but it also binds when >= half the
# prior draws are censored (179 of 640 events): a known defect, disclosed at Checkpoint 3.
SIZE_GRID = (1000, 2000, 3000, 5000, 7500, 10_000, 15_000, 20_000)
PEAK_SHARE = 0.32  # meant as the median p1 / county size; it is 0.362 (rerun: the minimum size stays 5k)
TRUTHS = 100
SHRINK_TARGET = 0.8
ALPHA = 0.05
FULL_WINDOW = 168 * 4
VARIANT = {"shape": 1.5, "widen": 1.0}  # set from the command line; see main


def pmap(fn, items: list) -> list:
    """Map over processes where the platform allows it; the macOS sandbox blocks the semaphore probe."""
    try:
        with ProcessPoolExecutor() as ex:
            return list(ex.map(fn, items))
    except (PermissionError, OSError):
        return [fn(x) for x in items]


def rng_for(label: str) -> np.random.Generator:
    return np.random.default_rng(int.from_bytes(hashlib.sha256(label.encode()).digest()[:8], "big"))


def training_events() -> pd.DataFrame:
    df = pd.read_csv(CHECK / "train-events.csv", dtype={"storm_id": str, "fips": str})
    k = df[df["status"] == "kept"].copy()
    k["size"] = np.maximum(k["mcc"], k["p1"])
    k["c_rel"] = (k["c"] - k["peak"]).astype(int)
    return k.reset_index(drop=True)


def model_features(model: str, theta: np.ndarray, Q: np.ndarray | None, c_rel: int) -> np.ndarray:
    if model == "sim":
        return features(theta[:, 0], theta[:, 1], Q, c_rel, VARIANT["shape"])
    return exponential_features(theta[:, 0], theta[:, 1], c_rel)


def prior_draws(model: str, n: int, rng: np.random.Generator) -> np.ndarray:
    (a, b), (c, d) = PRIOR[model]
    return np.column_stack([rng.uniform(a, b, n), rng.uniform(c, d, n)])


def spread_draws(spread: dict, n: int, rng: np.random.Generator) -> np.ndarray:
    th = rng.multivariate_normal(spread["mean"], spread["cov"], n)
    th[:, 1] = np.maximum(th[:, 1], 0.0)  # protocol §10: delay draws below 0 are set to 0
    return th


def abc(obs: list[tuple[np.ndarray, np.ndarray | None, int]], model: str, theta: np.ndarray,
        rng: np.random.Generator) -> np.ndarray:
    """Keep the KEEP draws closest to the observed milestones, summed over county-events. Each
    feature is scaled by 1.4826 x MAD of that event's prior predictive."""
    d2 = np.zeros(len(theta))
    for x, pool, c_rel in obs:
        Q = None if pool is None else pool[rng.integers(len(pool), size=len(theta))]
        f = model_features(model, theta, Q, c_rel)
        scale = np.maximum(1.4826 * np.median(np.abs(f - np.median(f, axis=0)), axis=0), MAD_FLOOR)
        d2 += (((f - x) / scale) ** 2).sum(axis=1)
    return theta[np.argpartition(d2, KEEP)[:KEEP]]


def _pool(args: tuple) -> np.ndarray:
    size, p1, label, n = args
    return unit_quantiles(size, p1, n, rng_for(label), VARIANT["shape"])


def pools_for(ev: pd.DataFrame, n: int, tag: str) -> list[np.ndarray]:
    jobs = [(r.size, r.p1, f"restoration-addendum/{tag}/{r.storm_id}/{r.fips}", n) for r in ev.itertuples()]
    return pmap(_pool, jobs)


def _abc_storm(args: tuple) -> tuple[str, dict]:
    storm, obs, model = args
    rng = rng_for(f"restoration-addendum/abc/{model}/{storm}")
    post = abc(obs, model, prior_draws(model, M_ABC, rng), rng)
    return storm, {"mean": post.mean(axis=0).tolist(), "cov": np.cov(post.T).tolist(), "n": len(obs)}


def population(posts: dict[str, dict], exclude: str | None = None) -> dict:
    """Mean of per-storm posterior means; covariance of those means plus the mean posterior covariance."""
    ps = [p for s, p in posts.items() if s != exclude]
    means = np.array([p["mean"] for p in ps])
    covs = np.array([p["cov"] for p in ps])
    return {"mean": means.mean(axis=0).tolist(), "cov": (np.cov(means.T) + covs.mean(axis=0)).tolist(),
            "storms": len(ps)}


def stage_abc() -> dict:
    ev = training_events()
    pools = pools_for(ev, POOL, "abc-worlds")
    out = {}
    for model in MODELS:
        tasks = []
        for storm, g in ev.groupby("storm_id"):
            obs = [(np.array([r.t50, r.t90, r.t95]), pools[i] if model == "sim" else None, r.c_rel)
                   for i, r in zip(g.index, g.itertuples())]
            tasks.append((storm, obs, model))
        posts = dict(pmap(_abc_storm, tasks))
        out[model] = {"storms": posts, "spread": population(posts)}
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "spread.json"
    path.write_text(json.dumps(out, indent=2))
    return {"spread_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            **{m: out[m]["spread"] for m in MODELS}}


def _shrink_size(args: tuple) -> tuple[int, float, list[float]]:
    p1, spread = args
    size = p1 / PEAK_SHARE
    pool = unit_quantiles(size, p1, POOL, rng_for(f"restoration-addendum/shrink-worlds/{p1}"))
    truth_Q = unit_quantiles(size, p1, TRUTHS, rng_for(f"restoration-addendum/shrink-truths/{p1}"))
    rng = rng_for(f"restoration-addendum/shrink/{p1}")
    truths = spread_draws(spread, TRUTHS, rng)
    prior_var = np.var(spread_draws(spread, M_ABC, rng)[:, 0])
    vals = []
    for t in range(TRUTHS):
        x = features(truths[t:t + 1, 0], truths[t:t + 1, 1], truth_Q[t:t + 1], FULL_WINDOW)[0]
        post = abc([(x, pool, FULL_WINDOW)], "sim", spread_draws(spread, M_ABC, rng), rng)
        vals.append(1 - np.var(post[:, 0]) / prior_var)
    return p1, float(np.median(vals)), vals


def stage_shrink() -> dict:
    spread = json.loads((OUT / "spread.json").read_text())["sim"]["spread"]
    res = pmap(_shrink_size, [(p1, spread) for p1 in SIZE_GRID])
    med = {p1: m for p1, m, _ in res}
    ok = [p1 for p1 in SIZE_GRID if med[p1] >= SHRINK_TARGET]
    out = {"median_shrinkage": med, "min_size": ok[0] if ok else SIZE_GRID[-1],
           "reached": bool(ok), "peak_share": PEAK_SHARE}
    (OUT / "shrinkage.json").write_text(json.dumps(out, indent=2))
    return out


def ensemble_size(m: int) -> int:
    """Protocol §11: N + 1 = the smallest power of two >= max(1024, 50 m)."""
    return 2 ** math.ceil(math.log2(max(1024, 50 * m))) - 1


def _loo_event(args: tuple) -> np.ndarray:
    size, p1, c_rel, label, theta, model = args
    Q = unit_quantiles(size, p1, len(theta), rng_for(label), VARIANT["shape"]) if model == "sim" else None
    return model_features(model, theta, Q, c_rel)


def pooled_members(ev: pd.DataFrame, min_size: int) -> dict[str, list[dict]]:
    """Each storm's county-events below the minimum size, with bridged series re-read over the pooled
    window [earliest member peak, earliest member c] under §6 (training years only)."""
    from .checkpoint2 import DATA
    from .outages import bridge, read_year, window
    small = ev[ev["p1"] < min_size].copy()
    small["g_peak"] = small["a"] + small["peak"]
    small["g_c"] = small["a"] + small["c"]
    small["year"] = small["storm_id"].str[:4].astype(int)
    out: dict[str, list[dict]] = {}
    for year, gy in small.groupby("year"):
        if not 2018 <= year <= 2021:
            raise SystemExit(f"pooling asked for {year}: only training years may be read here")
        yd = read_year(DATA / "raw" / f"eaglei_outages_{year}.csv")
        for storm, g in gy.groupby("storm_id"):
            start, end = int(g["g_peak"].min()), int(g["g_c"].min())
            out[storm] = [{"fips": r.fips, "a": start, "peak": int(r.g_peak) - start, "c": int(r.g_c) - start,
                           "mcc": r.mcc, "p1": r.p1, "x": bridge(window(yd, int(r.fips), start, end))}
                          for r in g.itertuples()]
    return out


def _pooled_look(args: tuple) -> tuple[np.ndarray, np.ndarray]:
    members, theta, model, label = args
    real, _, _ = real_pooled_curve(members)
    curves = (simulated_pooled_curves(members, theta, rng_for(label), VARIANT["shape"]) if model == "sim"
              else exponential_pooled_curves(members, theta))
    return pooled_features(real), np.array([pooled_features(c) for c in curves])


def stage_loo() -> dict:
    ev = training_events()
    shrink = json.loads((OUT / "shrinkage.json").read_text())
    fitted = json.loads((OUT / "spread.json").read_text())
    min_size = shrink["min_size"]
    pools = pooled_members(ev, min_size)
    big = ev[ev["p1"] >= min_size]
    out = {}
    for model in MODELS:
        storms = {}
        for storm in sorted(ev["storm_id"].unique()):
            g = big[big["storm_id"] == storm]
            members = pools.get(storm, [])
            m = len(g) + (1 if members else 0)
            N = ensemble_size(m)
            spread = population(fitted[model]["storms"], exclude=storm)
            spread["cov"] = (np.array(spread["cov"]) * VARIANT["widen"]).tolist()
            theta = spread_draws(spread, N, rng_for(f"restoration-addendum/loo-theta/{model}/{storm}"))
            jobs = [(r.size, r.p1, r.c_rel, f"restoration-addendum/loo-worlds/{storm}/{r.fips}", theta, model)
                    for r in g.itertuples()]
            sims = pmap(_loo_event, jobs)
            obs = [np.array([r.t50, r.t90, r.t95]) for r in g.itertuples()]
            if members:
                x, f = _pooled_look((members, theta, model, f"restoration-addendum/loo-pooled/{storm}"))
                obs.append(x)
                sims.append(f)
            scores = [pooled_mahalanobis(np.vstack([x, f])) for x, f in zip(obs, sims)]
            look_p = [float(rank_p_all(s)[0]) for s in scores]
            storms[storm] = {"looks": m, "pooled_members": len(members), "N": N,
                             "p": min_p_combined(np.array(scores)),
                             "county_flags": int(sum(p <= ALPHA for p in look_p)), "look_p": look_p}
        flags = sum(s["p"] <= ALPHA for s in storms.values())
        looks = sum(s["looks"] for s in storms.values())
        county_flags = sum(s["county_flags"] for s in storms.values())
        out[model] = {
            "storm_flags": int(flags), "storms": len(storms),
            "binomial_p_vs_5pct": float(binomtest(int(flags), len(storms), 0.05, alternative="greater").pvalue),
            "county_flags": county_flags, "looks": looks,
            "county_rate_ci95": county_rate_ci(storms), "per_storm": storms,
        }
    (OUT / "loo.json").write_text(json.dumps(out, indent=2))
    return {mo: {k: v for k, v in out[mo].items() if k != "per_storm"} for mo in MODELS}


def county_rate_ci(storms: dict) -> list[float]:
    """A storm-resampled percentile interval, as in §11 (one item per storm, Σflags ÷ Σlooks, 2,000
    resamples), but computed here in Python with its own seed. The Phase 4 check uses stratifiedBootstrap."""
    items = np.array([[s["county_flags"], s["looks"]] for s in storms.values()], dtype=float)
    rng = rng_for("restoration-addendum/loo-county-rate")
    idx = rng.integers(len(items), size=(2000, len(items)))
    rates = items[idx, 0].sum(axis=1) / items[idx, 1].sum(axis=1)
    return np.percentile(rates, [2.5, 97.5]).tolist()


STAGES = {"abc": stage_abc, "shrink": stage_shrink, "loo": stage_loo}

if __name__ == "__main__":
    # --shape k: a repair-time Weibull shape other than 1.5 (§10's sensitivity rows 0.6 and 3.0).
    # --widen f: multiply the leave-one-out spread's covariance by f (the Checkpoint 3 remedy).
    # Variants write under phase3/<variant>/, reading spread and shrinkage from their own abc run
    # (widen reuses the base fit).
    args = sys.argv[1:]
    for flag in ("--shape", "--widen"):
        if flag in args:
            i = args.index(flag)
            VARIANT[flag[2:]] = float(args[i + 1])
            del args[i:i + 2]
    tag = "-".join(f"{k}{v:g}" for k, v in VARIANT.items() if v != {"shape": 1.5, "widen": 1.0}[k])
    if tag:
        base = OUT
        OUT = OUT / tag
        OUT.mkdir(parents=True, exist_ok=True)
        # Every variant keeps the base minimum size (so the looks are the same); a widen-only
        # variant also reuses the base fit.
        for name in ("shrinkage.json",) + (("spread.json",) if VARIANT["shape"] == 1.5 else ()):
            (OUT / name).write_text((base / name).read_text())
    names = list(STAGES) if args == ["all"] else args
    for name in names:
        print(name, json.dumps(STAGES[name](), indent=2, default=float))
