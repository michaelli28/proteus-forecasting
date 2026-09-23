"""Run: engine/.venv/bin/python -m pytest python/eaglei/ -q -p no:cacheprovider (from engine/)."""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import numpy as np

from .rank import min_p_combined, pooled_mahalanobis, rank_p_all

ENGINE = Path(__file__).resolve().parents[2]


def ts(looks: list) -> dict:
    out = subprocess.run(["node", "--import", "tsx", "python/eaglei/ts_rank.ts"], cwd=ENGINE,
                         input=json.dumps({"looks": looks}), capture_output=True, text=True, check=True,
                         env={**os.environ, "DOTENV_CONFIG_PATH": "/dev/null"})
    return json.loads(out.stdout)


def test_python_rank_check_matches_the_engine_typescript_exactly():
    # Censored milestones (168.25) make exact ties common, so the inputs include many.
    rng = np.random.default_rng(5)
    looks = []
    for m in range(4):
        pts = np.round(rng.gamma(2.0, 10.0, size=(65, 3)) * 4) / 4
        pts[rng.random((65, 3)) < 0.15] = 168.25
        pts[3] = pts[0]  # an exact tie with the observed member
        looks.append(pts.tolist())
    want = ts(looks)
    scores = [pooled_mahalanobis(np.array(p)) for p in looks]
    assert np.allclose(scores, want["scores"], rtol=1e-12, atol=0)
    assert [rank_p_all(s).tolist() for s in scores] == want["p"]
    assert min_p_combined(np.array(scores)) == want["minP"]


def test_rank_p_counts_ties_against_the_alarm():
    assert rank_p_all(np.array([2.0, 2, 2, 2])).tolist() == [1, 1, 1, 1]
    assert rank_p_all(np.array([5.0, 5, 1, 1]))[0] == 0.5
