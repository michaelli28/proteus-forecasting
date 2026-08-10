import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { ArtifactStore } from "../../src/artifact/store.js";
import { createFailingClient } from "../../src/llm/stub.js";
import { runQuestion } from "../../src/pipeline/run-question.js";
import {
  CORPUS_AS_OF,
  TOY_QUANTITY,
  pipelineStub,
  promptCorpus,
  testCorpus,
  toyBinding,
  toySpec,
} from "./harness.js";
import type { QuestionInput } from "../../src/pipeline/run-question.js";
import type { ToyConfig, ToyState } from "./harness.js";
import type { DomainBinding } from "../../src/pipeline/types.js";

let root: string;
let store: ArtifactStore;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "proteus-question-"));
  store = new ArtifactStore(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const INPUT: QuestionInput = {
  question: "Where does the level land by tick 19?",
  quantity: TOY_QUANTITY,
  asOf: CORPUS_AS_OF,
  rootSeed: "seed-alpha",
  hypothesisCount: 3,
  runCount: 4,
  concurrency: 4,
  truth: toySpec("oracle", 62, 35),
};

function deps(
  client = pipelineStub(),
  binding: DomainBinding<ToyConfig, ToyState> = toyBinding,
) {
  return { client, binding, store, corpus: testCorpus() };
}

/** Drops the named specs, simulating k-of-N run loss. */
function lossyBinding(
  ...failing: string[]
): DomainBinding<ToyConfig, ToyState> {
  return {
    ...toyBinding,
    configFor: (spec, quantity) => {
      if (failing.includes(spec.id)) throw new Error(`run ${spec.id} failed`);
      return toyBinding.configFor(spec, quantity);
    },
  };
}

describe("runQuestion — the happy path", () => {
  it("turns a question into a BLUF product with a forecast", async () => {
    const result = await runQuestion(deps(), INPUT);

    expect(result.abstained).toBe(false);
    expect(result.framingSource).toBe("llm");
    expect(result.ensemble.summaries).toHaveLength(4);
    expect(result.product.bluf.length).toBeGreaterThan(0);
    expect(result.product.hypotheses).toHaveLength(3);
    expect(result.product.corpusSnapshotId).toBe(
      result.ensemble.corpusSnapshotId,
    );
  });

  it("emits a probability per band that sums to 1", async () => {
    const result = await runQuestion(deps(), INPUT);
    expect(result.probabilities).toHaveLength(3);
    const total = result.probabilities!.reduce((sum, p) => sum + p, 0);
    expect(total).toBeCloseTo(1, 12);
  });

  it("resolves the outcome from a hidden oracle run, not from the ensemble", async () => {
    const result = await runQuestion(deps(), INPUT);
    expect(result.oracle).not.toBeNull();
    expect(result.forecast).not.toBeNull();
    expect(result.forecast!.outcomeIndex).toBe(result.oracle!.bandIndex);
    expect(
      result.ensemble.summaries.some((s) => s.runId === result.oracle!.runId),
    ).toBe(false);
  });

  it("never lets the oracle's value or artifact reach a prompt", async () => {
    const client = pipelineStub();
    const result = await runQuestion(deps(client), INPUT);
    const prompts = promptCorpus(client);

    expect(prompts).not.toContain(result.oracle!.runId);
    expect(prompts).not.toContain(result.oracle!.value.toFixed(6));
    expect(prompts.length).toBeGreaterThan(0);
  });

  it("cites nothing published after the information cutoff", async () => {
    const result = await runQuestion(deps(), INPUT);
    const refs = result.product.claims.flatMap((c) => c.support);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(Date.parse(ref.publishedAt)).toBeLessThanOrEqual(
        Date.parse(CORPUS_AS_OF),
      );
    }
  });

  it("reproduces byte-identical artifacts and probabilities from the same seed", async () => {
    const first = await runQuestion(deps(), INPUT);
    const second = await runQuestion(deps(), INPUT);

    expect(second.questionId).toBe(first.questionId);
    expect(second.probabilities).toEqual(first.probabilities);
    expect(second.ensemble.summaries.map((s) => s.artifactHash)).toEqual(
      first.ensemble.summaries.map((s) => s.artifactHash),
    );
    expect(second.oracle!.artifactHash).toBe(first.oracle!.artifactHash);
  });

  it("diverges under a different root seed", async () => {
    const first = await runQuestion(deps(), INPUT);
    const other = await runQuestion(deps(), {
      ...INPUT,
      rootSeed: "seed-beta",
    });
    expect(other.ensemble.summaries.map((s) => s.artifactHash)).not.toEqual(
      first.ensemble.summaries.map((s) => s.artifactHash),
    );
  });

  it("records what the run cost", async () => {
    const result = await runQuestion(deps(), INPUT);
    expect(result.llmCalls).toBeGreaterThan(0);
    expect(result.costUsd).toBeGreaterThanOrEqual(0);
  });
});

