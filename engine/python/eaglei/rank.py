"""The rank check of engine/src/metrics/rank-check.ts, vectorised with sorts (protocol §11).

Same statistics, same tie rule (ties count against the alarm), same shrunk pooled covariance.
test_rank.py runs both implementations on the same inputs and requires identical p-values.
Sorting gives every member's rank at O(N log N), where the TS code's pairwise filter is O(N^2) per member.
"""
from __future__ import annotations

import numpy as np
from scipy.linalg import solve_triangular

SHRINKAGE = 0.1
MIN_VALUE = 5e-324  # JavaScript's Number.MIN_VALUE


def pooled_mahalanobis(points: np.ndarray) -> np.ndarray:
    """Squared distance of each row from the pooled mean under the shrunk pooled covariance."""
    x = np.asarray(points, dtype=float)
    centred = x - x.mean(axis=0)
    cov = centred.T @ centred / (len(x) - 1)
    shrunk = (1 - SHRINKAGE) * cov
    np.fill_diagonal(shrunk, np.diag(cov) * (1 + 1e-9) + MIN_VALUE)
    lower = np.linalg.cholesky(shrunk)
    y = solve_triangular(lower, centred.T, lower=True)
    return (y * y).sum(axis=0)


def rank_p_all(scores: np.ndarray) -> np.ndarray:
    """Every member's rank p-value: the share of members scoring at least its score, itself included."""
    s = np.asarray(scores, dtype=float)
    ranked = np.sort(s)
    return (len(s) - np.searchsorted(ranked, s, side="left")) / len(s)


def min_p_combined(scores_by_look: np.ndarray, observed: int = 0) -> float:
    """Each member's smallest rank p across looks, then the observed member's min-p ranked among all."""
    min_p = np.min([rank_p_all(s) for s in scores_by_look], axis=0)
    return float(np.count_nonzero(min_p <= min_p[observed]) / len(min_p))
