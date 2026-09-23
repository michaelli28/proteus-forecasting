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
    # HiGHS's raw starts, which may leave a crew idle for free: engine/src/restoration/solver.ts
    # re-checks them against the objective and hands them out again (pre-registration §9.3).
    starts = None
    if not relax and res.x is not None:
        starts = [next(s for s in range(T - p[j] + 1) if res.x[col[(j, s)]] > 0.5) for j in range(k)]
    return {"status": STATUS.get(int(res.status), "error"),
            "objective": float(res.fun) if res.x is not None else None,
            "starts": starts, "seconds": seconds}
