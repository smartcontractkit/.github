import * as core from "@actions/core";
import { execa } from "execa";

export async function getChangedFilesGit(
  base: string,
  head: string,
  directory: string = process.cwd(),
): Promise<string[]> {
  core.info(
    `Getting changed files between ${base} and ${head} in ${directory}`,
  );

  const { stdout: changedFiles } = await execa(
    "git",
    ["diff", "--name-only", base, head],
    {
      cwd: directory,
    },
  );

  return changedFiles.split("\n").filter(Boolean);
}
