import * as core from "@actions/core";

import type { CodeownersEntry } from "./codeowners";
import type { ProcessedCodeOwnersEntry } from "./run";

import { PullRequestReviewStateExt, iconFor } from "./review-status";

const LEGEND =
  `Legend: ${iconFor(PullRequestReviewStateExt.Approved)} Approved | ` +
  `${iconFor(PullRequestReviewStateExt.ChangesRequested)} Changes Requested | ` +
  `${iconFor(PullRequestReviewStateExt.Commented)} Commented | ` +
  `${iconFor(PullRequestReviewStateExt.Dismissed)} Dismissed | ` +
  `${iconFor(PullRequestReviewStateExt.Pending)} Pending | ` +
  `${iconFor(PullRequestReviewStateExt.Unknown)} Unknown`;

export function formatPendingReviewsMarkdown(
  entryMap: Map<CodeownersEntry, ProcessedCodeOwnersEntry>,
  summaryUrl: string,
): string {
  const lines: string[] = [];

  lines.push("### Codeowners Review Summary");
  lines.push("");
  lines.push(LEGEND);
  lines.push("");
  lines.push("| Codeowners Entry | Overall | Files | Owners |");
  lines.push("| ---------------- | ------- | ----- | ------ |");

  const sortedEntries = [...entryMap.entries()].sort(([a, _], [b, __]) => {
    return a.lineNumber - b.lineNumber;
  });

  for (const [entry, processed] of sortedEntries) {
    const overall = processed.overallStatus;

    // Only show if not satisfied (skip Approved)
    if (overall === PullRequestReviewStateExt.Approved) {
      continue;
    }

    const owners =
      entry.owners && entry.owners.length > 0
        ? entry.owners
        : ["_No owners found_"];
    const overallIcon = iconFor(overall);

    // Just one row per entry, pattern as inline code
    lines.push(
      `| \`${entry.rawPattern}\` | ${overallIcon} | ${processed.files.length} |${owners.join(", ")} |`,
    );
  }

  if (summaryUrl) {
    lines.push("");
    lines.push(
      `For more details, see the [full review summary](${summaryUrl}).`,
    );
    lines.push("");
  }

  return lines.join("\n");
}

type TCell = {
  data: string;
  header?: boolean;
  colspan?: string;
  rowspan?: string;
};
type TRow = TCell[];

export async function formatAllReviewsSummaryByEntry(
  entryMap: Map<CodeownersEntry, ProcessedCodeOwnersEntry>,
): Promise<void> {
  const headerRow: TRow = [
    { data: "File Path", header: true },
    { data: "Overall", header: true },
    { data: "Owner", header: true },
    { data: "State", header: true },
    { data: "Reviewed By", header: true },
  ];

  // Top-level heading & legend once
  core.summary
    .addHeading("Codeowners Review Details", 2)
    .addRaw(LEGEND)
    .addBreak();

  const sortedEntries = [...entryMap.entries()].sort(([a, _], [b, __]) => {
    return a.lineNumber - b.lineNumber;
  });
  for (const [entry, processed] of sortedEntries) {
    const files = (processed.files || []).slice().sort();
    if (files.length === 0) {
      core.warning(`No files matched CODEOWNERS entry: ${entry.pattern}`);
      continue;
    }

    const owners: string[] =
      entry.owners && entry.owners.length > 0
        ? entry.owners
        : ["_No owners found_"];
    const ownerStatuses = processed.ownerReviewStatuses || [];
    const overallIcon = iconFor(processed.overallStatus);

    const rows: TRow[] = [];

    for (const file of files) {
      if (ownerStatuses.length === 0) {
        rows.push([
          { data: file },
          { data: overallIcon }, // overall is per-entry
          { data: owners[0] ?? "_No owners found_" },
          { data: overallIcon },
          { data: "-" },
        ]);
        continue;
      }

      const rowspan = String(ownerStatuses.length);
      const filenameCell: TCell = { data: file, rowspan };
      const overallCell: TCell = { data: overallIcon, rowspan };

      ownerStatuses.forEach((status, idx) => {
        // Align owners with statuses (same logic you had before)
        let ownerName: string;
        if (owners.length === ownerStatuses.length) {
          ownerName = owners[idx] ?? "_Unknown owner_";
        } else if (owners.length === 1) {
          ownerName = owners[0];
        } else {
          ownerName =
            owners[idx] ?? owners[owners.length - 1] ?? "_Unknown owner_";
        }

        const ownerCell: TCell = { data: ownerName };
        const stateCell: TCell = { data: iconFor(status.state) };
        const reviewedByCell: TCell = { data: status.actor ?? "-" };

        if (idx === 0) {
          rows.push([
            filenameCell,
            overallCell,
            ownerCell,
            stateCell,
            reviewedByCell,
          ]);
        } else {
          rows.push([ownerCell, stateCell, reviewedByCell]);
        }
      });
    }

    // Per-entry heading + table
    core.summary
      .addHeading(`${overallIcon} - <code>${entry.rawPattern}</code>`, 3)
      .addRaw(`<p><strong>Owners:</strong> ${owners.join(", ")}</p>`)
      .addTable([headerRow, ...rows])
      .addBreak();
  }

  await core.summary.addSeparator().write();
}
