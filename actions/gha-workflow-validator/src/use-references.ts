import * as core from "@actions/core";
import {
  NoOperationTraceWriter,
  parseWorkflow,
} from "@actions/workflow-parser";
import {
  convertWorkflowTemplate,
  ErrorPolicy,
} from "@actions/workflow-parser/model/convert";
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
  if (isActionFile(filename)) {
    // Composite action files stay on the line scanner until the next layer.
    return undefined;
  }

  try {
    return await extractWorkflowReferences(filename, content);
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
      const lineReferences = byLine.get(reference.line) ?? [];
      lineReferences.push(reference);
      byLine.set(reference.line, lineReferences);
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

  const references: UseReference[] = [];
  for (const job of template.jobs ?? []) {
    if (job.type === "reusableWorkflowJob") {
      references.push(
        toUseReference(filename, job.ref, "reusable-workflow", content),
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
          content,
        ),
      );
    }
  }

  return references;
}

function toUseReference(
  filename: string,
  token: StringTokenLike,
  kind: UseKind,
  content: string,
): UseReference {
  return {
    filename,
    value: token.value,
    kind,
    line: token.range?.start.line ?? token.line ?? 1,
    column: token.range?.start.column ?? token.col ?? 1,
    comment: extractComment(content, token.range),
  };
}

function extractComment(
  content: string,
  range: TokenRange | undefined,
): string | undefined {
  if (!range) return undefined;

  const line = content.split("\n")[range.end.line - 1];
  if (line === undefined) return undefined;

  const trailing = line.slice(range.end.column - 1).trim();
  if (!trailing.startsWith("#")) return undefined;
  return trailing.slice(1).trim();
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
