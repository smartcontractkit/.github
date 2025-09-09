const apidiffUrl = "https://pkg.go.dev/golang.org/x/exp/cmd/apidiff";

interface MetaDiff {
  /** The full header line (without the leading "! ") */
  header: string;
  /** The “first:” message */
  first: string;
  /** The “second:” message */
  second: string;
}

interface Change {
  /** The fully-qualified API element path (e.g. "./grafana.GaugePanelOptions.Decimals") */
  element: string;
  /** The rest of the text after “: ” (e.g. “changed from float64 to *float64”) */
  change: string;
}

interface ApiDiffResult {
  moduleName: string;
  /** “!” messages */
  meta: MetaDiff[];
  /** Under “Incompatible changes:” */
  incompatible: Change[];
  /** Under “Compatible changes:” */
  compatible: Change[];
}
export function parseApidiffOutputs(
  output: Record<string, string>,
): ApiDiffResult[] {
  const results: ApiDiffResult[] = [];

  for (const [moduleName, moduleOutput] of Object.entries(output)) {
    const parsed = parseApidiffOutput(moduleName, moduleOutput);
    results.push(parsed);
  }

  return results;
}

function parseApidiffOutput(moduleName: string, output: string): ApiDiffResult {
  const lines = output.split(/\r?\n/);
  const result: ApiDiffResult = {
    moduleName,
    meta: [],
    incompatible: [],
    compatible: [],
  };

  let section: "meta" | "incompatible" | "compatible" | null = null;
  let currentMeta: MetaDiff | null = null;

  for (const raw of lines) {
    const line = raw.trim();

    // start of a meta-message block
    if (line.startsWith("! ")) {
      // if we were building one, flush previous
      if (currentMeta) result.meta.push(currentMeta);
      currentMeta = {
        header: line.slice(2),
        first: "",
        second: "",
      };
      section = "meta";
      continue;
    }

    // inside a meta block, pick up first/second lines
    if (section === "meta" && currentMeta) {
      if (line.startsWith("first:")) {
        currentMeta.first = line.slice("first:".length).trim();
        continue;
      }
      if (line.startsWith("second:")) {
        currentMeta.second = line.slice("second:".length).trim();
        continue;
      }
    }

    // transition to incompatible bucket
    if (line === "Incompatible changes:") {
      if (currentMeta) {
        result.meta.push(currentMeta);
        currentMeta = null;
      }
      section = "incompatible";
      continue;
    }

    // transition to compatible bucket
    if (line === "Compatible changes:") {
      section = "compatible";
      continue;
    }

    // parse a “- ” entry in either changes section
    if (
      (section === "incompatible" || section === "compatible") &&
      line.startsWith("- ")
    ) {
      // split on first ": "
      const content = line.slice(2);
      const sepIdx = content.indexOf(": ");
      if (sepIdx >= 0) {
        const element = content.slice(0, sepIdx);
        const change = content.slice(sepIdx + 2);
        const target =
          section === "incompatible" ? result.incompatible : result.compatible;
        target.push({ element, change });
      }
    }
  }
  // flush any trailing meta
  if (currentMeta) result.meta.push(currentMeta);

  return result;
}

export function formatApidiffMarkdown(
  diffs: ApiDiffResult[],
  summaryUrl: string,
  includeFullOutput: boolean = false,
): string {
  if (diffs.length === 0) {
    return `## [apidiff](${summaryUrl}) results - no modules to analyze`;
  }

  // Check if any module has incompatible changes
  const hasIncompatibleChanges = diffs.some(
    (diff) => diff.incompatible.length > 0,
  );
  const totalIncompatible = diffs.reduce(
    (sum, diff) => sum + diff.incompatible.length,
    0,
  );
  const totalCompatible = diffs.reduce(
    (sum, diff) => sum + diff.compatible.length,
    0,
  );

  const header = hasIncompatibleChanges
    ? `backwards-incompatible changes detected ❌`
    : `no incompatible changes detected ✅`;

  const lines: string[] = [
    `## [apidiff](${summaryUrl}) results - ${header}`,
    ``,
  ];

  // Helper to wrap types in backticks when we see "changed from ... to ..."
  function formatChange(change: string): string {
    const re = /^changed from (.+?) to (.+)$/;
    const match = change.match(re);
    if (match) {
      const [, oldType, newType] = match;
      return `changed from \`${oldType}\` to \`${newType}\``;
    }
    return change;
  }

  function createTable(title: string, elements: Change[]): string[] {
    // Sort elements alphabetically by element name and deduplicate
    const uniqueElements = Array.from(
      new Map(
        elements.map((item) => [`${item.element}:${item.change}`, item]),
      ).values(),
    );
    const sortedElements = uniqueElements.sort((a, b) =>
      a.element.localeCompare(b.element),
    );

    const rows = sortedElements.map(({ element, change }) => {
      const formatted = formatChange(change);
      return `| \`${element}\` | ${formatted} |`;
    });
    return [
      `#### ${title} (${sortedElements.length})`,
      ``,
      `| Element | Change |`,
      `| ------- | ------ |`,
      ...rows,
    ];
  }

  // Process each module
  for (const diff of diffs) {
    if (
      diff.incompatible.length === 0 &&
      diff.compatible.length === 0 &&
      diff.meta.length === 0
    ) {
      // Skip modules with no changes
      continue;
    }

    lines.push(`### Module: \`${diff.moduleName}\``);
    lines.push(``);

    // Module-specific status
    const moduleStatus =
      diff.incompatible.length > 0
        ? `❌ ${diff.incompatible.length} incompatible, ${diff.compatible.length} compatible`
        : `✅ ${diff.compatible.length} compatible changes`;
    lines.push(`**Status:** ${moduleStatus}`);
    lines.push(``);

    // Incompatible changes for this module
    if (diff.incompatible.length > 0) {
      lines.push(...createTable("Incompatible Changes", diff.incompatible));
      lines.push(``);
    }

    // Compatible changes for this module (if includeFullOutput)
    if (diff.compatible.length > 0 && includeFullOutput) {
      lines.push(...createTable("Compatible Changes", diff.compatible));
      lines.push(``);
    }

    // Meta section for this module (if includeFullOutput)
    if (diff.meta.length > 0 && includeFullOutput) {
      lines.push(`<details>`);
      lines.push(
        `<summary>Meta diff messages for ${diff.moduleName}</summary>`,
      );
      lines.push(``);
      lines.push("```text");
      for (const m of diff.meta) {
        lines.push(`! ${m.header}`);
        lines.push(`  first: ${m.first}`);
        lines.push(`  second: ${m.second}`);
        lines.push(``);
      }
      if (lines[lines.length - 1] === "") {
        lines.pop();
      }
      lines.push("```");
      lines.push(`</details>`);
      lines.push(``);
    }

    lines.push(`---`);
    lines.push(``);
  }

  // Remove trailing separator
  if (lines[lines.length - 2] === "---") {
    lines.splice(-2, 2);
  }

  if (summaryUrl) {
    lines.push(`*(Full summary: [${summaryUrl}](${summaryUrl}))*`);
    lines.push(``);
  }

  return lines.join("\n");
}
