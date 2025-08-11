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
  /** “!” messages */
  meta: MetaDiff[];
  /** Under “Incompatible changes:” */
  incompatible: Change[];
  /** Under “Compatible changes:” */
  compatible: Change[];
}

export function parseApidiffOutput(output: string): ApiDiffResult {
  const lines = output.split(/\r?\n/);
  const result: ApiDiffResult = { meta: [], incompatible: [], compatible: [] };

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
  diff: ApiDiffResult,
  summaryUrl: string,
  includeFullOutput: boolean = false,
): string {
  const header =
    diff.incompatible.length > 0
      ? "backwards-incompatible changes detected ❌"
      : "no incompatible changes detected ✅";

  const lines: string[] = [
    `## [apidiff](${summaryUrl}) results - ${header}`,
    ``,
  ];

  // Helper to group by prefix (e.g. "./grafana")
  function groupByPrefix(changes: Change[]): Map<string, Change[]> {
    const map = new Map<string, Change[]>();
    for (const c of changes) {
      let prefix = "";
      if (c.element.startsWith("package ")) {
        prefix = "package";
      } else {
        const idx = c.element.indexOf(".", 1);
        prefix = idx > 0 ? c.element.substring(0, idx) : c.element;
      }
      if (!map.has(prefix)) {
        map.set(prefix, []);
      }
      map.get(prefix)!.push(c);
    }
    return map;
  }

  // New helper to wrap types in backticks when we see "changed from ... to ..."
  function formatChange(change: string): string {
    const re = /^changed from (.+?) to (.+)$/;
    const match = change.match(re);
    if (match) {
      const [, oldType, newType] = match;
      return `changed from \`${oldType}\` to \`${newType}\``;
    }
    return change;
  }

  function createTable(prefix: string, elements: Change[]): string[] {
    const rows = elements.map(({ element, change }) => {
      const formatted = formatChange(change);
      return `| \`${element}\` | ${formatted} |`;
    });
    return [
      `#### ${prefix} (${elements.length})`,
      ``,
      `| Element | Change |`,
      `| ------- | ------ |`,
      ...rows,
    ];
  }

  // Incompatible
  if (diff.incompatible.length > 0) {
    lines.push(`### Incompatible Changes (${diff.incompatible.length})`);
    lines.push(``);
    const groups = groupByPrefix(diff.incompatible);
    for (const [prefix, items] of Array.from(groups.entries()).sort()) {
      lines.push(...createTable(prefix, items));
      lines.push(``);
    }
  }

  if (summaryUrl) {
    lines.push(`*(Full summary: [${summaryUrl}](${summaryUrl}))*`);
    lines.push(``);
  }

  // Compatible
  if (diff.compatible.length > 0 && includeFullOutput) {
    lines.push(`### Compatible Changes (${diff.compatible.length})`);
    lines.push(``);
    const groups = groupByPrefix(diff.compatible);
    for (const [prefix, items] of Array.from(groups.entries()).sort()) {
      lines.push(...createTable(prefix, items));
      lines.push(``);
    }
  }

  // Collapsible meta section
  if (diff.meta.length > 0 && includeFullOutput) {
    lines.push(`<details>`);
    lines.push(`<summary>Meta diff messages</summary>`);
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

  return lines.join("\n");
}
