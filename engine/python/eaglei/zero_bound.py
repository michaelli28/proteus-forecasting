"""Protocol §16.7's zero-format bound, on training storms only. Report-only: it changes no rule.

The held-out files store explicit zeros, and in counties that store them, §6 counts absent rows as missing.
The training files store none, so an absent training row is usually a real zero. Rerunning Checkpoint 2's
training events with every county's absent rows counted as missing is therefore a worst case for how much
that rule could delay real milestones or drop events.

Run from engine/:  .venv/bin/python -m python.eaglei.zero_bound
It first checks that the unchanged rule still reproduces train-events.csv byte for byte, so the comparison
isolates the one rule. Writes .cache/restoration-check/phase4/zero-bound.json.
"""
from __future__ import annotations

from importlib.metadata import version

import numpy as np
import pandas as pd

from . import fit
from .checkpoint2 import OUT as CHECK, frozen_state, run_split
from .events import CENSORED_H, MILESTONES
from .phase4 import PHASE4


def compare(base: pd.DataFrame, bound: pd.DataFrame) -> dict:
    """Per training kept event: its status under the bound, and for events kept under both, the milestone shifts."""
    key = ["storm_id", "fips"]
    kept = base[base["status"] == "kept"]
    both = kept.merge(bound[key + ["status", *MILESTONES]], on=key, suffixes=("", "_bound"))
    if len(both) != len(kept):
        raise SystemExit("the bound run lost (storm, county) pairs; it must cover the same pairs")
    still = both[both["status_bound"] == "kept"]
    shifts = {}
    for m in MILESTONES:
        a, b = still[m].to_numpy(), still[f"{m}_bound"].to_numpy()
        reached = a < CENSORED_H
        d = b[reached] - a[reached]
        shifts[m] = {
            "reached_in_base": int(reached.sum()),
            "censored_under_bound": int((b[reached] >= CENSORED_H).sum()),
            "later": int((d > 0).sum()), "earlier": int((d < 0).sum()), "unchanged": int((d == 0).sum()),
            "shift_h_p50_p90_max_among_still_reached": (np.percentile(d[b[reached] < CENSORED_H], [50, 90, 100]).tolist()
                                                        if (b[reached] < CENSORED_H).any() else None),
        }
    changed = (both["status_bound"] != "kept") | np.column_stack(
        [both[m] != both[f"{m}_bound"] for m in MILESTONES]).any(axis=1)
    survives = both["status_bound"] == "kept"
    # The bound can also select: an event that never reaches zero has no absent rows to lose.
    selection = {name: {"events": int(g.sum()),
                        "median_h": both.loc[g, list(MILESTONES)].median().round(2).to_dict(),
                        "censored_share": (both.loc[g, list(MILESTONES)] >= CENSORED_H).mean().round(3).to_dict()}
                 for name, g in (("kept_under_bound", survives), ("dropped_under_bound", ~survives))}
    return {
        "kept_in_base": len(kept),
        "status_under_bound": both["status_bound"].value_counts().to_dict(),
        "kept_in_bound_not_base": int(((bound["status"] == "kept")
                                       & ~bound.set_index(key).index.isin(kept.set_index(key).index)).sum()),
        "milestones_of_events_kept_under_both": shifts,
        "events_whose_status_or_a_milestone_changes": int(changed.sum()),
        "share_changed": float(changed.mean()),
        "base_milestones_by_fate": selection,
    }


def main() -> None:
    fit.PROVENANCE.update(frozen_state("the zero-format bound runs"))
    base_records, _, _ = run_split("train")
    text = pd.DataFrame(base_records).to_csv(index=False)
    if text.encode() != (CHECK / "train-events.csv").read_bytes():
        raise SystemExit("the unchanged rule no longer reproduces train-events.csv; the bound would not isolate one rule")
    bound_records, _, _ = run_split("train", absent_as_missing=True)
    dtypes = {"storm_id": str, "fips": str}
    base = pd.read_csv(CHECK / "train-events.csv", dtype=dtypes)
    bound = pd.DataFrame(bound_records).astype(dtypes)
    out = {"rule": "every training county's absent rows count as missing (§16.7, worst case)",
           "data_sha256": fit.data_sha256(), "packages": {p: version(p) for p in ("numpy", "pandas", "scipy")},
           **compare(base, bound)}
    fit.logged_write(PHASE4 / "zero-bound.json", out, root=PHASE4)
    print(pd.Series({k: v for k, v in out.items() if not isinstance(v, dict)}).to_string())
    print(out["status_under_bound"])


if __name__ == "__main__":
    main()
