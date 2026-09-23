"""Protocol §12 under §16.7: the synthetic arms, on training-storm inputs only (docs/RESTORATION-ADDENDUM.md).

Each arm runs 1,000 storm-level replicates. Replicate r takes training storm r mod 18 (storms in id order), so
every storm's real county sizes, peaks, cuts and pooling are used. A replicate simulates one "truth" for every
county of its storm and runs the hindsight check against that storm's ensemble, drawn from the full training
spread. Arms are paired: every arm reuses the null arm's storm effects, county scatter and unit worlds, and the
planted errors draw from one shared seed of their own. Only the check itself is tested here; the exponential
baseline has no arms.

Run from engine/:  FIT_WORKERS=1 .venv/bin/python -m python.eaglei.arms
Writes .cache/restoration-check/phase4/arms.json once (§16's rule; a rerun needs --deviation "<reason>").
"""
from __future__ import annotations

import math
import sys
from importlib.metadata import version

import numpy as np
from scipy.stats import binomtest, chisquare, norm

from . import fit
from .looks import ALPHA, hindsight_plan, rank_check, weighted
from .phase4 import PHASE4, SEED, county_worlds, fitted_inputs, flag_rate

REPLICATES = 1000
Z = float(norm.ppf(0.975))
ARMS: dict[str, dict] = {
    "null": {},
    "fixed: centre": {"eta": "centre"},
    "fixed: fast corner": {"eta": "fast"},
    "fixed: slow corner": {"eta": "slow"},
    "prolonged 2%": {"error": {"prolonged": 0.02}},
    "prolonged 5%": {"error": {"prolonged": 0.05}},
    "prolonged 10%": {"error": {"prolonged": 0.10}},
    "heavier tail 0.5": {"error": {"tail_sigma": 0.5}},
    "heavier tail 1.0": {"error": {"tail_sigma": 1.0}},
    "heavier tail 1.5": {"error": {"tail_sigma": 1.5}},
    "delay +12 h": {"shift": 12.0},
    "delay +24 h": {"shift": 24.0},
    "delay +48 h": {"shift": 48.0},
    "blind spot: critical first": {"error": {"critical_first": True}},
}
FAMILIES = {
    "prolonged small failures": ["prolonged 2%", "prolonged 5%", "prolonged 10%"],
    "heavier tail": ["heavier tail 0.5", "heavier tail 1.0", "heavier tail 1.5"],
    "delay shift": ["delay +12 h", "delay +24 h", "delay +48 h"],
}


def eta_for(kind: str, spread: dict) -> np.ndarray:
    """§16.7: the centre of N(mu, B), or its 2.5% (fast) or 97.5% (slow) corner in both (log W, delay)."""
    mean, sd = np.array(spread["mean"]), np.sqrt(np.diag(spread["between"]))
    return {"centre": mean, "fast": mean - Z * sd, "slow": mean + Z * sd}[kind]


def delay_range(spread: dict) -> tuple[float, float]:
    """The 2.5-97.5% delay range of the county-level marginal N(mu, B + C)."""
    m = fit.marginal(spread)
    sd = math.sqrt(m["cov"][1][1])
    return m["mean"][1] - Z * sd, m["mean"][1] + Z * sd


def wilson(k: int, n: int) -> list[float]:
    centre = (k + Z**2 / 2) / (n + Z**2)
    half = Z * math.sqrt(k * (n - k) / n + Z**2 / 4) / (n + Z**2)
    return [centre - half, centre + half]


