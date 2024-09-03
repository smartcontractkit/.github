import * as core from "@actions/core";
import * as glob from "@actions/glob";
import { sep } from "path";
import { readFileSync } from "fs";
import { GithubFiles } from "./github.js";
import {
  FileValidationResult,
  LineValidationResult,
  ValidationType,
} from "./validations/validation-check.js";
import { VALIDATOR_IGNORE_LINE, FIXING_ERRORS, htmlLink } from "./strings.js";

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

/**
 * Gets all workflow and action files in the specified directory and subdirectories.
 * @param directory The root directory to search for workflow and action files
 * @param allActionDefinitions Whether to include all action definitions or just those in the .github directory
 * @returns Array of file paths to the workflow and action files
 */
export async function getAllWorkflowAndActionFiles(
  directory: string,
  allActionDefinitions: boolean,
): Promise<string[]> {
  core.debug(`Getting all workflow and action files in ${directory}`);

  const workflowPatterns = [
    `${directory}/.github/workflows/*.yml`,
    `${directory}/.github/workflows/*.yaml`,
  ];

  const actionPatterns = allActionDefinitions
    ? [
        `${directory}/**/action.yml`,
        `${directory}/**/action.yaml`,
        `${directory}/action.yml`,
        `${directory}/action.yaml`,
      ]
    : [
        `${directory}/.github/actions/**/action.yml`,
        `${directory}/.github/actions/**/action.yaml`,
      ];

  return await globFiles([...workflowPatterns, ...actionPatterns]);
}

async function globFiles(patterns: string[]): Promise<string[]> {
  let files: string[] = [];

  try {
    for (const pattern of patterns) {
      const globber = await glob.create(pattern, {
        followSymbolicLinks: false,
      });
      const matchedFiles = await globber.glob();

      core.debug(`Matched files for ${pattern}: ${matchedFiles.length}`);

      const noPrefixMatchedFiles = matchedFiles.map((f) =>
        f.replace(`${process.cwd()}${sep}`, `.${sep}`),
      );
      files = files.concat(noPrefixMatchedFiles);
    }

    return files;
  } catch (error) {
    core.error(`Failed to get paths: ${error}`);
  }

  return [];
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
    const ignored =
      currentLine.includes(VALIDATOR_IGNORE_LINE) && operation === "unchanged";
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
 * Combines an array of LineValidationResult objects, merging entries
 * that have the same lineNumber by concatenating their messages arrays.
 * Also lowers the severity of messages if the line is to be ignored.
 *
 * @param {LineValidationResult[]} results - Array of LineValidationResult objects to be combined.
 * @returns {LineValidationResult[]} - A new array where entries with matching line numbers have their messages combined.
 */
export function processLineValidationResults(
  results: LineValidationResult[],
): LineValidationResult[] {
  const combinedResults = results.reduce((acc, current) => {
    // Find if we already have an entry with the same lineNumber
    const existingEntry = acc.find(
      (item) => item.line.lineNumber === current.line.lineNumber,
    );

    const processedMessages = current.messages.map((message) => {
      if (
        current.line.ignored &&
        message.type !== ValidationType.IGNORE_COMMENT
      ) {
        return {
          ...message,
          severity: "ignored",
        };
      }
      return message;
    });

    if (existingEntry) {
      // Combine messages for matching lineNumber
      existingEntry.messages = [...existingEntry.messages, ...current.messages];
    } else {
      // If not, add the current result to the accumulator
      acc.push({ ...current });
    }

    return acc;
  }, [] as LineValidationResult[]);

  return combinedResults.sort((a, b) => a.line.lineNumber - b.line.lineNumber);
}

export function doValidationErrorsExist(files: FileValidationResult[]) {
  return files.some((file) =>
    file.lineValidations.some((lv) =>
      lv.messages.some((m) => m.severity === "error"),
    ),
  );
}

/**
 * Maps an array then filters out undefined values.
 * @param {T[]} arr Array to map
 * @param mapFn Mapping function
 * @returns Array of mapped values with undefined values filtered out
 */
export function mapAndFilterUndefined<T, U>(
  arr: T[],
  mapFn: (x: T) => U | undefined,
): U[] {
  if (!arr) return [];

  return arr.reduce<U[]>((acc, curr) => {
    const result = mapFn(curr);
    if (result !== undefined) {
      acc.push(result);
    }
    return acc;
  }, []);
}
