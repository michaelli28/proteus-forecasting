"""Run: engine/.venv/bin/python -m pytest python/eaglei/ -q -p no:cacheprovider (from engine/)."""
from __future__ import annotations

import numpy as np

from .county_sim import features, unit_quantiles
from .fit import FULL_WINDOW, abc, ensemble_size, population, prior_draws


def test_ensemble_size_follows_the_protocol_rule():
    # N + 1 = the smallest power of two >= max(1024, 50 m).
    assert [ensemble_size(m) + 1 for m in (1, 20, 21, 67, 118)] == [1024, 1024, 2048, 4096, 8192]


def test_population_spread_is_the_law_of_total_variance():
    posts = {"a": {"mean": [0.0, 10.0], "cov": [[1.0, 0.0], [0.0, 4.0]]},
             "b": {"mean": [2.0, 14.0], "cov": [[3.0, 0.0], [0.0, 8.0]]}}
    sp = population(posts)
    assert sp["mean"] == [1.0, 12.0]
    assert np.allclose(sp["cov"], [[2.0 + 2.0, 4.0], [4.0, 8.0 + 6.0]])
    assert population(posts, exclude="a")["storms"] == 1


def test_abc_recovers_a_known_work_rate_from_a_large_county():
    rng = np.random.default_rng(12)
    pool = unit_quantiles(60_000, 20_000, 256, np.random.default_rng(13))
    truth = np.array([[np.log(0.3), 6.0]])
    x = features(truth[:, 0], truth[:, 1], pool[:1], FULL_WINDOW)[0]
    post = abc([(x, pool, FULL_WINDOW), (x, pool, FULL_WINDOW)], "sim", prior_draws("sim", 50_000, rng), rng)
    lo, hi = np.percentile(post, [2.5, 97.5], axis=0)
    assert (lo <= truth[0]).all() and (truth[0] <= hi).all()  # the truth sits inside the 95% posterior
    assert hi[0] - lo[0] < 0.5 * (np.log(100) - np.log(0.01))  # one county trades delay against work rate, but narrows the prior
