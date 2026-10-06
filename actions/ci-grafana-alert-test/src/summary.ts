import type {
  GrafanaAlertCheckResult,
  Termination,
  Verdict,
  Violation,
} from "./result";

export const SUMMARY_HEADER =
  "| Status | Alert | Source | Verdict | Grafana state | Grafana health | Last error | Broken for | Details |";
export const SUMMARY_SEPARATOR = "|---|---|---|---|---|---|---|---|---|";

const STATUS_FAIL = "❌";
const STATUS_PASS = "✅";
const STATUS_PAUSED = "⏸️";
// GitHub's step-summary limit is a UTF-8 byte size, not a character count.
const MAX_SUMMARY_BYTES = 1_000_000;
const TRUNCATION_NOTE = "\n\n(truncated near 1 MB)";

// Outcomes that pass on their own. A paused rule was never watched, so it is
// neither a pass nor a failure unless it produced a violation.
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

// The identity across both source kinds: datasource-managed rules carry no
// uid, so the CLI's rule_key is the only stable match. Older results without
// rule_key still match by uid.
function ruleKey(entity: { rule_key?: string; RuleUID?: string }): string {
  return entity.rule_key || entity.RuleUID || "";
}

function findViolation(
  violations: Violation[],
  verdict: Verdict,
): Violation | undefined {
  return violations.find(
    (violation) => ruleKey(violation) === ruleKey(verdict),
  );
}

// The CLI prefixes rule-specific coverage notes with `rule "<title>": `; the
// Alert column already names the rule, so the summary strips it the way the
// CLI's own table does.
function noteCell(alert: string | undefined, note: string | undefined): string {
  if (note === undefined) {
    return "-";
  }
  if (!alert) {
    return note;
  }
  const prefix = `rule "${alert}": `;
  return note.startsWith(prefix) ? note.slice(prefix.length) : note;
}

// A row's status: a violation always fails; paused/skipped is neutral because
// the rule was never watched, and only counts against the run when it produced
// a violation (min-observed shortfall).
export function rowStatus(
  verdict: Verdict,
  violation: Violation | undefined,
): string {
  if (violation !== undefined) {
    return STATUS_FAIL;
  }
  if (PASSING_OUTCOMES.has(verdict.Outcome)) {
    return STATUS_PASS;
  }
  if (verdict.Outcome === "paused" || verdict.Outcome === "skipped") {
    return STATUS_PAUSED;
  }
  return STATUS_FAIL;
}

function row(cells: string[]): string {
  return `| ${cells.map(tableCell).join(" | ")} |`;
}

// Failing first, then the neutral paused rules, then passes. The sort is
// stable, so alerts keep the CLI's order within one status.
const STATUS_RANK: Record<string, number> = {
  [STATUS_FAIL]: 0,
  [STATUS_PAUSED]: 1,
  [STATUS_PASS]: 2,
};

interface SummaryRow {
  status: string;
  line: string;
}

// Violations that no verdict names — the CLI's synthetic `not_counted`
// min-observed shortfall. Without these rows an exit 1 could render all ✅.
function buildUnmatchedViolationRows(
  verdicts: Verdict[],
  violations: Violation[],
): SummaryRow[] {
  return violations
    .filter(
      (violation) =>
        !verdicts.some((verdict) => ruleKey(verdict) === ruleKey(violation)),
    )
    .map((violation) => ({
      status: STATUS_FAIL,
      line: row([
        STATUS_FAIL,
        violation.Alert || "-",
        "-",
        violation.Outcome ?? "-",
        violation.State ?? "-",
        violation.Health ?? "-",
        truncateLastError(violation.LastError),
        "-",
        noteCell(violation.Alert, violation.Note),
      ]),
    }));
}

export function buildSummaryRows(result: GrafanaAlertCheckResult): string {
  const verdicts = result.Verdicts ?? [];
  const violations = result.Violations ?? [];

  const rows: SummaryRow[] = verdicts.map((verdict) => {
    const violation = findViolation(violations, verdict);
    const status = rowStatus(verdict, violation);
    return {
      status,
      line: row([
        status,
        verdict.Alert,
        verdict.source_kind ?? "-",
        verdict.Outcome,
        violation?.State ?? "-",
        violation?.Health ?? "-",
        truncateLastError(violation?.LastError),
        formatBrokenFor(verdict.BadFor),
        // Matches jq `(($r.Note // $viol.Note) // "-")` — empty strings kept.
        noteCell(verdict.Alert, verdict.Note ?? violation?.Note),
      ]),
    };
  });

  rows.push(...buildUnmatchedViolationRows(verdicts, violations));

  return rows
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
    .map((summaryRow) => summaryRow.line)
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
    " Set `fail-fast: false` to observe the full window."
  );
}

function sortLabels(labels: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)),
  );
}

export function buildInstancesSection(result: GrafanaAlertCheckResult): string {
  const alertOf = new Map(
    (result.Verdicts ?? []).map((verdict) => [ruleKey(verdict), verdict.Alert]),
  );
  const grouped = new Map<string, Violation[]>();

  for (const violation of result.Violations ?? []) {
    const labels = violation.InstanceLabels ?? {};
    if (Object.keys(labels).length === 0) {
      continue;
    }
    const alert = violation.Alert || alertOf.get(ruleKey(violation)) || "-";
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
  const parts = [
    `${SUMMARY_HEADER}\n${SUMMARY_SEPARATOR}\n${buildSummaryRows(result)}`,
  ];
  if (result.terminated_early) {
    parts.unshift(buildEarlyExitNote(result.terminated_early));
  }
  if (includeInstances) {
    const instances = buildInstancesSection(result);
    if (instances) {
      parts.push(instances);
    }
  }

  return truncateToMaxBytes(parts.join("\n\n"));
}

// body.length counts UTF-16 code units, so a summary dominated by non-ASCII
// alert names or instance labels can pass a character check and still exceed
// the byte limit. Truncate on a UTF-8 code point boundary and budget the note.
function truncateToMaxBytes(body: string): string {
  if (Buffer.byteLength(body, "utf8") <= MAX_SUMMARY_BYTES) {
    return body;
  }
  const budget = MAX_SUMMARY_BYTES - Buffer.byteLength(TRUNCATION_NOTE, "utf8");
  return `${truncateToUtf8Bytes(body, budget)}${TRUNCATION_NOTE}`;
}

function truncateToUtf8Bytes(value: string, maxBytes: number): string {
  const bytes = Buffer.from(value, "utf8");
  let end = maxBytes;
  while (end > 0 && (bytes[end] & 0b1100_0000) === 0b1000_0000) {
    end--;
  }
  return bytes.subarray(0, end).toString("utf8");
}