def storm_arms(storm: str, ev, reps: int, spread: dict, cell: dict, min_size: float) -> dict[str, dict]:
    """Every arm's replicates for one training storm."""
    fips = list(ev["fips"])
    plan = hindsight_plan(ev, min_size)
    N = fit.ensemble_size(len(plan))

    def worlds(theta: dict, tag: str, error: dict | None) -> dict[str, np.ndarray]:
        jobs = [("sim", r.size, r.p1, r.c_rel, theta[r.fips], cell, f"{SEED}/arms/{tag}-worlds/{storm}/{r.fips}",
                 error, ()) for r in ev.itertuples()]
        return {f: w["milestones"] for f, w in zip(fips, fit.pmap(county_worlds, jobs))}

    ens = worlds(fit.world_draws(spread, fips, N, f"{SEED}/arms/ensemble-theta/{storm}"), "ensemble", None)
    ens_vectors = [weighted(look, ens) for look in plan]
    lo, hi = delay_range(spread)
    out = {}
    for arm, cfg in ARMS.items():
        eta = eta_for(cfg["eta"], spread) if "eta" in cfg else None
        theta = fit.world_draws(spread, fips, reps, f"{SEED}/arms/truth-theta/{storm}", eta=eta)
        for f in fips:
            theta[f][:, 1] += cfg.get("shift", 0.0)  # after the clip at 0 (§16.7)
        truth = worlds(theta, "truth", cfg.get("error"))
        res = [rank_check([(weighted(look, {f: truth[f][r] for f in look.members}), F)
                           for look, F in zip(plan, ens_vectors)]) for r in range(reps)]
        out[arm] = {"p": [x["p"] for x in res], "look_p": [x["look_p"] for x in res]}
        if "shift" in cfg:  # county looks split by the county's own shifted delay; the pooled look apart
            out[arm]["in_spread"] = [[None if look.key == "pooled" else bool(lo <= theta[look.key][r, 1] <= hi)
                                      for look in plan] for r in range(reps)]
    return {"N": N, "looks": len(plan), "reps": reps, "arms": out}


def design_effect(look_flags: list[list[float]]) -> dict:
    """How much one storm's looks move together, from the null arm: the one-way ANOVA intraclass correlation rho
    of look flags within a replicate, and 1 + (n_w - 1) x rho with the size-weighted look count
    n_w = sum(n^2) / sum(n), the variance inflation of a pooled flags / looks rate over unequal storms."""
    groups = [np.array(g, dtype=float) for g in look_flags]
    n = np.array([len(g) for g in groups], dtype=float)
    k, total = len(groups), n.sum()
    grand = np.concatenate(groups).mean()
    msb = sum(len(g) * (g.mean() - grand) ** 2 for g in groups) / (k - 1)
    msw = sum(((g - g.mean()) ** 2).sum() for g in groups) / (total - k)
    n0 = (total - (n**2).sum() / total) / (k - 1)
    rho = (msb - msw) / (msb + (n0 - 1) * msw)
    nw = float((n**2).sum() / total)
    return {"icc_look_flags": float(rho), "weighted_looks": nw, "design_effect": float(1 + (nw - 1) * rho)}


