import { getOctokit } from "@actions/github";
import {
  CreateCommitOnBranchInput,
  CreateCommitOnBranchPayload,
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
  const input: CreateCommitOnBranchInput = {
    branch: {
      branchName: branch,
      repositoryNameWithOwner: `${owner}/${repo}`,
    },
    message: {
      headline: message,
      body: "",
    },
    expectedHeadOid: await getRemoteHeadOid(client, {
      branch,
      owner,
      repo,
    }),
    fileChanges: await repoStatus.getFileChanges(cwd),
  };

  await createCommitOnBranch(client, input);
}

export async function createCommitOnBranch(
  client: ReturnType<typeof getOctokit>,
  input: CreateCommitOnBranchInput,
) {
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
  const res = await client.rest.repos.getBranch(opts);

  return res.data.commit.sha;
}
