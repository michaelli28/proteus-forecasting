"""Run: engine/.venv/bin/python -m pytest python/eaglei/ -q -p no:cacheprovider (from engine/)."""
from __future__ import annotations

import json

import numpy as np
import pandas as pd
import pytest

from . import fit
from .arms import ARMS, delay_range, design_effect, eta_for, storm_arms, summarise, wilson
from .county_sim import (CENSORED, CREWS_PER_10K, DT, READ_HOURS, _worlds, exponential_features,
                         exponential_shares, features, simulated_curves, unit_quantiles, world_features)
from .events import PEAK_HOLD, held
from .held_out import (BRIER_MIN_C, brier_rows, brier_summary, event_table, over_mcc_split, storm_flags,
                       ts_rate_interval)
from .looks import during_plan, hindsight_plan, read_cols, vectors, weighted
from .zero_bound import compare

CELL = {"crews": 0.25, "shape": 0.6, "over": "peak"}
SPREAD = {"mean": [0.08, 9.3], "between": [[0.55, 1.87], [1.87, 9.4]], "within": [[2.9, 4.76], [4.76, 206.0]]}


def _theta(n: int, seed: int) -> np.ndarray:
    r = np.random.default_rng(seed)
    return np.column_stack([r.normal(0.0, 1.0, n), r.uniform(0, 30, n)])


def test_world_features_equal_the_phase3_fast_path_with_no_planted_error():
    # Same rng, same batches: the Phase 4 path must give Phase 3's milestones exactly.
    settings = fit.sim_settings(CELL)
    theta = _theta(700, 1)
    for size, p1, c_rel in ((4_000, 1_500, 300), (90_000, 30_000, 120)):  # the second takes several batches
        got = world_features(size, p1, theta, c_rel, np.random.default_rng(2), **settings)["milestones"]
        Q = unit_quantiles(size, p1, len(theta), np.random.default_rng(2), **settings)
        assert np.array_equal(got, features(theta[:, 0], theta[:, 1], Q, c_rel, **settings))


def test_world_shares_are_the_curve_read_as_h():
    theta = _theta(30, 3)
    wf = world_features(9_000, 3_000, theta, 400, np.random.default_rng(4), crews=0.5 * CREWS_PER_10K)
    curves = simulated_curves(9_000, 3_000, 400, theta, np.random.default_rng(4), crews=0.5 * CREWS_PER_10K)
    for s in range(len(theta)):
        h = held(curves[s], PEAK_HOLD)
        want = [h[4 * hr] / curves[s, 0] for hr in READ_HOURS]
        assert np.allclose(wf["shares"][s], want), s


def test_the_error_seed_leaves_the_worlds_alone_and_pairs_the_arms():
    theta = _theta(40, 5)
    plain = world_features(6_000, 2_000, theta, 600, np.random.default_rng(6))
    with_extra = world_features(6_000, 2_000, theta, 600, np.random.default_rng(6), extra=np.random.default_rng(7))
    assert np.array_equal(plain["milestones"], with_extra["milestones"])
    assert np.array_equal(plain["shares"], with_extra["shares"])
    later = world_features(6_000, 2_000, theta, 600, np.random.default_rng(6), extra=np.random.default_rng(7),
                           prolonged=0.10)
    assert (later["milestones"] >= plain["milestones"]).all()  # added outage only ever delays
    assert (later["shares"] >= plain["shares"] - 1e-12).all()
    with pytest.raises(ValueError):
        world_features(6_000, 2_000, theta, 600, np.random.default_rng(6), tail_sigma=1.0)


def test_heavier_tail_keeps_the_mean_repair_time():
    # With one crew and no idling, the last restore time is the sum of every repair time, so the ratio of paired
    # worlds' last restore times measures the multiplier's mean over a world's few hundred repairs.
    one_crew = 1e-6
    base = _worlds(30_000, 9_000, 200, np.random.default_rng(8), 1.5, 1.0, 0.0, one_crew,
                   extra=np.random.default_rng(9))
    tail = _worlds(30_000, 9_000, 200, np.random.default_rng(8), 1.5, 1.0, 0.0, one_crew,
                   extra=np.random.default_rng(9), tail_sigma=1.0)
    assert np.array_equal(base["n_jobs"], tail["n_jobs"]) and set(base["crews"]) == {1}
    assert not np.allclose(base["R"], tail["R"])
    assert abs(np.mean(tail["R"].max(axis=1) / base["R"].max(axis=1)) - 1) < 0.05


