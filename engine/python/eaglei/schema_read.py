"""Protocol §3's schema read of the held-out files: header and distinct fips codes, nothing else.

Run from engine/:  .venv/bin/python -m python.eaglei.schema_read
Writes engine/.cache/restoration-check/schema-held-out.json. Refuses while the protocol or loader is uncommitted.
"""
from __future__ import annotations

import json

from .checkpoint2 import DATA, OUT, frozen_state
from .outages import schema
from .storms import HELD_OUT_YEARS, load_mcc


def main() -> None:
    state = frozen_state()
    mcc = set(load_mcc(DATA / "raw" / "MCC.csv"))
    out = state | {"years": {}}
    for year in sorted(HELD_OUT_YEARS):
        s = schema(DATA / "raw" / f"eaglei_outages_{year}.csv")
        codes = {c.zfill(5) for c in s["fips_codes"]}
        out["years"][year] = {
            "columns": s["columns"],
            "distinct_fips": len(codes),
            "not_in_mcc": sorted(codes - mcc),
            "ct_planning_regions": sorted(c for c in codes if c.startswith("091")),
            "vi": sorted(c for c in codes if c.startswith("78")),
            "pr": len([c for c in codes if c.startswith("72")]),
        }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "schema-held-out.json").write_text(json.dumps(out, indent=2))
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
