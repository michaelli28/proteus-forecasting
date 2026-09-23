"""Checkpoint 2 of docs/RESTORATION-PROTOCOL.md: storms, county-events and drops, per split.

Run from engine/:  .venv/bin/python -m python.eaglei.checkpoint2 train|held_out
Training writes every county-event (features included) and 10 plotted curves. The held-out split is
sealed (§3): it writes per-storm and per-step counts only, and refuses to run while the protocol or
this package has uncommitted edits.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from dataclasses import replace
from importlib.metadata import version
from pathlib import Path

import numpy as np
import pandas as pd

from .events import DROPS, county_event
from .outages import SLOTS_PER_HOUR, bridge, read_year, slot_of, window
from .storms import HELD_OUT_YEARS, TRAIN_YEARS, load_declarations, load_mcc, storm_counties

ENGINE = Path(__file__).resolve().parents[2]
REPO = ENGINE.parent
PROTOCOL = "docs/RESTORATION-PROTOCOL.md"
DATA = ENGINE / ".cache" / "eaglei"
OUT = ENGINE / ".cache" / "restoration-check"
DAY = 24 * SLOTS_PER_HOUR
CURVE_SEED = "restoration-protocol/checkpoint2-curves"
N_CURVES = 10
SPLIT_YEARS = {"train": TRAIN_YEARS, "held_out": HELD_OUT_YEARS}
# §3: a 3 MB head of the county-sorted 2024 file, read in research, held these counties' whole year.
SEEN = {("2024092301", f) for f in ("01001", "01003", "01005", "01007")}


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True, check=True).stdout.strip()


def frozen_state(before: str = "a held-out year is read", also: tuple[str, ...] = ()) -> dict:
    """Commits a held-out read (or a §16 fit stage) runs under. Refuses while the protocol, the loader or the
    paths in `also` have uncommitted edits, so the run is always reproducible from a commit (§3, §16.8)."""
    protocol = git("log", "-1", "--format=%H", "--", PROTOCOL)
    if not protocol or git("status", "--porcelain", "--", PROTOCOL, "engine/python/eaglei", *also):
        raise SystemExit(f"commit {PROTOCOL}, engine/python/eaglei and {list(also)} before {before}")
    return {"protocol_commit": protocol, "head": git("rev-parse", "HEAD")}


def pair_windows(pairs: pd.DataFrame) -> pd.DataFrame:
    """Onset window [lo, hi] and data window [a, b] in global slots (§7.1). The data window ends at
    the earlier of hi + 21 d and the slot before this county's onset window for its next storm."""
    lo = (pairs["begin"] - pd.Timedelta(days=1)).map(slot_of)
    end = pairs["end"].where(pairs["end"] < pairs["begin"] + pd.Timedelta(days=7), pairs["begin"] + pd.Timedelta(days=7))
    hi = (end + pd.Timedelta(days=1)).map(slot_of)
    out = pairs.assign(lo=lo, hi=hi).sort_values(["fips", "lo", "storm_id"])
    nxt = out.groupby("fips")["lo"].shift(-1)
    out["a"] = out["lo"] - 2 * DAY
    out["b"] = np.minimum(out["hi"] + 21 * DAY, nxt.fillna(np.inf) - 1).astype(np.int64)
    if (out["b"] <= out["hi"]).any():
        raise SystemExit("two onset windows for one county overlap; §7 has no rule for that")
    return out.sort_values(["begin", "storm_id", "fips"], ignore_index=True)


def slot_year(s: int) -> int:
    return (pd.Timestamp("2018-01-01") + pd.Timedelta(minutes=15 * s)).year


