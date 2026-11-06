import * as core from "@actions/core";
import {
  NoOperationTraceWriter,
  parseWorkflow,
} from "@actions/workflow-parser";
import {
  convertActionTemplate,
  parseAction,
} from "@actions/workflow-parser/actions/index";
import {
  convertWorkflowTemplate,
  ErrorPolicy,
} from "@actions/workflow-parser/model/convert";
import {
  isMapping,
  isSequence,
} from "@actions/workflow-parser/templates/tokens/type-guards";
import type { TemplateToken } from "@actions/workflow-parser/templates/tokens/template-token";
import type { TokenRange } from "@actions/workflow-parser/templates/tokens/token-range";

import type { ParsedFile } from "./parse-files.js";

export type UseKind = "action" | "docker" | "local" | "reusable-workflow";

export interface UseReference {
  filename: string;
  /** The `uses` value with YAML quotes removed. */
  value: string;
  kind: UseKind;
  /** 1-based line where the value starts. */
  line: number;
  /** 1-based line where the value ends. Greater than `line` for multiline scalars. */
  endLine: number;
  /** 1-based column where the value starts. */
  column: number;
  /** Trailing YAML comment after the value, without the leading `#`. */
  comment?: string;
}

/** A list means the file parsed. "fallback" means use the line scanner. */
export type UseReferenceLookup = UseReference[] | "fallback";

export interface UseReferenceIndex {
  get(filename: string, lineNumber: number): UseReferenceLookup;
}

interface StringTokenLike {
  value: string;
  line?: number;
  col?: number;
  range?: TokenRange;
}

/**
 * Extracts every `uses` value from a workflow or composite action file using
 * GitHub's workflow parser. Returns undefined when the file could not be
 * parsed, so the caller can fall back to the line scanner.
 */
export async function extractUseReferences(
  filename: string,
  content: string,
): Promise<UseReference[] | undefined> {
  try {
    return isActionFile(filename)
      ? extractActionReferences(filename, content)
      : await extractWorkflowReferences(filename, content);
  } catch (error) {
    core.debug(
      `Unable to parse ${filename} with @actions/workflow-parser: ${describeError(error)}`,
    );
    return undefined;
  }
}

/**
 * Parses every candidate file once and indexes references by line.
 */
export async function buildUseReferenceIndex(
  files: ParsedFile[],
): Promise<UseReferenceIndex> {
  const byFile = new Map<string, Map<number, UseReference[]> | "fallback">();

  for (const file of files) {
    if (file.content === undefined) {
      core.debug(`No content available for ${file.filename}; using fallback`);
      byFile.set(file.filename, "fallback");
      continue;
    }

    const references = await extractUseReferences(file.filename, file.content);
    if (references === undefined) {
      byFile.set(file.filename, "fallback");
      continue;
    }

    const byLine = new Map<number, UseReference[]>();
    for (const reference of references) {
      // A multiline scalar is reachable from every line it spans.
      for (let line = reference.line; line <= reference.endLine; line++) {
        const lineReferences = byLine.get(line) ?? [];
        lineReferences.push(reference);
        byLine.set(line, lineReferences);
      }
    }
    byFile.set(file.filename, byLine);
  }

  return {
    get(filename, lineNumber) {
      const entry = byFile.get(filename);
      if (entry === undefined || entry === "fallback") {
        return "fallback";
      }
      return entry.get(lineNumber) ?? [];
    },
  };
}

export function classifyUse(value: string): UseKind {
  const trimmed = value.trim();
  if (trimmed.startsWith("docker://")) return "docker";
  if (
    trimmed.startsWith("./") ||
    trimmed.startsWith(".\\") ||
    trimmed.startsWith("$/")
  ) {
    return "local";
  }
  return "action";
}

function isActionFile(filename: string): boolean {
  const normalized = filename.replace(/\\/g, "/");
  // A workflow may legitimately be named action.yml.
  if (normalized.includes(".github/workflows/")) return false;
  return (
    normalized === "action.yml" ||
    normalized === "action.yaml" ||
    normalized.endsWith("/action.yml") ||
    normalized.endsWith("/action.yaml")
  );
}

