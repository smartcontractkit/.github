import * as core from "@actions/core";
import * as glob from "@actions/glob";
import { sep } from "path";
import { readFile } from "fs/promises";
import { GithubFiles } from "./github.js";
import { FileValidationResult } from "./validation-check.js";
import { FIXING_ERRORS, htmlLink } from "./strings.js";

export interface ParsedFile {
  filename: string;
  lines: FileLine[];
}

export interface FileLine {
  lineNumber: number;
  content: string;
  operation: "add" | "unchanged";
}

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

function isGithubWorkflowOrActionFile(filename: string): boolean {
  return (
    (filename.startsWith(".github/workflows") ||
      filename.startsWith(".github/actions")) &&
    (filename.endsWith(".yml") || filename.endsWith(".yaml"))
  );
}

export async function parseFiles(paths: string[]) {
  const parsedFiles: ParsedFile[] = [];

  for (const path of paths) {
    const content = await readFile(path, "utf-8");
    const lines = content
      .split("\n")
      .map(
        (line, index) =>
          ({
            lineNumber: index + 1,
            content: line,
            operation: "unchanged",
          }) as FileLine,
      )
      .filter((line) => line.content.trim() !== "");

    parsedFiles.push({ filename: path, lines });
  }

  return parsedFiles;
}

export function parseGithubDiff(githubFiles: GithubFiles): ParsedFile[] {
  if (!githubFiles) return [];

  return githubFiles?.map((entry) => {
    const { filename, patch } = entry;
    const lineChanges = patch ? parsePatchChanges(patch) : [];
    return { filename, lines: lineChanges };
  });
}

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

    additions.push({
      content: currentLine,
      lineNumber: currentLineInFile,
      operation,
    });

    currentLineInFile++;
  }

  return additions;
}

export function logErrors(
  validationResults: FileValidationResult[],
  annotatePR: boolean = false,
) {
  for (const fileResults of validationResults) {
    for (const lineResults of fileResults.lineValidations) {
      const message = lineResults.validationErrors
        .map((error) => error.message)
        .join(",");
      core.error(
        `file: ${fileResults.filename} @ line: ${lineResults.line.lineNumber} - ${message}`,
      );
      if (annotatePR) {
        core.error(message, {
          file: fileResults.filename,
          startLine: lineResults.line.lineNumber,
        });
      }
    }
  }
}

type TableRow = Parameters<typeof core.summary.addTable>[0][0];
type TableCell = TableRow[0];

export async function setSummary(
  validationResults: FileValidationResult[],
  fileUrlPrefix: string,
) {
  const headerRow: TableRow = [
    { data: "Filename", header: true },
    { data: "Line Number", header: true },
    { data: "Violations", header: true },
  ];

  const errorRows = validationResults.reduce<TableRow[]>((acc, curr) => {
    const filename = curr.filename;

    const errorCellTuples: TableCell[][] = curr.lineValidations.map(
      (validationResult) => {
        const lineNumberCell: TableCell = {
          data: htmlLink(
            `${validationResult.line.lineNumber}`,
            `${fileUrlPrefix}/${filename}#L${validationResult.line.lineNumber}`,
          ),
        };
        const violationsCell: TableCell = {
          data: validationResult.validationErrors
            .map((error) => error.message)
            .join(", "),
        };

        return [lineNumberCell, violationsCell];
      },
    );

    if (errorCellTuples.length === 0) {
      return acc;
    }

    // The filename cell to span all the rows for this file
    const filenameCell: TableCell = {
      data: filename,
      rowspan: `${errorCellTuples.length}`,
    };
    const firstErrorCellTuple = errorCellTuples.shift() as TableCell[];
    const firstRowForFile = [filenameCell, ...firstErrorCellTuple];

    return [...acc, firstRowForFile, ...errorCellTuples];
  }, [] as TableRow[]);

  await core.summary
    .addTable([headerRow, ...errorRows])
    .addSeparator()
    .addRaw(FIXING_ERRORS)
    .write();
}

export function mapAndFilter<T, U>(
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

export function flatMapFilter<T, U>(
  arr: T[],
  mapFn: (x: T) => U[] | undefined,
): U[] {
  if (!arr) return [];

  return arr.reduce<U[]>((acc, curr) => {
    const result = mapFn(curr);
    if (result !== undefined) {
      acc.push(...result); // Flattening by spreading the result array into the accumulator
    }
    return acc;
  }, []);
}
