import { describe, expect, it } from "vitest";

import type { GrafanaAlertCheckResult } from "../result";
import { parseResult } from "../result";
import {
  buildInstancesSection,
  buildSummaryBody,
  buildSummaryRows,
  rowStatus,
} from "../summary";

const result: GrafanaAlertCheckResult = {
  Violations: [
    {
      Alert: "My Alert",
      RuleUID: "rule-1",
      rule_key: "rule-1",
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
      Alert: "DS Alert",
      RuleUID: "",
      rule_key: 'ds:["vm","g","DS Alert"]',
      Outcome: "new_failure",
      State: "firing",
      Health: "err",
      LastError: "prometheus error",
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
      rule_key: "rule-1",
      source_kind: "grafana",
      Outcome: "new_failure",
      BadFor: 1_500_000_000,
      Note: "verdict note",
    },
    {
      Alert: "Other | Alert",
      RuleUID: "rule-2",
      source_kind: "grafana",
      Outcome: "healthy",
      BadFor: 0,
    },
    {
      Alert: "Unverified",
      RuleUID: "rule-3",
      source_kind: "grafana",
      Outcome: "not_verified",
      BadFor: 0,
    },
    {
      Alert: "DS Alert",
      RuleUID: "",
      rule_key: 'ds:["vm","g","DS Alert"]',
      source_kind: "datasource",
      Outcome: "new_failure",
      BadFor: 2_000_000_000,
    },
    {
      Alert: "Paused",
      RuleUID: "rule-5",
      source_kind: "grafana",
      Outcome: "paused",
      BadFor: 0,
    },
  ],
};

describe("rowStatus", () => {
  it("passes healthy and recovered without a violation", () => {
    const verdict = { Alert: "A", RuleUID: "r", Outcome: "healthy", BadFor: 0 };
    expect(rowStatus(verdict, undefined)).toBe("✅");
    expect(rowStatus({ ...verdict, Outcome: "recovered" }, undefined)).toBe(
      "✅",
    );
  });

  it("gives paused without a violation a neutral status, failing it with one", () => {
    const verdict = { Alert: "A", RuleUID: "r", Outcome: "paused", BadFor: 0 };
    expect(rowStatus(verdict, undefined)).toBe("⏸️");
    expect(rowStatus(verdict, { RuleUID: "r" })).toBe("❌");
  });

  it("fails recovered when the policy still counts it as a violation", () => {
    const verdict = {
      Alert: "A",
      RuleUID: "r",
      Outcome: "recovered",
      BadFor: 0,
    };
    expect(rowStatus(verdict, { RuleUID: "r", Outcome: "recovered" })).toBe(
      "❌",
    );
  });

  it("fails not_verified even without a violation", () => {
    const verdict = {
      Alert: "A",
      RuleUID: "r",
      Outcome: "not_verified",
      BadFor: 0,
    };
    expect(rowStatus(verdict, undefined)).toBe("❌");
  });
});

