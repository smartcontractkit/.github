import * as core from "@actions/core";
import { execa } from "execa";

import * as fs from "fs";
import * as path from "path";

/**
 * Validates that the given directory exists and is the root of a Git repository
 */
export async function validateGitRepositoryRoot(
  directory: string,
): Promise<void> {
  // Validate that the directory exists
  if (!fs.existsSync(directory)) {
    throw new Error(`Directory does not exist: ${directory}`);
  }

  // Validate that the directory is the root of a Git repository
  try {
    const { stdout: gitDir } = await execa("git", ["rev-parse", "--git-dir"], {
      cwd: directory,
    });
    const resolvedGitDir = path.resolve(directory, gitDir);
    const expectedGitDir = path.resolve(directory, ".git");

    // Check if the git directory is directly in the provided directory (repository root)
    if (resolvedGitDir !== expectedGitDir) {
      throw new Error(
        `Directory is not the root of a Git repository: ${directory}. Git directory found at: ${gitDir}`,
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("not the root of a Git repository")
    ) {
      throw error;
    }
    throw new Error(`Directory is not a Git repository: ${directory}`);
  }
}

/**
 * Resolves a ref (commit, branch, tag, local or remote) to a commit SHA.
 *
 * Throws if none can be resolved to a commit.
 */
export async function resolveRef(
  repoDir: string,
  ref: string,
): Promise<string> {
  // Order matters: keep the most "obvious" / user-intended first
  const candidates = [
    ref,
    `origin/${ref}`,
    `refs/tags/${ref}`,
    `refs/heads/${ref}`,
  ];

  const tried: string[] = [];

  for (const candidate of candidates) {
    tried.push(candidate);
    try {
      // ^{commit} forces it to resolve to a commit, even if it's a tag, etc.
      const { stdout } = await execa(
        "git",
        ["rev-parse", "--verify", `${candidate}^{commit}`],
        { cwd: repoDir },
      );

      const sha = stdout.trim();
      core.info(`Resolved ref '${ref}' to '${candidate}' (${sha})`);
      return sha;
    } catch {
      // just continue to the next candidate
    }
  }

  throw new Error(
    `Could not resolve ref '${ref}' to a commit. Tried: ${tried.join(", ")}`,
  );
}

/**
 * Checks if a ref is a commit SHA (40-character hex string) rather than a branch name
 */
async function isCommitSha(repoDir: string, ref: string): Promise<boolean> {
  // First check if it looks like a SHA (40 hex characters)
  const shaPattern = /^[a-f0-9]{40}$/i;
  if (!shaPattern.test(ref)) {
    return false;
  }

  try {
    // Verify that this SHA actually exists in the repository
    await execa("git", ["cat-file", "-e", ref], { cwd: repoDir });
    return true;
  } catch (error) {
    // If git cat-file fails, it's not a valid SHA in this repo
    return false;
  }
}

/**
 * Checks out the specified ref in the repository
 */
export async function checkoutRef(repoDir: string, ref: string): Promise<string> {
  core.info(`Checking out ref: ${ref}`);

  try {
    const resolvedRef = await resolveRef(repoDir, ref);
    await execa("git", ["checkout", resolvedRef], { cwd: repoDir });
    core.info(`Successfully checked out: ${resolvedRef}`);
    return resolvedRef;
  } catch (error) {
    throw new Error(`Failed to checkout ref ${ref}: ${error}`);
  }
}

export async function getRepoTags(repoDir: string) {
  const { stdout: rawTags } = await execa("git", ["tag"], { cwd: repoDir });
  const tags = rawTags
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  return tags;
}
