import * as core from "@actions/core";
import { execa } from "execa";

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
  if (!resolvedHead) {
    core.warning(
      `Head ref ${head} could not be resolved. Using HEAD as fallback.`,
    );
    resolvedHead = await resolveCommitish("HEAD", directory);
  }

  let resolvedBase = await resolveCommitish(base, directory);
  if (!resolvedBase) {
    core.info(
      `Base ref ${base} could not be resolved. Using ${resolvedHead}^ as fallback.`,
    );
    resolvedBase = await resolveCommitish(`${resolvedHead}^`, directory);
  }

  if (!resolvedBase || !resolvedHead) {
    core.warning(
      `One or both git references could not be resolved: base=${base} (${resolvedBase}), head=${head} (${resolvedHead})`,
    );
    return [];
  }

  core.info(
    `Using (after fallback logic) - base: ${resolvedBase}, head: ${resolvedHead}`,
  );
  const { stdout: changedFiles } = await execa(
    "git",
    ["diff", "--name-only", resolvedBase, resolvedHead],
    {
      cwd: directory,
    },
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
    const { stdout } = await execa(
      "git",
      ["rev-parse", "-q", "--verify", `${ref}^{commit}`],
      {
        cwd: directory,
      },
    );
    return stdout.trim(); // resolved full SHA
  } catch {
    return null;
  }
}
