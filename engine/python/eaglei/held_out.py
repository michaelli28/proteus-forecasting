"""Phase 4's check on real storms (protocol §9, §11, §16.3, §16.7; details in docs/RESTORATION-ADDENDUM.md).

Every storm gets one ensemble per model, of N worlds by §11's rule on its largest number of combined looks. Its
looks are scored three ways: hindsight (primary), the during-storm look at +12 h, and all looks at +12, +24 and
+48 h in one minPCombined. The Brier forecast of "t95 <= 72 h" is issued at +12 h from the county's worlds whose
first-12-hour reads sit nearest the real curve's.

Run from engine/:
  FIT_WORKERS=1 .venv/bin/python -m python.eaglei.held_out --addendum <commit>   # once; unseals the held-out split
  FIT_WORKERS=1 .venv/bin/python -m python.eaglei.held_out --rehearse            # the same code on training storms
The rehearsal is in sample (the spread was fitted on those storms), so it is a code test, not a result.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import subprocess
import sys
from importlib.metadata import version

import numpy as np
import pandas as pd
from scipy.stats import binomtest

from . import fit, unseal
from .checkpoint2 import DATA, OUT as CHECK, PROTOCOL, REPO, frozen_state, git, run_split
from .storms import HELD_OUT_YEARS
from .county_sim import READ_HOURS, read_slots
from .events import PEAK_HOLD, held
from .looks import ALPHA, LOOK_HOURS, during_plan, hindsight_plan, rank_check, read_cols, vectors
from .phase4 import PHASE4, SEED, county_worlds, fitted_inputs

BRIER_H = 72.0
BRIER_MIN_C = int(read_slots((73,))[0])  # c >= peak + 73 h 45 min: t95 <= 72 h needs a 2-hour hold starting by 72 h
NEAREST_SHARE, NEAREST_MIN = 0.1, 100
RATE_SEED = "restoration-protocol/county-event-rate"  # §11
Y_MIN_EVENTS = 5  # §9
TS_INTERVAL = ("engine/src/metrics/bootstrap.ts", "engine/src/sim/rng.ts")  # the headline interval's code
PROTOCOL_MD5 = re.compile(r"`(eaglei_outages_\d{4}\.csv|MCC\.csv)`[^|\n]*\|\s*`([0-9a-f]{32})`")


def input_md5() -> dict[str, str]:
    """§2: each held-out outage file and MCC.csv must match the MD5 the protocol records. Hashing is not reading
    (§3): no value is parsed."""
    want = dict(PROTOCOL_MD5.findall((REPO / PROTOCOL).read_text()))
    names = [f"eaglei_outages_{y}.csv" for y in sorted(HELD_OUT_YEARS)] + ["MCC.csv"]
    got = {}
    for name in names:
        with (DATA / "raw" / name).open("rb") as f:
            got[name] = hashlib.file_digest(f, "md5").hexdigest()
    bad = [n for n in names if got[n] != want.get(n)]
    if bad:
        raise SystemExit(f"{bad} do not match the MD5s in protocol §2")
    return got


def event_table(records: list[dict], series: dict, fitted: dict) -> tuple[pd.DataFrame, dict[str, dict]]:
    """Kept county-events sized as in training, and each one's reads: the share of p1 still out at each read
    hour, read as h (§11), NaN where h is undefined."""
    k = pd.DataFrame(records)
    k = k[k["status"] == "kept"].copy()
    k["size"] = fit.county_sizes(k, fitted["cell"]["over"], fitted["undercount_share"])
    k["c_rel"] = (k["c"] - k["peak"]).astype(int)
    reads: dict[str, dict] = {}
    for r in k.itertuples():
        h = held(series[(r.storm_id, r.fips)], PEAK_HOLD)
        at = [int(r.peak) + 4 * hr for hr in READ_HOURS]  # float after the frame mixes kept and dropped rows
        reads.setdefault(r.storm_id, {})[r.fips] = np.array([h[i] / r.p1 if i < len(h) else np.nan for i in at])
    return k.reset_index(drop=True), reads


def brier_rows(g: pd.DataFrame, reads: dict[str, np.ndarray], worlds: dict[str, dict]) -> list[list[float]]:
    """(forecast, outcome) per county-event, pooled members one by one (§16.3). Left out: c < peak + 73 h 45 min,
    or a missing read in the first 12 h. The forecast is the share reaching t95 <= 72 h among the county's
    worlds nearest the real reads at +3, +6, +9 and +12 h: the nearest 10%, at least 100, by Euclidean distance."""
    cols = read_cols(12)
    rows = []
    for r in g.itertuples():
        x = reads[r.fips][cols]
        if r.c_rel < BRIER_MIN_C or np.isnan(x).any():
            continue
        w = worlds[r.fips]
        d = np.linalg.norm(w["shares"][:, cols] - x, axis=1)
        near = np.argsort(d, kind="stable")[:max(NEAREST_MIN, math.ceil(NEAREST_SHARE * len(d)))]
        rows.append([float(np.mean(w["milestones"][near, 2] <= BRIER_H)), float(r.t95 <= BRIER_H)])
    return rows


def storm_check(storm: str, g: pd.DataFrame, reads: dict[str, np.ndarray], fitted: dict, min_size: float,
                label: str) -> dict:
    plans = {"hindsight": hindsight_plan(g, min_size),
             **{f"L{L}": during_plan(g, min_size, L, reads) for L in LOOK_HOURS}}
    multi = [(L, look) for L in LOOK_HOURS for look in plans[f"L{L}"]]
    m = max(len(plans["hindsight"]), len(plans["L12"]), len(multi))
    N = fit.ensemble_size(m)
    real_ms = {r.fips: fit.milestones(r) for r in g.itertuples()}
    out: dict = {"events": len(g), "looks": len(plans["hindsight"]), "pooled_members": int((g["p1"] < min_size).sum()),
                 "looks_at": {k: len(v) for k, v in plans.items()}, "m": m, "N": N}
    for model in fit.MODELS:
        theta = fit.world_draws(fitted[model]["spread"], list(g["fips"]), N, f"{label}/theta/{model}/{storm}")
        jobs = [(model, r.size, r.p1, r.c_rel, theta[r.fips], fitted["cell"], f"{label}/worlds/{storm}/{r.fips}",
                 None, READ_HOURS) for r in g.itertuples()]
        worlds = dict(zip(g["fips"], fit.pmap(county_worlds, jobs)))
        ms = {f: w["shares"] for f, w in worlds.items()}
        mil = {f: w["milestones"] for f, w in worlds.items()}
        out[model] = {
            "hindsight": rank_check([vectors(look, real_ms, mil) for look in plans["hindsight"]]),
            "L12": rank_check([vectors(look, reads, ms, read_cols(12)) for look in plans["L12"]])
            if plans["L12"] else None,
            "multi": rank_check([vectors(look, reads, ms, read_cols(L)) for L, look in multi]) if multi else None,
            "brier": brier_rows(g, reads, worlds),
        }
        del worlds, ms, mil
    return out


def ts_rate_interval(items: list[list[int]], seed: str) -> dict:
    """§11: the engine's stratifiedBootstrap, one item per storm in one stratum, 2,000 resamples."""
    res = subprocess.run(["node", "--import", "tsx", "python/eaglei/ts_bootstrap.ts"], cwd=fit.ENGINE,
                         input=json.dumps({"items": items, "seed": seed, "resamples": fit.BOOT}), capture_output=True,
                         text=True, check=True, env={**os.environ, "DOTENV_CONFIG_PATH": "/dev/null"})
    return json.loads(res.stdout)


