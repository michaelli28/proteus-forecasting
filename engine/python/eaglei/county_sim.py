"""County-scale restoration simulator (protocol §10 and §16; docs/RESTORATION-ADDENDUM.md pins the details).

Spike S3's toy, unchanged in structure:
- A county is F random radial feeders, each with 60 sections of about 17 customers.
- Weather damage breaks sections so that the customers out at t = 0 match the observed peak p1.
- Identical crews work a static most-customers-first list: a section's downstream customers.
- A customer is back when every broken section on its path is repaired.
Crews per 10k and the repair-time shape are settings: §16.5 chooses them on training storms.

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
CREWS_PER_10K = math.sqrt(6)  # protocol §10: S3's reference point; §16.5 compares multiples of it
SHAPE = 1.5
DT = 0.25
CENSORED = 168.25
MILESTONE_HOLD = 8
QUANTS = (0.5, 0.9, 0.95)
BATCH_ELEMS = 3_000_000
READ_HOURS = (3, 6, 9, 12, 18, 24, 36, 48)  # §11: the looks at L = 12, 24, 48 h read at L/4, L/2, 3L/4 and L
PEAK_HOLD = 4  # a read is the 1-hour level h (§7.4); on a curve that only falls, h at slot i is its value at i + 3
CRITICAL_PER_FEEDER = 2  # Phase 1's two critical facilities per feeder (docs/RESTORATION-LAB-PREREG.md §2)
CRITICAL_KEY = 1e12  # critical-path sections sort ahead of every other; a feeder holds far fewer customers
CRITICAL_DEPTH_STEP = 1e8
PROLONG_MEAN_H = 72.0  # §12: a prolonged small failure adds Exponential(mean 72 h) to a node's restore time


def grid_up(t: np.ndarray) -> np.ndarray:
    """First 15-minute tick at or after t: the first slot a curve shows the change."""
    return np.ceil(t / DT - 1e-9) * DT


def weibull_scale(log_w: np.ndarray, shape: float = SHAPE, crews: float = CREWS_PER_10K) -> np.ndarray:
    """Repair-time Weibull scale (h) for log work rate W = mean repair hours / crews per 10k."""
    return np.exp(log_w) * crews / math.gamma(1 + 1 / shape)


def _worlds(size: float, p1: float, S: int, rng: np.random.Generator, shape: float,
            scale: float, delay: float, crews: float = CREWS_PER_10K, *, extra: np.random.Generator | None = None,
            critical_first: bool = False, tail_sigma: float = 0.0) -> dict[str, np.ndarray]:
    """S worlds of one county at one (scale, delay): node restore times R (S, F*n), customers w.

    Phase 4's planted errors (§12) draw from `extra`, never from `rng`, so a world's feeders, damage and repair
    draws are the same with or without them. With `extra`, every error's draws are made in one fixed order
    whichever error is used, so arms seeded alike are paired worlds. critical_first: Phase 1's rule 2 as a static
    list, two critical nodes per feeder and the sections on their paths first, nearest the substation first.
    tail_sigma: each repair time times a mean-one lognormal."""
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
    if extra is not None:
        critical = np.zeros((SF, n), bool)
        np.put_along_axis(critical, extra.random((SF, n)).argsort(axis=1)[:, :CRITICAL_PER_FEEDER], True, axis=1)
        z = extra.standard_normal((SF, n))
        prolong_u = extra.random((SF, n))
        prolong_h = extra.exponential(PROLONG_MEAN_H, size=(SF, n))
    elif critical_first or tail_sigma:
        raise ValueError("planted errors draw from `extra`")

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

    priority = sub_c
    if critical_first:
        on_path = critical.copy()  # a section is on a critical path if its subtree holds a critical node
        depth = np.zeros((SF, n))
        for i in range(n - 1, 0, -1):
            on_path[rows, parent[:, i]] |= on_path[:, i]
        for i in range(1, n):
            depth[:, i] = depth[rows, parent[:, i]] + 1
        priority = np.where(on_path, CRITICAL_KEY - depth * CRITICAL_DEPTH_STEP + sub_c, sub_c)
    key = np.where(damaged, priority.reshape(S, F * n) + tie.reshape(S, F * n) * 0.5, -1.0)
    kmax = int(n_jobs.max())
    order = np.argsort(-key, axis=1)[:, :kmax]
    repair = scale * wb
    if tail_sigma:
        repair = repair * np.exp(tail_sigma * z - 0.5 * tail_sigma**2)
    p = np.take_along_axis(repair.reshape(S, F * n), order, axis=1)

    n_crews = np.maximum(1, np.rint(crews * total / 1e4)).astype(int)
    cmax = int(n_crews.max())
    avail = np.where(np.arange(cmax)[None, :] < n_crews[:, None], delay, np.inf)
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
    out = {"R": R, "w": np.where(R > 0, cw, 0.0), "crews": n_crews, "n_jobs": n_jobs}
    if extra is not None:
        out |= {"prolong_u": prolong_u.reshape(S, F * n), "prolong_h": prolong_h.reshape(S, F * n),
                "critical": critical.reshape(S, F * n)}
    return out


def restore_quantiles(R: np.ndarray, w: np.ndarray, quants: tuple[float, ...] = QUANTS) -> np.ndarray:
    """(S, len(quants)): the restore time by which a share q of the simulated peak is back."""
    peak = w.sum(axis=1)
    o = np.argsort(R, axis=1)
    Rs = np.take_along_axis(R, o, axis=1)
    cumw = np.cumsum(np.take_along_axis(w, o, axis=1), axis=1)
    rows = np.arange(R.shape[0])
    return np.column_stack([Rs[rows, np.argmax(cumw >= q * peak[:, None] - 1e-9, axis=1)] for q in quants])


def unit_quantiles(size: float, p1: float, n_worlds: int, rng: np.random.Generator,
                   shape: float = SHAPE, crews: float = CREWS_PER_10K) -> np.ndarray:
    """(n_worlds, 3) restore-time quantiles at unit Weibull scale and zero delay, simulated in batches."""
    F = max(1, int(round(size / (N_NODES * MEAN_CUST))))
    per = max(1, BATCH_ELEMS // (F * N_NODES))
    out = []
    done = 0
    while done < n_worlds:
        S = min(per, n_worlds - done)
        sim = _worlds(size, p1, S, rng, shape, 1.0, 0.0, crews)
        out.append(restore_quantiles(sim["R"], sim["w"]))
        done += S
    return np.concatenate(out)


def features(log_w: np.ndarray, delay: np.ndarray, Q: np.ndarray, c_rel: int,
             shape: float = SHAPE, crews: float = CREWS_PER_10K) -> np.ndarray:
    """Milestones (h) for work rates and delays broadcast against unit quantiles Q (..., 3).

    A milestone counts only if its 2-hour hold fits inside the feature window, as for real curves
    (§7.8): slot i + 7 <= c_rel. Otherwise it is 168.25."""
    t = grid_up(np.maximum(delay, 0.0)[..., None] + weibull_scale(log_w, shape, crews)[..., None] * Q)
    return np.where(t / DT + (MILESTONE_HOLD - 1) <= c_rel, t, CENSORED)


def exponential_features(log_tau: np.ndarray, delay: np.ndarray, c_rel: int) -> np.ndarray:
    """The baseline: out(t) = p1 exp(-(t - delay)/tau) after the delay, so t_q = delay + tau ln 1/(1-q)."""
    k = -np.log1p(-np.array(QUANTS))
    t = grid_up(np.maximum(delay, 0.0)[..., None] + np.exp(log_tau)[..., None] * k)
    return np.where(t / DT + (MILESTONE_HOLD - 1) <= c_rel, t, CENSORED)


def simulated_curves(size: float, p1: float, L: int, theta: np.ndarray, rng: np.random.Generator,
                     shape: float = SHAPE, crews: float = CREWS_PER_10K) -> np.ndarray:
    """(N, L) customers-out curves on the 15-minute grid from the peak slot, for N worlds with parameters
    theta (N, 2): (log W, delay). Built slot by slot for plots and tests; the fit uses `features`."""
    lam = weibull_scale(theta[:, 0], shape, crews)
    delay = np.maximum(theta[:, 1], 0.0)
    N = len(theta)
    F = max(1, int(round(size / (N_NODES * MEAN_CUST))))
    per = max(1, BATCH_ELEMS // (F * N_NODES))
    out = np.zeros((N, L))
    for b0 in range(0, N, per):
        b1 = min(N, b0 + per)
        sim = _worlds(size, p1, b1 - b0, rng, shape, 1.0, 0.0, crews)
        R, w = sim["R"], sim["w"]
        k = np.ceil((delay[b0:b1, None] + lam[b0:b1, None] * R) / DT - 1e-9).astype(np.int64)
        restored = np.zeros((b1 - b0, L + 1))
        rows = np.broadcast_to(np.arange(b1 - b0)[:, None], k.shape)
        inside = (w > 0) & (k <= L - 1)
        np.add.at(restored, (rows[inside], k[inside]), w[inside])
        out[b0:b1] = w.sum(axis=1)[:, None] - np.cumsum(restored[:, :L], axis=1)
    return out


def read_slots(read_hours: tuple[int, ...] = READ_HOURS) -> np.ndarray:
    """Slots after the peak whose value a curve that only falls reads as h at each read hour."""
    return np.array(read_hours) * 4 + PEAK_HOLD - 1


def world_features(size: float, p1: float, theta: np.ndarray, c_rel: int, rng: np.random.Generator, *,
                   shape: float = SHAPE, crews: float = CREWS_PER_10K, extra: np.random.Generator | None = None,
                   critical_first: bool = False, tail_sigma: float = 0.0, prolonged: float = 0.0,
                   read_hours: tuple[int, ...] = READ_HOURS) -> dict[str, np.ndarray]:
    """Phase 4: per world with parameters theta (N, 2), the milestones (N, 3), censored as `features` does, and
    the share of the simulated peak still out at each read hour (N, len(read_hours)).

    With no planted error this equals `features` on `unit_quantiles` drawn from the same rng (it simulates in
    the same batches). prolonged: each out node, with this probability, gets +Exponential(72 h) on its own
    restore time (§12); the draws come from `extra`, as do _worlds' other planted errors."""
    if prolonged and extra is None:
        raise ValueError("planted errors draw from `extra`")
    lam = weibull_scale(theta[:, 0], shape, crews)
    delay = np.maximum(theta[:, 1], 0.0)
    N = len(theta)
    F = max(1, int(round(size / (N_NODES * MEAN_CUST))))
    per = max(1, BATCH_ELEMS // (F * N_NODES))
    slots = read_slots(read_hours)
    ms, shares = np.zeros((N, len(QUANTS))), np.zeros((N, len(slots)))
    for b0 in range(0, N, per):
        b1 = min(N, b0 + per)
        sim = _worlds(size, p1, b1 - b0, rng, shape, 1.0, 0.0, crews, extra=extra, critical_first=critical_first,
                      tail_sigma=tail_sigma)
        R, w = sim["R"], sim["w"]
        t = delay[b0:b1, None] + lam[b0:b1, None] * R
        if prolonged:
            t = t + np.where((sim["prolong_u"] < prolonged) & (R > 0), sim["prolong_h"], 0.0)
        tq = grid_up(restore_quantiles(t, w))
        ms[b0:b1] = np.where(tq / DT + (MILESTONE_HOLD - 1) <= c_rel, tq, CENSORED)
        if len(slots):
            k = np.ceil(t / DT - 1e-9)
            peak = w.sum(axis=1)
            shares[b0:b1] = np.column_stack([(w * (k > s)).sum(axis=1) for s in slots]) / peak[:, None]
    return {"milestones": ms, "shares": shares}


def exponential_shares(log_tau: np.ndarray, delay: np.ndarray,
                       read_hours: tuple[int, ...] = READ_HOURS) -> np.ndarray:
    """The baseline's share of p1 still out at each read hour: exp(-(t - delay)/tau) after the delay."""
    t = read_slots(read_hours) * DT
    lag = np.maximum(t[None, :] - np.maximum(delay, 0.0)[..., None], 0.0)
    return np.exp(-lag / np.exp(log_tau)[..., None])
