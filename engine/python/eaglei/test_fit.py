"""Run: engine/.venv/bin/python -m pytest python/eaglei/ -q -p no:cacheprovider (from engine/)."""
from __future__ import annotations

import json
from math import comb

import numpy as np
import pandas as pd
import pytest

from . import fit

from .county_sim import CENSORED, features, unit_quantiles
from .fit import (BASE_CELL, FULL_WINDOW, GRID, MAD_FLOOR, abc, cell_tag, choose_cell, county_sizes, energy_score,
                  ensemble_size, feature_scale, gate, pooled_look, prior_draws, score_out_of_sample, sign_flip_p,
                  two_level, undercount_share, world_draws, write_once)


def test_ensemble_size_follows_the_protocol_rule():
    # N + 1 = the smallest power of two >= max(1024, 50 m).
    assert [ensemble_size(m) + 1 for m in (1, 20, 21, 67, 118)] == [1024, 1024, 2048, 4096, 8192]


def test_abc_recovers_a_known_work_rate_from_a_large_county():
    rng = np.random.default_rng(12)
    pool = unit_quantiles(60_000, 20_000, 256, np.random.default_rng(13))
    truth = np.array([[np.log(0.3), 6.0]])
    x = features(truth[:, 0], truth[:, 1], pool[:1], FULL_WINDOW)[0]
    post = abc([(x, pool, FULL_WINDOW), (x, pool, FULL_WINDOW)], "sim", prior_draws("sim", 50_000, rng), rng,
               BASE_CELL)
    lo, hi = np.percentile(post, [2.5, 97.5], axis=0)
    assert (lo <= truth[0]).all() and (truth[0] <= hi).all()  # the truth sits inside the 95% posterior
    assert hi[0] - lo[0] < 0.5 * (np.log(100) - np.log(0.01))  # one county trades delay against work rate, but narrows the prior


def test_feature_scale_uses_uncensored_draws_when_most_are_censored():
    # The Checkpoint 3 defect: with >= half the draws censored the MAD was 0 and the 0.25 h floor bound.
    rng = np.random.default_rng(1)
    f = np.full((10_000, 3), CENSORED)
    f[:4000, 0] = rng.uniform(10, 50, 4000)  # 60% censored
    f[:50, 1] = rng.uniform(10, 50, 50)  # too few uncensored draws to scale on
    s = feature_scale(f)
    assert 12 < s[0] < 17  # 1.4826 x MAD of Uniform(10, 50) is about 14.8
    assert s[1] == MAD_FLOOR and s[2] == MAD_FLOOR


def test_two_level_recovers_known_between_and_within_spreads():
    rng = np.random.default_rng(3)
    B, W, mu = np.diag([1.0, 16.0]), np.diag([0.5, 36.0]), np.array([-1.0, 8.0])
    n_by_storm = rng.integers(3, 40, size=300)  # unequal storm sizes, as in the data
    fits = {}
    for s, n in enumerate(n_by_storm):
        eta = rng.multivariate_normal(mu, B)
        for c in range(n):
            fits[f"{s}/{c}"] = {"mean": (eta + rng.multivariate_normal(np.zeros(2), W)).tolist(),
                                "cov": np.zeros((2, 2)).tolist()}
    tl = two_level(fits)
    assert np.allclose(tl["mean"], mu, atol=0.25)
    assert np.allclose(np.diag(tl["within"]), np.diag(W), rtol=0.05)
    assert np.allclose(np.diag(tl["between"]), np.diag(B), rtol=0.25)
    assert two_level(fits, exclude="0")["storms"] == 299


def test_two_level_adds_county_posterior_noise_to_within():
    fits = {f"{s}/{c}": {"mean": [float(s), 0.0], "cov": [[2.0, 0.0], [0.0, 3.0]]} for s in range(4) for c in range(3)}
    tl = two_level(fits)
    assert np.allclose(tl["within"], [[2.0, 0.0], [0.0, 3.0]])  # no scatter within storms, so only the noise
    assert np.allclose(tl["between"], [[5 / 3, 0.0], [0.0, 0.0]])  # storm means vary in log W only
    assert np.linalg.eigvalsh(tl["between"]).min() >= -1e-12  # still a covariance matrix


def test_world_draws_share_the_storm_effect_and_clip_delay():
    shared = {"mean": [0.0, 5.0], "between": [[1.0, 0.0], [0.0, 25.0]], "within": [[1e-12, 0.0], [0.0, 1e-12]]}
    d = world_draws(shared, ["a", "b"], 4000, "t/shared")
    assert np.allclose(d["a"], d["b"], atol=1e-4)  # no county scatter: every county gets the storm's draw
    assert (d["a"][:, 1] >= 0).all() and (d["a"][:, 1] == 0).any()
    free = {"mean": [0.0, 5.0], "between": [[1e-12, 0.0], [0.0, 1e-12]], "within": [[1.0, 0.0], [0.0, 1.0]]}
    e = world_draws(free, ["a", "b"], 4000, "t/free")
    assert abs(np.corrcoef(e["a"][:, 0], e["b"][:, 0])[0, 1]) < 0.06  # counties independent without a storm effect


