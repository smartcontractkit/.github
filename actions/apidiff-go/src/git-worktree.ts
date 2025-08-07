import * as core from "@actions/core";
import * as fs from "fs";
import * as path from "path";
import { execa } from "execa";

export interface WorktreeResult {
  /** Path to the main repository (contains the head/current branch) */
  headRepoPath: string;
  /** Path to the worktree containing the base ref (merge-base for branches, or original ref for SHAs) */
  baseRepoPath: string;
}

export async function setupWorktree(
  directory: string,
  base: string,
  head: string,
  repoName: string,
): Promise<WorktreeResult> {
  // Validate that the directory exists and is the root of a Git repository
  await validateGitRepositoryRoot(directory);

  core.info(`Setting up worktrees for repository: ${directory}`);
  core.info(`Head ref: ${head}`);
  core.info(`Base ref: ${base}`);

  // Debug: Show current git state
  try {
    const { stdout: currentHead } = await execa("git", ["rev-parse", "HEAD"], { cwd: directory });
    const { stdout: currentBranch } = await execa("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: directory });
    const { stdout: remotes } = await execa("git", ["remote", "-v"], { cwd: directory });
    core.info(`Current HEAD: ${currentHead.trim()}`);
    core.info(`Current branch: ${currentBranch.trim()}`);
    core.info(`Available remotes:\n${remotes}`);
  } catch (error) {
    core.warning(`Failed to get git debug info: ${error}`);
  }

  // Determine the actual base ref to use for comparison
  let actualBaseRef = base;

  // Only use merge-base logic if both refs appear to be branch names (not SHAs)
  const baseIsSha = await isCommitSha(directory, base);
  const headIsSha = await isCommitSha(directory, head);

  if (!baseIsSha && !headIsSha) {
    // Both are branch names, find the merge-base (common ancestor)
    actualBaseRef = await findMergeBase(directory, head, base);
    core.info(`Both refs are branches - using merge-base: ${actualBaseRef}`);
    core.info(`Will compare changes from ${actualBaseRef} to ${head}`);
  } else {
    core.info(`Using direct ref comparison (at least one ref is a SHA)`);
    core.info(`Will compare changes from ${base} to ${head}`);
  }

  // Use the actual base ref for creating deterministic worktree path
  const worktreePath = createWorktreePath(directory, repoName, actualBaseRef);

  try {
    // Ensure the main repository is at the correct ref
    await checkoutRef(directory, head);

    // Clean up any existing worktree at the target path
    await cleanupExistingWorktree(directory, worktreePath);

    // Create worktree for the actual base ref
    await createWorktree(directory, worktreePath, actualBaseRef);

    core.info(`Successfully created worktree at: ${worktreePath}`);

    return {
      headRepoPath: directory,
      baseRepoPath: worktreePath,
    };
  } catch (error) {
    core.error(`Failed to setup worktree: ${error}`);
    throw error;
  }
}

/**
 * Validates that the given directory exists and is the root of a Git repository
 */
async function validateGitRepositoryRoot(directory: string): Promise<void> {
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
      await execa("git", ["rev-parse", "--verify", remoteRef], { cwd: repoDir });
      core.info(`Resolved ${ref} to ${remoteRef}`);
      return remoteRef;
    } catch (remoteError) {
      throw new Error(`Could not resolve ref: ${ref}. Tried both '${ref}' and '${remoteRef}'`);
    }
  }
}

/**
 * Finds the merge-base (common ancestor) between two refs
 */
