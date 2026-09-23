"""Pooled looks for county-events below the minimum size (protocol §10).

A storm's small county-events become one look:
- **Real curve:** the slot-by-slot sum of the members' bridged series, from the earliest member
  peak to the earliest member c. A pooled slot is missing if any member's slot is.
- **Simulated curve, per world:** the members' simulated curves, each starting at that member's
  observed peak slot. Before its own peak a member contributes its observed series.
- **Features:** p1 and the milestones follow §7, applied to the sum. p1 is the largest one-hour
  level in the window.

Members start at different slots, so a pooled world is no longer an affine map of one unit world,
and its curve is built explicitly.
"""
from __future__ import annotations

import numpy as np

from .county_sim import CENSORED, DT, N_NODES, MEAN_CUST, BATCH_ELEMS, _worlds, weibull_scale
from .events import MILESTONES, PEAK_HOLD, held, milestone


def pooled_features(curve: np.ndarray) -> np.ndarray:
    """(3,) milestones of one pooled curve over its whole window [0, len - 1]."""
    h = held(curve, PEAK_HOLD)
    if np.isnan(h).all():
        return np.full(3, CENSORED)
    peak = int(np.nanargmax(h))
    p1 = float(h[peak])
    c = len(curve) - 1
    out = []
    for q in MILESTONES.values():
        i = milestone(curve, peak, c, (1 - q) * p1)
        out.append(CENSORED if i is None else (i - peak) * DT)
    return np.array(out)


def real_pooled_curve(members: list[dict]) -> tuple[np.ndarray, int, int]:
    """members: dicts with the bridged series `x`, window start `a`, and `peak` and `c` relative to a.
    Returns the pooled curve and its global start and end slots."""
    start = min(m["a"] + m["peak"] for m in members)
    end = min(m["a"] + m["c"] for m in members)
    total = np.zeros(end - start + 1)
    for m in members:
        total += m["x"][start - m["a"]:end - m["a"] + 1]  # NaN in any member makes the slot missing
    return total, start, end


def simulated_pooled_curves(members: list[dict], theta: np.ndarray, rng: np.random.Generator,
                            shape: float = 1.5) -> np.ndarray:
    """(N, L) pooled curves for N worlds with parameters theta (N, 2): (log W, delay)."""
    start = min(m["a"] + m["peak"] for m in members)
    end = min(m["a"] + m["c"] for m in members)
    L = end - start + 1
    N = len(theta)
    lam = weibull_scale(theta[:, 0], shape)
    delay = np.maximum(theta[:, 1], 0.0)
    pooled = np.zeros((N, L))
    for m in members:
        off = m["a"] + m["peak"] - start  # slot of this member's peak inside the pooled window
        n_pre = min(off, L)
        if n_pre > 0:  # before its own peak a member contributes its observed series
            pooled[:, :n_pre] += m["x"][start - m["a"]:start - m["a"] + n_pre][None, :]
        if off >= L:
            continue
        size = max(m["mcc"], m["p1"])
        F = max(1, int(round(size / (N_NODES * MEAN_CUST))))
        per = max(1, BATCH_ELEMS // (F * N_NODES))
        for b0 in range(0, N, per):
            b1 = min(N, b0 + per)
            sim = _worlds(size, m["p1"], b1 - b0, rng, shape, 1.0, 0.0)
            R, w = sim["R"], sim["w"]
            k = np.ceil((delay[b0:b1, None] + lam[b0:b1, None] * R) / DT - 1e-9).astype(np.int64)
            restored = np.zeros((b1 - b0, L - off + 1))
            rows = np.broadcast_to(np.arange(b1 - b0)[:, None], k.shape)
            inside = (w > 0) & (k <= L - off - 1)
            np.add.at(restored, (rows[inside], k[inside]), w[inside])
            out = w.sum(axis=1)[:, None] - np.cumsum(restored[:, :L - off], axis=1)
            pooled[b0:b1, off:] += out
    return pooled


def exponential_pooled_curves(members: list[dict], theta: np.ndarray) -> np.ndarray:
    """(N, L) pooled curves for the exponential baseline, theta (N, 2): (log tau, delay). Each member
    decays from its observed p1, starting at its own peak slot."""
    start = min(m["a"] + m["peak"] for m in members)
    end = min(m["a"] + m["c"] for m in members)
    L = end - start + 1
    tau = np.exp(theta[:, 0])[:, None]
    delay = np.maximum(theta[:, 1], 0.0)[:, None]
    pooled = np.zeros((len(theta), L))
    for m in members:
        off = m["a"] + m["peak"] - start
        n_pre = min(off, L)
        if n_pre > 0:
            pooled[:, :n_pre] += m["x"][start - m["a"]:start - m["a"] + n_pre][None, :]
        if off >= L:
            continue
        t = np.arange(L - off)[None, :] * DT
        pooled[:, off:] += m["p1"] * np.exp(-np.maximum(t - delay, 0.0) / tau)
    return pooled