def test_pooled_look_is_the_p1_weighted_mean_of_member_milestones():
    members = pd.DataFrame({"fips": ["a", "b"], "p1": [1000.0, 3000.0],
                            "t50": [4.0, 8.0], "t90": [10.0, 20.0], "t95": [12.0, CENSORED]})
    worlds = {"a": np.full((5, 3), 2.0), "b": np.full((5, 3), 6.0)}
    real, sim = pooled_look(members, worlds)
    assert np.allclose(real, [7.0, 17.5, 0.25 * 12.0 + 0.75 * CENSORED])
    assert sim.shape == (5, 3) and np.allclose(sim, 5.0)


def test_between_floor_does_not_depend_on_units():
    # Delay in hours or in days must give the same floored B, up to the unit change.
    rng = np.random.default_rng(6)
    fits = {}
    for s in range(6):
        eta = rng.normal([0.0, 8.0], [0.05, 0.5])  # storm effects small next to the scatter, so the floor binds
        for c in range(5):
            fits[f"{s}/{c}"] = {"mean": (eta + rng.normal([0.0, 0.0], [1.0, 10.0])).tolist(), "cov": np.zeros((2, 2)).tolist()}
    days = {k: {"mean": [v["mean"][0], v["mean"][1] / 24], "cov": v["cov"]} for k, v in fits.items()}
    b_hours, b_days = np.array(two_level(fits)["between"]), np.array(two_level(days)["between"])
    assert np.allclose(b_days * np.array([[1, 24], [24, 576]]), b_hours)


def test_energy_score_prefers_the_true_predictive_to_a_vaguer_one():
    rng = np.random.default_rng(8)
    truth = np.exp(rng.normal(3.0, 0.3, size=(300, 3)))
    sharp = np.exp(rng.normal(3.0, 0.3, size=(400, 3)))
    vague = np.exp(rng.normal(3.0, 1.2, size=(400, 3)))
    assert np.mean([energy_score(x, sharp) for x in truth]) < np.mean([energy_score(x, vague) for x in truth])


def test_energy_score_treats_everything_under_an_hour_as_an_hour():
    # Real milestones are never under 1 h (the peak is held for 1 h), so simulated 0.25 h must not cost more than 1 h.
    x = np.array([1.0, 5.0, 9.0])
    early = np.tile([0.25, 5.0, 9.0], (50, 1))
    at_hour = np.tile([1.0, 5.0, 9.0], (50, 1))
    assert energy_score(x, early) == energy_score(x, at_hour)


def test_county_sizes_and_the_undercount_share():
    k = pd.DataFrame({"p1": [100.0, 300.0, 500.0, 900.0], "mcc": [1000.0, 1000.0, 1000.0, 600.0]})
    s = undercount_share(k)
    assert s == 0.3  # the median p1 / MCC over the three counties that are not over-MCC
    assert county_sizes(k, "peak", s).tolist() == [1000.0, 1000.0, 1000.0, 900.0]
    assert np.allclose(county_sizes(k, "share", s), [1000.0, 1000.0, 1000.0, 3000.0])


def test_sign_flip_p_is_exact():
    assert sign_flip_p(-np.ones(18)) == 1 / 2 ** 18  # every storm better: only the observed pattern is as low
    assert sign_flip_p(np.ones(18)) == 1.0
    four_worse = np.r_[np.ones(4), -np.ones(14)]  # p = P(at most 4 of 18 fair signs are +)
    assert np.isclose(sign_flip_p(four_worse), sum(comb(18, k) for k in range(5)) / 2 ** 18)


def test_choose_cell_keeps_the_base_unless_a_cell_beats_it_clearly():
    rng = np.random.default_rng(2)
    storms = np.repeat([f"s{i}" for i in range(18)], 20)
    base = rng.normal(1.0, 0.3, storms.size)
    clear = {"base": base, "better": base - 0.2 + rng.normal(0, 0.02, storms.size)}
    pick = choose_cell(clear, storms, "base", "t/select")
    assert pick["chosen"] == "better" and pick["vs_base"]["base"]["paired_diff_mean"] == 0.0
    assert pick["p_bar"] == 0.025  # one alternative: no multiplicity adjustment
    noise = {"base": base, "noisy": base + rng.normal(-0.01, 0.3, storms.size)}
    assert choose_cell(noise, storms, "base", "t/select")["chosen"] == "base"
    # Better in 14 of 18 storms: p = 0.0154 clears 0.025 alone, but not 0.025 / 23 among 24 cells.
    edge_cell = base + np.repeat(np.r_[np.ones(4), -np.ones(14)] * 0.01, 20)
    assert choose_cell({"base": base, "edge": edge_cell}, storms, "base", "t/select")["chosen"] == "edge"
    many = {"base": base, **{f"c{i}": base + 0.01 for i in range(22)}, "edge": edge_cell}
    adjusted = choose_cell(many, storms, "base", "t/select")
    assert adjusted["p_bar"] == 0.025 / 23 and adjusted["best"] == "edge" and adjusted["chosen"] == "base"


