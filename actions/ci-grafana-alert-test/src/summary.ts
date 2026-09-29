import type {
  GrafanaAlertCheckResult,
  Termination,
  Verdict,
  Violation,
} from "./result";

export const SUMMARY_HEADER =
  "| Status | Alert | Verdict | Grafana state | Grafana health | Last error | Broken for | Details |";
export const SUMMARY_SEPARATOR = "|---|---|---|---|---|---|---|---|";

const STATUS_FAIL = "❌";
const STATUS_PASS = "✅";
const MAX_TABLE_LENGTH = 1_000_000;

// Outcomes that pass on their own. `paused`/`skipped` pass only with
// allow-paused, so a matching violation decides those rows.
const PASSING_OUTCOMES = new Set(["healthy", "clean", "recovered"]);

function escapePipe(value: string): string {
  return value.replaceAll("|", "\\|");
}

// CLI/Grafana strings reach Markdown that is also posted as a PR comment, so
// collapse newlines and neutralise inline-code spans.
function singleLine(value: string): string {
  return value.replaceAll(/[\r\n]+/g, " ");
}

function tableCell(value: string): string {
  return escapePipe(singleLine(value));
}

function inlineCode(value: string): string {
  return singleLine(value).replaceAll("`", "'");
}

function truncateLastError(lastError: string | undefined): string {
  if (lastError === undefined) {
    return "-";
  }
  return lastError.length > 120 ? lastError.slice(0, 120) : lastError;
}

// Full started seconds: any partial second counts, and a sub-second break
// still reads as 1s rather than 0s.
function formatBrokenFor(badFor: number): string {
  if (badFor <= 0) {
    return "0s";
  }
  return `${Math.ceil(badFor / 1_000_000_000)}s`;
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

export function isFailure(
  verdict: Verdict,
  violation: Violation | undefined,
): boolean {
  if (violation !== undefined) {
    return true;
  }
  return !(
    PASSING_OUTCOMES.has(verdict.Outcome) ||
    verdict.Outcome === "paused" ||
    verdict.Outcome === "skipped"
  );
}

export function buildSummaryRows(result: GrafanaAlertCheckResult): string {
  const verdicts = result.Verdicts ?? [];
  const violations = result.Violations ?? [];

  return verdicts
    .map((verdict) => {
      const violation = findViolation(violations, verdict.RuleUID);
      const cells = [
        isFailure(verdict, violation) ? STATUS_FAIL : STATUS_PASS,
        verdict.Alert,
        verdict.Outcome,
        violation?.State ?? "-",
        violation?.Health ?? "-",
        truncateLastError(violation?.LastError),
        formatBrokenFor(verdict.BadFor),
        formatNote(verdict, violation),
      ].map(tableCell);
      return `| ${cells.join(" | ")} |`;
    })
    .join("\n");
}

function buildEarlyExitNote(termination: Termination): string {
  const target = termination.alert
    ? ` on "${singleLine(termination.alert)}"`
    : "";
  const comparison = termination.at ? ` at ${singleLine(termination.at)}` : "";
  const detail = singleLine(
    termination.reason ?? termination.outcome ?? termination.kind ?? "unknown",
  );
  return (
    `> **Early exit:** the gate stopped before the window closed` +
    `${target}${comparison} (${detail}).` +
    " Set `no-fail-fast: true` to observe the full window."
  );
}

function sortLabels(labels: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)),
  );
}

export function buildInstancesSection(result: GrafanaAlertCheckResult): string {
  const alertOf = new Map(
    (result.Verdicts ?? []).map((verdict) => [verdict.RuleUID, verdict.Alert]),
  );
  const grouped = new Map<string, Violation[]>();

  for (const violation of result.Violations ?? []) {
    const labels = violation.InstanceLabels ?? {};
    if (Object.keys(labels).length === 0) {
      continue;
    }
    const alert =
      violation.Alert || alertOf.get(violation.RuleUID ?? "") || "-";
    grouped.set(alert, [...(grouped.get(alert) ?? []), violation]);
  }

  if (grouped.size === 0) {
    return "";
  }

  const sections = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([alert, violations]) => {
      const items = violations.map((violation) => {
        const labels = inlineCode(
          JSON.stringify(sortLabels(violation.InstanceLabels ?? {})),
        );
        const details = [
          violation.Outcome,
          violation.State && `state: ${violation.State}`,
          violation.Health && `health: ${violation.Health}`,
        ]
          .filter((part): part is string => Boolean(part))
          .map(singleLine)
          .join("; ");
        return `- \`${labels}\`${details ? ` — ${escapePipe(details)}` : ""}`;
      });
      return `**${tableCell(alert)}**\n${items.join("\n")}`;
    });

  return `#### Failing instances\n\n${sections.join("\n\n")}`;
}

export function buildSummaryBody(
  result: GrafanaAlertCheckResult,
  includeInstances = false,
): string {
  let rows = buildSummaryRows(result);
  if (rows.length > MAX_TABLE_LENGTH) {
    rows = `${rows.slice(0, MAX_TABLE_LENGTH)}\n(truncated near 1 MB)`;
  }

  const parts = [`${SUMMARY_HEADER}\n${SUMMARY_SEPARATOR}\n${rows}`];
  if (result.terminated_early) {
    parts.unshift(buildEarlyExitNote(result.terminated_early));
  }
  if (includeInstances) {
    const instances = buildInstancesSection(result);
    if (instances) {
      parts.push(instances);
    }
  }
  return parts.join("\n\n");
}