async function extractWorkflowReferences(
  filename: string,
  content: string,
): Promise<UseReference[] | undefined> {
  const result = parseWorkflow(
    { name: filename, content },
    new NoOperationTraceWriter(),
  );
  if (!result.value) {
    return undefined;
  }

  const template = await convertWorkflowTemplate(
    result.context,
    result.value,
    undefined,
    { errorPolicy: ErrorPolicy.TryConversion },
  );

  const jobs = template.jobs ?? [];
  const raw = countRawJobsAndSteps(result.value);
  const converted = {
    jobs: jobs.length,
    steps: jobs.reduce(
      (total, job) =>
        total + (job.type === "reusableWorkflowJob" ? 0 : job.steps.length),
      0,
    ),
  };
  if (raw.jobs !== converted.jobs || raw.steps !== converted.steps) {
    // The converter drops invalid jobs and steps without throwing.
    core.debug(
      `Converted ${converted.jobs} jobs/${converted.steps} steps but found ${raw.jobs}/${raw.steps} in ${filename}; using fallback`,
    );
    return undefined;
  }

  const lines = content.split(/\r?\n/);
  const references: UseReference[] = [];
  for (const job of jobs) {
    if (job.type === "reusableWorkflowJob") {
      references.push(
        toUseReference(filename, job.ref, "reusable-workflow", lines),
      );
      continue;
    }

    for (const step of job.steps ?? []) {
      if (!("uses" in step)) continue;
      references.push(
        toUseReference(
          filename,
          step.uses,
          classifyUse(step.uses.value),
          lines,
        ),
      );
    }
  }

  if (hasAliasedReferences(references, lines)) {
    core.debug(
      `${filename} reuses a \`uses\` value through a YAML alias; using fallback`,
    );
    return undefined;
  }

  return references;
}

function countRawJobsAndSteps(root: TemplateToken): {
  jobs: number;
  steps: number;
} {
  const counts = { jobs: 0, steps: 0 };
  if (!isMapping(root)) return counts;

  const jobs = root.find("jobs");
  if (!jobs || !isMapping(jobs)) return counts;

  for (const { value: job } of jobs) {
    counts.jobs++;
    if (!isMapping(job)) continue;
    const steps = job.find("steps");
    if (steps && isSequence(steps)) counts.steps += steps.count;
  }
  return counts;
}

/**
 * The parser reports an aliased value at its anchor, not at the alias. Such a
 * reference would be indexed on the wrong line, so detect it: either two
 * references share a position, or the position is not a `uses` key's value.
 */
function hasAliasedReferences(
  references: UseReference[],
  lines: string[],
): boolean {
  const seen = new Set<string>();
  for (const reference of references) {
    const position = `${reference.line}:${reference.column}`;
    if (seen.has(position)) return true;
    seen.add(position);

    const prefix = (lines[reference.line - 1] ?? "").slice(
      0,
      reference.column - 1,
    );
    if (!/\buses\s*:\s*(?:[&!]\S+\s+)*["']?$/.test(prefix)) return true;
  }
  return false;
}

function extractActionReferences(
  filename: string,
  content: string,
): UseReference[] | undefined {
  const result = parseAction(
    { name: filename, content },
    new NoOperationTraceWriter(),
  );
  if (!result.value) {
    return undefined;
  }

  const template = convertActionTemplate(result.context, result.value, {
    errorPolicy: ErrorPolicy.TryConversion,
  });
  if (template.runs.using !== "composite") {
    return [];
  }

  const lines = content.split(/\r?\n/);
  const references = template.runs.steps.flatMap((step) =>
    "uses" in step
      ? [
          toUseReference(
            filename,
            step.uses,
            classifyUse(step.uses.value),
            lines,
          ),
        ]
      : [],
  );

  if (hasAliasedReferences(references, lines)) {
    core.debug(
      `${filename} reuses a \`uses\` value through a YAML alias; using fallback`,
    );
    return undefined;
  }

  return references;
}

function toUseReference(
  filename: string,
  token: StringTokenLike,
  kind: UseKind,
  lines: string[],
): UseReference {
  return {
    filename,
    value: token.value,
    kind,
    line: token.range?.start.line ?? token.line ?? 1,
    endLine:
      token.range?.end.line ?? token.range?.start.line ?? token.line ?? 1,
    column: token.range?.start.column ?? token.col ?? 1,
    comment: extractComment(lines, token.range),
  };
}

function extractComment(
  lines: string[],
  range: TokenRange | undefined,
): string | undefined {
  if (!range) return undefined;

  const line = lines[range.end.line - 1];
  if (line === undefined) return undefined;

  // Flow-style values can be followed by closing delimiters before the comment.
  const trailing = line
    .slice(range.end.column - 1)
    .replace(/^[\s}\],]+/, "")
    .trim();
  if (!trailing.startsWith("#")) return undefined;
  return trailing.slice(1).trim();
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
