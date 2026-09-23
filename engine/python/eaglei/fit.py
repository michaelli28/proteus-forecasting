"""Phase 3 as amended by protocol §16: fit the county simulator and the exponential baseline on training
storms only, choose the one structural cell, and run the leave-one-training-storm-out null.

Protocol §10 and §16 fix what is fitted; docs/RESTORATION-ADDENDUM.md will record the resulting files.
Run from engine/ (python/eaglei/run_grid.sh runs the 24 cells, then select):
  .venv/bin/python -m python.eaglei.fit cell --crews 0.5 --shape 0.6 --over share   # one §16.5 grid cell
  .venv/bin/python -m python.eaglei.fit select                                      # §16.5's rule, once
  .venv/bin/python -m python.eaglei.fit abc shrink loo                              # on the chosen cell
Stages:
- cell: every county-event fitted alone, then scored against a spread fitted without its storm;
- select: §16.5's rule over all 24 cells;
- abc: county fits for both models and the two-level spread (§16.1);
- shrink: the minimum county size;
- loo: the leave-one-training-storm-out null, and the Checkpoint 3 gate (§16.6).
From the command line every stage refuses to run on uncommitted edits and records the commit it ran from;
select and loo refuse to run twice (§16, "one amendment, one run"). Everything reads
.cache/restoration-check/train-events.csv. Nothing here reads an outage file.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import sys
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import binomtest

from .county_sim import CENSORED, CREWS_PER_10K, MEAN_CUST, N_NODES, exponential_features, features, unit_quantiles
from .rank import min_p_combined, pooled_mahalanobis, rank_p_all

ENGINE = Path(__file__).resolve().parents[2]
CHECK = ENGINE / ".cache" / "restoration-check"
OUT = CHECK / "phase3-amended"
GRID_DIR = OUT / "grid"
SEED = "restoration-amendment"
MODELS = ("sim", "exp")
# ABC prior, uniform on [lo, hi]. The first coordinate is log W for "sim" and log tau for "exp"; the second is delay (h).
PRIOR = {"sim": ((math.log(0.01), math.log(100.0)), (0.0, 72.0)),
         "exp": ((math.log(0.1), math.log(1000.0)), (0.0, 72.0))}
M_ABC = 100_000
KEEP = 500
POOL = 512  # unit worlds per county-event for the ABC fit
PREDICTIVE_WORLDS = 511  # §16.5's out-of-sample worlds per county-event, so a rank p has a floor of 1/512
MAD_FLOOR = 0.25  # h
MIN_UNCENSORED = 100  # §16.2: fewer uncensored prior-predictive draws than this and the scale is the floor
SCORE_FLOOR = 1.0  # h: a real milestone is never under 1 h, since the peak is a level held for 1 h (§7.4)
SIZE_GRID = (1000, 2000, 3000, 5000, 7500, 10_000, 15_000, 20_000)
TRUTHS = 100
SHRINK_TARGET = 0.8
ALPHA = 0.05
FULL_WINDOW = 168 * 4
BOOT = 2000
TRAIN_YEARS = range(2018, 2022)
BASE_CELL = {"crews": 1.0, "shape": 1.5, "over": "peak"}  # §10's settings; crews is a multiple of sqrt(6)
GRID = tuple({"crews": c, "shape": k, "over": o}
             for c in (0.25, 0.5, 1.0, 2.0) for k in (0.6, 1.5, 3.0) for o in ("peak", "share"))
PROVENANCE: dict = {}  # set from the command line: the commits a run used (checkpoint2.frozen_state)


def pmap(fn, items: list) -> list:
    """Map over processes where the platform allows it; the macOS sandbox blocks the semaphore probe.
    FIT_WORKERS caps the pool (1 = serial). Workers see only their arguments, so every setting travels in them."""
    workers = int(os.environ.get("FIT_WORKERS", "0")) or None
    if workers == 1:
        return [fn(x) for x in items]
    try:
        with ProcessPoolExecutor(max_workers=workers) as ex:
            return list(ex.map(fn, items))
    except (PermissionError, OSError):
        return [fn(x) for x in items]


def rng_for(label: str) -> np.random.Generator:
    return np.random.default_rng(int.from_bytes(hashlib.sha256(label.encode()).digest()[:8], "big"))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def data_sha256() -> str:
    return sha256(CHECK / "train-events.csv")


def logged_write(path: Path, out: dict, deviation: str | None = None) -> None:
    """Write a result stamped with the commits it ran from, and append the write and its hash to runs.log."""
    stamp = {"utc": datetime.now(timezone.utc).isoformat(timespec="seconds"), "deviation": deviation, **PROVENANCE}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({**out, "run": stamp}, indent=2))
    with (OUT / "runs.log").open("a") as log:
        log.write(json.dumps({"file": str(path.relative_to(OUT)), "sha256": sha256(path), **stamp}) + "\n")


def write_once(path: Path, out: dict, deviation: str | None) -> None:
    """§16's one run: refuse to replace a result unless a dated deviation names why."""
    if path.exists() and not deviation:
        raise SystemExit(f"{path.name} exists: §16 allows one run. A rerun needs --deviation \"<reason>\"")
    logged_write(path, out, deviation)


