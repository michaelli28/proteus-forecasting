// Test helper for test_rank.py: runs the engine's own rank check on JSON from stdin.
// Input: { looks: number[][][] } (look x member x feature). Output: per-look scores and p-values, and min-p.
import {
  minPCombined,
  pooledMahalanobis,
  rankPValue,
} from "../../src/metrics/rank-check.js";

let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  const { looks } = JSON.parse(raw) as { looks: number[][][] };
  const scores = looks.map((points) => pooledMahalanobis(points));
  const p = scores.map((s) => s.map((_, j) => rankPValue(s, j)));
  process.stdout.write(
    JSON.stringify({ scores, p, minP: minPCombined(scores, 0) }),
  );
});
