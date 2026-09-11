import type { GrafanaAlertCheckResult, Verdict, Violation } from "./result";

export const SUMMARY_HEADER =
  "| Alert | Outcome | State | Health | Last error | Bad for | Note |";
export const SUMMARY_SEPARATOR = "|---|---|---|---|---|---|---|";

const MAX_TABLE_LENGTH = 1_000_000;

function escapePipe(value: string): string {
  return value.replaceAll("|", "\\|");
}

function truncateLastError(lastError: string | undefined): string {
  if (lastError === undefined) {
    return "-";
  }
  return lastError.length > 120 ? lastError.slice(0, 120) : lastError;
}

function findViolation(
  violations: Violation[],
  ruleUid: string,
): Violation | undefined {
  return violations.find((violation) => violation.RuleUID === ruleUid);
}

function formatNote(
  verdict: Verdict,
  violation: Violation | undefined,
): string {
  // Matches jq `(($r.Note // $viol.Note) // "-")` — empty strings are kept.
  return verdict.Note ?? violation?.Note ?? "-";
}

export function buildSummaryRows(result: GrafanaAlertCheckResult): string {
  const verdicts = result.Verdicts ?? [];
  const violations = result.Violations ?? [];

  return verdicts
    .map((verdict) => {
      const violation = findViolation(violations, verdict.RuleUID);
      const badForSeconds = (verdict.BadFor / 1_000_000_000).toString();
      const cells = [
        verdict.Alert,
        verdict.Outcome,
        violation?.State ?? "-",
        violation?.Health ?? "-",
        truncateLastError(violation?.LastError),
        `${badForSeconds}s`,
        formatNote(verdict, violation),
      ].map(escapePipe);
      return `| ${cells.join(" | ")} |`;
    })
    .join("\n");
}

export function buildSummaryBody(result: GrafanaAlertCheckResult): string {
  let rows = buildSummaryRows(result);
  if (rows.length > MAX_TABLE_LENGTH) {
    rows = `${rows.slice(0, MAX_TABLE_LENGTH)}\n(truncated near 1 MB)`;
  }
  return `${SUMMARY_HEADER}\n${SUMMARY_SEPARATOR}\n${rows}`;
}