def check_chain(fitted: dict) -> None:
    """§16.8: the fit must come from the selection file and the data file now on disk."""
    if fitted["selection_sha256"] != sha256(OUT / "selection.json"):
        raise SystemExit("spread.json was fitted under another selection.json; rerun abc")
    if fitted["data_sha256"] != data_sha256():
        raise SystemExit("train-events.csv changed since the fit; rerun abc")


def cell_tag(cell: dict) -> str:
    return f"crews{cell['crews']:g}-shape{cell['shape']:g}-{cell['over']}"


def sim_settings(cell: dict) -> dict:
    return {"shape": cell["shape"], "crews": CREWS_PER_10K * cell["crews"]}


def undercount_share(k: pd.DataFrame) -> float:
    """§16.5's s: the median p1 / MCC over kept training county-events that are not over-MCC."""
    normal = k[k["p1"] <= k["mcc"]]
    return float(np.median(normal["p1"] / normal["mcc"]))


def county_sizes(k: pd.DataFrame, over: str, s: float) -> np.ndarray:
    """max(MCC, p1) as in §10, or for over-MCC counties p1 / s, reading MCC as an undercount (§16.5)."""
    grown = k["p1"] / s if over == "share" else k["p1"]
    return np.where(k["p1"] > k["mcc"], grown, k["mcc"]).astype(float)


def training_events(over: str = "peak") -> pd.DataFrame:
    df = pd.read_csv(CHECK / "train-events.csv", dtype={"storm_id": str, "fips": str})
    k = df[df["status"] == "kept"].copy()
    years = set(k["storm_id"].str[:4].astype(int))
    if not years <= set(TRAIN_YEARS):
        raise SystemExit(f"train-events.csv holds storms from {sorted(years - set(TRAIN_YEARS))}: training years only")
    k["size"] = county_sizes(k, over, undercount_share(k))
    k["c_rel"] = (k["c"] - k["peak"]).astype(int)
    return k.reset_index(drop=True)


def milestones(r) -> np.ndarray:
    return np.array([r.t50, r.t90, r.t95])


def model_features(model: str, theta: np.ndarray, Q: np.ndarray | None, c_rel: int, cell: dict) -> np.ndarray:
    if model == "sim":
        return features(theta[:, 0], theta[:, 1], Q, c_rel, **sim_settings(cell))
    return exponential_features(theta[:, 0], theta[:, 1], c_rel)


def prior_draws(model: str, n: int, rng: np.random.Generator) -> np.ndarray:
    (a, b), (c, d) = PRIOR[model]
    return np.column_stack([rng.uniform(a, b, n), rng.uniform(c, d, n)])


def spread_draws(spread: dict, n: int, rng: np.random.Generator) -> np.ndarray:
    th = rng.multivariate_normal(spread["mean"], spread["cov"], n)
    th[:, 1] = np.maximum(th[:, 1], 0.0)  # protocol §10: delay draws below 0 are set to 0
    return th


