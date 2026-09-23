#!/usr/bin/env bash
# Snapshot the two OpenFEMA DisasterDeclarationsSummaries v2 queries of docs/RESTORATION-PROTOCOL.md §2
# (declaration METADATA only) into engine/.cache/eaglei/fema/. Fetched once, 2026-09-23T05:12Z; never re-run.
set -euo pipefail
OUT="$(cd "$(dirname "$0")/../.." && pwd)/.cache/eaglei/fema"
mkdir -p "$OUT/pages"
URL="https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries"
Q1="(incidentType eq 'Hurricane' or incidentType eq 'Tropical Storm' or incidentType eq 'Typhoon' or incidentType eq 'Coastal Storm' or incidentType eq 'Tropical Depression') and incidentBeginDate ge '2017-06-01T00:00:00.000Z'"
Q2="incidentBeginDate ge '2017-06-01T00:00:00.000Z' and incidentType ne 'Hurricane' and incidentType ne 'Tropical Storm' and incidentType ne 'Typhoon' and incidentType ne 'Coastal Storm' and incidentType ne 'Tropical Depression' and (contains(declarationTitle,'TROPICAL') or contains(declarationTitle,'HURRICANE') or contains(declarationTitle,'REMNANTS') or contains(declarationTitle,'TYPHOON'))"

fetch() {
  local name="$1" filter="$2" skip=0 page=0 n total
  rm -f "$OUT/pages/${name}_"*.json
  while :; do
    local f="$OUT/pages/${name}_$page.json"
    curl -sS -m 180 -G "$URL" \
      --data-urlencode "\$filter=$filter" --data-urlencode '$top=5000' \
      --data-urlencode "\$skip=$skip" --data-urlencode '$inlinecount=allpages' \
      --data-urlencode '$orderby=id' -o "$f"
    n=$(jq '.DisasterDeclarationsSummaries | length' "$f")
    total=$(jq '.metadata.count' "$f")
    echo "$name page=$page skip=$skip n=$n total=$total"
    [ "$n" -eq 0 ] && break
    skip=$((skip + n)); page=$((page + 1))
    [ "$skip" -ge "$total" ] && break
  done
  jq -s '[.[].DisasterDeclarationsSummaries[]] | sort_by(.id)' "$OUT/pages/${name}_"*.json > "$OUT/$name.json"
  echo "$name records=$(jq length "$OUT/$name.json") sha256=$(shasum -a 256 "$OUT/$name.json" | cut -d' ' -f1)"
}
fetch tropical_types "$Q1"
fetch other_types_tropical_titles "$Q2"
echo "fetched $(date -u +%Y-%m-%dT%H:%M:%SZ)"
