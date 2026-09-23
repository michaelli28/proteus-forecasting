"""The unseal gate (protocol §3, with §16.7's two additions). Held-out feature code runs only through it.

It refuses unless:
- the addendum commit is an ancestor of HEAD and contains docs/RESTORATION-ADDENDUM.md;
- the addendum records a SHA-256 for each of the five Phase 3 files, and each file on disk matches;
- the code commit the addendum names is an ancestor of HEAD, and the check's code at HEAD is identical to it;
- the leave-one-storm-out null's computed gate says go, on those same files.
The first held-out read then appends (UTC time, addendum commit, HEAD) to engine/.cache/eaglei/unseal.log. A second
unseal needs a dated deviation.
"""
from __future__ import annotations

import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from . import fit

ADDENDUM = "docs/RESTORATION-ADDENDUM.md"
UNSEAL_LOG = fit.ENGINE / ".cache" / "eaglei" / "unseal.log"
HASHED = {  # the name the addendum uses -> the file on disk
    "train-events.csv": fit.CHECK / "train-events.csv",
    "phase3-amended/selection.json": fit.OUT / "selection.json",
    "phase3-amended/spread.json": fit.OUT / "spread.json",
    "phase3-amended/shrinkage.json": fit.OUT / "shrinkage.json",
    "phase3-amended/loo.json": fit.OUT / "loo.json",
}
NULL_CHAIN = {  # what loo.json records it ran on -> the addendum's name for that file
    "spread_sha256": "phase3-amended/spread.json",
    "shrinkage_sha256": "phase3-amended/shrinkage.json",
    "selection_sha256": "phase3-amended/selection.json",
    "data_sha256": "train-events.csv",
}
HASH_ROW = re.compile(r"`([\w./-]+)`\s*\|\s*`([0-9a-f]{64})`")
CODE_ROW = re.compile(r"\*\*Code commit:\*\*\s*`([0-9a-f]{40})`")
CODE_PATHS = (  # everything the held-out check executes that could change its answer
    "docs/RESTORATION-PROTOCOL.md", "engine/python/eaglei", "engine/src/metrics/bootstrap.ts", "engine/src/sim/rng.ts",
)


def addendum_hashes(text: str) -> dict[str, str]:
    """Rows of the form | `name` | `sha256` | in the addendum."""
    return dict(HASH_ROW.findall(text))


def _git(repo: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=repo, capture_output=True, text=True)


def open_gate(commit: str, repo: Path = fit.ENGINE.parent, files: dict[str, Path] = HASHED,
              loo: Path = fit.OUT / "loo.json", code_paths: tuple[str, ...] = CODE_PATHS) -> dict:
    full = _git(repo, "rev-parse", "--verify", f"{commit}^{{commit}}")
    if full.returncode:
        raise SystemExit(f"{commit} is not a commit")
    sha = full.stdout.strip()
    if _git(repo, "merge-base", "--is-ancestor", sha, "HEAD").returncode:
        raise SystemExit(f"{sha} is not an ancestor of HEAD")
    shown = _git(repo, "show", f"{sha}:{ADDENDUM}")
    if shown.returncode:
        raise SystemExit(f"{sha} does not contain {ADDENDUM}")
    code = CODE_ROW.findall(shown.stdout)
    if len(code) != 1:
        raise SystemExit("the addendum must name exactly one code commit")
    if _git(repo, "merge-base", "--is-ancestor", code[0], "HEAD").returncode:
        raise SystemExit(f"the code commit {code[0]} is not an ancestor of HEAD")
    if _git(repo, "diff", "--quiet", code[0], "HEAD", "--", *code_paths).returncode:
        raise SystemExit(f"the check's code at HEAD differs from the code commit {code[0]} the addendum names")
    recorded = addendum_hashes(shown.stdout)
    missing = sorted(set(files) - set(recorded))
    if missing:
        raise SystemExit(f"the addendum records no SHA-256 for {missing}")
    wrong = sorted(name for name, path in files.items() if fit.sha256(path) != recorded[name])
    if wrong:
        raise SystemExit(f"on disk, {wrong} differ from the hashes the addendum records")
    null = json.loads(loo.read_text())
    stale = [key for key, name in NULL_CHAIN.items() if null.get(key) != recorded[name]]
    if stale:
        raise SystemExit(f"loo.json's go was computed on other files ({stale})")
    if null["gate"]["go"] is not True:
        raise SystemExit("the leave-one-storm-out null's gate is not go")
    return {"addendum_commit": sha, "code_commit": code[0], "hashes": {name: recorded[name] for name in files}}


def log_unseal(gate: dict, head: str, deviation: str | None, log: Path = UNSEAL_LOG) -> dict:
    """Append the unseal to the log before the first held-out read. One unseal, unless a deviation names why."""
    if log.exists() and log.read_text().strip() and not deviation:
        raise SystemExit(f"{log} already records an unseal: the held-out check runs once. A rerun needs --deviation")
    entry = {"utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
             "addendum_commit": gate["addendum_commit"], "head": head, "deviation": deviation}
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("a") as f:
        f.write(json.dumps(entry) + "\n")
    return entry