def feature_scale(f: np.ndarray) -> np.ndarray:
    """§16.2: per feature, 1.4826 x the MAD of the draws not censored at 168.25 h, floored at 0.25 h. With fewer
    than MIN_UNCENSORED such draws the scale is the floor."""
    out = np.full(f.shape[1], MAD_FLOOR)
    for k in range(f.shape[1]):
        u = f[f[:, k] < CENSORED, k]
        if len(u) >= MIN_UNCENSORED:
            out[k] = max(1.4826 * float(np.median(np.abs(u - np.median(u)))), MAD_FLOOR)
    return out


def abc(obs: list[tuple[np.ndarray, np.ndarray | None, int]], model: str, theta: np.ndarray,
        rng: np.random.Generator, cell: dict) -> np.ndarray:
    """Keep the KEEP draws closest to the observed milestones, summed over county-events, each feature scaled
    by feature_scale of that event's prior predictive."""
    d2 = np.zeros(len(theta))
    for x, pool, c_rel in obs:
        Q = None if pool is None else pool[rng.integers(len(pool), size=len(theta))]
        f = model_features(model, theta, Q, c_rel, cell)
        d2 += (((f - x) / feature_scale(f)) ** 2).sum(axis=1)
    return theta[np.argpartition(d2, KEEP)[:KEEP]]


def _pool(args: tuple) -> np.ndarray:
    size, p1, label, n, cell = args
    return unit_quantiles(size, p1, n, rng_for(label), **sim_settings(cell))


def pools_for(ev: pd.DataFrame, n: int, tag: str, cell: dict) -> list[np.ndarray]:
    """Unit worlds per county-event. Seeds do not depend on the cell, so cells share random numbers, except
    where over-MCC sizing changes a county's size and with it the random stream."""
    return pmap(_pool, [(r.size, r.p1, f"{SEED}/{tag}/{r.storm_id}/{r.fips}", n, cell) for r in ev.itertuples()])


def _county_fit(args: tuple) -> dict:
    key, x, pool, c_rel, model, cell = args
    rng = rng_for(f"{SEED}/county-abc/{model}/{key}")
    post = abc([(x, pool, c_rel)], model, prior_draws(model, M_ABC, rng), rng, cell)
    return {"mean": post.mean(axis=0).tolist(), "cov": np.cov(post.T).tolist()}


def county_fits(ev: pd.DataFrame, model: str, cell: dict) -> dict[str, dict]:
    """§16.1: each county-event fitted alone. Returns {"storm/fips": {mean, cov}}."""
    pools = pools_for(ev, POOL, "abc-worlds", cell) if model == "sim" else [None] * len(ev)
    keys = [f"{r.storm_id}/{r.fips}" for r in ev.itertuples()]
    return dict(zip(keys, pmap(_county_fit, [(k, milestones(r), pools[i], r.c_rel, model, cell)
                                             for i, (k, r) in enumerate(zip(keys, ev.itertuples()))])))


def two_level(fits: dict[str, dict], exclude: str | None = None) -> dict:
    """§16.1's method of moments on county fits {"storm/fips": {mean, cov}}, one-way random effects by storm.
    mean: the mean of storm means. within (the county scatter C): the pooled within-storm covariance of
    county means C0, plus the mean county posterior covariance. between (B): the covariance of storm means S
    minus C0 x mean(1/n_s), with eigenvalues floored at 0.1 in S's correlation scale, so the floor is
    unit-free."""
    by_storm: dict[str, list[dict]] = {}
    for key, v in fits.items():
        storm = key.split("/")[0]
        if storm != exclude:
            by_storm.setdefault(storm, []).append(v)
    means = [np.array([c["mean"] for c in g]) for g in by_storm.values()]
    n = np.array([len(m) for m in means])
    storm_means = np.array([m.mean(axis=0) for m in means])
    dev = np.concatenate([m - m.mean(axis=0) for m in means])
    c0 = dev.T @ dev / (n - 1).sum()
    within = c0 + np.mean([c["cov"] for g in by_storm.values() for c in g], axis=0)
    s = np.cov(storm_means.T)
    d = np.sqrt(np.diag(s))
    safe = np.where(d > 0, d, 1.0)
    w, V = np.linalg.eigh((s - c0 * np.mean(1.0 / n)) / np.outer(safe, safe))
    between = np.outer(d, d) * ((V * np.maximum(w, 0.1)) @ V.T)
    return {"mean": storm_means.mean(axis=0).tolist(), "between": between.tolist(), "within": within.tolist(),
            "storms": len(means)}


