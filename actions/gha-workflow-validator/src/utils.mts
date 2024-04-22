import { GithubFiles } from "./github.mjs";

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
      const [ _, source, dest, __ ] = line.split(' ');

      if (!dest.startsWith("+")) {
        throw new Error("Invalid git hunk format");
      }

      const [ destLine, ___ ] = dest.substring(1).split(',');
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

export function extractActionReference(line: string): ActionReference | undefined {
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

  const [ actionIdentifier, ...comment ] = trimmedLine.split("#");
  const [ identifier, gitRef ] = actionIdentifier.trim().split("@");
  const [ owner, repo, ...path] = identifier.split("/");
  const repoPath = ((path.length) > 0 ? "/" : "") + path.join("/");

  return { owner, repo, repoPath, ref: gitRef, comment: comment.join().trim(), line, };
}