def run_split(split: str, *, absent_as_missing: bool = False,
              keep_series: bool = False) -> tuple[list[dict], dict[tuple[str, str], np.ndarray], dict]:
    """absent_as_missing: every county's absent rows count as missing, not zero (§16.7's zero-format bound).
    keep_series: also return the bridged series of every kept event (Phase 4's during-storm reads)."""
    decl = load_declarations(DATA / "fema")
    pairs = pair_windows(storm_counties(decl))
    pairs = pairs[pairs["split"] == split]
    mcc = load_mcc(DATA / "raw" / "MCC.csv")
    records: list[dict] = []
    series: dict[tuple[str, str], np.ndarray] = {}
    files: dict[str, dict] = {}
    pairs = pairs.assign(year=pairs["a"].map(slot_year))
    for year, group in pairs.groupby("year"):
        if year not in SPLIT_YEARS[split]:
            raise SystemExit(f"a {split} window starts in {year}")
        if (group["b"].map(slot_year) != year).any():
            raise SystemExit(f"a {split} window crosses the end of {year}; §6 allows it, but no loader path exists")
        yd = read_year(DATA / "raw" / f"eaglei_outages_{year}.csv")
        if absent_as_missing:
            yd = replace(yd, zero_heavy=yd.counties)
        files[str(year)] = {"rows": len(yd.fips), "duplicates": yd.duplicates, "zero_rows": yd.zero_rows,
                            "zero_heavy_counties": len(yd.zero_heavy), "first_slot": yd.first,
                            "last_slot": yd.last}
        for p in group.itertuples():
            rec = {"storm_id": p.storm_id, "title": p.title, "fips": p.fips, "state": p.state,
                   "has_dr": bool(p.has_dr), "mcc": mcc.get(p.fips), "a": p.a}
            if (p.storm_id, p.fips) in SEEN:
                ev = {"status": "seen"}
            elif p.fips not in mcc:
                ev = {"status": "no_mcc"}
            elif int(p.fips) not in yd.counties:
                ev = {"status": "not_in_file"}
            else:
                raw = window(yd, int(p.fips), p.a, p.b)
                x = bridge(raw)
                ev = county_event(x, raw, mcc[p.fips], p.lo - p.a, p.hi - p.a)
                plotted = split == "train" and ev["status"] in ("kept", "spike", "resurge", "coverage") and "p1" in ev
                if plotted or (keep_series and ev["status"] == "kept"):
                    series[(p.storm_id, p.fips)] = x
            records.append(rec | ev)
    return records, series, files


def counts(records: list[dict], split: str) -> dict:
    df = pd.DataFrame(records)
    kept = df[df["status"] == "kept"]
    per_storm = []
    for sid, g in df.groupby("storm_id", sort=False):
        per_storm.append({"storm_id": sid, "title": g["title"].iloc[0], "pairs": len(g),
                          "kept": int((g["status"] == "kept").sum()),
                          "drops": {r: int((g["status"] == r).sum()) for r in DROPS}})
    per_kept = kept.groupby("storm_id").size()
    return {
        "split": split,
        "pairs": len(df),
        "drops": {r: int((df["status"] == r).sum()) for r in DROPS},
        "kept": len(kept),
        "storms": int(df["storm_id"].nunique()),
        "storms_with_kept": int(per_kept.size),
        "storms_with_5plus": int((per_kept >= 5).sum()),
        "per_storm": per_storm,
    }


def plot_curves(records: list[dict], series: dict, path: Path) -> list[dict]:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    pool = sorted(series)
    rng = np.random.default_rng(int.from_bytes(hashlib.sha256(CURVE_SEED.encode()).digest()[:8], "big"))
    picks = [pool[i] for i in sorted(rng.choice(len(pool), size=min(N_CURVES, len(pool)), replace=False))]
    by_key = {(r["storm_id"], r["fips"]): r for r in records}
    fig, axes = plt.subplots(2, 5, figsize=(20, 7), constrained_layout=True)
    shown = []
    for ax, key in zip(axes.flat, picks):
        r, x = by_key[key], series[key]
        hours = (np.arange(len(x)) - r["peak"]) / SLOTS_PER_HOUR
        ax.plot(hours, x, lw=0.8, color="#1f3b73")
        ax.axhline(r["T"], color="#999", lw=0.6, ls="--")
        ax.axvline((r["c"] - r["peak"]) / SLOTS_PER_HOUR, color="#b33", lw=0.8)
        for k in ("t50", "t90", "t95"):
            if r[k] < 168.25:
                ax.axvline(r[k], color="#2a7", lw=0.6, ls=":")
        ax.set_xlim(-48, 180)
        ax.set_title(f"{r['title'].title()[:26]} {r['fips']}\n{r['status']}", fontsize=9)
        shown.append({"storm_id": key[0], "fips": key[1], "status": r["status"]})
    fig.supxlabel("hours from the 1-hour peak (red: feature-window end c; green dotted: t50/t90/t95; dashed: T)")
    fig.supylabel("customers out")
    fig.savefig(path, dpi=110)
    return shown


def main(split: str) -> None:
    if split not in SPLIT_YEARS:
        raise SystemExit("usage: checkpoint2 train|held_out")
    state = frozen_state() if split == "held_out" else {"head": git("rev-parse", "HEAD")}
    OUT.mkdir(parents=True, exist_ok=True)
    records, series, files = run_split(split)
    summary = counts(records, split) | state | {
        "files": files,
        "packages": {p: version(p) for p in ("numpy", "pandas", "scipy", "matplotlib")},
    }
    if split == "train":
        pd.DataFrame(records).to_csv(OUT / "train-events.csv", index=False)
        summary["curves"] = plot_curves(records, series, OUT / "checkpoint2-curves.png")
    # Held-out: counts only. The records never leave this process (§3).
    (OUT / f"{split}-counts.json").write_text(json.dumps(summary, indent=2, default=str))
    print(json.dumps({k: summary[k] for k in ("split", "pairs", "kept", "drops", "storms_with_kept",
                                                "storms_with_5plus")}, indent=2))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
