"""Run: engine/.venv/bin/python -m pytest python/eaglei/ -q -p no:cacheprovider (from engine/)."""
from __future__ import annotations

import numpy as np

from .county_sim import (CENSORED, CREWS_PER_10K, DT, _worlds, exponential_features, features, grid_up,
                         restore_quantiles, simulated_curves, unit_quantiles, weibull_scale)
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


def test_simulated_curves_match_the_affine_features():
    # The slot-by-slot curve builder (plots) and the affine fast path (the fit) must agree, at a non-default crew density.
    rng_theta = np.random.default_rng(4)
    theta = np.column_stack([rng_theta.normal(-1.5, 0.8, 40), rng_theta.uniform(0, 20, 40)])
    crews = 0.5 * CREWS_PER_10K
    Q = unit_quantiles(12_000, 4_000, 40, np.random.default_rng(9), 1.5, crews)
    fast = features(theta[:, 0], theta[:, 1], Q, 300, 1.5, crews)
    curves = simulated_curves(12_000, 4_000, 301, theta, np.random.default_rng(9), 1.5, crews)
    for s in range(40):
        want = []
        for q in MILESTONES.values():
            i = milestone(curves[s], 0, 300, (1 - q) * curves[s, 0])
            want.append(CENSORED if i is None else i * DT)
        assert np.allclose(fast[s], want), (s, fast[s], want)


def test_crew_density_sets_the_crew_count_and_keeps_the_affine_map():
    few = _worlds(20_000, 5_000, 4, np.random.default_rng(3), 1.5, 1.0, 0.0, 0.25 * CREWS_PER_10K)
    assert set(few["crews"]) == {1}  # sqrt(6)/4 per 10k of about 20k customers rounds to 1
    unit = _worlds(30_000, 9_000, 6, np.random.default_rng(7), 1.5, 1.0, 0.0, 2 * CREWS_PER_10K)
    moved = _worlds(30_000, 9_000, 6, np.random.default_rng(7), 1.5, 2.5, 6.0, 2 * CREWS_PER_10K)
    out = unit["R"] > 0
    assert np.allclose(moved["R"][out], 6.0 + 2.5 * unit["R"][out])


def test_fewer_crews_restore_later_in_the_same_world():
    Q_many = unit_quantiles(40_000, 12_000, 64, np.random.default_rng(5), 1.5, 2 * CREWS_PER_10K)
    Q_few = unit_quantiles(40_000, 12_000, 64, np.random.default_rng(5), 1.5, 0.25 * CREWS_PER_10K)
    assert (np.median(Q_few, axis=0) > np.median(Q_many, axis=0)).all()
