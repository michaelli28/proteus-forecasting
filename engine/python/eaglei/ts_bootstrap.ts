// Phase 4 helper: the engine's own stratifiedBootstrap for a storm-resampled flag rate (protocol §11).
// Input: { items: [flags, looks][] (one per storm), seed, resamples }. One stratum, so whole storms are resampled.
// Output: the Interval, for the statistic sum(flags) / sum(looks).
import { stratifiedBootstrap } from "../../src/metrics/bootstrap.js";

type Item = readonly [number, number];

let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  const { items, seed, resamples } = JSON.parse(raw) as {
    items: Item[];
    seed: string;
    resamples: number;
  };
  const interval = stratifiedBootstrap(items, {
    stratumOf: () => "all",
    statistic: (sample) => {
      const looks = sample.reduce((a, [, n]) => a + n, 0);
      return looks === 0 ? null : sample.reduce((a, [f]) => a + f, 0) / looks;
    },
    seed,
    resamples,
  });
  process.stdout.write(JSON.stringify(interval));
});
