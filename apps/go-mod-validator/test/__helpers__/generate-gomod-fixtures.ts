/**
 * Script: Go Module Copier and Checkout Helper
 *
 * This script is designed to facilitate working with Git repositories containing Go modules.
 * It automates the following tasks:
 *
 * - Takes a directory (dirToGlob) as input, assumed to be the root of a Go project under Git version control.
 * - Optionally checks out a specific commit SHA if provided, ensuring the repository is clean before switching branches.
 * - Identifies all `go.mod` files and their corresponding `go.sum` files within the specified directory.
 * - Copies the `go.mod` and `go.sum` files to a designated fixtures directory, organizing them by repository name and commit SHA.
 * - Reverts to the original commit SHA after the copy operation is completed.
 *
 * Usage:
 * - The script takes two arguments:
 *   1. `dirToGlob`: The directory to search for Go module files.
 *   2. `commitSha`: (Optional) The commit SHA to checkout before processing.
 *
 * Example:
 *    pnpm fixtures:gomods <dirToGlob> <commitSha>
 *
 * Notes:
 * - Ensure the directory provided is the root of a valid Go project under Git.
 * - The repository must be clean before switching commits.
 */

import { getAllGoModsWithin } from "../../src/deps";
import { ensureFileSync, readFileSync, writeFileSync } from "fs-extra";
import path from "path";
import simpleGit from "simple-git";

async function main() {
  const commitSha = process.argv[3];
  const fixtures = path.join(__dirname, "../__fixtures__");
  const dirToGlob = process.argv[2];
  if (!dirToGlob) {
    throw new Error("Please provide a directory to glob");
  }

  // Assuming that the dirToGlob is the root of the go project, and is a git repo
  // this is the name of the git repo
  const repoName = dirToGlob.split(path.sep).pop();
  if (!repoName) {
    throw new Error("Could not determine the repo name");
  }

  const git = simpleGit(dirToGlob);
  const originalCommitSha = await git.revparse(["HEAD"]);
  if (commitSha) {
    console.log(
      `Commit sha provided for repo ${repoName}, checking out ${commitSha}`,
    );
    const status = await git.status();
    if (!status.isClean()) {
      throw new Error(
        "Failed checkout, please ensure that the repo is clean before running this script",
      );
    }
    await git.checkout(commitSha);
  } else {
    console.log(
      `No commit sha provided for repo ${repoName}, using: ${originalCommitSha}`,
    );
  }

  try {
    await copyGoModAndGoSumFiles(dirToGlob, fixtures, repoName, commitSha);
  } catch (e) {
    console.error(e);
  }

  // We want to checkout the original commit sha before exiting
  if (commitSha) {
    console.log("Checking out original commit sha", originalCommitSha);
    await git.checkout(originalCommitSha);
  }
}
main();
async function copyGoModAndGoSumFiles(
  dirToGlob: string,
  fixtures: string,
  repoName: string,
  commitSha: string,
) {
  console.log("Finding go.mod files in", dirToGlob);
  const goModFiles = await getAllGoModsWithin(dirToGlob);
  console.log("\n");
  goModFiles.forEach((goMod) => {
    // Assuming that dirToGlob is /foo/bar/chainlink
    // /foo/bar/chainlink/charts/chainlink-cluster/go.mod
    // /foo/bar/chainlink/charts/chainlink-cluster/go.sum
    const goSumFile = goMod.replace(".mod", ".sum");
    const goModContent = readFileSync(goMod, "utf-8");
    const goSumContent = readFileSync(goSumFile, "utf-8");

    // chainlink/charts/chainlink-cluster/go.mod
    const goModRelPath = goMod.replace(dirToGlob, "");
    // chainlink/charts/chainlink-cluster/go.sum
    const goSumRelPath = goSumFile.replace(dirToGlob, "");

    // Assuming that commitSha is 29117850e9be1be1993dbf8f21cf13cbb6af9d24
    // /foo/bar/.github/apps/go-mod-validator/test/__fixtures__/chainlink/29117850e9be1be1993dbf8f21cf13cbb6af9d24/charts/chainlink-cluster/go.mod
    const goModFixturePath = path.join(
      fixtures,
      repoName,
      commitSha,
      goModRelPath,
    );
    // /foo/bar/.github/apps/go-mod-validator/test/__fixtures__/chainlink/29117850e9be1be1993dbf8f21cf13cbb6af9d24/charts/chainlink-cluster/go.sum
    const goSumFixturePath = path.join(
      fixtures,
      repoName,
      commitSha,
      goSumRelPath,
    );

    ensureFileSync(goModFixturePath);
    ensureFileSync(goSumFixturePath);

    console.log("Copying", goMod, "to", goModFixturePath);
    writeFileSync(goModFixturePath, goModContent);
    console.log("Copying", goSumFile, "to", goSumFixturePath);
    writeFileSync(goSumFixturePath, goSumContent);
    console.log("\n");
  });
}
