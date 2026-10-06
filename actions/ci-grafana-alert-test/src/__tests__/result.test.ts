import { describe, expect, it } from "vitest";

import { parseResult } from "../result";

describe("parseResult", () => {
  it("reads the CLI wire format, including the tagged terminated_early", () => {
    const raw = JSON.stringify({
      Violations: [],
      Verdicts: [
        {
          Alert: "CCIP O11y slow queries",
          RuleUID: "r1",
          Outcome: "unstable",
          BadFor: 303_000_000_000,
        },
      ],
      terminated_early: {
        kind: "violation",
        alert: "CCIP O11y slow queries",
        rule_key: 'ds:["vm","g","CCIP O11y slow queries"]',
        rule_uid: "",
        outcome: "unstable",
        at: "2026-09-29T10:00:00Z",
      },
    });

    const result = parseResult(raw);

    expect(result.terminated_early?.kind).toBe("violation");
    expect(result.terminated_early?.alert).toBe("CCIP O11y slow queries");
    expect(result.terminated_early?.rule_key).toBe(
      'ds:["vm","g","CCIP O11y slow queries"]',
    );
    expect(result.terminated_early?.at).toBe("2026-09-29T10:00:00Z");
  });

  it("leaves terminated_early absent on a full run", () => {
    const result = parseResult(
      JSON.stringify({ Violations: [], Verdicts: [] }),
    );

    expect(result.terminated_early).toBeUndefined();
  });
});