describe("buildSummaryRows", () => {
  it("builds one row per verdict with a failing status and matching violation", () => {
    const rows = buildSummaryRows(result);

    expect(rows).toContain(
      "| ❌ | My Alert | grafana | new_failure | firing | bad | some error | 2s | verdict note |",
    );
  });

  it("matches violations to datasource verdicts by rule_key, not the empty uid", () => {
    const rows = buildSummaryRows({
      Violations: [
        {
          Alert: "A",
          RuleUID: "",
          rule_key: "ds:a",
          Outcome: "still_failing",
          State: "firing",
          Health: "err",
        },
        {
          Alert: "B",
          RuleUID: "",
          rule_key: "ds:b",
          Outcome: "new_failure",
          State: "pending",
          Health: "ok",
        },
      ],
      Verdicts: [
        {
          Alert: "A",
          RuleUID: "",
          rule_key: "ds:a",
          source_kind: "datasource",
          Outcome: "still_failing",
          BadFor: 0,
        },
        {
          Alert: "B",
          RuleUID: "",
          rule_key: "ds:b",
          source_kind: "datasource",
          Outcome: "new_failure",
          BadFor: 0,
        },
      ],
    });

    expect(rows).toContain(
      "| ❌ | A | datasource | still_failing | firing | err | - | 0s | - |",
    );
    expect(rows).toContain(
      "| ❌ | B | datasource | new_failure | pending | ok | - | 0s | - |",
    );
  });

  it("matches datasource rules from the CLI's snake_case wire format", () => {
    const parsed = parseResult(
      JSON.stringify({
        Violations: [
          {
            Alert: "DS Alert",
            RuleUID: "",
            rule_key: "ds:a",
            Outcome: "new_failure",
            State: "firing",
            Health: "err",
          },
        ],
        Verdicts: [
          {
            Alert: "DS Alert",
            RuleUID: "",
            rule_key: "ds:a",
            source_kind: "datasource",
            Outcome: "new_failure",
            BadFor: 0,
          },
        ],
      }),
    );

    expect(buildSummaryRows(parsed)).toContain(
      "| ❌ | DS Alert | datasource | new_failure | firing | err | - | 0s | - |",
    );
  });

  it("strips the CLI's rule title prefix from details", () => {
    const rows = buildSummaryRows({
      Violations: [],
      Verdicts: [
        {
          Alert: "My Alert",
          RuleUID: "r",
          Outcome: "not_verified",
          BadFor: 0,
          Note: 'rule "My Alert": heartbeat gap 5m exceeds maxGap 1m',
        },
      ],
    });

    expect(rows).toContain("| heartbeat gap 5m exceeds maxGap 1m |");
    expect(rows).not.toContain('rule "My Alert":');
  });

  it("marks passing, neutral, and unverified rules with the right status", () => {
    const rows = buildSummaryRows(result);

    expect(rows).toContain(
      "| ✅ | Other \\| Alert | grafana | healthy | - | - | - | 0s | - |",
    );
    expect(rows).toContain(
      "| ❌ | Unverified | grafana | not_verified | - | - | - | 0s | - |",
    );
    expect(rows).toContain(
      "| ⏸️ | Paused | grafana | paused | - | - | - | 0s | - |",
    );
  });

  it("escapes pipes in cells", () => {
    const rows = buildSummaryRows(result);
    expect(rows).toContain("Other \\| Alert");
  });

  it("adds a failing row for violations that no verdict names", () => {
    const rows = buildSummaryRows({
      Violations: [
        {
          Outcome: "not_counted",
          Note: "min-observed 3 exceeds the 1 rule(s) counted as observed",
        },
      ],
      Verdicts: [{ Alert: "A", RuleUID: "r1", Outcome: "healthy", BadFor: 0 }],
    });

    expect(rows).toContain("| ✅ | A | - | healthy | - | - | - | 0s | - |");
    expect(rows).toContain(
      "| ❌ | - | - | not_counted | - | - | - | - | min-observed 3 exceeds the 1 rule(s) counted as observed |",
    );
  });

  it("does not duplicate matched violations as unmatched rows", () => {
    const rows = buildSummaryRows(result);
    const occurrences = rows.split("| My Alert |").length - 1;

    expect(occurrences).toBe(1);
  });

  it("rounds broken time up to full seconds with a 1s floor", () => {
    const rows = buildSummaryRows({
      Violations: [],
      Verdicts: [
        {
          Alert: "Sub",
          RuleUID: "r1",
          Outcome: "new_failure",
          BadFor: 400_000_000,
        },
        { Alert: "None", RuleUID: "r2", Outcome: "healthy", BadFor: 0 },
        {
          Alert: "Partial",
          RuleUID: "r3",
          Outcome: "new_failure",
          BadFor: 10_200_000_000,
        },
      ],
    });

    expect(rows).toContain(
      "| ❌ | Sub | - | new_failure | - | - | - | 1s | - |",
    );
    expect(rows).toContain("| ✅ | None | - | healthy | - | - | - | 0s | - |");
    expect(rows).toContain(
      "| ❌ | Partial | - | new_failure | - | - | - | 11s | - |",
    );
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

  it("orders failing rows first, then paused, then passing", () => {
    const statuses = buildSummaryRows(result)
      .split("\n")
      .map((line) => line.split("|")[1].trim());
    const rank: Record<string, number> = { "❌": 0, "⏸️": 1, "✅": 2 };

    expect(statuses).toEqual([...statuses].sort((a, b) => rank[a] - rank[b]));
  });
});

describe("buildSummaryBody", () => {
  it("prefixes the header, separator, and status column", () => {
    const body = buildSummaryBody(result);
    expect(body).toContain(
      "| Status | Alert | Source | Verdict | Grafana state | Grafana health | Last error | Broken for | Details |\n|---|---|---|---|---|---|---|---|---|",
    );
  });

  it("spells out a wire-format early exit", () => {
    const body = buildSummaryBody({
      ...result,
      terminated_early: {
        kind: "violation",
        alert: "My\nAlert",
        outcome: "new_failure",
        at: "2026-09-29T10:00:00Z",
      },
    });
    expect(body).toContain("**Early exit:**");
    expect(body).toContain('on "My Alert" at 2026-09-29T10:00:00Z');
    expect(body).toContain("Set `fail-fast: false`");
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

  it("caps non-ASCII bodies by UTF-8 bytes, not UTF-16 code units", () => {
    const body = buildSummaryBody({
      Violations: [],
      Verdicts: [
        {
          Alert: "😀".repeat(400_000),
          RuleUID: "r",
          Outcome: "healthy",
          BadFor: 0,
        },
      ],
    });

    expect(Buffer.byteLength(body, "utf8")).toBeLessThanOrEqual(1_000_000);
    expect(body.endsWith("(truncated near 1 MB)")).toBe(true);
    expect(body).not.toContain("\uFFFD");
  });

  it("caps the whole body, including instance details", () => {
    const violations = Array.from({ length: 2000 }, (_, i) => ({
      Alert: "A",
      RuleUID: "r1",
      Outcome: "new_failure",
      InstanceLabels: { instance: `host-${i}`, pad: "x".repeat(500) },
    }));
    const body = buildSummaryBody(
      {
        Violations: violations,
        Verdicts: [
          { Alert: "A", RuleUID: "r1", Outcome: "new_failure", BadFor: 0 },
        ],
      },
      true,
    );

    expect(Buffer.byteLength(body, "utf8")).toBeLessThanOrEqual(1_000_000);
    expect(body.endsWith("(truncated near 1 MB)")).toBe(true);
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

  it("resolves a datasource violation's alert by rule_key when the uid is empty", () => {
    const section = buildInstancesSection({
      Verdicts: [
        {
          Alert: "DS Alert",
          RuleUID: "",
          rule_key: "ds:a",
          source_kind: "datasource",
          Outcome: "new_failure",
          BadFor: 0,
        },
      ],
      Violations: [
        {
          RuleUID: "",
          rule_key: "ds:a",
          Outcome: "new_failure",
          InstanceLabels: { instance: "host:1" },
        },
      ],
    });

    expect(section).toContain("**DS Alert**");
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
