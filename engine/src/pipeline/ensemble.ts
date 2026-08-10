/**
 * The Monte Carlo fan-out.
 *
 * Runs N simulations in a local pool and collects N content-addressed
 * artifacts, at most `concurrency` in flight.
 *
 * A member that fails is RECORDED, never fatal. Losing runs has to be survivable
 * for graceful degradation to be a measurable property rather than an aspiration
 * — if one bad config aborted the ensemble there would be nothing to degrade.
 */

import { runSimulation } from "../sim/kernel.js";
import { resolveOutcome } from "../evidence/partition.js";
import { mapWithConcurrency } from "../util/concurrency.js";
import { orderedBands } from "./types.js";
import type { ArtifactStore, RunIdentity } from "../artifact/store.js";
import type { OutcomeBand, TargetQuantity } from "../evidence/partition.js";
import type { RunSpec } from "../agents/framer.js";
import type { DomainBinding, RunFailure, RunSummary } from "./types.js";

/** Per-run artifact file holding the restricted view of what the run produced. */
export const SUMMARY_FILE = "summary.json";

export const DEFAULT_CONCURRENCY = 8;

export interface EnsembleRequest<TConfig, TState> {
  readonly binding: DomainBinding<TConfig, TState>;
  readonly specs: readonly RunSpec[];
  readonly bands: readonly OutcomeBand[];
  readonly quantity: TargetQuantity;
  readonly store: ArtifactStore;
  /** Pinned corpus. "Same seed, same answer" only means anything alongside it. */
  readonly corpusSnapshotId: string;
  /** Namespaces this ensemble's seeds. A rerun uses a different one. */
  readonly seedNamespace: string;
  readonly concurrency?: number;
}

export interface EnsembleResult {
  readonly planned: number;
  readonly summaries: readonly RunSummary[];
  readonly failures: readonly RunFailure[];
  readonly completionRatio: number;
  readonly corpusSnapshotId: string;
}

/** A run's seed. Namespaced so a rerun cannot reproduce the original. */
export function runSeed(namespace: string, specId: string): string {
  return `${namespace}::${specId}`;
}

class PhaseError extends Error {
  constructor(
    readonly phase: string,
    readonly cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "PhaseError";
  }
}

export async function runEnsemble<TConfig, TState>(
  request: EnsembleRequest<TConfig, TState>,
): Promise<EnsembleResult> {
  const { specs, bands } = request;
  if (specs.length === 0) {
    throw new RangeError("an ensemble needs at least one run spec");
  }

  const ordered = orderedBands(bands);
  const outcomes = await mapWithConcurrency(
    specs,
    request.concurrency ?? DEFAULT_CONCURRENCY,
    async (spec) => {
      try {
        return { summary: await executeRun(request, spec, ordered) };
      } catch (error) {
        const phase = error instanceof PhaseError ? error.phase : "unknown";
        const message = error instanceof Error ? error.message : String(error);
        return { failure: { specId: spec.id, phase, message } };
      }
    },
  );

  const summaries = outcomes
    .map((o) => o.summary)
    .filter((s): s is RunSummary => s !== undefined);
  const failures = outcomes
    .map((o) => o.failure)
    .filter((f): f is RunFailure => f !== undefined);

  return {
    planned: specs.length,
    summaries,
    failures,
    completionRatio: summaries.length / specs.length,
    corpusSnapshotId: request.corpusSnapshotId,
  };
}

/** Concatenate two ensembles — how a red-team-forced rerun is folded in. */
export function mergeEnsembles(
  first: EnsembleResult,
  second: EnsembleResult,
): EnsembleResult {
  if (first.corpusSnapshotId !== second.corpusSnapshotId) {
    throw new Error(
      "refusing to merge ensembles pinned to different corpus snapshots",
    );
  }
  const planned = first.planned + second.planned;
  const summaries = [...first.summaries, ...second.summaries];
  return {
    planned,
    summaries,
    failures: [...first.failures, ...second.failures],
    completionRatio: summaries.length / planned,
    corpusSnapshotId: first.corpusSnapshotId,
  };
}

async function executeRun<TConfig, TState>(
  request: EnsembleRequest<TConfig, TState>,
  spec: RunSpec,
  ordered: readonly OutcomeBand[],
): Promise<RunSummary> {
  const { binding, quantity, store, corpusSnapshotId, seedNamespace } = request;
  let phase = "configure";

  try {
    const config = binding.configFor(spec, quantity);
    const seed = runSeed(seedNamespace, spec.id);

    phase = "open-artifact";
    // The seed belongs in the identity. Without it two runs of the same config
    // under different seeds hash to the same run id, and the rerun silently
    // overwrites the artifact it was supposed to be compared against.
    const identity: RunIdentity = {
      config: {
        spec,
        seed,
        quantity: {
          name: quantity.name,
          resolveAtTick: quantity.resolveAtTick,
        },
        domain: config,
      },
      corpusSnapshotId,
      kernelVersion: `${binding.adapter.name}@${binding.adapter.version}`,
    };
    // A run whose later phases throw leaves an unsealed directory behind. That
    // is deliberate: it is forensic evidence, and store.exists() already treats
    // a run with no manifest as absent.
    const writer = await store.create(identity);

    phase = "simulate";
    const result = await runSimulation(binding.adapter, config, seed, {
      sink: writer,
      observeEvery: 0,
    });

    phase = "resolve";
    const value = binding.readQuantity(result, quantity);
    const { bandId } = resolveOutcome(ordered, value);
    const signatures = binding.signatures(result);

    phase = "seal";
    await writer.writeFile(SUMMARY_FILE, {
      specId: spec.id,
      seed,
      quantity: value,
      bandId,
      signatures,
    });
    const manifest = await writer.close();

    return {
      runId: manifest.runId,
      specId: spec.id,
      label: spec.label,
      artifactHash: manifest.artifactHash,
      quantity: value,
      bandId,
      bandIndex: ordered.findIndex((band) => band.id === bandId),
      signatures,
    };
  } catch (error) {
    throw new PhaseError(phase, error);
  }
}
