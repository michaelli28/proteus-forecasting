#!/usr/bin/env bash
# Protocol §16.5: run the 24 grid cells as parallel processes, then the selection rule. Run from anywhere.
# Each cell is one serial `fit cell` process; JOBS sets how many run at once (default 12). Like every fit stage,
# a cell refuses to run on uncommitted edits and records the commit it ran from.
set -euo pipefail
cd "$(dirname "$0")/../.."
export FIT_WORKERS=1 OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1  # one core per cell
GRID_DIR=.cache/restoration-check/phase3-amended/grid
mkdir -p "$GRID_DIR"
.venv/bin/python -c "
from python.eaglei.fit import GRID, cell_tag
for c in GRID:
    print(c['crews'], c['shape'], c['over'], cell_tag(c))" |
  xargs -P "${JOBS:-12}" -n 4 sh -c '
    .venv/bin/python -m python.eaglei.fit cell --crews "$0" --shape "$1" --over "$2" > "'"$GRID_DIR"'/$3.log" 2>&1 \
      || { echo "cell $3 failed, see '"$GRID_DIR"'/$3.log" >&2; exit 255; }'
.venv/bin/python -m python.eaglei.fit select
