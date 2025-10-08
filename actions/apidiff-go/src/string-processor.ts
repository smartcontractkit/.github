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
  diffs: ApiDiffResult[],
  summaryUrl: string,
  includeFullOutput = false,
): string {
  if (diffs.length === 0) {
    return `## 📊 API Diff Results\n\n> No modules to analyze\n\n[View full report](${summaryUrl})`;
  }

  const hasIncompat = diffs.some((d) => d.incompatible.length > 0);
  const totalIncompat = diffs.reduce((s, d) => s + d.incompatible.length, 0);
  const totalCompat = diffs.reduce((s, d) => s + d.compatible.length, 0);
  const modulesWithChanges = diffs.filter(
    (d) => d.incompatible.length || d.compatible.length,
  ).length;

  const statusEmoji = hasIncompat ? "⚠️" : "✅";
  const statusText = hasIncompat
    ? "Breaking changes detected"
    : "No breaking changes";

  const lines: string[] = [
    `## ${statusEmoji} API Diff Results - ${statusText}`,
    ``,
  ];

  function apidiffShield(label: string, count: number, color: string) {
    const escapedLabel = label.replace(/ /g, "_").replace(/-/g, "--");
    return `![${label}](https://img.shields.io/badge/${escapedLabel}-${count}-${color})`;
  }

  if (includeFullOutput) {
    const analyzedShield = apidiffShield(
      "modules analyzed",
      modulesWithChanges,
      "blue",
    );
    const breakingShield = apidiffShield(
      "breaking changes",
      totalIncompat,
      "red",
    );
    const compatibleShield = apidiffShield(
      "compatible changes",
      totalCompat,
      "green",
    );
    lines.push(
      ``,
      `${analyzedShield} ${breakingShield} ${compatibleShield}`,
      ``,
    );
  }

  function formatGroupedChanges(
    title: string,
    changes: Change[],
    isBreaking = false,
  ): string[] {
    if (!changes.length) return [];
    const out: string[] = [];
    const icon = isBreaking ? "🔴" : "🟢";
    out.push(`#### ${icon} ${title} (${changes.length})`, ``);

    const grouped = groupByPackage(changes);
    for (const packagePath of Array.from(grouped.keys()).sort()) {
      const packageChanges = grouped.get(packagePath)!;

      // Plain header instead of collapsible
      out.push(
        `##### \`${packagePath || "(root)"}\` (${packageChanges.length})`,
        ``,
      );

      for (const change of packageChanges) {
        const { elementName } = parseElement(change.element);
        const formatted = formatTypeChangeMarkdown(change.change);
        const isBlock = formatted.startsWith("\n<pre>");
        if (isBlock) {
          out.push(`- **\`${elementName}\`** — Type changed:`);
          out.push(formatted);
        } else {
          out.push(`- **\`${elementName}\`** — ${formatted}`);
        }
        out.push(``);
      }
    }
    return out;
  }

  const breaking = diffs.filter((d) => d.incompatible.length);
  const compatOnly = diffs.filter(
    (d) => !d.incompatible.length && d.compatible.length,
  );

  if (breaking.length) {
    if (includeFullOutput) {
      lines.push(`---`, ``, `## ⚠️ Modules with Breaking Changes`, ``);
    }

    for (const d of breaking) {
      lines.push(`### 📦 Module: \`${d.moduleName}\``, ``);
      lines.push(
        ...formatGroupedChanges("Breaking Changes", d.incompatible, true),
      );

      if (includeFullOutput && d.compatible.length) {
        lines.push(
          ...formatGroupedChanges("Compatible Changes", d.compatible, false),
        );
      }

      if (includeFullOutput && d.meta.length) {
        lines.push(`#### 📋 Metadata (${d.meta.length})`, ``);
        lines.push("```diff");
        for (const m of d.meta) {
          lines.push(`! ${m.header}`);
          lines.push(`  first:  ${m.first}`);
          lines.push(`  second: ${m.second}`);
          lines.push("");
        }
        lines.push("```", ``);
      }
    }
  }

  if (includeFullOutput && compatOnly.length) {
    lines.push(`---`, ``, `## ✅ Modules with Only Compatible Changes`, ``);
    for (const d of compatOnly) {
      lines.push(`### 📦 ${d.moduleName} (${d.compatible.length})`, ``);
      lines.push(
        ...formatGroupedChanges("Compatible Changes", d.compatible, false),
      );
    }
  }

  lines.push(`---`, ``, `📄 [View full apidiff report](${summaryUrl})`, ``);
  return lines.join("\n");
}

