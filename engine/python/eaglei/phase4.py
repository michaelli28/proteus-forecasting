"""Phase 4's shared pieces: the Phase 3 files it runs on, checked by their hash chain, its seeds, and one
county's simulated worlds. docs/RESTORATION-ADDENDUM.md records all of them before anything is unsealed."""
from __future__ import annotations

import json

import numpy as np

from . import fit
from .county_sim import exponential_features, exponential_shares, world_features

PHASE4 = fit.CHECK / "phase4"
SEED = "restoration-phase4"


def fitted_inputs() -> tuple[dict, dict]:
    """spread.json and shrinkage.json, refused unless the chain from selection.json and the data holds (§16.8)."""
    spread_path, shrink_path = fit.OUT / "spread.json", fit.OUT / "shrinkage.json"
    fitted = json.loads(spread_path.read_text())
    fit.check_chain(fitted)
    shrink = json.loads(shrink_path.read_text())
    if shrink["spread_sha256"] != fit.sha256(spread_path):
        raise SystemExit("shrinkage.json was computed from another spread.json")
    return fitted, shrink


def county_worlds(args: tuple) -> dict[str, np.ndarray]:
    """One county's worlds: milestones (N, 3) and shares at the read hours (N, k). A process-pool job, so every
    setting travels in args. error holds §12's planted errors; they draw from their own seed, `extra`."""
    model, size, p1, c_rel, theta, cell, label, error, read_hours = args
    if model == "exp":
        return {"milestones": exponential_features(theta[:, 0], theta[:, 1], c_rel),
                "shares": exponential_shares(theta[:, 0], theta[:, 1], read_hours)}
    extra = fit.rng_for(f"{label}/extra") if error else None
    return world_features(size, p1, theta, c_rel, fit.rng_for(label), **fit.sim_settings(cell), extra=extra,
                          read_hours=read_hours, **(error or {}))
