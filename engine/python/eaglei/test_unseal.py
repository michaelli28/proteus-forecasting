"""Run: engine/.venv/bin/python -m pytest python/eaglei/ -q -p no:cacheprovider (from engine/)."""
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

import pytest

from .unseal import ADDENDUM, NULL_CHAIN, addendum_hashes, log_unseal, open_gate

GIT = ["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null"]


def _git(repo: Path, *args: str) -> str:
    return subprocess.run([*GIT, *args], cwd=repo, capture_output=True, text=True, check=True).stdout.strip()


def _setup(tmp_path: Path, go: bool = True) -> tuple[Path, dict[str, Path], Path, str]:
    repo = tmp_path / "repo"
    (repo / "docs").mkdir(parents=True)
    files = {}
    for name in NULL_CHAIN.values():
        p = tmp_path / "data" / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(f"contents of {name}")
        files[name] = p
    loo = tmp_path / "data" / "loo.json"
    chain = {key: hashlib.sha256(files[name].read_bytes()).hexdigest() for key, name in NULL_CHAIN.items()}
    loo.write_text(json.dumps({**chain, "gate": {"go": go}}))
    rows = "\n".join(f"| `{n}` | `{hashlib.sha256(p.read_bytes()).hexdigest()}` |" for n, p in files.items())
    _git(tmp_path, "init", "-q", "-b", "main", str(repo))
    (repo / "code").mkdir()
    (repo / "code" / "check.py").write_text("the check")
    _git(repo, "add", ".")
    _git(repo, "commit", "-q", "-m", "code")
    code = _git(repo, "rev-parse", "HEAD")
    (repo / ADDENDUM).write_text(f"# Addendum\n\n**Code commit:** `{code}`\n\n| File | SHA-256 |\n| --- | --- |\n{rows}\n")
    _git(repo, "add", ".")
    _git(repo, "commit", "-q", "-m", "addendum")
    commit = _git(repo, "rev-parse", "HEAD")
    (repo / "later.txt").write_text("code after the addendum")
    _git(repo, "add", ".")
    _git(repo, "commit", "-q", "-m", "later")
    return repo, files, loo, commit


def test_addendum_hashes_reads_the_table():
    text = "| `train-events.csv` | `" + "a" * 64 + "` |\n| `x` | `short` |"
    assert addendum_hashes(text) == {"train-events.csv": "a" * 64}


def _open(commit, repo, files, loo):
    return open_gate(commit, repo, files, loo, code_paths=("code",))


def test_gate_opens_for_an_ancestor_addendum_with_matching_files(tmp_path):
    repo, files, loo, commit = _setup(tmp_path)
    gate = _open(commit[:10], repo, files, loo)
    assert gate["addendum_commit"] == commit and set(gate["hashes"]) == set(files)
    assert gate["code_commit"] == _git(repo, "rev-parse", f"{commit}~1")


def test_gate_refuses_when_the_check_code_changed_after_the_named_commit(tmp_path):
    repo, files, loo, commit = _setup(tmp_path)
    (repo / "code" / "check.py").write_text("a different check")
    _git(repo, "commit", "-q", "-am", "edit the check")
    with pytest.raises(SystemExit, match="differs from the code commit"):
        _open(commit, repo, files, loo)


def test_gate_refuses_a_changed_file(tmp_path):
    repo, files, loo, commit = _setup(tmp_path)
    files["phase3-amended/spread.json"].write_text("refitted")
    with pytest.raises(SystemExit, match="differ"):
        _open(commit, repo, files, loo)


def test_gate_refuses_a_file_the_addendum_does_not_record(tmp_path):
    repo, files, loo, commit = _setup(tmp_path)
    extra = tmp_path / "data" / "loo-copy.json"
    extra.write_text("{}")
    with pytest.raises(SystemExit, match="records no SHA-256"):
        _open(commit, repo, {**files, "phase3-amended/loo.json": extra}, loo)


def test_gate_refuses_a_commit_that_is_not_an_ancestor(tmp_path):
    repo, files, loo, commit = _setup(tmp_path)
    _git(repo, "checkout", "-q", "-b", "side", f"{commit}~0")
    (repo / "side.txt").write_text("elsewhere")
    _git(repo, "add", ".")
    _git(repo, "commit", "-q", "-m", "side")
    side = _git(repo, "rev-parse", "HEAD")
    _git(repo, "checkout", "-q", "main")
    with pytest.raises(SystemExit, match="not an ancestor"):
        _open(side, repo, files, loo)


def test_gate_refuses_a_commit_without_the_addendum(tmp_path):
    repo, files, loo, commit = _setup(tmp_path)
    _git(repo, "rm", "-q", ADDENDUM)
    _git(repo, "commit", "-q", "-m", "drop")
    with pytest.raises(SystemExit, match="does not contain"):
        _open(_git(repo, "rev-parse", "HEAD"), repo, files, loo)


def test_gate_refuses_a_null_computed_on_other_files(tmp_path):
    repo, files, loo, commit = _setup(tmp_path)
    loo.write_text(json.dumps({**json.loads(loo.read_text()), "spread_sha256": "0" * 64}))
    with pytest.raises(SystemExit, match="computed on other files"):
        _open(commit, repo, files, loo)


def test_gate_refuses_when_the_null_did_not_pass(tmp_path):
    repo, files, loo, commit = _setup(tmp_path, go=False)
    with pytest.raises(SystemExit, match="not go"):
        _open(commit, repo, files, loo)


def test_the_unseal_is_logged_once(tmp_path):
    log = tmp_path / "unseal.log"
    gate = {"addendum_commit": "abc"}
    first = log_unseal(gate, "def", None, log)
    assert first["addendum_commit"] == "abc" and first["head"] == "def"
    with pytest.raises(SystemExit, match="runs once"):
        log_unseal(gate, "def", None, log)
    log_unseal(gate, "def", "2026-09-23: named reason", log)
    assert len(log.read_text().splitlines()) == 2