def marginal(spread: dict) -> dict:
    """The spread a new county's parameters are drawn from: N(mean, B + C)."""
    return {"mean": spread["mean"], "cov": (np.array(spread["between"]) + np.array(spread["within"])).tolist()}


def world_draws(spread: dict, keys: list[str], n: int, label: str) -> dict[str, np.ndarray]:
    """§16.1: one storm effect per world, plus each county look's own scatter; delay below 0 is set to 0."""
    eta = rng_for(f"{label}/storm").multivariate_normal(spread["mean"], spread["between"], n)
    out = {}
    for key in keys:
        th = eta + rng_for(f"{label}/{key}").multivariate_normal(np.zeros(2), spread["within"], n)
        th[:, 1] = np.maximum(th[:, 1], 0.0)
        out[key] = th
    return out


def energy_score(x: np.ndarray, F: np.ndarray) -> float:
    """Energy score of observed milestones x (3,) against predictive draws F (n, 3), on log hours floored at
    SCORE_FLOOR; lower is better. It is proper only against data the predictive was not fitted to."""
    lx, lF = np.log(np.maximum(x, SCORE_FLOOR)), np.log(np.maximum(F, SCORE_FLOOR))
    n = len(lF)
    near = np.linalg.norm(lF - lx, axis=1).mean()
    spread = np.linalg.norm(lF[:, None, :] - lF[None, :, :], axis=2).sum() / (n * (n - 1))
    return float(near - 0.5 * spread)


def storm_resampled(sums: np.ndarray, counts: np.ndarray, rng: np.random.Generator) -> list[float]:
    """95% percentile interval of sum(sums) / sum(counts) over storms resampled whole, BOOT times."""
    idx = rng.integers(len(sums), size=(BOOT, len(sums)))
    return np.percentile(sums[idx].sum(axis=1) / counts[idx].sum(axis=1), [2.5, 97.5]).tolist()


def sign_flip_p(sums: np.ndarray) -> float:
    """Exact one-sided sign-flip p that the storms' paired sums are centred below 0: the share of all 2^n sign
    patterns whose total is at most the observed one. Deterministic, so it needs no seed."""
    n = len(sums)
    if n > 22:
        raise SystemExit(f"exact sign-flip over {n} storms is too large to enumerate")
    signs = 1 - 2 * ((np.arange(2 ** n)[:, None] >> np.arange(n)) & 1)
    return float(np.mean(signs @ sums <= sums.sum() + 1e-12 * np.abs(sums).sum()))


def _predictive(args: tuple) -> dict:
    """§16.5: one county-event scored against the county-level marginal of a spread fitted without its storm."""
    x, size, p1, c_rel, spread, label, cell = args
    theta = spread_draws(marginal(spread), PREDICTIVE_WORLDS, rng_for(f"{label}/theta"))
    Q = unit_quantiles(size, p1, PREDICTIVE_WORLDS, rng_for(f"{label}/worlds"), **sim_settings(cell))
    F = model_features("sim", theta, Q, c_rel, cell)
    return {"es": energy_score(x, F), "p": float(rank_p_all(pooled_mahalanobis(np.vstack([x, F])))[0]), "F": F}


