"""Read one EAGLE-I year file, and turn a county's rows into a dense 15-minute series (protocol §6).

EAGLE-I stores no zero rows (checked for 2020-21): an absent row means "zero, or not collected".
Absent counts as zero except inside a nationwide collection dip, outside the file's span, or for a
county that stores zeros itself (>= 10% of its rows that year). A blank customers_out cell is always
missing. Slots are global 15-minute indices from 2018-01-01 00:00 UTC, so windows compare across years.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from .storms import FIPS_RECODE

EPOCH = pd.Timestamp("2018-01-01 00:00:00")
SLOT = pd.Timedelta(minutes=15)
SLOTS_PER_HOUR = 4
TIME_FORMATS = ("%Y-%m-%d %H:%M:%S", "%m/%d/%y %H:%M")
DIP_WINDOW = 97  # slots, a centred +-12 h rolling median of rows per slot
DIP_SHARE = 0.5
BRIDGE_MAX = 8  # interior missing runs of up to 2 h are filled linearly
ZERO_HEAVY_SHARE = 0.10
RECODE = {int(k): int(v) for k, v in FIPS_RECODE.items()}


@dataclass(frozen=True)
class YearData:
    fips: np.ndarray  # int32, sorted, one row per (county, slot)
    slot: np.ndarray  # int32 global slot
    cust: np.ndarray  # float32, NaN = blank cell
    first: int
    last: int
    dip: np.ndarray  # bool per slot in [first, last]
    counties: frozenset[int]
    zero_heavy: frozenset[int]  # counties whose absent rows are missing, not zero
    zero_rows: int
    duplicates: int


def slot_of(ts: pd.Timestamp) -> int:
    return int((ts - EPOCH) // SLOT)


def parse_times(s: pd.Series) -> pd.Series:
    for fmt in TIME_FORMATS:
        t = pd.to_datetime(s, format=fmt, errors="coerce")
        if t.notna().all():
            return t
    raise ValueError(f"run_start_time matches none of {TIME_FORMATS}; first value {s.iloc[0]!r}")


def compact(fips: np.ndarray, slot: np.ndarray, cust: np.ndarray) -> YearData:
    for old, new in RECODE.items():  # the recode applies to outage codes too; merged rows dedupe below
        fips = np.where(fips == old, new, fips)
    order = np.lexsort((slot, fips))
    fips, slot, cust = fips[order], slot[order], cust[order]
    starts = np.flatnonzero(np.r_[True, (np.diff(fips) != 0) | (np.diff(slot) != 0)])
    # Duplicate (county, slot) rows keep their maximum; a blank loses to any value.
    cust_u = np.fmax.reduceat(cust, starts)
    fips_u, slot_u = fips[starts], slot[starts]
    first, last = int(slot_u.min()), int(slot_u.max())
    rows = np.bincount(slot_u - first, minlength=last - first + 1)
    median = pd.Series(rows).rolling(DIP_WINDOW, center=True, min_periods=1).median().to_numpy()
    county_start = np.flatnonzero(np.r_[True, np.diff(fips_u) != 0])
    zeros = np.add.reduceat((cust_u == 0).astype(np.int64), county_start)
    n_rows = np.diff(np.r_[county_start, len(fips_u)])
    heavy = fips_u[county_start][zeros >= ZERO_HEAVY_SHARE * n_rows]
    return YearData(
        fips=fips_u, slot=slot_u, cust=cust_u, first=first, last=last,
        dip=rows < DIP_SHARE * median, counties=frozenset(int(f) for f in fips_u[county_start]),
        zero_heavy=frozenset(int(f) for f in heavy), zero_rows=int(zeros.sum()),
        duplicates=len(fips) - len(starts),
    )


def read_year(path: Path, *, chunksize: int = 2_000_000) -> YearData:
    header = pd.read_csv(path, nrows=0).columns.tolist()
    # The 2023 file names customers_out "sum" (protocol §15, found by the schema read).
    count = "customers_out" if "customers_out" in header else "sum"
    fips_parts, slot_parts, cust_parts = [], [], []
    for chunk in pd.read_csv(path, usecols=["fips_code", count, "run_start_time"], chunksize=chunksize,
                             dtype={"fips_code": str, count: "float64", "run_start_time": str}):
        t = parse_times(chunk["run_start_time"])
        fips_parts.append(chunk["fips_code"].astype(int).to_numpy(np.int32))
        slot_parts.append(((t - EPOCH) // SLOT).to_numpy(np.int64).astype(np.int32))  # floors off-grid stamps
        cust_parts.append(chunk[count].to_numpy(np.float32))
    return compact(np.concatenate(fips_parts), np.concatenate(slot_parts), np.concatenate(cust_parts))


def bridge(x: np.ndarray, max_len: int = BRIDGE_MAX) -> np.ndarray:
    x = x.copy()
    edges = np.diff(np.r_[0, np.isnan(x).astype(np.int8), 0])
    for s, e in zip(np.flatnonzero(edges == 1), np.flatnonzero(edges == -1)):
        if e - s <= max_len and s > 0 and e < len(x):
            x[s:e] = np.linspace(x[s - 1], x[e], e - s + 2)[1:-1]
    return x


def window(year: YearData, fips: int, a: int, b: int) -> np.ndarray:
    """Series over global slots [a, b] with NaN where missing, before bridging."""
    n = b - a + 1
    present = np.zeros(n, bool)
    value = np.full(n, np.nan)
    lo, hi = np.searchsorted(year.fips, [fips, fips + 1])
    sl, cu = year.slot[lo:hi], year.cust[lo:hi]
    keep = (sl >= a) & (sl <= b)
    present[sl[keep] - a] = True
    value[sl[keep] - a] = cu[keep]
    s = np.arange(a, b + 1)
    in_file = (s >= year.first) & (s <= year.last)
    in_dip = np.zeros(n, bool)
    in_dip[in_file] = year.dip[s[in_file] - year.first]
    absent_missing = ~in_file | in_dip | (fips in year.zero_heavy)
    return np.where(present, value, np.where(absent_missing, np.nan, 0.0))


def schema(path: Path) -> dict:
    """Header and sorted distinct fips codes, nothing else: protocol §3's schema read."""
    header = pd.read_csv(path, nrows=0).columns.tolist()
    col = next(c for c in header if "fips" in c.lower())
    codes: set[str] = set()
    for chunk in pd.read_csv(path, usecols=[col], dtype=str, chunksize=5_000_000):
        codes.update(chunk[col].dropna().unique())
    return {"file": path.name, "columns": header, "fips_codes": sorted(codes)}
