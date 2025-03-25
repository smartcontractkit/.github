import { execSync } from "child_process";
import { execWithOutput } from "../../utils";
import * as fs from "fs";

export async function createRepo(name: string) {
  // create 8 byte random string
  const randomString = Math.random().toString(36).substring(2, 10);
  const repoPath = `/tmp/${name}-test-repo-${randomString}`;
  if (fs.existsSync(repoPath)) {
    throw new Error("Test repository already exists");
  }

  // Create the repository
  execSync(`mkdir ${repoPath}`);
  execSync(`cd ${repoPath} && git init`);

  await execWithOutput("git", ["config", "--local", "user.name", `test-user`], {
    cwd: repoPath,
  });
  await execWithOutput(
    "git",
    ["config", "--local", "user.email", `test-user@testuser.com`],
    { cwd: repoPath },
  );

  // disable signing
  await execWithOutput(
    "git",
    ["config", "--local", "commit.gpgsign", "false"],
    { cwd: repoPath },
  );

  // create readme and commit
  fs.writeFileSync(`${repoPath}/README.md`, "README");
  execSync(`cd ${repoPath} && git add . && git commit -m "Initial commit"`);

  fs.writeFileSync(`${repoPath}/README.md`, "README\nEDIT");
  execSync(`cd ${repoPath} && git add . && git commit -m "Secondary Commit"`);

  return repoPath;
}

export async function createCommit(repoPath: string) {
  const uuid = Math.random().toString(36).substring(2, 10);
  fs.writeFileSync(`${repoPath}/README.md`, "README\nEDIT\n" + uuid);
  execSync(
    `cd ${repoPath} && git add . && git commit -m "new commit - ${uuid}"`,
  );
}
