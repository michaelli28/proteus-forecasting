"""One county-event from a storm-county series (docs/RESTORATION-PROTOCOL.md §7-8).

Indices are slots within the data window, which the caller has already ended before the county's
next storm. `x` is the bridged series and `raw` the same series before bridging (NaN = missing);
both come from outages.window. An event is dropped for data quality or attribution, never for being
slow: slow events stay, flagged. The feature window ends at c, and every simulated curve for the
event must be cut at the same c.
"""
from __future__ import annotations

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

THRESHOLD_SHARE = 0.01
END_HOLD = 48  # 12 h below T ends an event
PEAK_HOLD = 4  # the peak is a level held for 1 h
MILESTONE_HOLD = 8  # a milestone counts only if held for 2 h
HORIZON = 168 * 4
CENSORED_H = 168.25
MILESTONES = {"t50": 0.5, "t90": 0.9, "t95": 0.95}
SUBSTANTIAL_MIN, SUBSTANTIAL_SHARE = 1000, 0.05
SPIKE_RATIO = 2.0
RESURGE_SHARE = 0.5
COVERAGE_MAX = 0.10
DROPS = ("seen", "no_mcc", "not_in_file", "no_event", "no_peak", "left_censored", "not_substantial",
         "spike", "resurge", "coverage")


def held(x: np.ndarray, width: int) -> np.ndarray:
    """h[i] = min(x[i..i+width-1]); NaN if any of those slots is missing or past the end."""
    padded = np.r_[x, np.full(width - 1, np.nan)]
    return sliding_window_view(padded, width).min(axis=1)


def find_events(x: np.ndarray, T: float, lo: int, hi: int) -> list[tuple[int, int | None]]:
    """(onset, end) for every event whose onset lies in [lo, hi]; end None = never ended in the window."""
    above = np.nan_to_num(x, nan=-np.inf) >= T
    below = np.nan_to_num(x, nan=np.inf) < T  # a missing slot breaks a hold-below run
    ended = np.flatnonzero(np.convolve(below.astype(int), np.ones(END_HOLD, int), "valid") == END_HOLD)
    out: list[tuple[int, int | None]] = []
    i = lo
    while i <= hi:
        nxt = np.flatnonzero(above[i:hi + 1])
        if nxt.size == 0:
            break
        onset = i + int(nxt[0])
        k = np.searchsorted(ended, onset + 1)
        end = int(ended[k]) if k < ended.size else None
        out.append((onset, end))
        if end is None:
            break
        i = end + END_HOLD
    return out


def milestone(x: np.ndarray, peak: int, c: int, level: float) -> int | None:
    """First slot i with x[i..i+7] all inside [peak, c], non-missing and <= level."""
    if c - peak + 1 < MILESTONE_HOLD:
        return None
    ok = np.nan_to_num(x[peak:c + 1], nan=np.inf) <= level
    run = np.convolve(ok.astype(int), np.ones(MILESTONE_HOLD, int), "valid")
    hit = np.flatnonzero(run == MILESTONE_HOLD)
    return peak + int(hit[0]) if hit.size else None


def feature_end(h: np.ndarray, T: float, peak: int, end: int | None, n: int) -> int:
    """c: the earliest of peak + 168 h, the slot before the next 1-hour rise to T after the event
    end, and the data window's end."""
    c = min(peak + HORIZON, n - 1)
    if end is not None:
        rise = np.flatnonzero(np.nan_to_num(h[end + 1:], nan=-np.inf) >= T)
        if rise.size:
            c = min(c, end + int(rise[0]))
    return c


def left_censored(x: np.ndarray, onset: int, lo: int, T: float) -> bool:
    """The kept event was already under way at the onset window's start: it starts there, or the
    first slot is missing and the last value at or before it is >= T."""
    if onset == lo:
        return True
    if not np.isnan(x[lo]):
        return False
    seen = np.flatnonzero(~np.isnan(x[:lo + 1]))
    return bool(seen.size) and x[seen[-1]] >= T


def county_event(x: np.ndarray, raw: np.ndarray, mcc: int | None, lo: int, hi: int) -> dict:
    """Apply §7-8 to one (storm, county) window; `lo`, `hi` bound the onset window."""
    if mcc is None:
        return {"status": "no_mcc"}
    T = max(THRESHOLD_SHARE * mcc, 1.0)
    h = held(x, PEAK_HOLD)
    best = None
    events = find_events(x, T, lo, hi)
    for onset, end in events:
        stop = end if end is not None else len(x) - 1
        seg = h[onset:stop + 1]
        if np.isnan(seg).all():
            continue
        rel = int(np.nanargmax(seg))
        cand = {"onset": onset, "end": end, "peak": onset + rel, "p1": float(seg[rel])}
        if best is None or cand["p1"] > best["p1"]:
            best = cand
    base = {"T": T, "n_events": len(events)}
    if not events:
        return base | {"status": "no_event"}
    if best is None:  # no one-hour level is defined anywhere: nothing to measure
        return base | {"status": "no_peak"}
    if left_censored(x, best["onset"], lo, T):
        return base | {"status": "left_censored"}
    if best["p1"] < SUBSTANTIAL_MIN or best["p1"] < SUBSTANTIAL_SHARE * mcc:
        return base | {"status": "not_substantial", "p1": best["p1"]}
    onset, end, peak, p1 = best["onset"], best["end"], best["peak"], best["p1"]
    stop = end if end is not None else len(x) - 1
    raw_max = float(np.nanmax(x[onset:stop + 1]))
    c = feature_end(h, T, peak, end, len(x))
    ev = base | best | {"raw_max": raw_max, "c": c, "status": "kept"}
    ms = {k: milestone(x, peak, c, (1 - q) * p1) for k, q in MILESTONES.items()}
    ev |= {k: CENSORED_H if i is None else (i - peak) / 4 for k, i in ms.items()}
    missing = float(np.isnan(raw[peak:c + 1]).mean())
    ev |= {
        "missing_share": missing,
        "over_mcc": p1 > mcc,
        "never_ended": end is None,
        "cut_early": c < peak + HORIZON,
    }
    if raw_max > SPIKE_RATIO * p1:
        return ev | {"status": "spike"}
    i50 = ms["t50"]  # not reached: the re-surge test does not apply
    if i50 is not None and np.nan_to_num(h[i50 + 1:stop], nan=-np.inf).max(initial=-np.inf) > RESURGE_SHARE * p1:
        return ev | {"status": "resurge"}
    if missing > COVERAGE_MAX:
        return ev | {"status": "coverage"}
    return ev
