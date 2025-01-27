import * as core from "@actions/core";
import { readFileSync } from "fs";

import { VALIDATOR_IGNORE_LINE } from "./strings.js";
import { InvokeContext, RunInputs } from "./run.js";
import { Octokit, getComparison, GithubFiles } from "./github.js";
import { getAllWorkflowAndActionFiles } from "./utils.js";

export interface ParsedFile {
  filename: string;
  lines: FileLine[];
}

export interface FileLine {
  lineNumber: number;
  content: string;
  operation: "add" | "unchanged";
  ignored: boolean;
}

export type ParsedFiles = ParsedFile[];

// Exported for testing only
export async function getParsedFilesForValidation(
  context: InvokeContext,
  inputs: RunInputs,
  octokit: Octokit,
): Promise<ParsedFiles> {
  const diff = await getPRChanges(context, inputs, octokit);
  const existing = await getExistingFiles(inputs);

  const combined = combineParsedFiles(existing, diff);
  return combined;
}

export async function getPRChanges(
  context: InvokeContext,
  inputs: RunInputs,
  octokit: Octokit,
): Promise<ParsedFiles> {
  if (!!context.prNumber || !context.base || !context.head) {
    core.warning(
      `Missing one of base or head commit SHA. Base: ${context.base}, Head: ${context.head}`,
    );
    return [];
  }

  core.debug(`Getting diff workflow/actions files for PR: ${context.prNumber}`);
  const allFiles = await getComparison(
    octokit,
    context.owner,
    context.repo,
    context.base,
    context.head,
  );
  const ghaWorkflowFiles = filterForRelevantChanges(
    allFiles,
    inputs.validateAllActionDefinitions,
  );

  return parseGithubDiff(ghaWorkflowFiles);
}

export async function getExistingFiles(inputs: RunInputs): Promise<ParsedFiles> {

  core.debug("Getting all workflow/action files in the repository.");
  const filePaths = await getAllWorkflowAndActionFiles(
    inputs.rootDir,
    inputs.validateAllActionDefinitions,
  );

  return await parseFiles(filePaths);
}

/**
 * Filters out files that are not GitHub workflows or actions.
 * @param files The files to filter
 * @param includeAllActionDefinitions Whether to include all action definitions or just those in the .github directory
 * @returns The filtered files
 */
export function filterForRelevantChanges(
  files: GithubFiles,
  includeAllActionDefinitions: boolean,
): GithubFiles {
  return files?.filter(({ filename }) => {
    return (
      (includeAllActionDefinitions &&
        (filename.endsWith("/action.yml") ||
          filename.endsWith("/action.yaml"))) ||
      isGithubWorkflowOrActionFile(filename)
    );
  });
}

/**
 * Checks if a file path is a GitHub workflow or action file in the .github directory.
 * @param {string} filename The file path to check
 * @returns {boolean} True if the file is a GitHub workflow or action file
 */
function isGithubWorkflowOrActionFile(filename: string): boolean {
  return (
    (filename.startsWith(".github/workflows") ||
      filename.startsWith(".github/actions")) &&
    (filename.endsWith(".yml") || filename.endsWith(".yaml"))
  );
}

// Exported for testing only
export function combineParsedFiles(
  existing: ParsedFiles,
  diff: ParsedFiles,
): ParsedFiles {
  const combined: ParsedFiles = [];

  for (const existingFile of existing) {
    const diffFile = diff.find((f) => f.filename === existingFile.filename);

    if (!diffFile) {
      combined.push(existingFile);
      continue;
    }

    const combinedFileLines = combineFileLines(existingFile.lines, diffFile.lines);

    combined.push({
      filename: existingFile.filename,
      lines: combinedFileLines,
    });
  }

  return combined;
}

function combineFileLines(
  existing: FileLine[],
  diff: FileLine[],
): FileLine[] {
  const combined: FileLine[] = [];

  for (const existingLine of existing) {
    const diffLine = diff.find((l) => l.lineNumber === existingLine.lineNumber);

    if (diffLine) {
      combined.push(diffLine);
      continue;
    }

    combined.push(existingLine);

  }

  return combined;
}


/**
 * Parses the diff files from a GitHub PR diff.
 * @param {GithubFiles} githubFiles The GithubFiles types from the GitHub commit comparison API
 * @returns {ParsedFile[]} Array of ParsedFile representing the files and their changes
 */
export function parseGithubDiff(githubFiles: GithubFiles): ParsedFile[] {
  if (!githubFiles) return [];

  return githubFiles?.map((entry) => {
    const { filename, patch } = entry;
    const lineChanges = patch ? parsePatchChanges(patch) : [];
    return { filename, lines: lineChanges };
  });
}

/**
 * Parses the patch changes from a Git diff file entry.
 * @param {string} patch The diff/patch string for a single file
 * @returns Array of FileLines representing the additions and unchanged lines in the patch does not include deletions
 */
function parsePatchChanges(patch: string): FileLine[] {
  const lineChanges = patch?.split("\n") || [];

  const additions: FileLine[] = [];

  let currentLineInFile = 0;
  for (const line of lineChanges) {
    if (line.startsWith("@@")) {
      // @@ denotes a git hunk header
      // https://mattscodecave.com/posts/howto-reading-git-diffs-and-staging-hunks.html
      // example line: @@ -16,10 +16,10 @@ jobs:
      //   - "-16,10": "-" denotes source file, "16,10" means the hunk starts at line 16 and output contains 10 lines
      //   - "+16,10": "+" denotes destination file, "16,10" means the same as above
      const [, , destination] = line.split(" ");

      if (!destination.startsWith("+")) {
        throw new Error("Invalid git hunk format");
      }

      const [destinationLine] = destination.substring(1).split(",");
      currentLineInFile = parseInt(destinationLine, 10);
      continue;
    }

    if (line.startsWith("-")) {
      // Do not track deletions
      continue;
    }

    const operation = line.startsWith("+") ? "add" : "unchanged";
    const currentLine = line.substring(1);

    // Only ignore the current line if it contains the ignore comment and it is unchanged.
    const ignored = currentLine.includes(VALIDATOR_IGNORE_LINE);
    additions.push({
      content: currentLine,
      lineNumber: currentLineInFile,
      operation,
      ignored,
    });

    currentLineInFile++;
  }

  return additions;
}


/**
 * Parses the files from the file system into a ParsedFile object.
 * @param paths The paths to the files to parse.
 * @returns Array of ParsedFile representing the files and their contents.
 */
export async function parseFiles(paths: string[]) {
  const parsedFiles: ParsedFile[] = [];

  for (const path of paths) {
    const content = readFileSync(path, "utf-8");
    const lines = content.split("\n").map((line, index) => {
      const ignored = line.includes(VALIDATOR_IGNORE_LINE);
      return {
        lineNumber: index + 1,
        content: line,
        operation: "unchanged",
        ignored,
      } as FileLine;
    });

    parsedFiles.push({ filename: path, lines });
  }

  return parsedFiles;
}
