import {
  calculateAdditionsAndDeletions,
  calculateFileChanges,
  getGitStatusPorcelainV1,
  listChanges,
} from "./repo-status";
import { execSync } from "child_process";
import * as fs from "fs";
import * as core from "@actions/core";
import { createRepo } from "./utils.testutils";

import { describe, it, expect, vi } from "vitest";

vi.mock("@actions/core", () => ({
  warning: vi.fn(),
}));

describe("repo-status", () => {
  describe("getGitStatusPorcelainV1", () => {
    it("should return the correct status", async () => {
      const repoPath = await createCommitTestRepo("getGitStatusPorcelainV1");
      const stdout = await getGitStatusPorcelainV1(repoPath);

      expect(stdout).toMatchInlineSnapshot(`
      " M file1.txt\0 D file2.txt\0R  file3renamed.txt\0file3.txt\0 T file4.txt\0A  file5.txt\0?? untracked.txt\0"
    `);
    });
  });

  describe("listChanges", () => {
    it("should return the correct additions and deletions", async () => {
      const repoPath = await createCommitTestRepo("listChanges");
      const stdout = await getGitStatusPorcelainV1(repoPath);
      const changes = listChanges(stdout);

      expect(changes).toMatchInlineSnapshot(`
      [
        {
          "filePath": "file1.txt",
          "indexStatus": " ",
          "workingTreeStatus": "M",
        },
        {
          "filePath": "file2.txt",
          "indexStatus": " ",
          "workingTreeStatus": "D",
        },
        {
          "filePath": "file3.txt -> file3renamed.txt",
          "indexStatus": "R",
          "workingTreeStatus": " ",
        },
        {
          "filePath": "file4.txt",
          "indexStatus": " ",
          "workingTreeStatus": "T",
        },
        {
          "filePath": "file5.txt",
          "indexStatus": "A",
          "workingTreeStatus": " ",
        },
        {
          "filePath": "untracked.txt",
          "indexStatus": "?",
          "workingTreeStatus": "?",
        },
      ]
    `);
    });
  });
  describe("calculateAdditionsAndDeletions", () => {
    it("should return the correct additions and deletions", async () => {
      const repoPath = await createCommitTestRepo("listChanges");
      const stdout = await getGitStatusPorcelainV1(repoPath);
      const changes = listChanges(stdout);
      const { additions, deletions } = calculateAdditionsAndDeletions(changes);

      expect(additions).toMatchInlineSnapshot(`
      [
        "file1.txt",
        "file3renamed.txt",
        "file4.txt",
        "file5.txt",
        "untracked.txt",
      ]
    `);
      expect(deletions).toMatchInlineSnapshot(`
      [
        "file2.txt",
        "file3.txt",
      ]
    `);
    });
  });
  describe("calculateFileChanges", () => {
    it("should skip unreadable paths with a warning", async () => {
      const repoPath = await createCommitTestRepo("calculateFileChanges");
      fs.mkdirSync(`${repoPath}/some-dir`);

      const fileChanges = await calculateFileChanges(
        {
          additions: ["file1.txt", "some-dir", "missing.txt"],
          deletions: ["file2.txt"],
        },
        repoPath,
      );

      expect(fileChanges.additions).toHaveLength(1);
      expect(fileChanges.additions![0].path).toEqual("file1.txt");
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining("some-dir"),
      );
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining("missing.txt"),
      );
      expect(fileChanges.deletions).toEqual([{ path: "file2.txt" }]);
    });
  });

  describe("paths with spaces and special characters", () => {
    // Regression test: the line-based porcelain format C-quotes these paths
    // (e.g. `?? "new dir/untracked file.txt"`), and the quoted strings failed
    // readFileSync. The -z format emits them raw and NUL-delimited.
    it("parses them unquoted and commits their contents", async () => {
      vi.mocked(core.warning).mockClear();

      const repoPath = await createSpecialPathsTestRepo("special-paths");
      const stdout = await getGitStatusPorcelainV1(repoPath);
      const changes = listChanges(stdout);
      const { additions, deletions } = calculateAdditionsAndDeletions(changes);
      const fileChanges = await calculateFileChanges(
        { additions, deletions },
        repoPath,
      );

      // rename: old path deleted, new path added — both with spaces in them
      expect(deletions).toContain("new dir/old file.txt");
      expect(additions).toContain("renamed dir/new name.txt");

      // untracked paths with a space and a double quote, parsed unquoted
      expect(additions).toContain("new dir/untracked file.txt");
      expect(additions).toContain('quote"name.txt');

      // every addition is a real, readable file — none skipped, no warnings
      expect(fileChanges.additions).toHaveLength(additions.length);
      expect(core.warning).not.toHaveBeenCalled();
    });
  });
});

async function createCommitTestRepo(name: string): Promise<string> {
  const repoPath = await createRepo(name);

  // Create initial files and commit
  fs.writeFileSync(`${repoPath}/file1.txt`, "Initial content");
  fs.writeFileSync(`${repoPath}/file2.txt`, "Initial content");
  fs.writeFileSync(`${repoPath}/file4.txt`, "This file will be a symlink");

  execSync(`cd ${repoPath} && git add . && git commit -m "Initial commit"`);

  // Modify a file
  fs.writeFileSync(`${repoPath}/file1.txt`, "Modified content");

  // Delete a file
  fs.unlinkSync(`${repoPath}/file2.txt`);

  // Rename a file
  fs.writeFileSync(`${repoPath}/file3.txt`, "New file");
  execSync(
    `cd ${repoPath} && git add file3.txt && git commit -m "Add file3.txt"`,
  );
  execSync(`cd ${repoPath} && git mv file3.txt file3renamed.txt`);

  // Add a file
  fs.writeFileSync(`${repoPath}/file5.txt`, "This file will be added");
  execSync(`cd ${repoPath} && git add file5.txt`);

  // Create an untracked file
  fs.writeFileSync(`${repoPath}/untracked.txt`, "Untracked file");

  // Change the type of a file (e.g., from a regular file to a symlink)
  fs.unlinkSync(`${repoPath}/file4.txt`);
  fs.symlinkSync(`${repoPath}/file1.txt`, `${repoPath}/file4.txt`);

  return repoPath;
}

async function createSpecialPathsTestRepo(name: string): Promise<string> {
  const repoPath = await createRepo(name);

  fs.mkdirSync(`${repoPath}/new dir`);
  fs.writeFileSync(`${repoPath}/new dir/old file.txt`, "Old content");
  execSync(`cd ${repoPath} && git add . && git commit -m "Initial commit"`);
  execSync(
    `cd ${repoPath} && mkdir -p "renamed dir" && git mv "new dir/old file.txt" "renamed dir/new name.txt"`,
  );

  // untracked paths whose names trigger C-quoting in the line-based format
  fs.writeFileSync(`${repoPath}/new dir/untracked file.txt`, "Untracked");
  fs.writeFileSync(`${repoPath}/quote"name.txt`, "Quoted name");

  return repoPath;
}
