import { describe, expect, it } from "vitest";

import type { GrafanaAlertCheckResult } from "../result";
import {
  buildInstancesSection,
  buildSummaryBody,
  buildSummaryRows,
  isFailure,
} from "../summary";

const result: GrafanaAlertCheckResult = {
  Violations: [
    {
      Alert: "My Alert",
      RuleUID: "rule-1",
      Outcome: "new_failure",
      State: "firing",
      Health: "bad",
      LastError: "some error",
      InstanceLabels: { pod: "pod-1", instance: "10.0.0.5:9090" },
      Note: "violation note",
    },
    {
      Alert: "Zebra Alert",
      RuleUID: "rule-4",
      Outcome: "still_failing",
      State: "firing",
      Health: "ok",
      InstanceLabels: { instance: "10.0.0.9:9090" },
    },
    {
      Outcome: "not_counted",
      Note: "min-observed shortfall with no instance behind it",
    },
  ],
  Verdicts: [
    {
      Alert: "My Alert",
      RuleUID: "rule-1",
      Outcome: "new_failure",
      BadFor: 1_500_000_000,
      Note: "verdict note",
    },
    {
      Alert: "Other | Alert",
      RuleUID: "rule-2",
      Outcome: "healthy",
      BadFor: 0,
    },
    {
      Alert: "Unverified",
      RuleUID: "rule-3",
      Outcome: "not_verified",
      BadFor: 0,
    },
    { Alert: "Paused", RuleUID: "rule-5", Outcome: "paused", BadFor: 0 },
  ],
};

describe("isFailure", () => {
  it("passes healthy and recovered without a violation", () => {
    const verdict = { Alert: "A", RuleUID: "r", Outcome: "healthy", BadFor: 0 };
    expect(isFailure(verdict, undefined)).toBe(false);
    expect(isFailure({ ...verdict, Outcome: "recovered" }, undefined)).toBe(
      false,
    );
  });

  it("passes paused without a violation but fails it with one", () => {
    const verdict = { Alert: "A", RuleUID: "r", Outcome: "paused", BadFor: 0 };
    expect(isFailure(verdict, undefined)).toBe(false);
    expect(isFailure(verdict, { RuleUID: "r" })).toBe(true);
  });

  it("fails recovered when the policy still counts it as a violation", () => {
    const verdict = {
      Alert: "A",
      RuleUID: "r",
      Outcome: "recovered",
      BadFor: 0,
    };
    expect(isFailure(verdict, { RuleUID: "r", Outcome: "recovered" })).toBe(
      true,
    );
  });

  it("fails not_verified even without a violation", () => {
    const verdict = {
      Alert: "A",
      RuleUID: "r",
      Outcome: "not_verified",
      BadFor: 0,
    };
    expect(isFailure(verdict, undefined)).toBe(true);
  });
});

describe("buildSummaryRows", () => {
  it("builds one row per verdict with a failing status and matching violation", () => {
    const rows = buildSummaryRows(result);

    expect(rows).toContain(
      "| ❌ | My Alert | new_failure | firing | bad | some error | 1.5s | verdict note |",
    );
  });

  it("marks passing and unverified rules with the right status", () => {
    const rows = buildSummaryRows(result);

    expect(rows).toContain(
      "| ✅ | Other \\| Alert | healthy | - | - | - | 0s | - |",
    );
    expect(rows).toContain(
      "| ❌ | Unverified | not_verified | - | - | - | 0s | - |",
    );
    expect(rows).toContain("| ✅ | Paused | paused | - | - | - | 0s | - |");
  });

  it("escapes pipes in cells", () => {
    const rows = buildSummaryRows(result);
    expect(rows).toContain("Other \\| Alert");
  });

  it("collapses newlines in table cells", () => {
    const rows = buildSummaryRows({
      Violations: [],
      Verdicts: [
        {
          Alert: "Multi\nLine",
          RuleUID: "r",
          Outcome: "new_failure",
          BadFor: 0,
          Note: "first\nsecond",
        },
      ],
    });
    expect(rows).toContain("Multi Line");
    expect(rows).toContain("first second");
  });

  it("truncates LastError to 120 chars", () => {
    const long = {
      Violations: [
        { RuleUID: "r", State: "firing", LastError: "x".repeat(200) },
      ],
      Verdicts: [
        { Alert: "A", RuleUID: "r", Outcome: "new_failure", BadFor: 0 },
      ],
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
  it("prefixes the header, separator, and status column", () => {
    const body = buildSummaryBody(result);
    expect(body).toContain(
      "| Status | Alert | Verdict | Grafana state | Grafana health | Last error | Broken for | Details |\n|---|---|---|---|---|---|---|---|",
    );
  });

  it("spells out an early exit", () => {
    const body = buildSummaryBody({
      ...result,
      TerminatedEarly: {
        Kind: "bad_onset",
        Alert: "My\nAlert",
        Outcome: "new_failure",
        At: "2026-09-29T10:00:00Z",
      },
    });
    expect(body).toContain("**Early exit:**");
    expect(body).toContain('on "My Alert" at 2026-09-29T10:00:00Z');
    expect(body).toContain("Set `no-fail-fast: true`");
  });

  it("lists failing instances only when asked", () => {
    expect(buildSummaryBody(result)).not.toContain("#### Failing instances");
    expect(buildSummaryBody(result, true)).toContain("#### Failing instances");
  });

  it("truncates near 1 MB", () => {
    const huge = {
      Violations: [],
      Verdicts: [
        {
          Alert: "A".repeat(1_200_000),
          RuleUID: "r",
          Outcome: "healthy",
          BadFor: 0,
        },
      ],
    };
    const body = buildSummaryBody(huge);
    expect(body).toContain("(truncated near 1 MB)");
  });
});

describe("buildInstancesSection", () => {
  it("groups labeled instances by alert, sorted, with sorted labels", () => {
    const section = buildInstancesSection(result);

    expect(section).toContain("#### Failing instances");
    expect(section).toContain(
      '- `{"instance":"10.0.0.5:9090","pod":"pod-1"}` — new_failure; state: firing; health: bad',
    );
    expect(section.indexOf("**My Alert**")).toBeLessThan(
      section.indexOf("**Zebra Alert**"),
    );
  });

  it("skips violations without instance labels", () => {
    const section = buildInstancesSection(result);
    expect(section).not.toContain("min-observed shortfall");
  });

  it("neutralises backticks and newlines in labels and the alert heading", () => {
    const section = buildInstancesSection({
      Violations: [
        {
          Alert: "Bad\nAlert",
          RuleUID: "r",
          Outcome: "new_failure",
          InstanceLabels: { "pod`x": "a\nb" },
        },
      ],
    });

    expect(section).toContain("**Bad Alert**");
    expect(section).toContain('- `{"pod\'x":"a\\nb"}`');
    expect(section).not.toContain("Bad\nAlert");
  });

  it("returns empty when nothing has instance labels", () => {
    expect(
      buildInstancesSection({ Violations: [{ Outcome: "not_counted" }] }),
    ).toBe("");
  });
});
