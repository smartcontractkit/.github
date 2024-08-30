import { getOctokit } from "@actions/github";
import * as core from "@actions/core";
import { dirname } from "path";
import {
  CreateCommitOnBranchInput,
  CreateCommitOnBranchPayload,
  FileAddition,
} from "../../generated/graphql";

import * as repoStatus from "./repo-status";
export { pushTags } from "./repo-tags";

/**
 * Note that this diverges from the original implementation in that it does not
 * pull down the updated HEAD from the remote after creating the commits. This means that
 * locally, the HEAD will still contain the old commit, and the non-committed changes.
 */
export async function commitAll(
  client: ReturnType<typeof getOctokit>,
  branch: string,
  owner: string,
  repo: string,
  message: string,
  cwd?: string,
) {
  console.log(`Committing all changes in ${cwd} to ${owner}/${repo}:${branch}`);
  core.debug(`Committing all changes in ${cwd} to ${owner}/${repo}:${branch}`);

  const fileChanges = await repoStatus.getFileChanges(cwd);
  const commits = compileCommits(fileChanges, message);

  if (commits.length === 0) {
    console.log("No changes to commit. Skipping.");
    core.info("No changes to commit. Skipping.");
  }

  let expectedHeadOid = await getRemoteHeadOid(client, {
    branch,
    owner,
    repo,
  });

  let commitNumber = 1;
  console.log(`Creating ${commits.length} commits.`);
  core.info(`Creating ${commits.length} commits.`);
  for (const commit of commits) {
    console.log(`Commit ${commitNumber++}/${commits.length} - ${commit.message}`);
    core.debug(
      `Commit ${commitNumber++}/${commits.length} - ${commit.message}`,
    );
    const input = {
      branch: {
        branchName: branch,
        repositoryNameWithOwner: `${owner}/${repo}`,
      },
      message: {
        headline: commit.message,
        body: "",
      },
      expectedHeadOid,
      fileChanges: commit.fileChanges,
    };
    const response = await createCommitOnBranch(client, input);
    expectedHeadOid = getRemoteHeadOidFromResponseOrThrow(response);
  }
}

/**
 * Sends a request to the GraphQL API to create a commit on a branch. This commit will be signed.
 * The mutation object requires the full contents of each file to be included in the commit.
 * @param client The Octokit client
 * @param input The input object for the create commit on branch mutation
 * @returns The response from the GraphQL API
 */
export async function createCommitOnBranch(
  client: ReturnType<typeof getOctokit>,
  input: CreateCommitOnBranchInput,
) {
  console.log(`Creating commit on branch ${input.branch.branchName}`);
  core.debug(`Creating commit on branch ${input.branch.branchName}`);
  const query = `
    mutation($input: CreateCommitOnBranchInput!) {
      createCommitOnBranch(input: $input) {
        commit {
          url
        }
      }
    }
  `;
  try {
    const response = await client.graphql<{
      createCommitOnBranch: CreateCommitOnBranchPayload;
    }>(query, {
      input,
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function getRemoteHeadOid(
  client: ReturnType<typeof getOctokit>,
  opts: Parameters<typeof client.rest.repos.getBranch>[0],
) {
  console.log(`Getting remote head oid for ${opts?.owner}/${opts?.repo}:${opts?.branch}`);
  core.debug(
    `Getting remote head oid for ${opts?.owner}/${opts?.repo}:${opts?.branch}`,
  );
  const res = await client.rest.repos.getBranch(opts);

  return res.data.commit.sha;
}

/**
 * Takes in the list of file changes and logically separates the commits by deletions, and additions by directory.
 * This pre-processes the changes into smaller commits so the GraphQL API requests are small enough to not create server errors.
 * @param fileChanges The list of file changes
 * @param message The base commit message to use for each commit
 * @returns An array of commits to be made
 */
function compileCommits(
  fileChanges: Awaited<ReturnType<typeof repoStatus.getFileChanges>>,
  message: string,
) {
  const commitFileChanges = [];

  const deletions = fileChanges.deletions;
  if (fileChanges.deletions && fileChanges.deletions.length > 0) {
    const fileChanges = {
      message: message + ` (deletions)`,
      fileChanges: { deletions },
    };
    commitFileChanges.push(fileChanges);
  }

  if (!fileChanges.additions || fileChanges.additions.length === 0) {
    return commitFileChanges;
  }

  const fileAdditionsByPath: Record<string, FileAddition[]> =
    fileChanges.additions.reduce(
      (acc, file) => {
        const dir = dirname(file.path);
        if (!acc[dir]) acc[dir] = [];
        acc[dir].push(file);
        return acc;
      },
      {} as Record<string, FileAddition[]>,
    );

  const entries = Object.entries(fileAdditionsByPath);
  for (const [path, additions] of entries) {
    const input = {
      message: message + ` (${path})`,
      fileChanges: { additions },
    };
    commitFileChanges.push(input);
  }

  return commitFileChanges;
}

/**
 * Extracts the head OID from the GraphQL response or throws an error if it cannot be found.
 * @param response The GraphQL response
 * @returns The head OID
 */
function getRemoteHeadOidFromResponseOrThrow(
  response: Awaited<ReturnType<typeof createCommitOnBranch>>,
): string {
  const commitUrl = response?.createCommitOnBranch?.commit?.url || "";
  if (!commitUrl) {
    console.log(response);
    throw new Error(`Cannot extract commit from GraphQL response, aborting.`);
  }
  return commitUrl.split("/").pop();
}
