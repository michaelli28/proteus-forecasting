import { describe, it, expect } from "vitest";
import {
  ensembleQualityReport,
  scoreQuestions,
} from "../../src/pipeline/score.js";
import type { QuestionResult } from "../../src/pipeline/run-question.js";

/** Only the fields the scorer reads. */
function result(
  id: string,
  probabilities: readonly number[] | null,
  outcomeIndex: number | null,
): QuestionResult {
  return {
    questionId: id,
    probabilities,
    forecast:
      probabilities && outcomeIndex !== null
        ? { id, probabilities, outcomeIndex }
        : null,
    bandCount: 3,
    abstained: probabilities === null,
  } as unknown as QuestionResult;
}

describe("scoreQuestions", () => {
  it("expands each categorical forecast one-vs-rest across its bands", () => {
    const score = scoreQuestions(
      [result("q1", [0.2, 0.7, 0.1], 1), result("q2", [0.6, 0.3, 0.1], 0)],
      "synthetic_oracle",
    );
    expect(score.scored).toBe(2);
    expect(score.report.n).toBe(6);
    expect(score.report.regime).toBe("synthetic_oracle");
  });

  it("scores a perfect forecast set at Brier 0", () => {
    const score = scoreQuestions(
      [result("q1", [0, 1, 0], 1), result("q2", [1, 0, 0], 0)],
      "synthetic_oracle",
    );
    expect(score.report.brier).toBeCloseTo(0, 12);
  });

  it("names what it skipped instead of quietly shrinking n", () => {
    const score = scoreQuestions(
      [result("q1", [0.2, 0.7, 0.1], 1), result("q2", null, null)],
      "synthetic_oracle",
    );
    expect(score.scored).toBe(1);
    expect(score.skipped).toEqual([{ questionId: "q2", reason: "abstained" }]);
  });

  it("skips a forecast with no resolved outcome rather than inventing one", () => {
    const score = scoreQuestions(
      [result("q1", [0.2, 0.7, 0.1], 1), result("q2", [0.3, 0.3, 0.4], null)],
      "synthetic_oracle",
    );
    expect(score.scored).toBe(1);
    expect(score.skipped[0]!.reason).toBe("unresolved");
  });

  it("refuses to report on an empty scorable set", () => {
    expect(() =>
      scoreQuestions([result("q1", null, null)], "synthetic_oracle"),
    ).toThrow(RangeError);
  });
});

describe("ensembleQualityReport", () => {
  it("reports coverage, tail recall and the abstention rate together", () => {
    const report = ensembleQualityReport([
      result("q1", [0.2, 0.7, 0.1], 1),
      result("q2", [0.6, 0.3, 0.1], 0),
      result("q3", null, null),
    ]);
    expect(report.scored).toBe(2);
    expect(report.coverageAt1).toBeCloseTo(1, 10);
    expect(report.abstentionRate).toBeCloseTo(1 / 3, 10);
    expect(report.tailRecall.recall).toBeGreaterThanOrEqual(0);
  });

  it("counts a realized outcome the ensemble ranked last as a coverage miss", () => {
    const report = ensembleQualityReport([result("q1", [0.7, 0.2, 0.1], 2)]);
    expect(report.coverageAt1).toBe(0);
    expect(report.coverageAt2).toBe(0);
  });
});