async function findMergeBase(
  repoDir: string,
  head: string,
  base: string,
): Promise<string> {
  core.info(`Finding merge-base between ${head} and ${base}`);

  try {
    // Resolve both refs to ensure they exist
    const resolvedHead = await resolveRef(repoDir, head);
    const resolvedBase = await resolveRef(repoDir, base);

    core.info(`Resolved refs: head=${resolvedHead}, base=${resolvedBase}`);

    const { stdout: mergeBase } = await execa(
      "git",
      ["merge-base", resolvedHead, resolvedBase],
      {
        cwd: repoDir,
      },
    );

    const trimmedMergeBase = mergeBase.trim();
    core.info(`Found merge-base: ${trimmedMergeBase}`);
    return trimmedMergeBase;
  } catch (error) {
    throw new Error(
      `Failed to find merge-base between ${head} and ${base}: ${error}`,
    );
  }
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
 * Creates a deterministic path for the worktree based on repo name and ref
 */
function createWorktreePath(
  repoDir: string,
  repoName: string,
  ref: string,
): string {
  // Sanitize the repo name (remove org/ prefix and any invalid filesystem characters)
  const sanitizedRepoName = repoName
    .replace(/^.*\//, "")
    .replace(/[^a-zA-Z0-9\-_]/g, "-");

  // Sanitize the ref name for use in filesystem path
  const sanitizedRef = ref.replace(/[^a-zA-Z0-9\-_]/g, "-");
  const worktreeName = `${sanitizedRepoName}-${sanitizedRef}`;

  // Create worktree in a sibling directory to avoid conflicts
  const parentDir = path.dirname(repoDir);
  return path.join(parentDir, `worktree-${worktreeName}`);
}

/**
 * Checks out the specified ref in the repository
 */
async function checkoutRef(repoDir: string, ref: string): Promise<void> {
  core.info(`Checking out ref: ${ref}`);

  try {
    // Resolve the ref to handle remote branches
    const resolvedRef = await resolveRef(repoDir, ref);

    // Check if we're already on the correct ref
    const { stdout: currentShaRef } = await execa(
      "git",
      ["rev-parse", "HEAD"],
      {
        cwd: repoDir,
      },
    );
    core.info(`Current SHA Ref: ${currentShaRef}`);

    const { stdout: currentBranch } = await execa(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      {
        cwd: repoDir,
      },
    );
    core.info(`Current branch: ${currentBranch}`);

    // Get the SHA of the target ref to compare
    const { stdout: targetSha } = await execa(
      "git",
      ["rev-parse", resolvedRef],
      {
        cwd: repoDir,
      },
    );

    if (currentShaRef.trim() === targetSha.trim()) {
      core.info(`Already at ref: ${ref} (${targetSha.trim()}) - skipping checkout`);
      return;
    }

    // Only checkout if we're not already on the target ref
    await execa("git", ["checkout", resolvedRef], { cwd: repoDir });
    core.info(`Successfully checked out: ${resolvedRef}`);
  } catch (error) {
    throw new Error(`Failed to checkout ref ${ref}: ${error}`);
  }
}

/**
 * Cleans up any existing worktree at the target path
 */
async function cleanupExistingWorktree(
  repoDir: string,
  worktreePath: string,
): Promise<void> {
  if (!fs.existsSync(worktreePath)) {
    return;
  }

  core.info(`Cleaning up existing worktree: ${worktreePath}`);

  try {
    // Remove the worktree from Git's tracking
    const worktreeName = path.basename(worktreePath);
    try {
      await execa("git", ["worktree", "remove", worktreeName, "--force"], {
        cwd: repoDir,
      });
    } catch (error) {
      // Worktree might not be tracked by Git, that's okay
      core.debug(`Worktree not tracked by Git: ${error}`);
    }

    // Remove the directory if it still exists
    if (fs.existsSync(worktreePath)) {
      fs.rmSync(worktreePath, { recursive: true, force: true });
    }
  } catch (error) {
    core.warning(`Failed to clean up existing worktree: ${error}`);
    // Continue anyway, as we'll try to create a new one
  }
}

/**
 * Creates a new worktree for the specified ref
 */
async function createWorktree(
  repoDir: string,
  worktreePath: string,
  ref: string,
): Promise<void> {
  core.info(`Creating worktree for ref: ${ref} at ${worktreePath}`);

  try {
    // Create the worktree
    await execa("git", ["worktree", "add", worktreePath, ref], {
      cwd: repoDir,
    });

    // Verify the worktree was created successfully
    if (!fs.existsSync(worktreePath)) {
      throw new Error("Worktree directory was not created");
    }

    // Verify the correct ref is checked out
    const { stdout: checkedOutRef } = await execa(
      "git",
      ["rev-parse", "HEAD"],
      {
        cwd: worktreePath,
      },
    );

    const { stdout: expectedRef } = await execa("git", ["rev-parse", ref], {
      cwd: repoDir,
    });

    if (checkedOutRef.trim() !== expectedRef.trim()) {
      throw new Error(
        `Worktree has wrong ref. Expected: ${expectedRef.trim()}, Got: ${checkedOutRef.trim()}`,
      );
    }

    core.info(`Worktree created successfully at: ${worktreePath}`);
  } catch (error) {
    throw new Error(`Failed to create worktree: ${error}`);
  }
}

/**
 * Cleans up worktrees created by this function
 */
export async function cleanupWorktrees(result: WorktreeResult): Promise<void> {
  core.info(`Cleaning up worktree: ${result.baseRepoPath}`);

  try {
    await cleanupExistingWorktree(result.headRepoPath, result.baseRepoPath);
    core.info("Worktree cleanup completed");
  } catch (error) {
    core.warning(`Failed to cleanup worktree: ${error}`);
  }
}