def ratio_percentiles(t: np.ndarray) -> dict:
    """10th / 50th / 90th percentiles of t90/t50 and t95/t50 over rows with t95 reached."""
    ok = t[:, 2] < CENSORED
    if not ok.any():
        return {"t90_t50": None, "t95_t50": None, "t95_unreached_share": 1.0}
    return {"t90_t50": np.percentile(t[ok, 1] / t[ok, 0], [10, 50, 90]).round(2).tolist(),
            "t95_t50": np.percentile(t[ok, 2] / t[ok, 0], [10, 50, 90]).round(2).tolist(),
            "t95_unreached_share": round(float(1 - ok.mean()), 3)}


def score_out_of_sample(ev: pd.DataFrame, fits: dict[str, dict], cell: dict) -> list[dict]:
    """§16.5: each county-event scored against a spread fitted without its storm, so none of its storm's
    fits, its own included, reach its forecast."""
    spreads = {s: two_level(fits, exclude=s) for s in ev["storm_id"].unique()}
    return pmap(_predictive, [(milestones(r), r.size, r.p1, r.c_rel, spreads[r.storm_id],
                               f"{SEED}/cell-predictive/{r.storm_id}/{r.fips}", cell) for r in ev.itertuples()])


def stage_cell(cell: dict, deviation: str | None = None) -> dict:
    """§16.5: county fits, then each county-event scored out of sample, for one grid cell (the simulator)."""
    if (OUT / "selection.json").exists() and not deviation:
        raise SystemExit("selection.json exists: a grid cell reruns only with --deviation \"<reason>\" (§16.8)")
    ev = training_events(cell["over"])
    res = score_out_of_sample(ev, county_fits(ev, "sim", cell), cell)
    es = np.array([r["es"] for r in res])
    flag = np.array([r["p"] <= ALPHA for r in res])
    over = (ev["p1"] > ev["mcc"]).to_numpy()
    big = (ev["p1"] >= 5000).to_numpy()
    feeders = np.maximum(1, np.rint(ev["size"] / (N_NODES * MEAN_CUST)))
    crews = np.maximum(1, np.rint(sim_settings(cell)["crews"] * feeders * N_NODES * MEAN_CUST / 1e4))
    out = {
        "cell": cell, "tag": cell_tag(cell), "events": [f"{r.storm_id}/{r.fips}" for r in ev.itertuples()],
        "es": es.tolist(), "p": [r["p"] for r in res],
        "mean_es": float(es.mean()), "look_flag_rate": float(flag.mean()),
        "look_flag_rate_over_mcc": float(flag[over].mean()) if over.any() else None,
        "look_flag_rate_other": float(flag[~over].mean()) if (~over).any() else None,
        "one_crew_events": int((crews == 1).sum()), "median_crews": float(np.median(crews)),
        "ratios_real_p1_5k": ratio_percentiles(ev.loc[big, ["t50", "t90", "t95"]].to_numpy()),
        "ratios_predictive_p1_5k": ratio_percentiles(np.concatenate([r["F"] for r, b in zip(res, big) if b])),
        "data_sha256": data_sha256(),
    }
    logged_write(GRID_DIR / cell_tag(cell) / "cell.json", out, deviation)
    return out


def choose_cell(es: dict[str, np.ndarray], storms: np.ndarray, base: str, label: str) -> dict:
    """§16.5's rule: the lowest mean energy score wins only if an exact one-sided sign-flip test over storms
    finds its paired difference with the base cell below 0 at p <= 0.025 / (the number of other cells);
    otherwise the base cell stays. Every cell's paired difference is reported with a storm-resampled 95%
    interval (description only, each with its own seed)."""
    ids = sorted(set(storms))
    counts = np.array([float((storms == s).sum()) for s in ids])
    bar = 0.025 / (len(es) - 1)
    vs_base = {}
    for tag, v in es.items():
        diff = v - es[base]
        sums = np.array([diff[storms == s].sum() for s in ids])
        vs_base[tag] = {"mean_es": float(v.mean()), "paired_diff_mean": float(diff.mean()),
                        "sign_flip_p": sign_flip_p(sums),
                        "paired_diff_ci95": storm_resampled(sums, counts, rng_for(f"{label}/{tag}"))}
    best = min(es, key=lambda t: vs_base[t]["mean_es"])
    return {"best": best, "p_bar": bar, "vs_base": vs_base,
            "chosen": best if best != base and vs_base[best]["sign_flip_p"] <= bar else base}


