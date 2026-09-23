"""County-scale restoration simulator (protocol §10; docs/RESTORATION-ADDENDUM.md pins the details).

Spike S3's toy, unchanged in structure:
- A county is F random radial feeders, each with 60 sections of about 17 customers.
- Weather damage breaks sections so that the customers out at t = 0 match the observed peak p1.
- Identical crews work a static most-customers-first list: a section's downstream customers.
- A customer is back when every broken section on its path is repaired.

The scale trick: with identical crews and a fixed list, multiplying every repair time by s multiplies
every completion time by s, and a common start delay shifts them all. So a world is simulated once, at
unit Weibull scale and zero delay. Any (work rate, delay) is then an affine map of its unit
restore-time quantiles; test_county_sim checks this against re-simulation.
"""
from __future__ import annotations

import math

import numpy as np

N_NODES = 60
MEAN_CUST = 17.0
CUST_SIGMA = 0.8
JUMP_P = 0.35  # parent = i - Geometric(0.35): long chains with branches
CREWS_PER_10K = math.sqrt(6)  # protocol §10: S3's reference point
SHAPE = 1.5
DT = 0.25
CENSORED = 168.25
MILESTONE_HOLD = 8
QUANTS = (0.5, 0.9, 0.95)
BATCH_ELEMS = 3_000_000


def grid_up(t: np.ndarray) -> np.ndarray:
    """First 15-minute tick at or after t: the first slot a curve shows the change."""
    return np.ceil(t / DT - 1e-9) * DT


def weibull_scale(log_w: np.ndarray, shape: float = SHAPE) -> np.ndarray:
    """Repair-time Weibull scale (h) for log work rate W = mean repair hours / crews per 10k."""
    return np.exp(log_w) * CREWS_PER_10K / math.gamma(1 + 1 / shape)


def _worlds(size: float, p1: float, S: int, rng: np.random.Generator, shape: float,
            scale: float, delay: float) -> dict[str, np.ndarray]:
    """S worlds of one county at one (scale, delay): node restore times R (S, F*n), customers w."""
    n = N_NODES
    F = max(1, int(round(size / (n * MEAN_CUST))))
    SF = S * F
    jumps = rng.geometric(JUMP_P, size=(SF, n))
    parent = np.maximum(np.arange(n)[None, :] - jumps, 0)
    parent[:, 0] = -1
    mu = math.log(MEAN_CUST) - 0.5 * CUST_SIGMA**2
    cust = np.maximum(1.0, np.rint(rng.lognormal(mu, CUST_SIGMA, size=(SF, n))))
    U = rng.random((SF, n))
    wb = rng.weibull(shape, size=(SF, n))
    tie = rng.random((SF, n))

    rows = np.arange(SF)
    pathmin = U.copy()
    for i in range(1, n):
        pathmin[:, i] = np.minimum(pathmin[rows, parent[:, i]], U[:, i])
    sub_c = cust.copy()
    for i in range(n - 1, 0, -1):
        sub_c[rows, parent[:, i]] += sub_c[:, i]  # one parent per row, so no index repeats

    # Damage threshold: the smallest q at which the customers out reach p1 (capped at the whole county).
    pm = pathmin.reshape(S, F * n)
    cw = cust.reshape(S, F * n)
    total = cw.sum(axis=1)
    target = np.minimum(p1, total)
    order_pm = np.argsort(pm, axis=1)
    cum = np.cumsum(np.take_along_axis(cw, order_pm, axis=1), axis=1)
    j = np.argmax(cum >= target[:, None], axis=1)
    q = np.take_along_axis(pm, order_pm, axis=1)[np.arange(S), j]
    damaged = U.reshape(S, F * n) <= q[:, None]
    n_jobs = damaged.sum(axis=1)

    key = np.where(damaged, sub_c.reshape(S, F * n) + tie.reshape(S, F * n) * 0.5, -1.0)
    kmax = int(n_jobs.max())
    order = np.argsort(-key, axis=1)[:, :kmax]
    p = np.take_along_axis(scale * wb.reshape(S, F * n), order, axis=1)

    crews = np.maximum(1, np.rint(CREWS_PER_10K * total / 1e4)).astype(int)
    cmax = int(crews.max())
    avail = np.where(np.arange(cmax)[None, :] < crews[:, None], delay, np.inf)
    comp = np.zeros((S, kmax))
    srows = np.arange(S)
    for k in range(kmax):
        c = np.argmin(avail, axis=1)
        fin = avail[srows, c] + p[:, k]
        valid = k < n_jobs
        avail[srows[valid], c[valid]] = fin[valid]
        comp[:, k] = np.where(valid, fin, 0.0)
    comp_sec = np.zeros((S, F * n))
    np.put_along_axis(comp_sec, order, comp, axis=1)
    comp_sec = comp_sec.reshape(SF, n)
    R = comp_sec.copy()
    for i in range(1, n):
        R[:, i] = np.maximum(R[rows, parent[:, i]], comp_sec[:, i])
    R = R.reshape(S, F * n)
    return {"R": R, "w": np.where(R > 0, cw, 0.0), "crews": crews, "n_jobs": n_jobs}


def restore_quantiles(R: np.ndarray, w: np.ndarray, quants: tuple[float, ...] = QUANTS) -> np.ndarray:
    """(S, len(quants)): the restore time by which a share q of the simulated peak is back."""
    peak = w.sum(axis=1)
    o = np.argsort(R, axis=1)
    Rs = np.take_along_axis(R, o, axis=1)
    cumw = np.cumsum(np.take_along_axis(w, o, axis=1), axis=1)
    rows = np.arange(R.shape[0])
    return np.column_stack([Rs[rows, np.argmax(cumw >= q * peak[:, None] - 1e-9, axis=1)] for q in quants])


def unit_quantiles(size: float, p1: float, n_worlds: int, rng: np.random.Generator,
                   shape: float = SHAPE) -> np.ndarray:
    """(n_worlds, 3) restore-time quantiles at unit Weibull scale and zero delay, simulated in batches."""
    F = max(1, int(round(size / (N_NODES * MEAN_CUST))))
    per = max(1, BATCH_ELEMS // (F * N_NODES))
    out = []
    done = 0
    while done < n_worlds:
        S = min(per, n_worlds - done)
        sim = _worlds(size, p1, S, rng, shape, 1.0, 0.0)
        out.append(restore_quantiles(sim["R"], sim["w"]))
        done += S
    return np.concatenate(out)


def features(log_w: np.ndarray, delay: np.ndarray, Q: np.ndarray, c_rel: int,
             shape: float = SHAPE) -> np.ndarray:
    """Milestones (h) for work rates and delays broadcast against unit quantiles Q (..., 3).

    A milestone counts only if its 2-hour hold fits inside the feature window, as for real curves
    (§7.8): slot i + 7 <= c_rel. Otherwise it is 168.25."""
    t = grid_up(np.maximum(delay, 0.0)[..., None] + weibull_scale(log_w, shape)[..., None] * Q)
    return np.where(t / DT + (MILESTONE_HOLD - 1) <= c_rel, t, CENSORED)


def exponential_features(log_tau: np.ndarray, delay: np.ndarray, c_rel: int) -> np.ndarray:
    """The baseline: out(t) = p1 exp(-(t - delay)/tau) after the delay, so t_q = delay + tau ln 1/(1-q)."""
    k = -np.log1p(-np.array(QUANTS))
    t = grid_up(np.maximum(delay, 0.0)[..., None] + np.exp(log_tau)[..., None] * k)
    return np.where(t / DT + (MILESTONE_HOLD - 1) <= c_rel, t, CENSORED)
