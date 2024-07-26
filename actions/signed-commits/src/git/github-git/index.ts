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
 * pull down the updated HEAD from the remote after creating the commit. This means that
 * locally, the HEAD will still contain the old commit, and the non-committed changes.
 *
 */
export async function commitAll(
  client: ReturnType<typeof getOctokit>,
  branch: string,
  owner: string,
  repo: string,
  message: string,
  cwd?: string,
) {
  core.debug(`Committing all changes in ${cwd} to ${owner}/${repo}:${branch}`);

  const fileChanges = await repoStatus.getFileChanges(cwd);
  if (!fileChanges.additions || fileChanges.additions.length === 0) {
    return;
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

  let expectedHeadOid = await getRemoteHeadOid(client, {
    branch,
    owner,
    repo,
  });
  let commitNumber = 1;
  const entries = Object.entries(fileAdditionsByPath);
  core.info(`Creating ${entries.length} commits.`);
  for (const [path, fileAdditions] of entries) {
    core.debug(`Commit ${commitNumber++}/${entries.length} - ${path}`);
    const input: CreateCommitOnBranchInput = {
      branch: {
        branchName: branch,
        repositoryNameWithOwner: `${owner}/${repo}`,
      },
      message: {
        headline: message + ` (${path})`,
        body: "",
      },
      expectedHeadOid: expectedHeadOid,
      fileChanges: { additions: fileAdditions },
    };

    const response = await createCommitOnBranch(client, input);

    const commitUrl = response?.createCommitOnBranch?.commit?.url || "";
    if (!commitUrl) {
      throw new Error("Cannot extract commit from GraphQL response, aborting.");
    }
    expectedHeadOid = commitUrl.split("/").pop();
  }
}

export async function createCommitOnBranch(
  client: ReturnType<typeof getOctokit>,
  input: CreateCommitOnBranchInput,
) {
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
  core.debug(
    `Getting remote head oid for ${opts?.owner}/${opts?.repo}:${opts?.branch}`,
  );
  const res = await client.rest.repos.getBranch(opts);

  return res.data.commit.sha;
}