def test_a_county_is_scored_without_any_fit_from_its_own_storm():
    ev = pd.DataFrame({"storm_id": np.repeat(["2019a", "2019b", "2020c"], 3), "fips": [f"{i:05d}" for i in range(9)],
                       "size": 8000.0, "p1": 3000.0, "c_rel": 672, "t50": 6.0, "t90": 20.0, "t95": 30.0})
    rng = np.random.default_rng(1)
    fits = {f"{r.storm_id}/{r.fips}": {"mean": [rng.normal(-1, 0.5), rng.uniform(2, 10)], "cov": np.eye(2).tolist()}
            for r in ev.itertuples()}
    before = [r["es"] for r in score_out_of_sample(ev, fits, BASE_CELL)]
    own = {**fits, "2019a/00001": {"mean": [2.0, 60.0], "cov": np.eye(2).tolist()}}  # a county in the first storm
    after = [r["es"] for r in score_out_of_sample(ev, own, BASE_CELL)]
    assert after[:3] == before[:3]  # the first storm's scores cannot see its own fits
    assert after[3:] != before[3:]  # the other storms' forecasts do use it


def test_a_result_is_written_once_and_every_write_is_logged(tmp_path, monkeypatch):
    monkeypatch.setattr(fit, "OUT", tmp_path)
    write_once(tmp_path / "loo.json", {"x": 1}, None)
    with pytest.raises(SystemExit):
        write_once(tmp_path / "loo.json", {"x": 2}, None)
    write_once(tmp_path / "loo.json", {"x": 3}, "a disclosed bug fix")
    log = [json.loads(line) for line in (tmp_path / "runs.log").read_text().splitlines()]
    assert [e["deviation"] for e in log] == [None, "a disclosed bug fix"]
    assert json.loads((tmp_path / "loo.json").read_text())["x"] == 3


def test_select_refuses_cells_without_one_recorded_commit(tmp_path, monkeypatch):
    (tmp_path / "train-events.csv").write_text("storm_id,fips\n")
    two = (BASE_CELL, {"crews": 2.0, "shape": 1.5, "over": "peak"})
    monkeypatch.setattr(fit, "CHECK", tmp_path)
    monkeypatch.setattr(fit, "OUT", tmp_path / "out")
    monkeypatch.setattr(fit, "GRID_DIR", tmp_path / "out" / "grid")
    monkeypatch.setattr(fit, "GRID", two)
    monkeypatch.setattr(fit, "PROVENANCE", {"head": "h1", "protocol_commit": "p1"})
    data = fit.data_sha256()
    for cell in two:
        d = tmp_path / "out" / "grid" / cell_tag(cell)
        d.mkdir(parents=True)
        (d / "cell.json").write_text(json.dumps({"cell": cell, "events": ["2019a/1"], "es": [1.0], "p": [0.5],
                                                 "data_sha256": data, "run": {}}))
    with pytest.raises(SystemExit, match="one commit"):
        fit.stage_select()


def test_the_grid_has_24_cells_and_includes_the_base():
    assert len(GRID) == 24 and BASE_CELL in GRID
    assert len({cell_tag(c) for c in GRID}) == 24


def test_gate_needs_every_check():
    shrink = {"median_shrinkage": {"1000": 0.7, "2000": 0.82, "3000": 0.85}, "min_size": 2000, "reached": True}
    ok = {"binomial_p_vs_5pct": 0.06, "county_rate_ci95": [0.03, 0.08]}
    assert gate(ok, shrink, pooled=10, events=100)["go"]
    assert not gate({**ok, "binomial_p_vs_5pct": 0.01}, shrink, pooled=10, events=100)["go"]
    assert not gate({**ok, "county_rate_ci95": [0.051, 0.09]}, shrink, pooled=10, events=100)["go"]
    assert not gate(ok, shrink, pooled=60, events=100)["go"]
    assert not gate(ok, {**shrink, "reached": False}, pooled=10, events=100)["go"]
    assert not gate(ok, {**shrink, "median_shrinkage": {"1000": 0.7, "2000": 0.82, "3000": 0.78}},
                    pooled=10, events=100)["go"]