def rate(storms: dict, model: str, check: str, seed: str) -> dict | None:
    """Look flags over looks for one check, with its storm-resampled interval."""
    items = [[s[model][check]["look_flags"], s[model][check]["looks"]] for s in storms.values() if s[model][check]]
    if not items:
        return None
    iv = ts_rate_interval(items, seed)
    return {"flags": sum(f for f, _ in items), "looks": sum(n for _, n in items), "rate": iv["estimate"],
            "ci95": [iv["lower"], iv["upper"]], "resamples": iv["resamples"]}


def storm_flags(storms: dict, model: str, check: str, among: list[str]) -> dict:
    ids = [s for s in among if storms[s][model][check]]
    x = sum(storms[s][model][check]["p"] <= ALPHA for s in ids)
    ci = list(binomtest(int(x), len(ids)).proportion_ci(method="exact")) if ids else None
    return {"flagged": int(x), "of": len(ids), "clopper_pearson95": ci}


def brier_summary(storms: dict, base_rate: float, seed: str) -> dict:
    """Brier scores of the simulator, the exponential baseline and the training base rate, and storm-resampled
    95% intervals of the simulator's differences from the other two."""
    per = {s: (np.array(v["sim"]["brier"]).reshape(-1, 2), np.array(v["exp"]["brier"]).reshape(-1, 2))
           for s, v in storms.items()}
    per = {s: v for s, v in per.items() if len(v[0])}
    if not per:
        return {"events": 0}
    sq = {s: {"sim": (a[:, 0] - a[:, 1]) ** 2, "exp": (b[:, 0] - b[:, 1]) ** 2, "base": (base_rate - a[:, 1]) ** 2}
          for s, (a, b) in per.items()}
    n = np.array([len(v["sim"]) for v in sq.values()], dtype=float)
    hits = np.array([a[:, 1].sum() for a, _ in per.values()])
    out = {"events": int(n.sum()), "storms": len(per), "outcome_rate": float(hits.sum() / n.sum()),
           "outcome_ci95": fit.storm_resampled(hits, n, fit.rng_for(f"{seed}/brier/outcome")), "base_rate": base_rate}
    for k in ("sim", "exp", "base"):
        out[f"brier_{k}"] = float(sum(v[k].sum() for v in sq.values()) / n.sum())
    for other in ("exp", "base"):
        diff = np.array([(v["sim"] - v[other]).sum() for v in sq.values()])
        out[f"sim_minus_{other}"] = {"mean": float(diff.sum() / n.sum()),
                                     "ci95": fit.storm_resampled(diff, n, fit.rng_for(f"{seed}/brier/{other}"))}
    return out


