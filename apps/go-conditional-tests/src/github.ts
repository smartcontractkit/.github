import * as core from "@actions/core";
import * as github from "@actions/github";
import * as cache from "@actions/cache";
import * as fs from "fs";
import * as path from "path";

function getCacheKey(testSuite: string, branch: string, commitSha?: string) {
  const key = `go-test-hashes-${testSuite}-${branch}`;
  return commitSha ? `${key}-${commitSha.substring(0, 7)}` : key;
}

function getRestoreKeys(
  testSuite: string,
  branch: string,
  targetBranch?: string,
) {
  // Order of precedence:
  // 1. Exact match for current branch
  // 2. Any match for current branch (most recent first)
  // 3. Any match for target branch (most recent first) - PRs only
  // 4. Any match for default branch (most recent first)
  const keys = [`go-test-hashes-${testSuite}-${branch}`];

  if (targetBranch) {
    keys.push(`go-test-hashes-${testSuite}-${targetBranch}`);
  }

  if (github.context.payload.repository?.default_branch) {
    keys.push(
      `go-test-hashes-${testSuite}-${github.context.payload.repository.default_branch}`,
    );
  }

  return keys;
}

function getCacheKeyInfo() {
  let branch = github.context.ref.replace("refs/heads/", "");
  let sha = github.context.sha;
  if (github.context.payload.pull_request) {
    const targetBranch = github.context.payload.pull_request?.base
      .ref as string;
    branch = github.context.payload.pull_request.head.ref;
    sha = github.context.payload.pull_request.head.sha;

    return { branch, sha, targetBranch };
  }

  return { branch, sha };
}

export async function getTestHashIndex(
  testSuite: string,
): Promise<{ [importPath: string]: string }> {
  const hashFile = `${testSuite}.json`;
  const { branch, targetBranch } = getCacheKeyInfo();

  const primaryKey = getCacheKey(testSuite, branch);
  const restoreKeys = getRestoreKeys(testSuite, branch, targetBranch);

  const hitKey = await cache.restoreCache([hashFile], primaryKey, restoreKeys);
  if (!hitKey) {
    core.info("No cache hit. Primary key: " + primaryKey);
    core.info("Restore keys: " + restoreKeys.join(", "));
    return {};
  }

  core.info(`Cache hit: ${hitKey}`);
  try {
    const content = await fs.promises.readFile(hashFile, "utf8");
    return JSON.parse(content);
  } catch (error) {
    core.warning(`Error reading cache file: ${error}`);
    return {};
  }
}

export async function saveTestHashIndex(
  testSuite: string,
  hashes: Record<string, string>,
): Promise<void> {
  const hashFile = `${testSuite}.json`;
  const { branch, sha } = getCacheKeyInfo();

  await fs.promises.writeFile(hashFile, JSON.stringify(hashes, null, 2));

  // Use short SHA of current commit to force a new cache entry
  const key = getCacheKey(testSuite, branch, sha);

  core.info(`Saving test hashes to cache. Key: ${key}`);
  try {
    await cache.saveCache([hashFile], key);
  } catch (error) {
    if (error instanceof cache.ReserveCacheError) {
      core.info("Cache already reserved or being saved by another job");
    } else {
      throw error;
    }
  }
}
