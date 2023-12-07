import { execWithOutput } from "../../utils";
import { join } from "path";
import { readFileSync } from "fs";
import {
  FileChanges,
  FileAddition,
  FileDeletion,
} from "../../generated/graphql";

export async function getFileChanges(cwd?: string) {
  const output = await getGitStatusPorcelainV1(cwd);
  const changes = listChanges(output);
  const additionsAndDeletions = calculateAdditionsAndDeletions(changes);
  const fileChanges = await calculateFileChanges(additionsAndDeletions, cwd);

  return fileChanges;
}

interface GitFileStatus {
  filePath: string;
  indexStatus: "A" | "M" | "D" | "R" | "C" | "U" | "?" | "!";
  workingTreeStatus: "A" | "M" | "D" | "R" | "C" | "U" | "?" | "!";
}

export async function getGitStatusPorcelainV1(cwd?: string) {
  const stdout = await execWithOutput("git", ["status", "--porcelain=v1"], {
    cwd,
    notrim: true,
  });

  return stdout;
}

interface FilesToAddOrDelete {
  additions: string[];
  deletions: string[];
}

export function calculateAdditionsAndDeletions(
  fileStatuses: GitFileStatus[],
): FilesToAddOrDelete {
  const additions: string[] = [];
  const deletions: string[] = [];

  for (const fileStatus of fileStatuses) {
    if (
      ["M", "A", "T", "?"].includes(fileStatus.indexStatus) ||
      ["M", "T", "?"].includes(fileStatus.workingTreeStatus)
    ) {
      additions.push(fileStatus.filePath);
    }
    if (
      fileStatus.indexStatus === "D" ||
      fileStatus.workingTreeStatus === "D"
    ) {
      deletions.push(fileStatus.filePath);
    }

    if (
      fileStatus.indexStatus === "R" ||
      fileStatus.workingTreeStatus === "R"
    ) {
      const [oldFilePath, newFilePath] = fileStatus.filePath.split("->");
      deletions.push(oldFilePath.trim());
      additions.push(newFilePath.trim());
    }
  }

  return {
    additions,
    deletions,
  };
}

export function listChanges(output: string): GitFileStatus[] {
  function parseStatusCode(code: string): {
    indexStatus: string;
    workingTreeStatus: string;
  } {
    // Assuming the code is always two characters long
    return {
      indexStatus: code.charAt(0),
      workingTreeStatus: code.charAt(1),
    };
  }

  /**
   * Parses the output of `git status --porcelain=v1` into a list of git file statuses.
   * @param output The stdout of `git status --porcelain=v1`
   */
  function parseGitStatusPorcelainOutput(output: string): GitFileStatus[] {
    const lines = output.split("\n");
    // remove newline
    lines.pop();
    return lines.map((line) => {
      // only split the first two characters, as the rest is the file path
      const [status, filePath] = [
        line.substring(0, 2),
        line.substring(2).trim(),
      ];
      const { indexStatus, workingTreeStatus } = parseStatusCode(status);

      return { filePath, indexStatus, workingTreeStatus } as GitFileStatus;
    });
  }

  return parseGitStatusPorcelainOutput(output);
}

export async function calculateFileChanges(
  changes: FilesToAddOrDelete,
  cwd = "",
): Promise<FileChanges> {
  const additions: FileAddition[] = changes.additions.map((path) => {
    const fullPath = join(cwd, path);
    const contents = readFileSync(fullPath).toString("base64");
    return {
      path,
      contents,
    };
  });

  const deletions: FileDeletion[] = changes.deletions.map((path) => {
    return { path };
  });

  return {
    additions,
    deletions,
  };
}
