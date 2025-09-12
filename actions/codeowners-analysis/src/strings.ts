import * as core from "@actions/core";

import type { ReviewSummary, OwnerReviewStatus } from "./run";
import { PullRequestReviewState } from "./generated/graphql";

const LEGEND =
  `Legend: ${iconFor(PullRequestReviewState.Approved)} Approved | ` +
  `${iconFor(PullRequestReviewState.ChangesRequested)} Changes Requested | ` +
  `${iconFor(PullRequestReviewState.Commented)} Commented | ` +
  `${iconFor(PullRequestReviewState.Dismissed)} Dismissed | ` +
  `${iconFor(PullRequestReviewState.Pending)} Pending`;

export function formatPendingReviewsMarkdown(
  reviewSummary: ReviewSummary,
  summaryUrl: string,
): string {
  const lines: string[] = [];

  lines.push("### Codeowners Review Summary");
  lines.push("");
  lines.push(LEGEND);
  lines.push("");
  lines.push("| File Path | Overall | Owners |");
  lines.push("| --------- | ------- | ------ |");

  reviewSummary.pendingFiles?.forEach((file) => {
    const owners = reviewSummary.fileToOwners[file] || ["_No owners found_"];
    const ownerStatuses = reviewSummary.fileToStatus[file] || [];
    const fileOverall = getOverallState(ownerStatuses);
    const overallIcon = fileOverall ? iconFor(fileOverall) : "-";

    lines.push(`| ${file} | ${overallIcon} | ${owners.join(", ")} |`);
  });

  lines.push("");
  lines.push(`For more details, see the [full review summary](${summaryUrl}).`);
  lines.push("");

  return lines.join("\n");
}

type TCell = {
  data: string;
  header?: boolean;
  colspan?: string;
  rowspan?: string;
};
type TRow = TCell[];

export async function formatAllReviewsSummary(
  summary: ReviewSummary,
): Promise<void> {
  const headerRow: TRow = [
    { data: "File Path", header: true },
    { data: "Overall", header: true },
    { data: "Owner", header: true },
    { data: "State", header: true },
    { data: "Reviewed By", header: true },
  ];

  const rows: TRow[] = [];

  const files = Object.keys(summary.fileToStatus || {}).sort();

  for (const file of files) {
    const ownerStatuses = summary.fileToStatus[file] || [];
    const owners: string[] =
      summary.fileToOwners[file] && summary.fileToOwners[file].length > 0
        ? summary.fileToOwners[file]
        : ["_No owners found_"];

    const fileOverall = getOverallState(ownerStatuses);

    if (ownerStatuses.length === 0) {
      rows.push([
        { data: file },
        { data: fileOverall ? iconFor(fileOverall) : "-" },
        { data: owners[0] ?? "_No owners found_" },
        { data: "-" },
        { data: "-" },
      ]);
      continue;
    }

    const rowspan = String(ownerStatuses.length);
    const filenameCell: TCell = { data: file, rowspan };
    const overallCell: TCell = {
      data: fileOverall ? iconFor(fileOverall) : "-",
      rowspan,
    };

    ownerStatuses.forEach((status, idx) => {
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
      const reviewedByCell: TCell = { data: status.user ?? "-" };

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

  await core.summary
    .addHeading("Codeowners Review Details", 2)
    .addRaw(LEGEND)
    .addBreak()
    .addTable([headerRow, ...rows])
    .addSeparator()
    .write();
}

function iconFor(state: PullRequestReviewState): string {
  switch (state) {
    case PullRequestReviewState.Approved:
      return "✅";
    case PullRequestReviewState.ChangesRequested:
      return "❌";
    case PullRequestReviewState.Commented:
      return "💬";
    case PullRequestReviewState.Dismissed:
      return "🚫";
    case PullRequestReviewState.Pending:
      return "⏳";
    default:
      return "❓";
  }
}

function getOverallState(
  statuses: OwnerReviewStatus[],
): PullRequestReviewState | undefined {
  if (!statuses || statuses.length === 0) return undefined;
  const precedence: Record<PullRequestReviewState, number> = {
    [PullRequestReviewState.ChangesRequested]: 0,
    [PullRequestReviewState.Approved]: 1,
    [PullRequestReviewState.Commented]: 2,
    [PullRequestReviewState.Dismissed]: 3,
    [PullRequestReviewState.Pending]: 4,
  } as const;

  return statuses
    .map((s) => s.state)
    .sort((a, b) => (precedence[a] ?? 99) - (precedence[b] ?? 99))[0];
}