def stage_select(deviation: str | None = None) -> dict:
    missing = [cell_tag(c) for c in GRID if not (GRID_DIR / cell_tag(c) / "cell.json").exists()]
    if missing:
        raise SystemExit(f"select needs all {len(GRID)} cells; missing: {missing}")
    cells = {cell_tag(c): json.loads((GRID_DIR / cell_tag(c) / "cell.json").read_text()) for c in GRID}
    commits = {(c["run"].get("head"), c["run"].get("protocol_commit")) for c in cells.values()}
    if len(commits) > 1 or (PROVENANCE and None in next(iter(commits))):
        raise SystemExit(f"the cells must all record one commit; they record {sorted(map(str, commits))}")
    if len({c["data_sha256"] for c in cells.values()} | {data_sha256()}) > 1:
        raise SystemExit("the cells used different train-events.csv files, or it changed since")
    base = cell_tag(BASE_CELL)
    events = cells[base]["events"]
    if any(c["events"] != events for c in cells.values()):
        raise SystemExit("cells disagree on the county-event list")
    storms = np.array([e.split("/")[0] for e in events])
    pick = choose_cell({t: np.array(c["es"]) for t, c in cells.items()}, storms, base, f"{SEED}/select")
    out = {"base": base, **pick, "chosen_cell": cells[pick["chosen"]]["cell"], "data_sha256": data_sha256(),
           "cell_sha256": {t: sha256(GRID_DIR / t / "cell.json") for t in cells},
           "cells": {t: {k: v for k, v in c.items() if k not in ("events", "es", "p")} for t, c in cells.items()}}
    write_once(OUT / "selection.json", out, deviation)
    return {"base": base, "best": pick["best"], "chosen": pick["chosen"], "best_vs_base": pick["vs_base"][pick["best"]]}


def stage_abc() -> dict:
    path = OUT / "selection.json"
    if not path.exists():
        raise SystemExit("run `fit select` first: §16.5 chooses the cell before any fit")
    selection = json.loads(path.read_text())
    if selection["data_sha256"] != data_sha256():
        raise SystemExit("train-events.csv changed since selection")
    cell = selection["chosen_cell"]
    ev = training_events(cell["over"])
    out = {"cell": cell, "selection_sha256": sha256(path), "data_sha256": data_sha256(),
           "undercount_share": undercount_share(ev), "peak_share": float(np.median(ev["p1"] / ev["size"]))}
    for model in MODELS:
        fits = county_fits(ev, model, cell)
        out[model] = {"counties": fits, "spread": two_level(fits)}
    spread_path = OUT / "spread.json"
    logged_write(spread_path, out)
    return {"spread_sha256": sha256(spread_path), "cell": cell, **{m: out[m]["spread"] for m in MODELS}}


def _shrink_size(args: tuple) -> tuple[int, float, list[float]]:
    p1, prior, cell, peak_share = args
    size = p1 / peak_share
    pool = unit_quantiles(size, p1, POOL, rng_for(f"{SEED}/shrink-worlds/{p1}"), **sim_settings(cell))
    truth_Q = unit_quantiles(size, p1, TRUTHS, rng_for(f"{SEED}/shrink-truths/{p1}"), **sim_settings(cell))
    rng = rng_for(f"{SEED}/shrink/{p1}")
    truths = spread_draws(prior, TRUTHS, rng)
    prior_var = np.var(spread_draws(prior, M_ABC, rng)[:, 0])
    vals = []
    for t in range(TRUTHS):
        x = model_features("sim", truths[t:t + 1], truth_Q[t:t + 1], FULL_WINDOW, cell)[0]
        post = abc([(x, pool, FULL_WINDOW)], "sim", spread_draws(prior, M_ABC, rng), rng, cell)
        vals.append(1 - np.var(post[:, 0]) / prior_var)
    return p1, float(np.median(vals)), vals


