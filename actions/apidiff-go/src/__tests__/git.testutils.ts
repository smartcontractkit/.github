import * as fs from "fs";
import * as path from "path";

import { execa } from "execa";

/**
 * Sets up a remote repository with multiple commits and branches
 */
export async function setupRepository(
  remoteRepoDir: string,
  tempDir: string,
): Promise<void> {
  await fs.promises.mkdir(remoteRepoDir, { recursive: true });

  // Initialize bare repository
  await execa("git", ["init", "--bare"], { cwd: remoteRepoDir });

  // Create a temporary clone to populate the bare repository
  const tempCloneDir = path.join(tempDir, "temp-clone");
  await execa("git", ["clone", remoteRepoDir, tempCloneDir]);
  await setupLocalGitConfig(tempCloneDir);

  // Setup branches and commits
  await execa("git", ["branch", "-M", "main"], { cwd: tempCloneDir });
  await createCommit(
    tempCloneDir,
    "Initial Commit",
    "README.md",
    "# Initial commit\n",
  );
  await createCommit(
    tempCloneDir,
    "Common commit 1",
    "common1.txt",
    "Common content 1\n",
  );

  // Create feature branch from this common point
  await execa("git", ["checkout", "-b", "feature/test-branch"], {
    cwd: tempCloneDir,
  });
  await createCommit(
    tempCloneDir,
    "Add feature",
    "feature.txt",
    "Feature content\n",
  );
  await createCommit(
    tempCloneDir,
    "Add more feature",
    "feature2.txt",
    "More feature content\n",
  );
  await execa("git", ["push", "origin", "feature/test-branch"], {
    cwd: tempCloneDir,
  });

  // Create develop branch from another common point
  await execa("git", ["checkout", "main"], { cwd: tempCloneDir });
  await createCommit(
    tempCloneDir,
    "Common commit 2",
    "common2.txt",
    "Common content 2\n",
  );
  await execa("git", ["checkout", "-b", "develop"], { cwd: tempCloneDir });
  await createCommit(
    tempCloneDir,
    "Add develop feature",
    "develop.txt",
    "Develop content\n",
  );
  await createCommit(
    tempCloneDir,
    "Add more develop features",
    "develop2.txt",
    "More develop content\n",
  );
  await execa("git", ["push", "origin", "develop"], { cwd: tempCloneDir });

  // Advance main branch beyond the common ancestor to create divergent history
  await execa("git", ["checkout", "main"], { cwd: tempCloneDir });
  await createCommit(
    tempCloneDir,
    "Advance main - commit 1",
    "main-advance1.txt",
    "Main advancement 1\n",
  );
  await createCommit(
    tempCloneDir,
    "Advance main - commit 2",
    "main-advance2.txt",
    "Main advancement 2\n",
  );
  await execa("git", ["push", "origin", "main"], { cwd: tempCloneDir });

  // Get the initial (root) commit SHA for lightweight tag
  const { stdout: rootSha } = await execa(
    "git",
    ["rev-list", "--max-parents=0", "HEAD"],
    { cwd: tempCloneDir },
  );

  // Lightweight tag on initial commit
  await execa("git", ["tag", "lightweight-tag", rootSha.trim()], {
    cwd: tempCloneDir,
  });

  // Annotated tag on current main HEAD
  await execa(
    "git",
    ["tag", "-a", "annotated-tag", "-m", "annotated tag", "HEAD"],
    { cwd: tempCloneDir },
  );

  // Push all tags
  await execa("git", ["push", "origin", "--tags"], { cwd: tempCloneDir });

  // Cleanup temp clone
  await fs.promises.rm(tempCloneDir, { recursive: true, force: true });
}

/**
 * Clones the remote repository to create a local working copy
 */
export async function cloneRepository(
  remoteRepoDir: string,
  localRepoDir: string,
): Promise<void> {
  await execa("git", ["clone", remoteRepoDir, localRepoDir]);

  await setupLocalGitConfig(localRepoDir);

  // Fetch all branches and set up local tracking branches
  await execa("git", ["fetch", "origin"], { cwd: localRepoDir });

  // Create local tracking branches for all remote branches
  try {
    await execa("git", ["checkout", "-b", "develop", "origin/develop"], {
      cwd: localRepoDir,
    });
  } catch (error) {
    // Branch might already exist, ignore error
  }

  try {
    await execa(
      "git",
      ["checkout", "-b", "feature/test-branch", "origin/feature/test-branch"],
      { cwd: localRepoDir },
    );
  } catch (error) {
    // Branch might already exist, ignore error
  }

  // Go back to main branch
  await execa("git", ["checkout", "main"], { cwd: localRepoDir });
}

/**
 * Get the SHA of a specific ref
 */
export async function getRefSha(repoDir: string, ref: string): Promise<string> {
  const { stdout } = await execa("git", ["rev-parse", ref], { cwd: repoDir });
  return stdout.trim();
}

async function createCommit(
  repoDir: string,
  message?: string,
  filename?: string,
  content?: string,
) {
  if (filename && content) {
    const messageText = message || `Add ${filename}`;

    await fs.promises.writeFile(path.join(repoDir, filename), content);
    await execa("git", ["add", filename], { cwd: repoDir });
    await execa("git", ["commit", "-m", messageText], { cwd: repoDir });
    return;
  }

  const messageText = message || "Empty commit";
  await execa("git", ["commit", "--allow-empty", "-m", messageText], {
    cwd: repoDir,
  });
}

async function setupLocalGitConfig(repoDir: string): Promise<void> {
  await execa("git", ["config", "--local", "user.name", "Test User"], {
    cwd: repoDir,
  });
  await execa("git", ["config", "--local", "user.email", "test@example.com"], {
    cwd: repoDir,
  });
  await execa("git", ["config", "--local", "commit.gpgsign", "false"], {
    cwd: repoDir,
  });
}
