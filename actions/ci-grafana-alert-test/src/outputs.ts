import type { GrafanaAlertCheckResult } from "./result";

export interface CheckOutputs {
  violationCount: number;
  violations: string;
  outcomes: string;
}

export function extractCheckOutputs(
  result: GrafanaAlertCheckResult,
): CheckOutputs {
  const violations = result.Violations ?? [];
  const outcomes = (result.Verdicts ?? []).map((verdict) => ({
    alert: verdict.Alert,
    outcome: verdict.Outcome,
    // Omitted by JSON.stringify when the CLI predates source_kind.
    source: verdict.source_kind,
  }));

  return {
    violationCount: violations.length,
    violations: JSON.stringify(violations),
    outcomes: JSON.stringify(outcomes),
  };
}