def stage_shrink() -> dict:
    """§10's minimum county size, against §16.4's prior: the county-level marginal of the fitted spread."""
    spread_path = OUT / "spread.json"
    fitted = json.loads(spread_path.read_text())
    check_chain(fitted)
    prior = marginal(fitted["sim"]["spread"])
    res = pmap(_shrink_size, [(p1, prior, fitted["cell"], fitted["peak_share"]) for p1 in SIZE_GRID])
    med = {p1: m for p1, m, _ in res}
    ok = [p1 for p1 in SIZE_GRID if med[p1] >= SHRINK_TARGET]
    out = {"median_shrinkage": med, "min_size": ok[0] if ok else SIZE_GRID[-1], "reached": bool(ok),
           "peak_share": fitted["peak_share"], "spread_sha256": sha256(spread_path)}
    logged_write(OUT / "shrinkage.json", out)
    return out


def ensemble_size(m: int) -> int:
    """Protocol §11: N + 1 = the smallest power of two >= max(1024, 50 m)."""
    return 2 ** math.ceil(math.log2(max(1024, 50 * m))) - 1


def _look_features(args: tuple) -> np.ndarray:
    size, p1, c_rel, label, theta, model, cell = args
    Q = unit_quantiles(size, p1, len(theta), rng_for(label), **sim_settings(cell)) if model == "sim" else None
    return model_features(model, theta, Q, c_rel, cell)


