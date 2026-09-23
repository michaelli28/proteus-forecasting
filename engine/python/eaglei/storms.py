"""Storms and their declared counties, from the frozen OpenFEMA snapshot (docs/RESTORATION-PROTOCOL.md §4-5).

A storm is one FEMA incidentId: no merging by name. County code 000 rows are tribal-area
designations and are dropped, never expanded to a whole state (spike S1 expanded them, which
marked every Alabama county as a major disaster for Sally). Dates are UTC wall clock.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

TROPICAL_TYPES = frozenset({"Hurricane", "Tropical Storm", "Typhoon", "Tropical Depression"})
TROPICAL_TITLE = r"HURRICANE|TROPICAL|TYPHOON|CYCLONE"
# Puerto Rico: 0% coverage 2018-20 and region codes in 2021. The Pacific territories are not in EAGLE-I.
EXCLUDED_STATES = frozenset({"PR", "GU", "MP", "AS", "FM", "MH", "PW"})
FIPS_RECODE = {"02270": "02158", "51515": "51019"}
TRAIN_YEARS = frozenset(range(2018, 2022))
HELD_OUT_YEARS = frozenset(range(2022, 2026))
FEMA_FILES = ("tropical_types.json", "other_types_tropical_titles.json")
DEFAULT_END = pd.Timedelta(days=7)


def load_declarations(fema_dir: Path) -> pd.DataFrame:
    rows = [r for name in FEMA_FILES for r in json.loads((fema_dir / name).read_text())]
    return pd.DataFrame(rows).drop_duplicates("id", ignore_index=True)


def _utc_naive(s: pd.Series) -> pd.Series:
    return pd.to_datetime(s, utc=True).dt.tz_localize(None)


def storm_counties(decl: pd.DataFrame) -> pd.DataFrame:
    """One row per (storm, county): storm_id, split, title, fips, state, begin, end, has_dr."""
    keep = decl["incidentType"].isin(TROPICAL_TYPES) | decl["declarationTitle"].str.upper().str.contains(TROPICAL_TITLE)
    d = decl[keep].copy()
    d["begin"] = _utc_naive(d["incidentBeginDate"])
    d["end"] = _utc_naive(d["incidentEndDate"]).fillna(d["begin"] + DEFAULT_END)
    year = d.groupby("incidentId")["begin"].transform("min").dt.year
    d["split"] = year.map(lambda y: "train" if y in TRAIN_YEARS else "held_out" if y in HELD_OUT_YEARS else None)
    d = d[d["split"].notna() & (d["fipsCountyCode"] != "000") & ~d["state"].isin(EXCLUDED_STATES)]
    fips = d["fipsStateCode"].str.zfill(2) + d["fipsCountyCode"].str.zfill(3)
    d = d.assign(fips=fips.replace(FIPS_RECODE), is_dr=d["declarationType"] == "DR")
    titles = d.groupby("incidentId")["declarationTitle"].agg(lambda s: sorted(set(s))[0])
    out = (
        d.groupby(["incidentId", "fips"])
        .agg(split=("split", "first"), state=("state", "first"), begin=("begin", "min"),
             end=("end", "max"), has_dr=("is_dr", "any"))
        .reset_index()
        .rename(columns={"incidentId": "storm_id"})
    )
    out.insert(2, "title", out["storm_id"].map(titles))
    return out.sort_values(["begin", "storm_id", "fips"], ignore_index=True)


def load_mcc(path: Path) -> dict[str, int]:
    """MCC.csv: County_FIPS (not zero-padded), Customers; a byte-order mark and a 'Grand Total' row."""
    m = pd.read_csv(path, encoding="utf-8-sig", dtype=str)
    m.columns = ["fips", "customers"]
    m = m[m["fips"].str.fullmatch(r"\d+")]
    return dict(zip(m["fips"].str.zfill(5), m["customers"].astype(int)))