def summarise(per_storm: dict[str, dict]) -> dict:
    """Arm by arm: storm flags with Wilson intervals, look flags and the delay split with storm-resampled
    intervals, delta*, and the blind spot's paired McNemar test against the null arm (§12's inference for that
    difference)."""
    storms = sorted(per_storm)
    arms: dict[str, dict] = {}
    flags = {}
    for arm in ARMS:
        p = np.concatenate([per_storm[s]["arms"][arm]["p"] for s in storms])
        look_p = [lp for s in storms for lp in per_storm[s]["arms"][arm]["look_p"]]
        flags[arm] = p <= ALPHA
        k, n = int(flags[arm].sum()), len(p)
        per_lp = [per_storm[s]["arms"][arm]["look_p"] for s in storms]
        arms[arm] = {"storm_flags": k, "replicates": n, "rate": k / n, "wilson95": wilson(k, n),
                     "looks": flag_rate(np.array([sum(q <= ALPHA for lp in g for q in lp) for g in per_lp], float),
                                        np.array([sum(len(lp) for lp in g) for g in per_lp], float),
                                        f"{SEED}/arms/look-rate/{arm}"),
                     "per_storm_flags": {s: int(np.sum(np.array(per_storm[s]["arms"][arm]["p"]) <= ALPHA))
                                         for s in storms}}
        if "in_spread" in per_storm[storms[0]]["arms"][arm]:
            split = {g: np.zeros((len(storms), 2)) for g in ("inside", "outside", "pooled")}
            for j, s in enumerate(storms):
                a = per_storm[s]["arms"][arm]
                for lp, ins in zip(a["look_p"], a["in_spread"]):
                    for q, i in zip(lp, ins):
                        split["pooled" if i is None else "inside" if i else "outside"][j] += (q <= ALPHA, 1)
            arms[arm]["looks_by_delay"] = {g: flag_rate(v[:, 0], v[:, 1], f"{SEED}/arms/delay-split/{arm}/{g}")
                                           for g, v in split.items()}
    null_p = np.concatenate([per_storm[s]["arms"]["null"]["p"] for s in storms])
    hist = np.histogram(null_p, bins=10, range=(0, 1))[0]
    arms["null"]["storm_p_histogram_10"] = hist.tolist()
    arms["null"]["histogram_chi2_p"] = float(chisquare(hist).pvalue)
    arms["null"]["mean_storm_p"] = float(null_p.mean())
    arms["null"]["design"] = design_effect([[float(q <= ALPHA) for q in lp] for s in storms
                                            for lp in per_storm[s]["arms"]["null"]["look_p"]])
    delta = {}
    for family, doses in FAMILIES.items():
        hit = [d for d in doses if arms[d]["wilson95"][0] > 0.5]
        delta[family] = hit[0] if hit else f"> {doses[-1]}"
    b = int((flags["null"] & ~flags["blind spot: critical first"]).sum())
    c = int((~flags["null"] & flags["blind spot: critical first"]).sum())
    blind = {"null_only": b, "blind_only": c, "both": int((flags["null"] & flags["blind spot: critical first"]).sum()),
             "paired_rate_difference": (c - b) / len(null_p),
             "mcnemar_exact_p": float(binomtest(b, b + c, 0.5).pvalue) if b + c else 1.0}
    return {"arms": arms, "delta_star": delta, "blind_spot": blind}


def stage_arms(deviation: str | None = None) -> dict:
    fitted, shrink = fitted_inputs()
    cell, spread, min_size = fitted["cell"], fitted["sim"]["spread"], shrink["min_size"]
    ev = fit.training_events(cell["over"])
    storms = sorted(ev["storm_id"].unique())
    per_storm = {}
    for i, s in enumerate(storms):
        reps = len(range(i, REPLICATES, len(storms)))
        per_storm[s] = storm_arms(s, ev[ev["storm_id"] == s], reps, spread, cell, min_size)
        print(s, per_storm[s]["N"], per_storm[s]["looks"], reps, flush=True)
    out = {"cell": cell, "min_size": min_size, "replicates": REPLICATES,
           "packages": {p: version(p) for p in ("numpy", "pandas", "scipy")},
           "spread_sha256": fit.sha256(fit.OUT / "spread.json"), "data_sha256": fit.data_sha256(),
           "delay_range": list(delay_range(spread)), "corners": {k: eta_for(k, spread).tolist()
                                                                 for k in ("centre", "fast", "slow")},
           **summarise(per_storm), "per_storm": per_storm}
    fit.write_once(PHASE4 / "arms.json", out, deviation, root=PHASE4)
    return {k: v for k, v in out.items() if k != "per_storm"}


if __name__ == "__main__":
    from .checkpoint2 import frozen_state

    names, opts = fit.parse(sys.argv[1:])
    if names or set(opts) - {"--deviation"}:
        raise SystemExit("arms takes only --deviation")
    fit.PROVENANCE.update(frozen_state("a Phase 4 stage runs (§16.8)"))
    res = stage_arms(opts.get("--deviation"))
    for arm, a in res["arms"].items():
        print(f"{arm:28s} {a['storm_flags']:4d}/{a['replicates']} = {100 * a['rate']:5.1f}%"
              f"  [{100 * a['wilson95'][0]:4.1f}, {100 * a['wilson95'][1]:4.1f}]  looks {100 * a['looks']['rate']:5.1f}%")
    print("delta*", res["delta_star"], "\nblind spot", res["blind_spot"], "\ndesign", res["arms"]["null"]["design"])
