"""
JSON bridge: the only way TypeScript talks to the restoration solver.

Reads one request on stdin, writes one response on stdout, logs progress to
stderr. See engine/src/restoration/solver.ts for the TypeScript side, which
re-checks every returned schedule rather than trusting it.

  {"command": "solve", "mode": "milp" | "lp", "crews": 2, "timeLimitSeconds": 60,
   "problems": [{"parent": [...], "customers": [...], "ticks": [...]}]}
"""
from __future__ import annotations

import json
import math
import sys

import scipy

from .milp import solve


def _is_int(x: object) -> bool:
    # bool is a subclass of int: true would otherwise pass as 1.
    return isinstance(x, int) and not isinstance(x, bool)


def _check(request: dict) -> None:
    if request.get("mode") not in ("milp", "lp"):
        raise ValueError(f"mode must be 'milp' or 'lp'; got {request.get('mode')!r}")
    crews = request.get("crews")
    if not _is_int(crews) or crews < 1:
        raise ValueError(f"crews must be an integer >= 1; got {crews!r}")
    limit = request.get("timeLimitSeconds")
    # json.load accepts NaN and Infinity, and NaN <= 0 is False.
    if not (_is_int(limit) or isinstance(limit, float)) or not (math.isfinite(limit) and limit > 0):
        raise ValueError(f"timeLimitSeconds must be a finite number > 0; got {limit!r}")
    for i, pr in enumerate(request.get("problems", [])):
        k = len(pr["ticks"])
        if len(pr["parent"]) != k or len(pr["customers"]) != k or k == 0:
            raise ValueError(f"problem {i}: parent, customers and ticks must be the same non-zero length")
        for j, a in enumerate(pr["parent"]):
            if not (-1 <= a < j):
                raise ValueError(f"problem {i}: parent[{j}] = {a} must be -1 or a lower index")
        if any(not _is_int(t) or t < 1 for t in pr["ticks"]):
            raise ValueError(f"problem {i}: ticks must be integers >= 1")
        if any(not _is_int(w) or w < 0 for w in pr["customers"]):
            raise ValueError(f"problem {i}: customers must be integers >= 0")


def _solve(request: dict) -> dict:
    _check(request)
    problems = request["problems"]
    results = []
    for i, problem in enumerate(problems):
        results.append(solve(problem, request["crews"], relax=request["mode"] == "lp",
                             time_limit=float(request["timeLimitSeconds"])))
        if (i + 1) % 10 == 0 or i + 1 == len(problems):
            print(f"[restoration] {request['mode']} crews={request['crews']} {i + 1}/{len(problems)}",
                  file=sys.stderr)
    return {"solver": f"scipy {scipy.__version__} / HiGHS", "results": results}


def main() -> int:
    try:
        request = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        json.dump({"ok": False, "error": f"malformed request: {exc}"}, sys.stdout)
        return 2
    try:
        if request.get("command") != "solve":
            raise ValueError(f"unknown command {request.get('command')!r}")
        payload = _solve(request)
    except Exception as exc:
        json.dump({"ok": False, "error": f"{type(exc).__name__}: {exc}"}, sys.stdout)
        return 1
    json.dump({"ok": True, **payload}, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
