import * as core from "@actions/core";
import * as github from "@actions/github";

import {
  CreateCommitOnBranchInput,
  CreateCommitOnBranchPayload,
} from "./generated/graphql.js";

type Octokit = ReturnType<typeof github.getOctokit>;

function getOctokit(): Octokit {
  const token =
    core.getInput("github-token") || (process.env.GITHUB_TOKEN as string);
  if (!token) {
    throw new Error("No Github token found");
  }

  return github.getOctokit(token);
}

export async function getHashFile(
  owner: string,
  repo: string,
  ref: string,
  file: string,
): Promise<{ [importPath: string]: string }> {
  const octokit = getOctokit();
  const hashFile = await getFile(octokit, owner, repo, file, ref);
  if (!hashFile) {
    core.warning("No hash file found");
    return {};
  }

  return JSON.parse(hashFile);
}

async function getFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref: string,
) {
  try {
    if (path.startsWith("/")) path = path.substring(1);
    if (path.startsWith("./")) path = path.substring(2);

    if (path === "") {
      core.error("Empty path provided to github.getFile. Returning empty.");
      return;
    }

    core.info(
      `Getting file through Github - ${owner}/${repo}@${ref}, file: ${path}`,
    );

    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    if ("content" in response.data) {
      return Buffer.from(response.data.content, "base64").toString();
    }
    throw Error("No content found in getContent response");
  } catch (error: any) {
    const requestPath = `${owner}/${repo}/${path}@${ref}`;
    if (error.status) {
      core.error(
        `Encountered Github Request Error while getting file - ${requestPath}. (${error.status} - ${error.message})`,
      );
    }
    throw error;
  }
}

export async function commitTestHashIndex(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  hashes: Record<string, string>,
) {
  core.info(`Committing test hashes to ${owner}/${repo}:${branch}`);
  core.debug(`Hashes: ${JSON.stringify(hashes, null, 2)}`);

  const octokit = getOctokit();
  const contents = Buffer.from(JSON.stringify(hashes, null, 2)).toString(
    "base64",
  );

  const expectedHeadOid = await getRemoteHeadOid(octokit, {
    branch,
    owner,
    repo,
  });

  const input: CreateCommitOnBranchInput = {
    branch: {
      branchName: branch,
      repositoryNameWithOwner: `${owner}/${repo}`,
    },
    message: {
      headline: `Update ${path}`,
      body: "",
    },
    expectedHeadOid,
    fileChanges: {
      additions: [
        {
          path,
          contents,
        },
      ],
    },
  };

  const response = await createCommitOnBranch(octokit, input);
  const commitUrl: string = response?.createCommitOnBranch?.commit?.url || "";
  core.info(`Commit URL: ${commitUrl}`);
  const commit = commitUrl.split("/").pop() || "";
  return commit;
}

async function getRemoteHeadOid(
  client: Octokit,
  opts: Parameters<typeof client.rest.repos.getBranch>[0],
) {
  core.debug(
    `Getting remote head oid for ${opts?.owner}/${opts?.repo}:${opts?.branch}`,
  );
  const res = await client.rest.repos.getBranch(opts);

  return res.data.commit.sha;
}

/**
 * Sends a request to the GraphQL API to create a commit on a branch. This commit will be signed.
 * The mutation object requires the full contents of each file to be included in the commit.
 * @param octokit The Octokit client
 * @param input The input object for the create commit on branch mutation
 * @returns The response from the GraphQL API
 */
async function createCommitOnBranch(
  octokit: Octokit,
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

  const response = await octokit.graphql<{
    createCommitOnBranch: CreateCommitOnBranchPayload;
  }>(query, {
    input,
  });

  return response;
}

export async function getChangedFiles(): Promise<string[]> {
  const context = github.context;
  const eventName = context.eventName;

  if (eventName === 'schedule') {
    core.info('Scheduled event detected. Skipping changed files logic.');
    return [];
  }

  const token = core.getInput('github_token', { required: true });
  const octokit = github.getOctokit(token);
  const { owner, repo } = context.repo;

  switch (eventName) {
    case 'pull_request':
      if (!context.payload.pull_request?.number) {
        throw new Error(`Malformed event context? No PR number found for event ${eventName}. Can't properly evaluate changed files.`);
      }
      const prNumber = context.payload.pull_request.number;
      return await getChangedFilesFromPullRequest(octokit, owner, repo, prNumber);

    case 'push':
      const beforeSha = context.payload.before;
      const afterSha = context.payload.after;
      if (beforeSha && afterSha) {
        return await getChangedFilesBetweenCommits(octokit, owner, repo, beforeSha, afterSha);
      }
      throw new Error(`Malformed event context? Can't properly evaluate changed files for event ${eventName}.`);

    case 'merge_group':
      const baseSha = context.payload.merge_group?.base_sha;
      const headSha = context.payload.merge_group?.head_sha;
      if (baseSha && headSha) {
        return await getChangedFilesBetweenCommits(octokit, owner, repo, baseSha, headSha);
      }
      throw new Error(`Malformed event context? Can't properly evaluate changed files for event ${eventName}.`);

    default:
      core.info(`Unhandled event type: ${eventName}`);
      return [];
  }
}

async function getChangedFilesFromPullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<string[]> {
  const perPage = 100;
  let page = 1;
  let files: string[] = [];
  let response;

  do {
    response = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
      per_page: perPage,
      page,
    });

    files = files.concat(response.data.map((file) => file.filename));
    page++;
  } while (response.data.length === perPage);

  return files;
}

async function getChangedFilesBetweenCommits(
  octokit: Octokit,
  owner: string,
  repo: string,
  baseSha: string,
  headSha: string
): Promise<string[]> {
  const response = await octokit.rest.repos.compareCommitsWithBasehead({
    owner,
    repo,
    basehead: `${baseSha}...${headSha}`,
  });

  return response.data.files?.map((file) => file.filename) || [];
}
