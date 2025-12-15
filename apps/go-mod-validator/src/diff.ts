import * as core from "@actions/core";
import { GetResponseTypeFromEndpointMethod } from "@octokit/types";
import { Octokit } from "./github";
type CompareResponse = GetResponseTypeFromEndpointMethod<
  Octokit["rest"]["repos"]["compareCommitsWithBasehead"]
>;
export type GithubFiles = CompareResponse["data"]["files"];

export async function getChangedGoModFiles(
  gh: Octokit,
  prNumber: number,
  owner: string,
  repo: string,
  depPrefix: string,
): Promise<ParsedFile[]> {
  const files = await getChangedFilesForPR(gh, owner, repo, prNumber);
  const relevantFiles = filterForRelevantChanges(files);
  return parseAllAdditions(relevantFiles, depPrefix);
}

function filterForRelevantChanges(files: GithubFiles): GithubFiles {
  return files?.filter(({ filename }) => filename.endsWith("go.mod"));
}

export async function getChangedFilesForPR(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<GithubFiles> {
  core.debug(`Comparing ${owner}/${repo} for PR ${prNumber}`);

  const prFiles = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  return prFiles;
}

// Taken from https://github.com/smartcontractkit/.github/blob/dc8b1a0b478151119d86ac1bf121ea7eb3c1c88c/actions/gha-workflow-validator/src/utils.ts#L59C1-L97C2
export interface ParsedFile {
  filename: string;
  sha: string;
  addedLines: FileAddition[];
}

export interface FileAddition {
  lineNumber: number;
  content: string;
}

function parseAllAdditions(
  files: GithubFiles,
  depPrefix: string,
): ParsedFile[] {
  if (!files) return [];

  return files?.map((entry) => {
    const { filename, sha, patch } = entry;
    const addedLines = patch ? parsePatchAdditions(patch, depPrefix) : [];
    return { filename, sha, addedLines };
  });
}

function parsePatchAdditions(patch: string, depPrefix: string): FileAddition[] {
  const lineChanges = patch?.split("\n") || [];

  const additions: FileAddition[] = [];

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
    } else if (line.startsWith("+")) {
      const currentLine = line.substring(1);
      if (isGoModule(currentLine, depPrefix)) {
        additions.push({
          content: currentLine,
          lineNumber: currentLineInFile,
        });
      }
    } else if (line.startsWith("-")) {
      // ignore deletions
      continue;
    }
    currentLineInFile++;
  }

  return additions;
}

function isGoModule(line: string, depPrefix: string): boolean {
  // Quick and dirty, we just search for github.com and include it in the results
  return line.includes(depPrefix);
}