/* ---------------------- GitHub ACTIONS JOB SUMMARY (HTML+) --------------------- */

/**
 * Writes a Job Summary (Markdown + HTML allowed) using @actions/core.summary.
 */
export async function formatApidiffJobSummary(
  diffs: ApiDiffResult[],
): Promise<void> {
  const s = core.summary;

  if (!diffs.length) {
    s.addHeading("📊 API Diff Results", 2).addRaw(
      "<blockquote>No modules to analyze</blockquote>",
      true,
    );
    await s.write();
    return;
  }

  const hasIncompat = diffs.some((d) => d.incompatible.length > 0);
  const totalIncompat = diffs.reduce(
    (sum, d) => sum + d.incompatible.length,
    0,
  );
  const totalCompat = diffs.reduce((sum, d) => sum + d.compatible.length, 0);
  const modulesWithChanges = diffs.filter(
    (d) => d.incompatible.length || d.compatible.length,
  ).length;

  const statusEmoji = hasIncompat ? "⚠️" : "✅";
  const statusText = hasIncompat
    ? "Breaking changes detected"
    : "No breaking changes";

  s.addHeading(`${statusEmoji} API Diff Results – ${statusText}`, 2);

  // Top summary table
  s.addTable([
    [
      { data: "Metric", header: true },
      { data: "Count", header: true },
    ],
    [
      { data: "Modules analyzed" },
      { data: `<div align="right">${modulesWithChanges}</div>` },
    ],
    [
      { data: "Breaking changes" },
      { data: `<div align="right">${totalIncompat}</div>` },
    ],
    [
      { data: "Compatible changes" },
      { data: `<div align="right">${totalCompat}</div>` },
    ],
  ]);

  const breaking = diffs.filter((d) => d.incompatible.length);
  const compatOnly = diffs.filter(
    (d) => !d.incompatible.length && d.compatible.length,
  );

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
            `<li><strong><code>${elementName}</code></strong> — Type changed:${formatted}</li>`,
            true,
          );
        } else {
          s.addRaw(
            `<li><strong><code>${elementName}</code></strong> — ${formatted}</li>`,
            true,
          );
        }
      }

      s.addRaw("</ul></details>", true);
    }
  };

  // Breaking section
  if (breaking.length) {
    s.addSeparator();
    s.addHeading("⚠️ Modules with Breaking Changes", 2);
    for (const d of breaking) {
      s.addHeading(`📦 ${d.moduleName}`, 3);
      renderGrouped("Breaking Changes", d.incompatible, true);

      if (d.compatible.length) {
        renderGrouped("Compatible Changes", d.compatible, false);
      }

      if (d.meta.length) {
        s.addHeading(`📋 Metadata (${d.meta.length})`, 4);
        s.addTable([
          [
            { data: "Header", header: true },
            { data: "First", header: true },
            { data: "Second", header: true },
          ],
          ...d.meta.map((m) => [
            { data: `<code>${escapeHtml(m.header)}</code>` },
            { data: escapeHtml(m.first) },
            { data: escapeHtml(m.second) },
          ]),
        ]);
      }
    }
  }

  // Compatible-only section
  if (compatOnly.length) {
    s.addSeparator();
    s.addHeading("✅ Modules with Only Compatible Changes", 2);
    for (const d of compatOnly) {
      s.addHeading(`📦 ${d.moduleName} (${d.compatible.length})`, 3);
      renderGrouped("Compatible Changes", d.compatible, false);
    }
  }

  await s.write();
}
