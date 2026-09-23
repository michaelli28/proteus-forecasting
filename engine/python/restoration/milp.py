"""Time-indexed MILP / LP floor for P | soft out-tree | sum w_j R_j, integer ticks.

x[j, s] = 1 when segment j starts at tick s. Soft precedence: a crew may work
below a broken segment; R_j >= completion of every broken ancestor, j included.
The LP relaxation is a floor no schedule can beat (0.3-3.4% below the optimum
at the median in spike S2); the big-M form was 5-55% below and is not used.
"""
from __future__ import annotations

import time

import numpy as np
from scipy.optimize import Bounds, LinearConstraint, milp
from scipy.sparse import coo_matrix

STATUS = {0: "optimal", 1: "time_limit", 2: "infeasible"}


def ancestors(parent: list[int]) -> list[list[int]]:
    out = []
    for j in range(len(parent)):
        chain, a = [], j
        while a != -1:
            chain.append(a)
            a = parent[a]
        out.append(chain)
    return out


def horizon(ticks: list[int], crews: int) -> int:
    # List schedules are optimal here and never idle, so S_j <= (sum p - p_j) / m.
    total = sum(ticks)
    return int(max((total - p) // crews + p for p in ticks))


def customer_ticks(problem: dict, starts: list[int]) -> int:
    """Σ customers × the tick the last broken segment on their path is repaired."""
    done = [s + p for s, p in zip(starts, problem["ticks"])]
    return sum(w * max(done[a] for a in chain)
               for w, chain in zip(problem["customers"], ancestors(problem["parent"])))


def list_schedule(ticks: list[int], order: list[int], crews: int) -> list[int]:
    """Start ticks when each repair, in order, goes to the crew that frees up first
    (lowest index on a tie) — listSchedule in objective.ts. Crews never idle."""
    free, starts = [0] * crews, [0] * len(ticks)
    for j in order:
        c = min(range(crews), key=lambda i: (free[i], i))
        starts[j] = free[c]
        free[c] += ticks[j]
    return starts


def solve(problem: dict, crews: int, *, relax: bool, time_limit: float) -> dict:
    parent, w, p = problem["parent"], problem["customers"], problem["ticks"]
    k, anc, T = len(p), ancestors(parent), horizon(p, crews)
    col: dict[tuple[int, int], int] = {}
    for j in range(k):
        for s in range(T - p[j] + 1):
            col[(j, s)] = len(col)
    nx = len(col)
    R = [nx + j for j in range(k)]
    c = np.zeros(nx + k)
    c[R] = w
    rows, cols, vals, lo, hi = [], [], [], [], []

    def add(cs, vs, lower, upper):
        i = len(lo)
        rows.extend([i] * len(cs)); cols.extend(cs); vals.extend(vs)
        lo.append(lower); hi.append(upper)

    for j in range(k):                                   # each segment starts once
        cs = [col[(j, s)] for s in range(T - p[j] + 1)]
        add(cs, [1.0] * len(cs), 1, 1)
    for t in range(T):                                   # at most `crews` under way at t
        cs = [col[(j, s)] for j in range(k)
              for s in range(max(0, t - p[j] + 1), min(t, T - p[j]) + 1)]
        if cs:
            add(cs, [1.0] * len(cs), -np.inf, crews)
    for j in range(k):                                   # R_j >= C_a for a in anc(j)
        for a in anc[j]:
            cs = [R[j]] + [col[(a, s)] for s in range(T - p[a] + 1)]
            vs = [1.0] + [-(s + p[a]) for s in range(T - p[a] + 1)]
            add(cs, vs, 0, np.inf)

    A = coo_matrix((vals, (rows, cols)), shape=(len(lo), nx + k)).tocsr()
    integrality = np.zeros(nx + k) if relax else np.r_[np.ones(nx), np.zeros(k)]
    started = time.perf_counter()
    res = milp(c=c, constraints=LinearConstraint(A, lo, hi), integrality=integrality,
               bounds=Bounds(np.zeros(nx + k), np.r_[np.ones(nx), np.full(k, float(T))]),
               options={"time_limit": time_limit, "disp": False})
    seconds = time.perf_counter() - started
    objective = float(res.fun) if res.x is not None else None
    starts = None
    if not relax and res.x is not None:
        raw = [next(s for s in range(T - p[j] + 1) if res.x[col[(j, s)]] > 0.5) for j in range(k)]
        if abs(customer_ticks(problem, raw) - res.fun) > 1e-6 * max(1.0, abs(res.fun)):
            raise RuntimeError(f"HiGHS objective {res.fun} disagrees with its own schedule's "
                               f"{customer_ticks(problem, raw)} customer-ticks")
        # HiGHS may delay a repair for free. Re-listing in its start order moves no repair
        # later, so no customer waits longer, and no crew idles (pre-registration §2).
        starts = list_schedule(p, sorted(range(k), key=lambda j: (raw[j], j)), crews)
        objective = float(customer_ticks(problem, starts))
    return {"status": STATUS.get(int(res.status), "error"),
            "objective": objective, "starts": starts, "seconds": seconds}
