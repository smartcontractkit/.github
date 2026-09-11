import { describe, expect, it } from "vitest";

import type { GrafanaAlertCheckResult } from "../result";
import { buildSummaryBody, buildSummaryRows } from "../summary";

const result: GrafanaAlertCheckResult = {
  Violations: [
    {
      RuleUID: "rule-1",
      State: "firing",
      Health: "bad",
      LastError: "some error",
      Note: "violation note",
    },
  ],
  Verdicts: [
    {
      Alert: "My Alert",
      RuleUID: "rule-1",
      Outcome: "newly_bad",
      BadFor: 1_500_000_000,
      Note: "verdict note",
    },
    {
      Alert: "Other | Alert",
      RuleUID: "rule-2",
      Outcome: "ok",
      BadFor: 0,
    },
  ],
};

describe("buildSummaryRows", () => {
  it("builds one row per verdict with matching violation merged", () => {
    const rows = buildSummaryRows(result);

    expect(rows).toContain(
      "| My Alert | newly_bad | firing | bad | some error | 1.5s | verdict note |",
    );
  });

  it("escapes pipes in cells", () => {
    const rows = buildSummaryRows(result);
    expect(rows).toContain("Other \\| Alert");
  });

  it("defaults missing fields to '-'", () => {
    const rows = buildSummaryRows(result);
    expect(rows).toContain("| Other \\| Alert | ok | - | - | - | 0s | - |");
  });

  it("truncates LastError to 120 chars", () => {
    const long = {
      Violations: [
        { RuleUID: "r", State: "firing", LastError: "x".repeat(200) },
      ],
      Verdicts: [{ Alert: "A", RuleUID: "r", Outcome: "bad", BadFor: 0 }],
    };
    const rows = buildSummaryRows(long);
    const match = rows.match(/x+/);
    expect(match && match[0].length).toBe(120);
  });

  it("returns empty for no verdicts", () => {
    expect(buildSummaryRows({ Verdicts: [] })).toBe("");
  });
});

describe("buildSummaryBody", () => {
  it("prefixes the header and separator", () => {
    const body = buildSummaryBody(result);
    expect(body).toContain(
      "| Alert | Outcome | State | Health | Last error | Bad for | Note |\n|---|---|---|---|---|---|---|",
    );
  });

  it("truncates near 1 MB", () => {
    const huge = {
      Violations: [],
      Verdicts: [
        {
          Alert: "A".repeat(1_200_000),
          RuleUID: "r",
          Outcome: "ok",
          BadFor: 0,
        },
      ],
    };
    const body = buildSummaryBody(huge);
    expect(body).toContain("(truncated near 1 MB)");
  });
});
