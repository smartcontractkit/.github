import * as core from "@actions/core";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Returns changed files between two git refs using `git diff --name-only`.
 * If the refs cannot be resolved, fallback logic is applied:
 * - If `head` cannot be resolved, `HEAD` is used.
 * - If `base` cannot be resolved, `head^` is used.
 */
export async function getChangedFilesGit(
  base: string,
  head: string,
  directory: string = process.cwd(),
): Promise<string[]> {
  core.info(
    `Getting changed files between ${base} and ${head} in ${directory}`,
  );

  let resolvedHead = await resolveCommitish(head, directory);
  let resolvedBase = await resolveCommitish(base, directory);

  if (!resolvedHead || !resolvedBase) {
    core.warning(
      `Head ("${head}") or Base ("${base}") could not be resolved. Attempting to pull latest changes and retry...`,
    );
    await gitPull(directory);
    resolvedHead = resolvedHead || (await resolveCommitish(head, directory));
    resolvedBase = resolvedBase || (await resolveCommitish(base, directory));
  }

  if (!resolvedBase || !resolvedHead) {
    throw new Error(
      `One or both git references could not be resolved: base=${base} (${resolvedBase}), head=${head} (${resolvedHead}).
      Ensure the repository is checked out and the fetch depth is sufficient.`,
    );
  }

  core.info(
    `Using (after fallback logic) - base: ${resolvedBase}, head: ${resolvedHead}`,
  );

  const { stdout: changedFiles } = await execFileAsync(
    "git",
    ["diff", "--name-only", resolvedBase, resolvedHead],
    { cwd: directory },
  );

  return changedFiles.split("\n").filter(Boolean);
}

/**
 * Resolves a git ref (branch, tag, or SHA) to a full commit SHA, or null if it cannot be resolved.
 */
async function resolveCommitish(
  ref: string,
  directory: string,
): Promise<string | null> {
  if (!ref || /\s/.test(ref) || ref.includes("..")) return null;

  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "-q", "--verify", `${ref}^{commit}`],
      { cwd: directory },
    );
    return stdout.trim();
  } catch {
    return null;
  }
}

async function gitPull(directory: string): Promise<void> {
  core.info(`Attempting to pull latest changes in ${directory}...`);
  try {
    await execFileAsync("git", ["pull"], { cwd: directory });
    core.info(`Successfully pulled latest changes in ${directory}`);
  } catch (err) {
    core.error(`Failed to pull latest changes in ${directory}: ${err}`);
    throw new Error(`Failed to pull latest changes: ${err}`);
  }
}
