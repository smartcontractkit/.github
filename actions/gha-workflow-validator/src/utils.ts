import * as core from "@actions/core";
import { GithubFiles } from "./github.js";
import { ValidationResult } from "./action-reference-validations.js";
import { FIXING_ERRORS, htmlLink } from "./strings.js";

export interface ParsedFile {
  filename: string;
  sha: string;
  addedLines: FileAddition[];
}

export interface FileAddition {
  lineNumber: number;
  content: string;
  actionReference?: ActionReference;
}

export interface ActionReference {
  owner: string;
  repo: string;
  repoPath: string;
  ref: string;
  comment?: string;
  line: string;
}

export function filterForGithubWorkflowChanges(files: GithubFiles): GithubFiles {
  return files?.filter(({ filename }) => {
    return (filename.startsWith('.github/workflows') || filename.startsWith('.github/actions'))
    && (filename.endsWith('.yml') || filename.endsWith('.yaml'))
  })
}

export function parseAllAdditions(files: GithubFiles): ParsedFile[] {
  if (!files) return [];

  return files?.map(entry => {
    const { filename, sha, patch } = entry;
    const addedLines = patch ? parsePatchAdditions(patch) : [];
    return { filename, sha, addedLines };
  });
}

function parsePatchAdditions(patch: string): FileAddition[]  {
  const lineChanges = patch?.split('\n') || [];

  const additions: FileAddition[] = [];

  let currentLineInFile = 0;
  for (const line of lineChanges) {

    if (line.startsWith('@@')) {
      // @@ denotes a git hunk header
      // https://mattscodecave.com/posts/howto-reading-git-diffs-and-staging-hunks.html
      // example line: @@ -16,10 +16,10 @@ jobs:
      //   - "-16,10": "-" denotes source file, "16,10" means the hunk starts at line 16 and output contains 10 lines
      //   - "+16,10": "+" denotes destination file, "16,10" means the same as above
      const [ , , dest, ] = line.split(' ');

      if (!dest.startsWith("+")) {
        throw new Error("Invalid git hunk format");
      }

      const [ destLine, ] = dest.substring(1).split(',');
      currentLineInFile = parseInt(destLine, 10);
      continue;
    } else if (line.startsWith('+')) {
      const currentLine = line.substring(1);
      const actionReference = extractActionReference(currentLine);
      additions.push({ content: currentLine, lineNumber: currentLineInFile, actionReference });
    } else if (line.startsWith('-')) {
      // ignore deletions
      continue;
    }
    currentLineInFile++;
  }

  return additions;
}

function extractActionReference(line: string): ActionReference | undefined {
  // example line:
  //       - uses: actions/checkout@9bb56186c3b09b4f86b1c65136769dd318469633 # v4.1.2
  const trimSubString = "uses:"
  const usesIndex = line.indexOf(trimSubString);

  if (usesIndex === -1) {
    // Not an action reference
    return;
  }

  // trim past the "uses:" substring to get "<owner>/<repo><optional path>@<ref> # <optional comment>""
  const trimmedLine = line.substring(line.indexOf(trimSubString) + trimSubString.length).trim();

  if (trimmedLine.startsWith("./")) {
    // Local action reference - do not extract or validate these.
    return;
  }

  const [ actionIdentifier, ...comment ] = trimmedLine.split("#");
  const [ identifier, gitRef ] = actionIdentifier.trim().split("@");
  const [ owner, repo, ...path] = identifier.split("/");
  const repoPath = ((path.length) > 0 ? "/" : "") + path.join("/");

  return { owner, repo, repoPath, ref: gitRef, comment: comment.join().trim(), line, };
}

export function logErrors(validationResults: ValidationResult[], annotatePR: boolean = false) {
  for (const fileResults of validationResults) {
    for (const lineResults of fileResults.lineValidations) {
      const message = lineResults.validationErrors.map(error => error.message).join(",");
      core.error(`file: ${fileResults.filename} @ line: ${lineResults.line.lineNumber} - ${message}`);
      if (annotatePR) {
        core.error(message, {
          file: fileResults.filename,
          startLine: lineResults.line.lineNumber,
        });
      }
    }
  }
}

type TableRow = Parameters<typeof core.summary.addTable>[0][0]
type TableCell = TableRow[0]

export async function setSummary(validationResults: ValidationResult[], fileUrlPrefix: string) {
  const headerRow: TableRow = [
      { data: "Filename", header: true },
      { data: "Line Number", header: true },
      { data: "Violations", header: true },
  ];

  const errorRows = validationResults.reduce<TableRow[]>((acc, curr) => {
    const filename = curr.filename;

    const errorCellTuples: TableCell[][]  = curr.lineValidations.map(validationResult => {
      const lineNumberCell: TableCell = { data: htmlLink(`${validationResult.line.lineNumber}`, `${fileUrlPrefix}/${filename}#L${validationResult.line.lineNumber}`) }
      const violationsCell: TableCell = { data: validationResult.validationErrors.map(error => error.message).join(", ") }

      return [ lineNumberCell, violationsCell ];
    })

    if (errorCellTuples.length === 0) {
      return acc;
    }

    // The filename cell to span all the rows for this file
    const filenameCell: TableCell = { data: filename, rowspan: `${errorCellTuples.length}` }
    const firstErrorCellTuple =  errorCellTuples.shift() as TableCell[];
    const firstRowForFile = [ filenameCell, ...firstErrorCellTuple ];

    return [
      ...acc,
      firstRowForFile,
      ...errorCellTuples
    ];

  }, [] as TableRow[]);

  await core.summary
    .addTable([headerRow, ...errorRows])
    .addSeparator()
    .addRaw(FIXING_ERRORS)
    .write();
}

