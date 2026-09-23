"""Run: engine/.venv/bin/python -m pytest python/eaglei/ -q -p no:cacheprovider (from engine/)."""
from __future__ import annotations

import numpy as np

from .county_sim import (CENSORED, DT, _worlds, exponential_features, features, grid_up, restore_quantiles,
                         unit_quantiles, weibull_scale)
from .events import MILESTONES, milestone


def test_scale_and_delay_are_an_affine_map_of_the_unit_world():
    # The whole fit rests on this: re-simulating at scale s and delay d equals d + s x the unit world.
    unit = _worlds(30_000, 9_000, 6, np.random.default_rng(7), 1.5, 1.0, 0.0)
    moved = _worlds(30_000, 9_000, 6, np.random.default_rng(7), 1.5, 3.7, 11.0)
    out = unit["R"] > 0
    assert np.allclose(moved["R"][out], 11.0 + 3.7 * unit["R"][out])
    assert np.allclose(restore_quantiles(moved["R"], moved["w"]), 11.0 + 3.7 * restore_quantiles(unit["R"], unit["w"]))


def test_simulated_peak_meets_the_observed_peak_and_crews_follow_size():
    sim = _worlds(20_000, 5_000, 20, np.random.default_rng(3), 1.5, 1.0, 0.0)
    peak = sim["w"].sum(axis=1)
    assert (peak >= 5_000).all() and np.median(peak) < 5_600  # overshoot is at most one subtree
    assert set(sim["crews"]) <= {4, 5, 6}  # sqrt(6) per 10k of about 20k customers


def test_features_match_the_real_curve_milestone_code_on_the_same_curve():
    # Build each world's customers-out curve on the 15-min grid and run events.milestone on it.
    rng = np.random.default_rng(11)
    sim = _worlds(8_000, 3_000, 5, rng, 1.5, 1.0, 0.0)
    Q = restore_quantiles(sim["R"], sim["w"])
    log_w, delay, c_rel = np.log(0.9), 4.0, 200
    got = features(np.full(5, log_w), np.full(5, delay), Q, c_rel)
    R = delay + weibull_scale(np.array(log_w)) * sim["R"]
    for s in range(5):
        grid = np.arange(c_rel + 1) * DT
        restored = (sim["w"][s][None, :] * (grid_up(R[s])[None, :] <= grid[:, None])).sum(axis=1)
        curve = sim["w"][s].sum() - restored
        want = []
        for q in MILESTONES.values():
            i = milestone(curve, 0, c_rel, (1 - q) * curve[0])
            want.append(CENSORED if i is None else i * DT)
        assert np.allclose(got[s], want), (s, got[s], want)


def test_a_milestone_whose_hold_runs_past_c_is_censored():
    Q = np.array([[1.0, 2.0, 3.0]])
    f = features(np.log(np.array([1.0 / 2.7])), np.array([10.0]), Q, c_rel=(12 * 4) + 7)
    assert f[0, 0] <= 12.0 and f[0, 2] == CENSORED


def test_exponential_baseline_milestones():
    f = exponential_features(np.log(np.array([10.0])), np.array([2.0]), c_rel=10_000)
    assert np.allclose(f[0], grid_up(2.0 + 10.0 * -np.log1p(-np.array([0.5, 0.9, 0.95]))))


def test_unit_quantiles_batches_without_changing_shape():
    assert unit_quantiles(5_000, 2_000, 7, np.random.default_rng(1)).shape == (7, 3)


def test_a_pool_of_one_matches_the_affine_single_county_path():
    from .county_sim import unit_quantiles
    from .pooling import pooled_features, real_pooled_curve, simulated_pooled_curves
    rng_theta = np.random.default_rng(4)
    theta = np.column_stack([rng_theta.normal(-1.5, 0.8, 40), rng_theta.uniform(0, 20, 40)])
    m = {"a": 1000, "peak": 30, "c": 30 + 300, "mcc": 12_000, "p1": 4_000, "x": np.full(400, 7.0)}
    Q = unit_quantiles(12_000, 4_000, 40, np.random.default_rng(9))
    fast = features(theta[:, 0], theta[:, 1], Q, c_rel=300)
    curves = simulated_pooled_curves([m], theta, np.random.default_rng(9))
    slow = np.array([pooled_features(c) for c in curves])
    assert np.allclose(fast, slow)
    real, start, end = real_pooled_curve([m])
    assert (start, end, len(real)) == (1030, 1330, 301)


def test_a_later_member_contributes_its_observed_series_before_its_peak():
    from .pooling import simulated_pooled_curves
    early = {"a": 0, "peak": 10, "c": 200, "mcc": 5_000, "p1": 2_000, "x": np.full(300, 1.0)}
    late = {"a": 0, "peak": 40, "c": 250, "mcc": 5_000, "p1": 2_000, "x": np.full(300, 5.0)}
    curves = simulated_pooled_curves([early, late], np.array([[0.0, 100.0]]), np.random.default_rng(2))
    # Delay 100 h: nobody is restored inside the first 30 slots; the late member shows its observed 5.0 there.
    assert np.allclose(curves[0, :30] - curves[0, 0] + 5.0, 5.0)
    assert curves.shape == (1, 191)
