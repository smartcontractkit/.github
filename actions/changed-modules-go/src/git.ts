import * as core from "@actions/core";
import { execa } from "execa";

export async function resolveBaseAndHeadRefs(
  repoDir: string,
  headRef: string,
  baseRef: string,
) {
  core.startGroup("Resolving base and head refs");
  core.info(
    `Resolving base and head refs for base: ${baseRef}, head: ${headRef}`,
  );

  try {
    // Resolve both refs to ensure they exist
    const resolvedBase = await resolveRef(repoDir, baseRef);
    const resolvedHead = await resolveRef(repoDir, headRef);

    core.info(`Resolved refs: base=${resolvedBase} head=${resolvedHead}`);

    const { stdout: mergeBase } = await execa(
      "git",
      ["merge-base", resolvedHead, resolvedBase],
      {
        cwd: repoDir,
      },
    );

    const trimmedMergeBase = mergeBase.trim();
    core.info(`Using base: ${trimmedMergeBase} (${baseRef})`);
    core.info(`Using head: ${resolvedHead} (${headRef})`);
    return { base: trimmedMergeBase, head: resolvedHead };
  } catch (error) {
    throw new Error(
      `Failed to find merge-base between ${headRef} and ${baseRef}: ${error}`,
    );
  } finally {
    core.endGroup();
  }
}

/**
 * Resolves a ref to ensure it exists and can be used by git commands
 */
async function resolveRef(repoDir: string, ref: string): Promise<string> {
  // Try the ref as-is first
  try {
    await execa("git", ["rev-parse", "--verify", ref], { cwd: repoDir });
    return ref;
  } catch (error) {
    // If that fails, try with origin/ prefix for remote branches
    const remoteRef = `origin/${ref}`;
    try {
      await execa("git", ["rev-parse", "--verify", remoteRef], {
        cwd: repoDir,
      });
      core.info(`Resolved ${ref} to ${remoteRef}`);
      return remoteRef;
    } catch (remoteError) {
      throw new Error(
        `Could not resolve ref: ${ref}. Tried both '${ref}' and '${remoteRef}'`,
      );
    }
  }
}

export async function getChangedFiles(
  directory: string,
  base: string,
  head: string,
): Promise<string[]> {
  const { stdout: changedFiles } = await execa(
    "git",
    ["diff", "--name-only", base, head],
    {
      cwd: directory,
    },
  );

  return changedFiles.split("\n").filter(Boolean);
}
