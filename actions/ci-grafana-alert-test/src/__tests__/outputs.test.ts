import { describe, expect, it } from "vitest";

import { extractCheckOutputs } from "../outputs";
import type { GrafanaAlertCheckResult } from "../result";

describe("extractCheckOutputs", () => {
  it("counts violations and shapes outcomes", () => {
    const result: GrafanaAlertCheckResult = {
      Violations: [{ RuleUID: "r1" }, { RuleUID: "r2" }],
      Verdicts: [
        { Alert: "A", RuleUID: "r1", Outcome: "newly_bad", BadFor: 0 },
        { Alert: "B", RuleUID: "r2", Outcome: "ok", BadFor: 0 },
      ],
    };

    expect(extractCheckOutputs(result)).toEqual({
      violationCount: 2,
      violations: JSON.stringify([{ RuleUID: "r1" }, { RuleUID: "r2" }]),
      outcomes: JSON.stringify([
        { alert: "A", outcome: "newly_bad" },
        { alert: "B", outcome: "ok" },
      ]),
    });
  });

  it("handles empty result", () => {
    expect(extractCheckOutputs({})).toEqual({
      violationCount: 0,
      violations: "[]",
      outcomes: "[]",
    });
  });
});
