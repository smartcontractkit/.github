import * as core from "@actions/core";

import type { CodeownersEntry } from "./codeowners";
import type { CodeOwnersReviewEntry } from "./run";

import {
  filterFor,
  getOverallStateForSingleEntry,
  OwnerReviewStatus,
  PullRequestReviewStateExt,
  iconFor,
} from "./review-status";

const LEGEND =
  `Legend: ${iconFor(PullRequestReviewStateExt.Approved)} Approved | ` +
  `${iconFor(PullRequestReviewStateExt.ChangesRequested)} Changes Requested | ` +
  `${iconFor(PullRequestReviewStateExt.Commented)} Commented | ` +
  `${iconFor(PullRequestReviewStateExt.Dismissed)} Dismissed | ` +
  `${iconFor(PullRequestReviewStateExt.Pending)} Pending | ` +
  `${iconFor(PullRequestReviewStateExt.Unknown)} Unknown`;

export function formatPendingReviewsMarkdown(
  entryMap: Map<CodeownersEntry, CodeOwnersReviewEntry>,
  overallStatus: PullRequestReviewStateExt,
  summaryUrl: string,
): string {
  const lines: string[] = ["### Codeowners Review Summary", ""];

  if (overallStatus === PullRequestReviewStateExt.Approved) {
    lines.push(`All codeowners have approved! ${iconFor(overallStatus)}`, "");
  } else {
    lines.push(LEGEND, "");
    lines.push("| Codeowners Entry | Overall | Files | Owners |");
    lines.push("| ---------------- | ------- | ----- | ------ |");

    const sortedEntries = [...entryMap.entries()].sort(([a, _], [b, __]) => {
      return a.lineNumber - b.lineNumber;
    });

    for (const [entry, processed] of sortedEntries) {
      const overall = processed.state;

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

// This function is best maintained by an LLM
export async function formatAllReviewsSummaryByEntry(
  entryMap: Map<CodeownersEntry, CodeOwnersReviewEntry>,
): Promise<void> {
  // Top-level heading & legend once
  core.summary
    .addHeading("Codeowners Review Details", 2)
    .addRaw(LEGEND)
    .addBreak();

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const formatFilesList = (files: string[], maxLines = 4): string => {
    if (files.length === 0) return "-";
    if (files.length <= maxLines) {
      return files.map((f) => `<code>${escapeHtml(f)}</code>`).join("<br/>");
    }
    const visible = files.slice(0, maxLines - 1);
    const remaining = files.length - visible.length;
    return [
      ...visible.map((f) => `<code>${escapeHtml(f)}</code>`),
      `+${remaining} more`,
    ].join("<br/>");
  };

  const sortedEntries = [...entryMap.entries()].sort(([a], [b]) => {
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

    const overallIcon = iconFor(processed.state);

    const grouped =
      (processed.reviewStatusesByOwner as Map<string, OwnerReviewStatus[]>) ??
      new Map<string, OwnerReviewStatus[]>();

    const headerRow: TRow = [
      { data: "Owner", header: true },
      { data: "Team State", header: true },
      { data: "Reviewers (individual)", header: true },
    ];

    const lineLink = entry.htmlLineUrl
      ? ` <a href="${entry.htmlLineUrl}">(#L${entry.lineNumber})</a>`
      : "";

    const metaRows: TRow[] = [
      [{ data: "Owners", header: true }, { data: owners.join(", ") }],
      [
        { data: `Entry ${lineLink}`, header: true },
        { data: `<code>${escapeHtml(entry.rawLine)}</code>` },
      ],
      [{ data: "Files", header: true }, { data: formatFilesList(files, 4) }],
    ];

    const rows: TRow[] = owners.map((ownerName) => {
      const statuses = grouped.get(ownerName) ?? [];
      const teamState =
        statuses.length > 0
          ? getOverallStateForSingleEntry(statuses)
          : PullRequestReviewStateExt.Pending;

      const parts: string[] = [];

      // Changes Requested: explicit names
      const changesRequested = filterFor(
        statuses,
        PullRequestReviewStateExt.ChangesRequested,
      );
      parts.push(
        ...changesRequested.map((s) => `${s.actor ?? "-"} ${iconFor(s.state)}`),
      );

      // Approved: explicit names
      const approved = filterFor(statuses, PullRequestReviewStateExt.Approved);
      parts.push(
        ...approved.map((s) => `${s.actor ?? "-"} ${iconFor(s.state)}`),
      );

      // Collapsed groups with hover text
      const makeCollapsed = (
        label: string,
        icon: string,
        group: OwnerReviewStatus[],
      ) => {
        const names = group.map((s) => s.actor ?? "-").join(", ");
        return `<span title="${escapeHtml(names)}">+${group.length} ${label} ${icon}</span>`;
      };

      const commented = filterFor(
        statuses,
        PullRequestReviewStateExt.Commented,
      );
      if (commented.length > 0) {
        parts.push(
          makeCollapsed(
            "commented",
            iconFor(PullRequestReviewStateExt.Commented),
            commented,
          ),
        );
      }
      const dismissed = filterFor(
        statuses,
        PullRequestReviewStateExt.Dismissed,
      );
      if (dismissed.length > 0) {
        parts.push(
          makeCollapsed(
            "dismissed",
            iconFor(PullRequestReviewStateExt.Dismissed),
            dismissed,
          ),
        );
      }
      const pending = filterFor(statuses, PullRequestReviewStateExt.Pending);
      if (pending.length > 0) {
        parts.push(
          makeCollapsed(
            "pending",
            iconFor(PullRequestReviewStateExt.Pending),
            pending,
          ),
        );
      }
      const unknown = filterFor(statuses, PullRequestReviewStateExt.Unknown);
      if (unknown.length > 0) {
        parts.push(
          makeCollapsed(
            "unknown",
            iconFor(PullRequestReviewStateExt.Unknown),
            unknown,
          ),
        );
      }

      const reviewers = parts.length > 0 ? parts.join("<br/>") : "-";

      return [
        { data: ownerName },
        { data: iconFor(teamState) },
        { data: reviewers },
      ];
    });

    core.summary
      .addHeading(
        `${overallIcon} - <code>${escapeHtml(entry.rawPattern)}</code>`,
        3,
      )
      .addTable(metaRows)
      .addTable([headerRow, ...rows])
      .addBreak();
  }

  await core.summary.addSeparator().write();
}
