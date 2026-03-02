/**
 * This logic is best maintained by an LLM. It is a bunch
 * of tedious string manipulation and formatting.
 */
import * as core from "@actions/core";

import { renderFuncDiffCompactPre } from "./render-diff";
import type { ApiDiffResult, Change } from "./apidiff";

/* ------------------------------ Shared helpers ----------------------------- */

function parseElement(element: string): {
  packagePath: string;
  elementName: string;
} {
  let path = element.startsWith("./") ? element.slice(2) : element;
  const i = path.lastIndexOf(".");
  if (i === -1) return { packagePath: "", elementName: path };
  return { packagePath: path.slice(0, i), elementName: path.slice(i + 1) };
}

function groupByPackage(changes: Change[]): Map<string, Change[]> {
  const m = new Map<string, Change[]>();
  for (const c of changes) {
    const { packagePath } = parseElement(c.element);
    if (!m.has(packagePath)) m.set(packagePath, []);
    m.get(packagePath)!.push(c);
  }
  for (const list of m.values())
    list.sort((a, b) => a.element.localeCompare(b.element));
  return m;
}

function formatTypeChangeMarkdown(change: string): string {
  const m = change.match(/^changed from (.+?) to (.+)$/);
  if (m) {
    const [, oldType, newType] = m;

    return "\n" + renderFuncDiffCompactPre(oldType, newType); // stays <pre>/<ins>/<del>
  }
  if (change.startsWith("removed")) return "🗑️ Removed";
  if (change.startsWith("added")) return "➕ Added";
  return change.charAt(0).toUpperCase() + change.slice(1);
}