def training_base_rate() -> float:
    """The share of training county-events with c >= peak + 73 h 45 min whose t95 <= 72 h."""
    ev = fit.training_events()
    ok = ev[ev["c_rel"] >= BRIER_MIN_C]
    return float((ok["t95"] <= BRIER_H).mean())


def check_split(records: list[dict], series: dict, label: str) -> dict:
    fitted, shrink = fitted_inputs()
    ev, reads = event_table(records, series, fitted)
    storms = {}
    for s in sorted(ev["storm_id"].unique()):
        storms[s] = storm_check(s, ev[ev["storm_id"] == s], reads[s], fitted, shrink["min_size"], label)
        print(s, storms[s]["events"], storms[s]["looks"], storms[s]["N"],
              round(storms[s]["sim"]["hindsight"]["p"], 4), flush=True)
    ids = sorted(storms)
    y_ids = [s for s in ids if storms[s]["events"] >= Y_MIN_EVENTS]
    summary = {}
    x_of_y = len(y_ids) >= 10
    for model in fit.MODELS:
        head = rate(storms, model, "hindsight", RATE_SEED)
        sy = storm_flags(storms, model, "hindsight", y_ids)
        binom = float(binomtest(sy["flagged"], sy["of"], ALPHA, alternative="greater").pvalue) if sy["of"] else None
        summary[model] = {
            "county_event_rate": head,
            # §9: with Y >= 10, an exact one-sided binomial test of X against 5%; with Y < 10, the rate's interval
            # lies entirely above 5%
            "rule": "X of Y, binomial p < 0.05" if x_of_y else "county-event rate interval entirely above 5%",
            "rejected": binom < 0.05 if x_of_y else head["ci95"][0] > ALPHA,
            "binomial_p_vs_5pct": binom,
            "storms_Y": sy,
            "storms_all": storm_flags(storms, model, "hindsight", ids),
            "L12_rate": rate(storms, model, "L12", f"{label}/L12-rate"),
            "L12_storms": storm_flags(storms, model, "L12", ids),
            "multi_storms": storm_flags(storms, model, "multi", ids),
            "storm_p_histogram_5": np.histogram([storms[s][model]["hindsight"]["p"] for s in ids], bins=5,
                                                range=(0, 1))[0].tolist(),
        }
    return {"Y": len(y_ids), "headline": "X of Y" if x_of_y else "county-event flag rate",
            "summary": summary, "brier": brier_summary(storms, training_base_rate(), label),
            "min_size": shrink["min_size"], "cell": fitted["cell"],
            "spread_sha256": fit.sha256(fit.OUT / "spread.json"), "data_sha256": fit.data_sha256(),
            "packages": {p: version(p) for p in ("numpy", "pandas", "scipy")}, "per_storm": storms}


