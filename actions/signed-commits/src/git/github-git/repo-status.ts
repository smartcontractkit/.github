import * as core from "@actions/core";
import { execWithOutput } from "../../utils";
import { join } from "path";
import { readFileSync } from "fs";
import type {
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
  // -z emits NUL-delimited records with raw, unquoted paths. The line-based
  // format C-quotes paths containing spaces or special characters (e.g.
  // `?? "new dir/file.txt"`), and those quoted paths fail readFileSync
  // downstream because no file literally named `"new dir/file.txt"` exists.
  const stdout = await execWithOutput(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    {
      cwd,
      notrim: true,
    },
  );

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
   * Parses the output of `git status --porcelain=v1 -z` into a list of git file statuses.
   *
   * -z output is NUL-delimited and never quotes or escapes paths, unlike the
   * line-based format which C-quotes paths containing spaces or special
   * characters. Rename and copy records carry two consecutive fields: the new
   * path, then the original path. The composite `original -> new` filePath
   * preserved here matches the line-based format that downstream code and
   * callers expect.
   * @param output The stdout of `git status --porcelain=v1 -z`
   */
  function parseGitStatusPorcelainOutput(output: string): GitFileStatus[] {
    const fields = output.split("\0");
    const changes: GitFileStatus[] = [];

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i] ?? "";
      // the trailing NUL produces one empty final field
      if (field === "") {
        continue;
      }
      // XY is the two-character status, followed by one separator space; the
      // path starts at index 3. substring(3) (rather than trim) keeps any
      // leading/trailing spaces that are part of the filename.
      const status = field.substring(0, 2);
      let filePath = field.substring(3);
      const { indexStatus, workingTreeStatus } = parseStatusCode(status);

      // rename/copy records are followed by a second field: the original path
      if (
        indexStatus === "R" ||
        indexStatus === "C" ||
        workingTreeStatus === "R" ||
        workingTreeStatus === "C"
      ) {
        const originalPath = fields[++i] ?? "";
        filePath = `${originalPath} -> ${filePath}`;
      }

      changes.push({
        filePath,
        indexStatus,
        workingTreeStatus,
      } as GitFileStatus);
    }

    return changes;
  }

  return parseGitStatusPorcelainOutput(output);
}

export async function calculateFileChanges(
  changes: FilesToAddOrDelete,
  cwd = "",
): Promise<FileChanges> {
  const additions: FileAddition[] = changes.additions.flatMap((path) => {
    const fullPath = join(cwd, path);
    try {
      const contents = readFileSync(fullPath).toString("base64");
      return [{ path, contents }];
    } catch {
      core.warning(
        `Skipping ${path}: not a readable file (missing, directory, or symlink)`,
      );
      return [];
    }
  });

  const deletions: FileDeletion[] = changes.deletions.map((path) => {
    return { path };
  });

  return {
    additions,
    deletions,
  };
}
