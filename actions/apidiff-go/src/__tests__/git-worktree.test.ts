import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execa } from "execa";

import {
  setupWorktree,
  cleanupWorktrees,
  WorktreeResult,
} from "../git-worktree.js";

import {
  setupRepository,
  cloneRepository,
  getRefSha,
} from "./git-worktree.testutils.js";

// Mock @actions/core
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
}));

describe("git-worktree", () => {
  let tempDir: string;
  let remoteRepoDir: string;
  let localRepoDir: string;

  beforeEach(async () => {
    // Create a temporary directory for our tests
    tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "git-worktree-test-"),
    );
    remoteRepoDir = path.join(tempDir, "remote");
    localRepoDir = path.join(tempDir, "local");

    // Clear all mocks
    vi.clearAllMocks();

    // Setup a remote repository with commits and branches
    await setupRepository(remoteRepoDir, tempDir);
    await cloneRepository(remoteRepoDir, localRepoDir);
  });

  afterEach(async () => {
    // Clean up the temporary directory
    if (tempDir && fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe("setupWorktree", () => {
    it("should setup worktree with branch names (using merge-base)", async () => {
      const result = await setupWorktree(
        localRepoDir,
        "main",
        "feature/test-branch",
        "test-repo",
      );

      expect(result).toBeDefined();
      expect(result.headRepoPath).toBe(localRepoDir);
      expect(result.baseRepoPath).toContain("worktree-test-repo-");
      expect(fs.existsSync(result.baseRepoPath)).toBe(true);

      // Verify the head repo is on the correct branch
      const { stdout: headBranch } = await execa(
        "git",
        ["rev-parse", "--abbrev-ref", "HEAD"],
        { cwd: result.headRepoPath },
      );
      expect(headBranch.trim()).toBe("feature/test-branch");

      // Verify the base repo exists and has the merge-base (NOT the current main tip)
      const { stdout: baseSha } = await execa("git", ["rev-parse", "HEAD"], {
        cwd: result.baseRepoPath,
      });
      const { stdout: mergeBase } = await execa(
        "git",
        ["merge-base", "main", "origin/feature/test-branch"],
        { cwd: localRepoDir },
      );
      const { stdout: mainTipSha } = await execa("git", ["rev-parse", "main"], {
        cwd: localRepoDir,
      });

      expect(baseSha.trim()).toBe(mergeBase.trim());
      // The merge-base should be different from the current main tip due to divergent history
      expect(mergeBase.trim()).not.toBe(mainTipSha.trim());
    });

    it("should setup worktree with SHA refs (direct comparison)", async () => {
      const mainSha = await getRefSha(localRepoDir, "main");
      const featureSha = await getRefSha(
        localRepoDir,
        "origin/feature/test-branch",
      );

      const result = await setupWorktree(
        localRepoDir,
        mainSha,
        featureSha,
        "test-repo",
      );

      expect(result).toBeDefined();
      expect(result.headRepoPath).toBe(localRepoDir);
      expect(result.baseRepoPath).toContain("worktree-test-repo-");
      expect(fs.existsSync(result.baseRepoPath)).toBe(true);

      // Verify the head repo is on the correct SHA
      const { stdout: headSha } = await execa("git", ["rev-parse", "HEAD"], {
        cwd: result.headRepoPath,
      });
      expect(headSha.trim()).toBe(featureSha);

      // Verify the base repo is on the correct SHA
      const { stdout: baseSha } = await execa("git", ["rev-parse", "HEAD"], {
        cwd: result.baseRepoPath,
      });
      expect(baseSha.trim()).toBe(mainSha);
    });

    it("should setup worktree with mixed ref types (one SHA, one branch)", async () => {
      const mainSha = await getRefSha(localRepoDir, "main");

      const result = await setupWorktree(
        localRepoDir,
        mainSha,
        "develop",
        "test-repo",
      );

      expect(result).toBeDefined();
      expect(result.headRepoPath).toBe(localRepoDir);
      expect(result.baseRepoPath).toContain("worktree-test-repo-");
      expect(fs.existsSync(result.baseRepoPath)).toBe(true);

      // Verify the head repo is on develop branch
      const { stdout: headBranch } = await execa(
        "git",
        ["rev-parse", "--abbrev-ref", "HEAD"],
        { cwd: result.headRepoPath },
      );
      expect(headBranch.trim()).toBe("develop");

      // Verify the base repo is on the main SHA
      const { stdout: baseSha } = await execa("git", ["rev-parse", "HEAD"], {
        cwd: result.baseRepoPath,
      });
      expect(baseSha.trim()).toBe(mainSha);
    });

    it("should handle remote branch refs", async () => {
      const result = await setupWorktree(
        localRepoDir,
        "origin/main",
        "origin/feature/test-branch",
        "test-repo",
      );

      expect(result).toBeDefined();
      expect(result.headRepoPath).toBe(localRepoDir);
      expect(result.baseRepoPath).toContain("worktree-test-repo-");
      expect(fs.existsSync(result.baseRepoPath)).toBe(true);

      // Verify proper checkout of remote branch
      const { stdout: headSha } = await execa("git", ["rev-parse", "HEAD"], {
        cwd: result.headRepoPath,
      });
      const { stdout: expectedSha } = await execa(
        "git",
        ["rev-parse", "origin/feature/test-branch"],
        { cwd: localRepoDir },
      );
      expect(headSha.trim()).toBe(expectedSha.trim());
    });

    it("should skip checkout if already on the correct ref", async () => {
      // First, checkout the target branch
      await execa("git", ["checkout", "main"], { cwd: localRepoDir });

      const result = await setupWorktree(
        localRepoDir,
        "develop",
        "main",
        "test-repo",
      );

      expect(result).toBeDefined();
    });

    it("should cleanup existing worktree before creating new one", async () => {
      // Create a worktree first
      const result1 = await setupWorktree(
        localRepoDir,
        "main",
        "develop",
        "test-repo",
      );
      const worktreePath = result1.baseRepoPath;

      expect(fs.existsSync(worktreePath)).toBe(true);

      // Create another worktree that should cleanup the existing one
      const result2 = await setupWorktree(
        localRepoDir,
        "main",
        "feature/test-branch",
        "test-repo",
      );

      expect(result2.baseRepoPath).toContain("worktree-test-repo-");
      expect(fs.existsSync(result2.baseRepoPath)).toBe(true);
    });

    it("should sanitize repo name and ref for worktree path", async () => {
      const result = await setupWorktree(
        localRepoDir,
        "main",
        "feature/test-branch",
        "org/repo-name",
      );

      expect(result.baseRepoPath).toMatch(/worktree-repo-name-/);
      expect(result.baseRepoPath).not.toContain("org/");
      expect(path.basename(result.baseRepoPath)).not.toContain("/");
    });

    it("should throw error for non-existent directory", async () => {
      const nonExistentDir = path.join(tempDir, "non-existent");

      await expect(
        setupWorktree(nonExistentDir, "main", "develop", "test-repo"),
      ).rejects.toThrow("Directory does not exist");
    });

    it("should throw error for non-git directory", async () => {
      const nonGitDir = path.join(tempDir, "not-git");
      await fs.promises.mkdir(nonGitDir);

      await expect(
        setupWorktree(nonGitDir, "main", "develop", "test-repo"),
      ).rejects.toThrow("Directory is not a Git repository");
    });

    it("should throw error for non-root git directory", async () => {
      const subDir = path.join(localRepoDir, "subdir");
      await fs.promises.mkdir(subDir);

      await expect(
        setupWorktree(subDir, "main", "develop", "test-repo"),
      ).rejects.toThrow("Directory is not the root of a Git repository");
    });

    it("should throw error for invalid refs", async () => {
      await expect(
        setupWorktree(localRepoDir, "non-existent-ref", "main", "test-repo"),
      ).rejects.toThrow("Could not resolve ref: non-existent-ref");

      await expect(
        setupWorktree(localRepoDir, "main", "non-existent-ref", "test-repo"),
      ).rejects.toThrow("Could not resolve ref: non-existent-ref");
    });

    it("should handle refs that need origin/ prefix", async () => {
      // First delete the local branch to simulate a remote-only branch
      await execa("git", ["branch", "-D", "feature/test-branch"], {
        cwd: localRepoDir,
      });

      // Test with a branch that exists only on remote
      const result = await setupWorktree(
        localRepoDir,
        "main",
        "feature/test-branch",
        "test-repo",
      );

      expect(result).toBeDefined();
    });
  });

  describe("cleanupWorktrees", () => {
    it("should cleanup worktree successfully", async () => {
      const result = await setupWorktree(
        localRepoDir,
        "main",
        "develop",
        "test-repo",
      );

      expect(fs.existsSync(result.baseRepoPath)).toBe(true);

      await cleanupWorktrees(result);

      expect(fs.existsSync(result.baseRepoPath)).toBe(false);
    });

    it("should handle cleanup failure gracefully", async () => {
      const result: WorktreeResult = {
        headRepoPath: localRepoDir,
        baseRepoPath: "/non/existent/path",
      };

      // Should not throw
      await cleanupWorktrees(result);
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle worktree creation when target directory is not empty", async () => {
      const result1 = await setupWorktree(
        localRepoDir,
        "main",
        "develop",
        "test-repo",
      );

      // Create a file in the worktree directory to make it "dirty"
      await fs.promises.writeFile(
        path.join(result1.baseRepoPath, "dirty-file.txt"),
        "dirty content",
      );

      // This should still work by cleaning up the existing worktree
      const result2 = await setupWorktree(
        localRepoDir,
        "main",
        "feature/test-branch",
        "test-repo",
      );

      expect(fs.existsSync(result2.baseRepoPath)).toBe(true);
      expect(
        fs.existsSync(path.join(result2.baseRepoPath, "dirty-file.txt")),
      ).toBe(false);
    });

    it("should handle long ref names and special characters", async () => {
      // Create a branch with special characters (Git will sanitize them)
      const longBranchName = "feature/very-long-branch-name-with-special-chars";
      await execa("git", ["checkout", "-b", longBranchName], {
        cwd: localRepoDir,
      });
      await fs.promises.writeFile(
        path.join(localRepoDir, "long-branch.txt"),
        "content",
      );
      await execa("git", ["add", "long-branch.txt"], { cwd: localRepoDir });
      await execa("git", ["commit", "-m", "Long branch commit"], {
        cwd: localRepoDir,
      });

      const result = await setupWorktree(
        localRepoDir,
        "main",
        longBranchName,
        "test-repo/with-special-chars",
      );

      expect(result.baseRepoPath).toMatch(/worktree-with-special-chars-/);
      expect(fs.existsSync(result.baseRepoPath)).toBe(true);
    });

    it("should provide detailed git debug information", async () => {
      await setupWorktree(localRepoDir, "main", "develop", "test-repo");
    });

    it("should handle merge-base calculation correctly", async () => {
      // This test validates that merge-base finds the common ancestor, not the current branch tips

      // Get the merge-base between main and feature/test-branch
      const { stdout: mergeBase } = await execa(
        "git",
        ["merge-base", "main", "feature/test-branch"],
        { cwd: localRepoDir },
      );

      // Get the current tips of both branches
      const { stdout: mainTip } = await execa("git", ["rev-parse", "main"], {
        cwd: localRepoDir,
      });
      const { stdout: featureTip } = await execa(
        "git",
        ["rev-parse", "feature/test-branch"],
        { cwd: localRepoDir },
      );

      // The merge-base should be different from both branch tips (proving divergent history)
      expect(mergeBase.trim()).not.toBe(mainTip.trim());
      expect(mergeBase.trim()).not.toBe(featureTip.trim());

      // Now test that setupWorktree uses this merge-base correctly
      const result = await setupWorktree(
        localRepoDir,
        "main",
        "feature/test-branch",
        "test-repo",
      );

      // Verify the worktree is set to the merge-base, not the main tip
      const { stdout: worktreeSha } = await execa(
        "git",
        ["rev-parse", "HEAD"],
        { cwd: result.baseRepoPath },
      );
      expect(worktreeSha.trim()).toBe(mergeBase.trim());
    });

    it("should use direct comparison when one ref is a SHA (bypassing merge-base)", async () => {
      const mainSha = await getRefSha(localRepoDir, "main");
      const featureSha = await getRefSha(localRepoDir, "feature/test-branch");

      // Test with SHA as base ref - should skip merge-base logic
      const result = await setupWorktree(
        localRepoDir,
        mainSha,
        "feature/test-branch",
        "test-repo-sha",
      );

      // Verify the worktree is set to the exact SHA provided, not a merge-base
      const { stdout: worktreeSha } = await execa(
        "git",
        ["rev-parse", "HEAD"],
        { cwd: result.baseRepoPath },
      );
      expect(worktreeSha.trim()).toBe(mainSha);
    });
  });

  describe("deterministic path creation", () => {
    it("should create the same path for the same inputs", async () => {
      const result1 = await setupWorktree(
        localRepoDir,
        "main",
        "develop",
        "test-repo",
      );
      await cleanupWorktrees(result1);

      const result2 = await setupWorktree(
        localRepoDir,
        "main",
        "develop",
        "test-repo",
      );

      // The paths should be the same because they use the same inputs
      expect(result1.baseRepoPath).toBe(result2.baseRepoPath);
    });

    it("should create different paths for different refs", async () => {
      const result1 = await setupWorktree(
        localRepoDir,
        "main",
        "develop",
        "test-repo",
      );
      const result2 = await setupWorktree(
        localRepoDir,
        "main",
        "feature/test-branch",
        "test-repo-2",
      );

      expect(result1.baseRepoPath).not.toBe(result2.baseRepoPath);
    });
  });
});