function formatTypeChangeJobSummary(change: string): string {
  // Same diff rendering works for Job Summary (HTML is allowed there).
  return formatTypeChangeMarkdown(change);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* -------------------------- GitHub COMMENT (Markdown) -------------------------- */

export function formatApidiffMarkdown(
  diff: ApiDiffResult,
  summaryUrl: string,
  includeFullOutput = false,
): string {
  const hasIncompat = diff.incompatible.length > 0;
  const hasCompat = diff.compatible.length > 0;
  const hasMeta = diff.meta.length > 0;

  if (!hasMeta && !hasIncompat && !hasCompat) {
    return `## 📊 API Diff Results\n\n> No changes detected for module \`${diff.moduleName}\`\n\n[View full report](${summaryUrl})`;
  }

  const statusEmoji = hasIncompat ? "⚠️" : "✅";

  const lines: string[] = [
    `## ${statusEmoji} API Diff Results - \`${diff.moduleName}\``,
    ``,
  ];

  function formatGroupedChanges(title: string, changes: Change[]): string[] {
    if (!changes.length) return [];
    const out: string[] = [];
    out.push(`#### ${title} (${changes.length})`, "");

    const grouped = groupByPackage(changes);
    for (const packagePath of Array.from(grouped.keys()).sort()) {
      const packageChanges = grouped.get(packagePath)!;

      out.push(
        `##### \`${packagePath || "`./`"}\` (${packageChanges.length})`,
        "",
      );

      for (const change of packageChanges) {
        const { elementName } = parseElement(change.element);
        const formatted = formatTypeChangeMarkdown(change.change);
        const isBlock = formatted.startsWith("\n<pre>");
        if (isBlock) {
          out.push(`- \`${elementName}\` — Type changed:`);
          out.push(formatted);
        } else {
          out.push(`- \`${elementName}\` — ${formatted}`);
        }
        out.push("");
      }
    }
    return out;
  }

  //
  // BREAKING CHANGES
  //
  if (diff.incompatible.length) {
    lines.push(
      ...formatGroupedChanges("⚠️ Breaking Changes", diff.incompatible),
    );
  }

  //
  // COMPATIBLE CHANGES
  //
  if (includeFullOutput && diff.compatible.length) {
    lines.push(
      ...formatGroupedChanges("✅ Compatible Changes", diff.compatible),
    );
  }

  //
  // META CHANGES
  //
  if (includeFullOutput && diff.meta.length) {
    lines.push(`---`, "", `## 📋 Metadata (${diff.meta.length})`, "");
    lines.push("<details>", "", "<summary>View metadata changes</summary>", "");
    lines.push("```diff");
    for (const m of diff.meta) {
      lines.push(`! ${m.header}`);
      lines.push(`  first:  ${m.first}`);
      lines.push(`  second: ${m.second}`);
      lines.push("");
    }
    lines.push("```", "");
    lines.push("</details>", "");
  }

  lines.push(`---`, "", `📄 [View full apidiff report](${summaryUrl})`, "");

  return lines.join("\n");
}

/* ---------------------- GitHub ACTIONS JOB SUMMARY (HTML+) --------------------- */

/**
 * Writes a Job Summary (Markdown + HTML allowed) using @actions/core.summary
 * for a single ApiDiffResult.
 */
export async function formatApidiffJobSummary(
  diff: ApiDiffResult,
  baseRef: string,
  headRef: string,
): Promise<void> {
  const s = core.summary;

  const hasIncompat = diff.incompatible.length > 0;
  const hasCompat = diff.compatible.length > 0;
  const hasMeta = diff.meta.length > 0;

  if (!hasIncompat && !hasCompat && !hasMeta) {
    s.addHeading(`📊 API Diff Results – ${diff.moduleName}`, 2).addRaw(
      "<blockquote>No changes detected for this module</blockquote>",
      true,
    );
    s.addTable([
      [
        { data: "Ref", header: true },
        { data: "Value", header: true },
      ],
      [{ data: "Base" }, { data: `<code>${escapeHtml(baseRef)}</code>` }],
      [{ data: "Head" }, { data: `<code>${escapeHtml(headRef)}</code>` }],
    ]);
    await s.write();
    return;
  }

  const statusEmoji = hasIncompat ? "⚠️" : "✅";
  s.addHeading(`${statusEmoji} API Diff Results – ${diff.moduleName}`, 2);

  s.addTable([
    [
      { data: "Ref", header: true },
      { data: "Value", header: true },
    ],
    [{ data: "Base" }, { data: `<code>${escapeHtml(baseRef)}</code>` }],
    [{ data: "Head" }, { data: `<code>${escapeHtml(headRef)}</code>` }],
  ]);

  // Top summary table for this module
  function simpleTableRow(title: string, content: number): { data: string }[] {
    return [{ data: title }, { data: `<div align="right">${content}</div>` }];
  }
  s.addTable([
    [
      { data: "Metric", header: true },
      { data: "Count", header: true },
    ],
    simpleTableRow("Breaking changes", diff.incompatible.length),
    simpleTableRow("Compatible changes", diff.compatible.length),
    simpleTableRow("Metadata entries", diff.meta.length),
  ]);

  const renderGrouped = (
    title: string,
    changes: Change[],
    isBreaking = false,
  ) => {
    if (!changes.length) return;
    const icon = isBreaking ? "🔴" : "🟢";
    s.addHeading(`${icon} ${title} (${changes.length})`, 3);

    const grouped = groupByPackage(changes);
    for (const packagePath of Array.from(grouped.keys()).sort()) {
      const pkg = packagePath || "(root)";
      const list = grouped.get(packagePath)!;

      s.addHeading(`📦 ${pkg} (${list.length})`, 4);
      s.addRaw("<ul>", true);

      for (const change of list) {
        const { elementName } = parseElement(change.element);
        const formatted = formatTypeChangeJobSummary(change.change);
        const isBlock = formatted.startsWith("\n<pre>");
        if (isBlock) {
          s.addRaw(
            `<li><code>${elementName}</code> — Type changed:${formatted}</li>`,
            true,
          );
        } else {
          s.addRaw(`<li><code>${elementName}</code> — ${formatted}</li>`, true);
        }
      }

      s.addRaw("</ul>", true);
    }
  };

  // Breaking section
  if (diff.incompatible.length) {
    s.addSeparator();
    s.addHeading("⚠️ Breaking Changes", 2);
    renderGrouped("Breaking Changes", diff.incompatible, true);
  }

  // Compatible section
  if (diff.compatible.length) {
    s.addSeparator();
    s.addHeading("✅ Compatible Changes", 2);
    renderGrouped("Compatible Changes", diff.compatible, false);
  }

  // Metadata section
  if (diff.meta.length) {
    s.addSeparator();
    s.addHeading(`📋 Metadata (${diff.meta.length})`, 2);
    s.addTable([
      [
        { data: "Header", header: true },
        { data: "First", header: true },
        { data: "Second", header: true },
      ],
      ...diff.meta.map((m) => [
        { data: `<code>${escapeHtml(m.header)}</code>` },
        { data: escapeHtml(m.first) },
        { data: escapeHtml(m.second) },
      ]),
    ]);
  }

  await s.write();
}