describe("runQuestion — degradation when the model declines", () => {
  it("still ships a product when every adjudicator refuses", async () => {
    const result = await runQuestion(
      deps(pipelineStub({ adjudicatorRefuses: true })),
      INPUT,
    );

    expect(result.adjudication.available).toBe(false);
    expect(result.adjudication.refusals).toBeGreaterThan(0);
    expect(result.abstained).toBe(false);
    expect(result.product.hypotheses).toHaveLength(3);
  });

  it("caps confidence at moderate when adjudication is lost", async () => {
    const full = await runQuestion(deps(), INPUT);
    const refused = await runQuestion(
      deps(pipelineStub({ adjudicatorRefuses: true })),
      INPUT,
    );
    expect(full.confidence.level).toBe("high");
    expect(refused.confidence.level).toBe("moderate");
  });

  it("falls back to a uniform partition when the framer refuses", async () => {
    const result = await runQuestion(
      deps(pipelineStub({ framerFails: true })),
      INPUT,
    );
    expect(result.framingSource).toBe("fallback");
    expect(result.bands).toHaveLength(3);
    expect(result.ensemble.summaries.length).toBeGreaterThan(0);
  });

  it("runs end to end with no working model at all", async () => {
    const result = await runQuestion(
      {
        client: createFailingClient(),
        binding: toyBinding,
        store,
        corpus: testCorpus(),
      },
      INPUT,
    );
    expect(result.framingSource).toBe("fallback");
    expect(result.adjudication.available).toBe(false);
    expect(result.product.bluf.length).toBeGreaterThan(0);
    expect(result.oracle).not.toBeNull();
  });
});

describe("runQuestion — graceful degradation under run loss", () => {
  it("lowers confidence when ensemble members are lost", async () => {
    const full = await runQuestion(deps(), INPUT);
    const lossy = await runQuestion(
      deps(pipelineStub(), lossyBinding("r4")),
      INPUT,
    );

    expect(lossy.ensemble.failures).toHaveLength(1);
    expect(lossy.degradation.runsCompleted).toBe(3);
    expect(lossy.degradation.failedToDegrade).toBe(false);
    expect(lossy.degradation.confidenceAfter).toBeLessThan(
      full.degradation.confidenceAfter,
    );
  });

  it("reports full completion as no degradation", async () => {
    const result = await runQuestion(deps(), INPUT);
    expect(result.degradation.completionRatio).toBe(1);
    expect(result.degradation.failedToDegrade).toBe(false);
  });
});

describe("runQuestion — the abstention path", () => {
  const spread: QuestionInput = { ...INPUT, runCount: 6 };

  it("abstains when nothing separates the hypotheses", async () => {
    const result = await runQuestion(
      deps(pipelineStub({ spreadFraming: true })),
      spread,
    );
    expect(result.abstained).toBe(true);
    expect(result.abstention.verdict).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("emits no likelihood whatsoever when it abstains", async () => {
    const result = await runQuestion(
      deps(pipelineStub({ spreadFraming: true })),
      spread,
    );
    expect(result.probabilities).toBeNull();
    expect(result.forecast).toBeNull();
    expect(result.product.hypotheses).toEqual([]);
    expect(result.product.abstention?.reasons.length).toBeGreaterThan(0);
  });
});

describe("runQuestion — red team with standing", () => {
  it("honours a forced rerun once and records it as a distinct artifact set", async () => {
    const result = await runQuestion(
      deps(pipelineStub({ redTeamDemandsRerun: true })),
      INPUT,
    );

    expect(result.reruns).toBe(1);
    const hashes = result.ensemble.summaries.map((s) => s.artifactHash);
    expect(new Set(hashes).size).toBe(hashes.length);
    expect(result.ensemble.summaries.length).toBeGreaterThan(4);
  });

  it("does not rerun when the budget is zero", async () => {
    const result = await runQuestion(
      deps(pipelineStub({ redTeamDemandsRerun: true })),
      { ...INPUT, rerunBudget: 0 },
    );
    expect(result.reruns).toBe(0);
    expect(result.ensemble.summaries).toHaveLength(4);
  });
});

describe("runQuestion — without a ground truth", () => {
  it("produces a forecast that is explicitly unscorable", async () => {
    const result = await runQuestion(deps(), { ...INPUT, truth: undefined });
    expect(result.oracle).toBeNull();
    expect(result.forecast).toBeNull();
    expect(result.probabilities).toHaveLength(3);
    expect(result.product.hypotheses).toHaveLength(3);
  });
});