def kept_counts(records: list[dict]) -> dict[str, int]:
    k = pd.DataFrame(records)
    return k[k["status"] == "kept"].groupby("storm_id").size().to_dict()


def main(args: list[str]) -> None:
    if args == ["--rehearse"]:  # training storms only, so it needs no gate; it records whether the tree was dirty
        fit.PROVENANCE.update({"head": git("rev-parse", "HEAD"), "dirty": bool(git("status", "--porcelain"))})
        records, series, _ = run_split("train", keep_series=True)
        out = check_split(records, series, f"{SEED}/rehearsal-train")
        fit.logged_write(PHASE4 / "rehearsal-train.json", out, root=PHASE4)
        print(json.dumps({k: out[k] for k in ("Y", "headline", "summary", "brier")}, indent=2, default=float))
        return
    names, opts = fit.parse(args)
    if names or not {"--addendum"} <= set(opts) <= {"--addendum", "--deviation"}:
        raise SystemExit("usage: held_out --addendum <commit> [--deviation <reason>]")
    state = frozen_state("the held-out split is unsealed (§3)", also=TS_INTERVAL)
    fit.PROVENANCE.update(state)
    if (PHASE4 / "held-out.json").exists() and "--deviation" not in opts:
        raise SystemExit("held-out.json exists: the held-out check runs once. A rerun needs --deviation")
    rehearsal = json.loads((PHASE4 / "rehearsal-train.json").read_text())["run"] \
        if (PHASE4 / "rehearsal-train.json").exists() else {}
    if rehearsal.get("head") != state["head"] or rehearsal.get("dirty") is not False:
        raise SystemExit("run `held_out --rehearse` from this clean HEAD first: it runs every step on training storms")
    inputs = input_md5()
    gate = unseal.open_gate(opts["--addendum"])
    entry = unseal.log_unseal(gate, state["head"], opts.get("--deviation"))
    records, series, files = run_split("held_out", keep_series=True)
    counts = json.loads((CHECK / "held_out-counts.json").read_text())
    want = {s["storm_id"]: s["kept"] for s in counts["per_storm"] if s["kept"]}
    if kept_counts(records) != want or files != counts["files"]:
        raise SystemExit("the held-out events or file stats differ from Checkpoint 2's; stopping before any check")
    out = check_split(records, series, f"{SEED}/held-out") | {"unseal": entry, "gate": gate, "inputs_md5": inputs}
    fit.write_once(PHASE4 / "held-out.json", out, opts.get("--deviation"), root=PHASE4)
    print(json.dumps({k: out[k] for k in ("Y", "headline", "summary", "brier")}, indent=2, default=float))


if __name__ == "__main__":
    main(sys.argv[1:])
