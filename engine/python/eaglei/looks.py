"""A storm's looks and its rank check (protocol §11, as amended by §16.3). Pure functions.

A look is one county-event at or above the minimum size, or the storm's pooled look over the rest. Its vector is
the p1-weighted mean of its members' own features, so a county look is its one member's. The same code builds
the real vector and every world's, so both are the same function of the curves.
- Hindsight: (t50, t90, t95).
- The look at L h: the share still out at L/4, L/2, 3L/4 and L, each read as h. A member is left out when
  c < peak + L h 45 min, or when any of its real reads is missing; a pooled look with no member left is left out.
  Worlds use the members the real look kept.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .county_sim import READ_HOURS, read_slots
from .rank import min_p_combined, pooled_mahalanobis, rank_p_all

ALPHA = 0.05
LOOK_HOURS = (12, 24, 48)


@dataclass(frozen=True)
class Look:
    key: str
    members: tuple[str, ...]
    weights: tuple[float, ...]  # p1 shares of the members kept, summing to 1


def _look(key: str, members: pd.DataFrame) -> Look:
    return Look(key, tuple(members["fips"]), tuple((members["p1"] / members["p1"].sum()).tolist()))


def hindsight_plan(ev: pd.DataFrame, min_size: float) -> list[Look]:
    """One look per county-event with p1 >= min_size, then the pooled look over the rest (§10, §16.3)."""
    big, small = ev[ev["p1"] >= min_size], ev[ev["p1"] < min_size]
    return [_look(f, big[big["fips"] == f]) for f in big["fips"]] + ([_look("pooled", small)] if len(small) else [])


def read_cols(L: int) -> list[int]:
    """Columns of READ_HOURS read by the look at L h."""
    return [READ_HOURS.index(h) for h in (L // 4, L // 2, 3 * L // 4, L)]


def during_plan(ev: pd.DataFrame, min_size: float, L: int, reads: dict[str, np.ndarray]) -> list[Look]:
    """The looks at L h. reads: each member's real shares at READ_HOURS, NaN where a read is missing."""
    cols = read_cols(L)
    need = read_slots((L,))[0]
    ok = ev[[r.c_rel >= need and not np.isnan(reads[r.fips][cols]).any() for r in ev.itertuples()]]
    return hindsight_plan(ok, min_size) if len(ok) else []


def weighted(look: Look, arrays: dict[str, np.ndarray], cols: list[int] | None = None) -> np.ndarray:
    """The p1-weighted mean of the members' arrays, (k,) for real features or (N, k) for worlds, over feature
    columns cols (all if None)."""
    stack = np.stack([arrays[f] if cols is None else arrays[f][..., cols] for f in look.members])
    return np.tensordot(np.array(look.weights), stack, axes=1)


def vectors(look: Look, real: dict[str, np.ndarray], worlds: dict[str, np.ndarray],
            cols: list[int] | None = None) -> tuple[np.ndarray, np.ndarray]:
    """The look's real vector and its worlds' (N, k)."""
    return weighted(look, real, cols), weighted(look, worlds, cols)


def rank_check(pairs: list[tuple[np.ndarray, np.ndarray]]) -> dict:
    """§11: each look scored by pooledMahalanobis over the real vector and its worlds, then rankPValue; the
    storm's p is minPCombined over its looks. Ties count against the alarm."""
    scores = [pooled_mahalanobis(np.vstack([x, F])) for x, F in pairs]
    look_p = [float(rank_p_all(s)[0]) for s in scores]
    return {"p": min_p_combined(np.array(scores)), "look_p": look_p, "looks": len(pairs),
            "look_flags": int(sum(p <= ALPHA for p in look_p))}
