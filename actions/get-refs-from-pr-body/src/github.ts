import * as core from "@actions/core";
import * as github from "@actions/github";

export type OctokitType = ReturnType<typeof github.getOctokit>;

export async function getPullRequestBody(
  octokit: OctokitType,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<string> {
  core.info(`Fetching PR #${prNumber} from ${owner}/${repo}`);
  const pr = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });
  return pr.data.body ?? "";
}

export async function resolveRefToSha(
  octokit: OctokitType,
  owner: string,
  repo: string,
  ref: string,
): Promise<string> {
  core.info(`Resolving ref ${ref} to a SHA in ${owner}/${repo}`);
  try {
    const commit = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref,
    });
    core.info(`Resolved ${owner}/${repo}@${ref} → ${commit.data.sha}`);
    return commit.data.sha;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to resolve ref '${ref}' in ${owner}/${repo}: ${message}`,
    );
  }
}