def test_critical_first_restores_critical_facilities_sooner():
    kw = dict(extra=np.random.default_rng(11))
    mcf = _worlds(20_000, 12_000, 300, np.random.default_rng(10), 1.5, 1.0, 0.0, **kw)
    kw = dict(extra=np.random.default_rng(11))
    crit = _worlds(20_000, 12_000, 300, np.random.default_rng(10), 1.5, 1.0, 0.0, critical_first=True, **kw)
    assert np.array_equal(mcf["critical"], crit["critical"]) and np.array_equal(mcf["w"] > 0, crit["w"] > 0)
    out = mcf["critical"] & (mcf["R"] > 0)
    assert crit["R"][out].mean() < 0.8 * mcf["R"][out].mean()
    assert np.allclose(mcf["critical"].reshape(300, -1, 60).sum(axis=2), 2)  # two per feeder


def test_exponential_shares_match_the_curve_behind_the_milestones():
    log_tau, delay = np.log(np.array([8.0, 30.0])), np.array([0.0, 5.0])
    sh = exponential_shares(log_tau, delay)
    t = (np.array(READ_HOURS) * 4 + PEAK_HOLD - 1) * DT
    assert np.allclose(sh, np.exp(-np.maximum(t[None, :] - delay[:, None], 0) / np.exp(log_tau)[:, None]))
    ms = exponential_features(log_tau, delay, 10_000)
    # t50 is the first slot the curve is at or below half the peak
    assert np.allclose(np.exp(-np.maximum(ms[:, 0] - delay, 0) / np.exp(log_tau)), 0.5, atol=0.05)


def _storm() -> pd.DataFrame:
    return pd.DataFrame({"fips": ["a", "b", "c", "d"], "p1": [8_000.0, 5_000.0, 2_000.0, 1_000.0],
                         "c_rel": [672, 100, 672, 40], "size": [20_000.0, 9_000.0, 6_000.0, 3_000.0],
                         "t50": [10.0, 12.0, 20.0, 30.0], "t90": [30.0, 40.0, 50.0, 60.0],
                         "t95": [40.0, 60.0, 80.0, 168.25]})


def test_hindsight_plan_pools_below_the_minimum_with_p1_weights():
    plan = hindsight_plan(_storm(), 3_000)
    assert [look.key for look in plan] == ["a", "b", "pooled"]
    assert plan[2].members == ("c", "d") and np.allclose(plan[2].weights, [2 / 3, 1 / 3])
    # the same vectors as Phase 3's pooled look
    ev = _storm()
    worlds = {f: np.random.default_rng(i).uniform(0, 100, (50, 3)) for i, f in enumerate(ev["fips"])}
    real = {r.fips: fit.milestones(r) for r in ev.itertuples()}
    x, F = vectors(plan[2], real, worlds)
    want_x, want_F = fit.pooled_look(ev[ev["p1"] < 3_000], worlds)
    assert np.allclose(x, want_x) and np.allclose(F, want_F)


def test_during_plan_drops_members_cut_before_the_look_or_missing_a_read():
    ev = _storm()
    reads = {f: np.linspace(0.9, 0.1, len(READ_HOURS)) for f in ev["fips"]}
    reads["c"] = reads["c"].copy()
    reads["c"][READ_HOURS.index(18)] = np.nan  # c misses its +18 h read, which only the look at 24 h uses
    at12 = during_plan(ev, 3_000, 12, reads)  # needs c_rel >= 51: d (40) is cut
    assert [(look.key, look.members) for look in at12] == [("a", ("a",)), ("b", ("b",)), ("pooled", ("c",))]
    at24 = during_plan(ev, 3_000, 24, reads)  # needs c_rel >= 99: c's missing read drops the pooled look
    assert [look.key for look in at24] == ["a", "b"]
    at48 = during_plan(ev, 3_000, 48, reads)  # needs c_rel >= 195: b (100) is cut
    assert [(look.key, look.members) for look in at48] == [("a", ("a",)), ("pooled", ("c",))]
    assert np.allclose(weighted(at48[1], reads, read_cols(48)), reads["c"][read_cols(48)])


