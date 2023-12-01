import {
  calculateAdditionsAndDeletions,
  getGitStatusPorcelainV1,
  listChanges,
} from "./repo-status";
import { execSync } from "child_process";
import * as fs from "fs";
import { createRepo } from "./utilts.testutils";

describe("repo-status", () => {
  describe("getGitStatusPorcelainV1", () => {
    it("should return the correct status", async () => {
      const repoPath = await createCommitTestRepo("getGitStatusPorcelainV1");
      const stdout = await getGitStatusPorcelainV1(repoPath);

      expect(stdout).toMatchInlineSnapshot(`
      " M file1.txt
       D file2.txt
      R  file3.txt -> file3renamed.txt
       T file4.txt
      A  file5.txt
      ?? untracked.txt
      "
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
    `cd ${repoPath} && git add file3.txt && git commit -m "Add file3.txt"`
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
