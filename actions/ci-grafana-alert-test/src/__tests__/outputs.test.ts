import { describe, expect, it } from "vitest";

import { extractCheckOutputs } from "../outputs";
import type { GrafanaAlertCheckResult } from "../result";

describe("extractCheckOutputs", () => {
  it("counts violations and shapes outcomes with their source", () => {
    const result: GrafanaAlertCheckResult = {
      Violations: [{ RuleUID: "r1" }, { RuleUID: "r2" }],
      Verdicts: [
        {
          Alert: "A",
          RuleUID: "r1",
          source_kind: "grafana",
          Outcome: "new_failure",
          BadFor: 0,
        },
        {
          Alert: "B",
          RuleUID: "",
          rule_key: "ds:b",
          source_kind: "datasource",
          Outcome: "healthy",
          BadFor: 0,
        },
      ],
    };

    expect(extractCheckOutputs(result)).toEqual({
      violationCount: 2,
      violations: JSON.stringify([{ RuleUID: "r1" }, { RuleUID: "r2" }]),
      outcomes: JSON.stringify([
        { alert: "A", outcome: "new_failure", source: "grafana" },
        { alert: "B", outcome: "healthy", source: "datasource" },
      ]),
    });
  });

  it("omits source for results from a CLI that predates source_kind", () => {
    const result: GrafanaAlertCheckResult = {
      Verdicts: [{ Alert: "A", RuleUID: "r1", Outcome: "healthy", BadFor: 0 }],
    };

    expect(extractCheckOutputs(result).outcomes).toBe(
      JSON.stringify([{ alert: "A", outcome: "healthy" }]),
    );
  });

  it("handles empty result", () => {
    expect(extractCheckOutputs({})).toEqual({
      violationCount: 0,
      violations: "[]",
      outcomes: "[]",
    });
  });
});