def test_event_table_reads_h_at_each_read_hour():
    x = np.r_[np.full(10, 50.0), np.linspace(1000, 0, 400), np.zeros(300)]
    x[10 + 4 * 6 + 2] = np.nan  # a hole inside the +6 h read's hour
    rec = {"storm_id": "s", "fips": "f", "status": "kept", "peak": 10, "c": 700, "p1": 1000.0, "mcc": 5000,
           "t50": 1.0, "t90": 2.0, "t95": 3.0}
    fitted = {"cell": {"over": "peak"}, "undercount_share": 0.3}
    ev, reads = event_table([rec], {("s", "f"): x}, fitted)
    h = held(x, PEAK_HOLD)
    want = [h[10 + 4 * hr] / 1000.0 for hr in READ_HOURS]
    assert np.isnan(reads["s"]["f"][1]) and np.isnan(want[1])
    assert np.allclose(np.delete(reads["s"]["f"], 1), np.delete(want, 1))
    assert ev.loc[0, "size"] == 5000 and ev.loc[0, "c_rel"] == 690


def test_brier_forecast_uses_the_nearest_worlds():
    ev = pd.DataFrame({"fips": ["a", "b"], "c_rel": [BRIER_MIN_C, BRIER_MIN_C - 1], "t95": [70.0, 80.0]})
    cols = read_cols(12)
    real = np.full(len(READ_HOURS), 0.5)
    shares = np.full((1000, len(READ_HOURS)), 0.9)
    shares[:150, cols] = 0.5  # 150 worlds match the real reads exactly; K = max(100, 10% of 1000) = 100
    ms = np.full((1000, 3), 100.0)
    ms[:150:3, 2] = 60.0  # a third of the exact matches reach t95 by 72 h
    worlds = {"a": {"shares": shares, "milestones": ms}, "b": {"shares": shares, "milestones": ms}}
    rows = brier_rows(ev, {"a": real, "b": real}, worlds)
    assert len(rows) == 1  # b ends before 73 h 45 min
    assert rows[0] == [pytest.approx(34 / 100), 1.0]  # stable order: the first 100 matches, every third reaches it


def test_brier_summary_scores_and_differences():
    storms = {"s1": {"sim": {"brier": [[0.8, 1.0], [0.2, 0.0]]}, "exp": {"brier": [[0.5, 1.0], [0.5, 0.0]]}},
              "s2": {"sim": {"brier": [[0.6, 1.0]]}, "exp": {"brier": [[0.4, 1.0]]}}}
    out = brier_summary(storms, 0.5, "test")
    assert out["events"] == 3 and out["base_rate"] == 0.5
    assert out["brier_sim"] == pytest.approx((0.04 + 0.04 + 0.16) / 3)
    assert out["brier_exp"] == pytest.approx((0.25 + 0.25 + 0.36) / 3)
    assert out["sim_minus_base"]["mean"] == pytest.approx(out["brier_sim"] - 0.25)


def test_storm_flags_and_the_typescript_rate_interval():
    storms = {s: {"sim": {"hindsight": {"p": p, "look_flags": f, "looks": n}}}
              for s, p, f, n in (("a", 0.01, 2, 10), ("b", 0.5, 0, 4), ("c", 0.04, 1, 1))}
    sf = storm_flags(storms, "sim", "hindsight", ["a", "b", "c"])
    assert sf["flagged"] == 2 and sf["of"] == 3
    iv = ts_rate_interval([[2, 10], [0, 4], [1, 1]], "test-seed")
    assert iv["estimate"] == pytest.approx(3 / 15) and iv["lower"] <= iv["estimate"] <= iv["upper"]
    assert iv["resamples"] == fit.BOOT
    assert ts_rate_interval([[2, 10], [0, 4], [1, 1]], "test-seed") == iv  # seeded, so repeatable


def test_over_mcc_split_sorts_county_looks_by_their_flag_and_keeps_pooled_looks_with_the_rest():
    storms = {"s1": {"look_keys": {"hindsight": ["a", "b", "pooled"]}, "over_mcc": {"a": True, "b": False, "c": True},
                     "sim": {"hindsight": {"look_p": [0.01, 0.5, 0.02]}}},
              "s2": {"look_keys": {"hindsight": ["d"]}, "over_mcc": {"d": True},
                     "sim": {"hindsight": {"look_p": [0.3]}}}}
    out = over_mcc_split(storms, "sim", "test")
    assert (out["over_mcc"]["flags"], out["over_mcc"]["looks"]) == (1, 2)
    assert (out["other"]["flags"], out["other"]["looks"]) == (1, 2)  # b and the pooled look (whose member c is over)
    # s2 has no "other" look, so a resample of s2 alone has no rate: it is skipped, never a NaN interval
    assert not np.isnan(out["other"]["ci95"]).any() and out["other"]["resamples"] < fit.BOOT


