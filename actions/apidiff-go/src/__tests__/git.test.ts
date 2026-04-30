import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execa } from "execa";

import {
  validateGitRepositoryRoot,
  resolveRef,
  checkoutRef,
  getRepoTags,
  findMergeBase,
} from "../git.js";

import {
  setupRepository,
  cloneRepository,
  getRefSha,
} from "./git.testutils.js";

vi.mock("@actions/core", () => ({
  startGroup: vi.fn(),
  endGroup: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
}));

describe("git utilities", () => {
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

  describe("validateGitRepositoryRoot", () => {
    it("should validate the root of a Git repository", async () => {
      await expect(
        validateGitRepositoryRoot(localRepoDir),
      ).resolves.toBeUndefined();
    });

    it("should throw an error for a non-existent directory", async () => {
      const nonExistentDir = path.join(tempDir, "non-existent");
      await expect(validateGitRepositoryRoot(nonExistentDir)).rejects.toThrow(
        `Directory does not exist: ${nonExistentDir}`,
      );
    });

    it("should throw an error for a non-Git directory", async () => {
      const nonGitDir = path.join(tempDir, "non-git");
      await fs.promises.mkdir(nonGitDir);
      await expect(validateGitRepositoryRoot(nonGitDir)).rejects.toThrow(
        `Directory is not a Git repository: ${nonGitDir}`,
      );
    });
  });

  describe("resolveRef", () => {
    it("should resolve a branch name to a commit SHA", async () => {
      const sha = await resolveRef(localRepoDir, "main");
      const expectedSha = await getRefSha(remoteRepoDir, "main");
      expect(sha).toBe(expectedSha);
    });

    it("should resolve a lightweight tag to a commit SHA", async () => {
      const sha = await resolveRef(localRepoDir, "lightweight-tag");
      const expectedSha = await getRefSha(remoteRepoDir, "lightweight-tag");
      expect(sha).toBe(expectedSha);
    });

    it("should resolve an annotated tag to a commit SHA", async () => {
      const sha = await resolveRef(localRepoDir, "annotated-tag");
      const expectedSha = await getRefSha(
        remoteRepoDir,
        "refs/tags/annotated-tag^{commit}",
      );
      expect(sha).toBe(expectedSha);
    });

    it("should throw an error for an invalid ref", async () => {
      await expect(
        resolveRef(localRepoDir, "non-existent-ref"),
      ).rejects.toThrow(
        `Could not resolve ref 'non-existent-ref' to a commit. Tried: non-existent-ref, origin/non-existent-ref, refs/tags/non-existent-ref, refs/heads/non-existent-ref`,
      );
    });
  });

  describe("getRepoTags", () => {
    it("should retrieve all tags from the repository", async () => {
      const tags = await getRepoTags(localRepoDir);
      expect(tags).toContain("lightweight-tag");
      expect(tags).toContain("annotated-tag");
    });
  });

  describe("findMergeBase", () => {
    it("should find the common ancestor of two divergent branches", async () => {
      // feature/test-branch diverged from main after "Common commit 1"
      // main has since advanced with "Common commit 2", "Advance main - commit 1", etc.
      const featureSha = await getRefSha(localRepoDir, "feature/test-branch");
      const mainSha = await getRefSha(localRepoDir, "main");

      const mergeBase = await findMergeBase(localRepoDir, featureSha, mainSha);

      // The merge base should not be the HEAD of main
      expect(mergeBase).not.toBe(mainSha);
      // The merge base should be an ancestor of both branches
      const { stdout: isAncestorOfMain } = await execa(
        "git",
        ["merge-base", "--is-ancestor", mergeBase, mainSha],
        { cwd: localRepoDir, reject: false },
      );
      const { stdout: isAncestorOfFeature } = await execa(
        "git",
        ["merge-base", "--is-ancestor", mergeBase, featureSha],
        { cwd: localRepoDir, reject: false },
      );
      expect(isAncestorOfMain).toBe("");
      expect(isAncestorOfFeature).toBe("");
    });

    it("should return the commit itself when comparing a branch to itself", async () => {
      const mainSha = await getRefSha(localRepoDir, "main");
      const mergeBase = await findMergeBase(localRepoDir, mainSha, mainSha);
      expect(mergeBase).toBe(mainSha);
    });

    it("should throw an error for invalid refs", async () => {
      await expect(
        findMergeBase(localRepoDir, "nonexistent1", "nonexistent2"),
      ).rejects.toThrow();
    });
  });

  describe("checkoutRef", () => {
    it("should checkout a branch", async () => {
      const branch = "feature/test-branch";

      const { stdout: branchSha } = await execa(
        "git",
        ["rev-parse", "--verify", branch],
        {
          cwd: localRepoDir,
        },
      );
      await checkoutRef(localRepoDir, "feature/test-branch");

      const { stdout: headSha } = await execa(
        "git",
        ["rev-parse", "--verify", "HEAD"],
        {
          cwd: localRepoDir,
        },
      );

      expect(headSha.trim()).toBe(branchSha.trim());
    });

    it("should checkout a tag", async () => {
      await checkoutRef(localRepoDir, "lightweight-tag");
      const { stdout } = await execa(
        "git",
        ["rev-parse", "--abbrev-ref", "HEAD"],
        {
          cwd: localRepoDir,
        },
      );
      expect(stdout.trim()).toBe("HEAD");
    });
  });
});
