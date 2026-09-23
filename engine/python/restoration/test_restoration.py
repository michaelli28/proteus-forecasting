"""Run: engine/.venv/bin/python -m pytest python/restoration/ -q (from engine/)."""
from __future__ import annotations

import itertools
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

from .bridge import _check
from .milp import ancestors, horizon, solve

ENGINE = Path(__file__).resolve().parents[2]


def cost(problem: dict, starts: list[int]) -> int:
    done = [s + p for s, p in zip(starts, problem["ticks"])]
    return sum(w * max(done[a] for a in chain)
               for w, chain in zip(problem["customers"], ancestors(problem["parent"])))


def one_crew_brute(problem: dict) -> int:
    best = None
    for order in itertools.permutations(range(len(problem["ticks"]))):
        t, starts = 0, [0] * len(order)
        for j in order:
            starts[j] = t
            t += problem["ticks"][j]
        c = cost(problem, starts)
        best = c if best is None else min(best, c)
    return best


def random_problem(rng: np.random.Generator, k: int) -> dict:
    return {"parent": [int(rng.integers(-1, j)) if j else -1 for j in range(k)],
            "customers": [int(x) for x in rng.integers(0, 50, k)],
            "ticks": [int(x) for x in rng.integers(1, 17, k)]}


def test_hand_chain_one_crew():
    # 0 above 1; 1 has the customers. Either order finishes both at tick 5; customers back at 5.
    problem = {"parent": [-1, 0], "customers": [0, 10], "ticks": [2, 3]}
    r = solve(problem, 1, relax=False, time_limit=10)
    assert r["status"] == "optimal" and r["objective"] == pytest.approx(50)
    assert cost(problem, r["starts"]) == 50


def test_milp_matches_brute_force_with_one_crew():
    rng = np.random.default_rng(1)
    for _ in range(60):
        problem = random_problem(rng, int(rng.integers(1, 7)))
        r = solve(problem, 1, relax=False, time_limit=30)
        assert r["status"] == "optimal"
        assert r["objective"] == pytest.approx(one_crew_brute(problem), rel=1e-6)


def test_lp_floor_below_milp_and_starts_feasible():
    rng = np.random.default_rng(2)
    for _ in range(40):
        problem = random_problem(rng, int(rng.integers(2, 9)))
        crews = int(rng.integers(1, 5))
        m = solve(problem, crews, relax=False, time_limit=30)
        lp = solve(problem, crews, relax=True, time_limit=30)
        assert m["status"] == "optimal" and lp["status"] == "optimal" and lp["starts"] is None
        assert lp["objective"] <= m["objective"] * (1 + 1e-6)
        starts = m["starts"]
        assert cost(problem, starts) == pytest.approx(m["objective"], rel=1e-6)
        for t in range(horizon(problem["ticks"], crews)):
            busy = sum(s <= t < s + p for s, p in zip(starts, problem["ticks"]))
            assert busy <= crews


def _bridge(request) -> dict:
    out = subprocess.run([sys.executable, "-m", "python.restoration.bridge"], cwd=ENGINE,
                         input=request if isinstance(request, str) else json.dumps(request),
                         capture_output=True, text=True, timeout=120)
    return json.loads(out.stdout)


def test_bridge_round_trip_and_errors():
    good = _bridge({"command": "solve", "mode": "milp", "crews": 2, "timeLimitSeconds": 10,
                    "problems": [{"parent": [-1, 0], "customers": [0, 10], "ticks": [2, 3]}]})
    assert good["ok"] is True and good["results"][0]["status"] == "optimal"
    assert good["solver"].startswith("scipy ")
    assert _bridge("{not json")["ok"] is False
    bad = _bridge({"command": "solve", "mode": "milp", "crews": 0, "timeLimitSeconds": 10, "problems": []})
    assert bad["ok"] is False and "crews" in bad["error"]
    bad_parent = _bridge({"command": "solve", "mode": "lp", "crews": 1, "timeLimitSeconds": 10,
                          "problems": [{"parent": [1, -1], "customers": [1, 1], "ticks": [1, 1]}]})
    assert bad_parent["ok"] is False and "parent" in bad_parent["error"]


def _request(**overrides) -> dict:
    return {"command": "solve", "mode": "milp", "crews": 2, "timeLimitSeconds": 10,
            "problems": [{"parent": [-1, 0], "customers": [0, 10], "ticks": [2, 3]}], **overrides}


def test_check_accepts_the_well_formed_request():
    _check(_request())
    _check(_request(crews=1, timeLimitSeconds=0.5))


def test_check_rejects_a_bool_crew_count():
    # True is an int in Python, so crews=true would quietly solve for one crew.
    with pytest.raises(ValueError, match="crews"):
        _check(_request(crews=True))


@pytest.mark.parametrize("limit", ["NaN", "Infinity", "0", "-5", "true", '"60"'])
def test_check_requires_a_finite_positive_time_limit(limit):
    # json.load accepts NaN and Infinity, and NaN <= 0 is False: a plain "> 0" check lets them in.
    request = json.loads('{"timeLimitSeconds": ' + limit + "}")
    with pytest.raises(ValueError, match="timeLimitSeconds"):
        _check(_request(**request))


@pytest.mark.parametrize("customers", [[0, -1], [0, 2.5], [0, True], [0, "10"]])
def test_check_requires_whole_customer_counts(customers):
    problem = {"parent": [-1, 0], "customers": customers, "ticks": [2, 3]}
    with pytest.raises(ValueError, match="customers"):
        _check(_request(problems=[problem]))