def test_arm_settings():
    c, f, s = (eta_for(k, SPREAD) for k in ("centre", "fast", "slow"))
    assert np.allclose(c, SPREAD["mean"]) and (f < c).all() and (s > c).all()
    assert np.allclose((s - c) / np.sqrt(np.diag(SPREAD["between"])), 1.959964, atol=1e-5)
    lo, hi = delay_range(SPREAD)
    assert lo < 9.3 < hi and hi - 9.3 == pytest.approx(1.959964 * np.sqrt(9.4 + 206.0), rel=1e-5)
    lo_w, hi_w = wilson(50, 1000)
    assert lo_w == pytest.approx(0.0381, abs=5e-4) and hi_w == pytest.approx(0.0653, abs=5e-4)


def test_design_effect_is_near_one_for_independent_looks_and_large_for_shared_ones():
    rng = np.random.default_rng(12)
    indep = [rng.uniform(size=8).tolist() for _ in range(400)]
    shared = [np.clip(rng.uniform() + rng.normal(0, 0.05, 8), 0, 1).tolist() for _ in range(400)]
    assert abs(design_effect(indep)["icc_look_flags"]) < 0.05
    assert design_effect(shared)["design_effect"] > 6
    assert design_effect([[0.0], [1.0, 1.0, 0.0]] * 50)["weighted_looks"] == 2.5  # sum(n^2) / sum(n) = 10 / 4


def test_storm_arms_runs_every_arm_paired_on_a_small_storm():
    ev = _storm().assign(c_rel=672)
    res = storm_arms("s", ev, 12, SPREAD, CELL, 3_000)
    assert res["N"] == 1023 and res["looks"] == 3 and set(res["arms"]) == set(ARMS)
    for arm, a in res["arms"].items():
        assert len(a["p"]) == 12 and all(len(lp) == 3 for lp in a["look_p"])
        assert all(1 / 1024 <= p <= 1 for p in a["p"])
    assert all(ins[2] is None for ins in res["arms"]["delay +24 h"]["in_spread"])  # the pooled look is apart
    summary = summarise({"s": res})
    assert set(summary["delta_star"]) == {"prolonged small failures", "heavier tail", "delay shift"}
    assert summary["arms"]["null"]["replicates"] == 12
    assert summary["arms"]["null"]["looks"]["looks"] == 36 and len(summary["arms"]["null"]["looks"]["ci95"]) == 2
    split = summary["arms"]["delay +24 h"]["looks_by_delay"]
    assert split["pooled"]["looks"] == 12 and split["inside"]["looks"] + split["outside"]["looks"] == 24


def test_zero_bound_compare_counts_drops_and_shifts():
    base = pd.DataFrame({"storm_id": ["s"] * 3, "fips": ["a", "b", "c"], "status": ["kept"] * 3,
                         "t50": [5.0, 6.0, 7.0], "t90": [9.0, 10.0, 168.25], "t95": [12.0, 20.0, 168.25]})
    bound = base.assign(status=["kept", "coverage", "kept"], t50=[5.0, 6.0, 8.0])
    out = compare(base, bound)
    assert out["status_under_bound"] == {"kept": 2, "coverage": 1}
    assert out["milestones_of_events_kept_under_both"]["t50"]["later"] == 1
    assert out["events_whose_status_or_a_milestone_changes"] == 2


@pytest.mark.skipif(not (fit.OUT / "loo.json").exists(), reason="needs Phase 3's local results")
def test_phase3_null_still_reproduces_for_one_storm():
    # A regression guard on the simulator: Nicholas (one look plus a pooled look) must give loo.json's numbers.
    fitted = json.loads((fit.OUT / "spread.json").read_text())
    loo = json.loads((fit.OUT / "loo.json").read_text())
    storm, cell, min_size = "2021091001", fitted["cell"], loo["min_size"]
    ev = fit.training_events(cell["over"])
    g = ev[ev["storm_id"] == storm]
    want = loo["sim"]["per_storm"][storm]
    theta = fit.world_draws(fit.two_level(fitted["sim"]["counties"], exclude=storm), list(g["fips"]), want["N"],
                            f"{fit.SEED}/loo-theta/sim/{storm}")
    sims = {r.fips: fit._look_features((r.size, r.p1, r.c_rel, f"{fit.SEED}/loo-worlds/{storm}/{r.fips}",
                                        theta[r.fips], "sim", cell)) for r in g.itertuples()}
    plan = hindsight_plan(g, min_size)
    real = {r.fips: fit.milestones(r) for r in g.itertuples()}
    from .looks import rank_check
    res = rank_check([vectors(look, real, sims) for look in plan])
    assert res["p"] == want["p"] and res["look_p"] == want["look_p"]