def pooled_look(members: pd.DataFrame, worlds: dict[str, np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    """§16.3: the p1-weighted means of the members' own milestones, real (3,) and per world (N, 3)."""
    w = (members["p1"] / members["p1"].sum()).to_numpy()
    real = w @ members[["t50", "t90", "t95"]].to_numpy()
    return real, np.tensordot(w, np.stack([worlds[f] for f in members["fips"]]), axes=1)


def stage_loo(deviation: str | None = None) -> dict:
    spread_path, shrink_path = OUT / "spread.json", OUT / "shrinkage.json"
    fitted = json.loads(spread_path.read_text())
    shrink = json.loads(shrink_path.read_text())
    check_chain(fitted)
    if shrink["spread_sha256"] != sha256(spread_path):
        raise SystemExit("shrinkage.json was computed from another spread.json; rerun shrink")
    cell = fitted["cell"]
    ev = training_events(cell["over"])
    min_size = shrink["min_size"]
    out: dict = {"cell": cell, "min_size": min_size, "spread_sha256": sha256(spread_path),
                 "shrinkage_sha256": sha256(shrink_path), "selection_sha256": fitted["selection_sha256"],
                 "data_sha256": fitted["data_sha256"]}
    for model in MODELS:
        storms = {}
        for storm in sorted(ev["storm_id"].unique()):
            g = ev[ev["storm_id"] == storm]
            big, small = g[g["p1"] >= min_size], g[g["p1"] < min_size]
            m = len(big) + (1 if len(small) else 0)
            N = ensemble_size(m)
            theta = world_draws(two_level(fitted[model]["counties"], exclude=storm), list(g["fips"]), N,
                                f"{SEED}/loo-theta/{model}/{storm}")
            jobs = [(r.size, r.p1, r.c_rel, f"{SEED}/loo-worlds/{storm}/{r.fips}", theta[r.fips], model, cell)
                    for r in g.itertuples()]
            sims = dict(zip(g["fips"], pmap(_look_features, jobs)))
            obs = [milestones(r) for r in big.itertuples()]
            worlds = [sims[f] for f in big["fips"]]
            keys = list(big["fips"])
            if len(small):
                x, f = pooled_look(small, sims)
                obs.append(x)
                worlds.append(f)
                keys.append("pooled")
            scores = [pooled_mahalanobis(np.vstack([x, f])) for x, f in zip(obs, worlds)]
            look_p = [float(rank_p_all(s)[0]) for s in scores]
            storms[storm] = {"looks": m, "pooled_members": len(small), "N": N, "look_keys": keys,
                             "p": min_p_combined(np.array(scores)),
                             "county_flags": int(sum(p <= ALPHA for p in look_p)), "look_p": look_p}
        flags = sum(s["p"] <= ALPHA for s in storms.values())
        items = np.array([[s["county_flags"], s["looks"]] for s in storms.values()], dtype=float)
        test = binomtest(int(flags), len(storms), 0.05, alternative="greater")
        all_p = np.concatenate([s["look_p"] for s in storms.values()])
        out[model] = {
            "storm_flags": int(flags), "storms": len(storms), "binomial_p_vs_5pct": float(test.pvalue),
            "storm_flag_rate_ci95": list(binomtest(int(flags), len(storms)).proportion_ci(method="exact")),
            "county_flags": int(items[:, 0].sum()), "looks": int(items[:, 1].sum()),
            "county_rate_ci95": storm_resampled(items[:, 0], items[:, 1], rng_for(f"{SEED}/loo-county-rate")),
            "mean_look_p": float(all_p.mean()), "per_storm": storms,
        }
    out["gate"] = gate(out["sim"], shrink, pooled=int((ev["p1"] < min_size).sum()), events=len(ev))
    write_once(OUT / "loo.json", out, deviation)
    return {k: ({kk: vv for kk, vv in v.items() if kk != "per_storm"} if k in MODELS else v) for k, v in out.items()}


def gate(sim: dict, shrink: dict, pooled: int, events: int) -> dict:
    """§16.6: Checkpoint 3's go/no-go on the simulator, computed rather than read off."""
    at_or_above = [m for p1, m in shrink["median_shrinkage"].items() if int(p1) >= shrink["min_size"]]
    checks = {
        "storm_flags_binomial_p_at_least_0.05": sim["binomial_p_vs_5pct"] >= 0.05,
        "county_rate_interval_not_all_above_5pct": sim["county_rate_ci95"][0] <= 0.05,
        "shrinkage_at_least_0.8_at_sizes_used": bool(shrink["reached"]) and min(at_or_above) >= SHRINK_TARGET,
        "not_most_pooled": pooled / events < 0.5,
    }
    return {**checks, "pooled_share": pooled / events, "go": all(checks.values())}


STAGES = {"select": stage_select, "abc": stage_abc, "shrink": stage_shrink, "loo": stage_loo}


def parse(args: list[str]) -> tuple[list[str], dict[str, str]]:
    """Stage names and --flag values, all checked before any stage runs."""
    names, opts, i = [], {}, 0
    while i < len(args):
        if args[i].startswith("--"):
            if i + 1 >= len(args):
                raise SystemExit(f"{args[i]} needs a value")
            opts[args[i]] = args[i + 1]
            i += 2
        else:
            names.append(args[i])
            i += 1
    return names, opts


if __name__ == "__main__":
    from .checkpoint2 import frozen_state

    names, opts = parse(sys.argv[1:])
    if names == ["cell"]:
        if not {"--crews", "--shape", "--over"} <= set(opts) <= {"--crews", "--shape", "--over", "--deviation"}:
            raise SystemExit("cell takes --crews, --shape and --over, and optionally --deviation")
        cell = {"crews": float(opts["--crews"]), "shape": float(opts["--shape"]), "over": opts["--over"]}
        if cell not in GRID:
            raise SystemExit(f"{cell} is not a §16.5 grid cell")
        PROVENANCE.update(frozen_state("a §16 fit stage runs (§16.8)"))
        res = stage_cell(cell, opts.get("--deviation"))
        print(json.dumps({k: v for k, v in res.items() if k not in ("events", "es", "p")}, indent=2))
    else:
        unknown = [n for n in names if n not in STAGES] + [o for o in opts if o != "--deviation"]
        if unknown or not names:
            raise SystemExit(f"unknown or missing stages/flags: {unknown}; stages are {list(STAGES)} or cell")
        PROVENANCE.update(frozen_state("a §16 fit stage runs (§16.8)"))
        for name in names:
            kwargs = {"deviation": opts["--deviation"]} if name in ("select", "loo") and "--deviation" in opts else {}
            print(name, json.dumps(STAGES[name](**kwargs), indent=2, default=float))
