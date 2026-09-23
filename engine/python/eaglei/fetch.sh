#!/usr/bin/env bash
# Fetch EAGLE-I figshare 24237376 v4 into engine/.cache/eaglei/raw/ and check each MD5 against figshare's
# computed_md5 (docs/RESTORATION-PROTOCOL.md §2). Downloading is not reading: nothing is parsed here.
set -uo pipefail
RAW="$(cd "$(dirname "$0")/../.." && pwd)/.cache/eaglei/raw"
mkdir -p "$RAW"
FILES=(
  "MCC.csv 42547708 7e30d47d44cae46b3342cdabf7c84b7f"
  "coverage_history.csv 42547714 33ef0c8549a95bcc1ef52b61c2463271"
  "eaglei_outages_2018.csv 42547879 726543e4a392e220108b035ba4c52e43"
  "eaglei_outages_2019.csv 42547885 0ff77af0106486eb7bdc6c5051bd916a"
  "eaglei_outages_2020.csv 42547894 3b1e76e7ff0445da2b9a2fe4819c0e88"
  "eaglei_outages_2021.csv 42547891 b5a5912be793ca22dddcc73ca2c3379d"
  "eaglei_outages_2022.csv 42547897 0cd04f23ac90ec4ec20ce3a63dcfa25a"
  "eaglei_outages_2023.csv 44574907 4ef3f9290884b4151a43333d28f67369"
  "eaglei_outages_2024.csv 53581661 13183facf56c196c061a238303c87973"
  "eaglei_outages_2025.csv 62164877 cd2feb1282a42fb048cb6885398bc1cc"
)
status=0
for row in "${FILES[@]}"; do
  read -r name id want <<<"$row"
  out="$RAW/$name"
  if [ ! -f "$out" ] || [ "$(md5 -q "$out")" != "$want" ]; then
    curl -sS -L --retry 3 -o "$out" "https://ndownloader.figshare.com/files/$id"
  fi
  got="$(md5 -q "$out")"
  if [ "$got" = "$want" ]; then echo "ok $name"; else echo "MD5 MISMATCH $name got=$got want=$want"; status=1; fi
done
exit $status
