import * as core from "@actions/core";
import * as github from "@actions/github";

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
  minimumHittingSets: Set<string[]>,
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

    const patternCell = entry.htmlLineUrl
      ? "[`" + `${entry.rawPattern}` + "`](" + `${entry.htmlLineUrl})`
      : "[`" + `${entry.rawPattern}` + "`]";

    // Just one row per entry, pattern as inline code
    lines.push(
      `| ${patternCell} | ${overallIcon} | ${processed.files.length} |${owners.join(", ")} |`,
    );
  }

  const recommendations = getReviewRecos(entryMap, minimumHittingSets, 2);
  if (recommendations.length > 0) {
    lines.push("");
    lines.push("### Reviewer Recommendations");
    recommendations.forEach((rec) => {
      lines.push(`- ${rec}`);
    });
    lines.push("");
  }

  lines.push("");
  lines.push("---");
  lines.push("");

  const {
    runId,
    repo: { owner, repo },
  } = github.context;
  if (runId && owner && repo) {
    lines.push(
      `Refresh analysis with: \`gh run rerun ${runId} -R ${owner}/${repo}\``,
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
  minimumHittingSets: Set<string[]>,
): Promise<void> {
  // Top-level heading & legend once
  core.summary
    .addHeading("Codeowners Review Details", 2)
    .addRaw(LEGEND)
    .addBreak();

  const recommendations = getReviewRecos(entryMap, minimumHittingSets, 10);
  if (recommendations.length > 0) {
    core.summary.addHeading(
      `Reviewer Recommendations (${recommendations.length} of ${minimumHittingSets.size})`,
      3,
    );
    core.summary.addList(recommendations);
    core.summary.addBreak();
  }

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

    const headerRow: TRow = [
      { data: `Files (${files.length})`, header: true },
      { data: "Overall", header: true },
      { data: "Owner", header: true },
      { data: "State", header: true },
      { data: "Reviewed By", header: true },
    ];

    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const lineLink = entry.htmlLineUrl
      ? ` <a href="${entry.htmlLineUrl}">(#L${entry.lineNumber})</a>`
      : "";

    const metaRows: TRow[] = [
      [{ data: "Owners", header: true }, { data: owners.join(", ") }],
      [
        { data: `Entry ${lineLink}`, header: true },
        {
          data: `<code>${escapeHtml(entry.rawLine)}</code>`,
        },
      ],
    ];

    // Per-entry heading + table
    core.summary
      .addHeading(
        `${overallIcon} - <code>${escapeHtml(entry.rawPattern)}</code>`,
        3,
      )
      .addTable(metaRows) // grouped meta info
      .addTable([headerRow, ...rows]) // your main details table
      .addBreak();
  }

  await core.summary.addSeparator().write();
}

function getReviewRecos(
  entryMap: Map<CodeownersEntry, ProcessedCodeOwnersEntry>,
  minimumHittingSets: Set<string[]>,
  limit: number = 3,
): string[] {
  if (minimumHittingSets.size === 0) {
  // Return early if no hitting sets
    return [];
  }

  const numEntries = entryMap.size;
  if (numEntries <= 1) {
    // Return early for trivial cases
    return [];
  }

  const setsArray = Array.from(minimumHittingSets);
  const minimumSize = setsArray[0].length;

  // Suggest up to `limit` sets of the minimum size
  const numberOfSetsToSuggest = Math.min(minimumSize, limit, setsArray.length);
  const trimmedSets = setsArray.slice(0, numberOfSetsToSuggest);
  return trimmedSets.map((set) => `${set.join(", ")}`);
}
