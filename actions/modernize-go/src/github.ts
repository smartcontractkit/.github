import * as core from "@actions/core";
import * as github from "@actions/github";

import { GetResponseTypeFromEndpointMethod } from "@octokit/types";

export type OctokitType = ReturnType<typeof github.getOctokit>;

export type PRReviewComment = NonNullable<
  NonNullable<
    Parameters<OctokitType["rest"]["pulls"]["createReview"]>[0]
  >["comments"]
>[0];

type ListFilesResponse = GetResponseTypeFromEndpointMethod<
  OctokitType["rest"]["pulls"]["listFiles"]
>;
export type PRFiles = ListFilesResponse["data"];

// docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28#list-pull-requests-files
export async function getChangedFilesForPR(
  octokit: OctokitType,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PRFiles> {
  core.debug(`Comparing ${owner}/${repo} for PR ${prNumber}`);

  const prFiles = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  return prFiles;
}

/**
 * Posts one or more PR reviews containing inline suggestion comments.
 * Batches to avoid API limits.
 */
export async function postSuggestionReview(
  octokit: OctokitType,
  owner: string,
  repo: string,
  prNumber: number,
  headSha: string,
  comments: PRReviewComment[],
): Promise<void> {
  if (!comments.length) {
    core.info("No suggestion comments to post.");
    return;
  }

  core.startGroup(
    `Posting ${comments.length} suggestion comment(s) to PR #${prNumber}`,
  );
  for (let i = 0; i < comments.length; i += batchSize) {
    const chunk = comments.slice(i, i + batchSize);

    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      commit_id: headSha,
      event: "COMMENT",
      body: i === 0 ? reviewBody : undefined, // body only on first review (optional)
      comments: chunk.map((c) => ({
        path: c.path,
        body: c.body,
        // For multi-line replacements provide both start_line and line
        // For single-line replacements, GitHub accepts just `line`
        ...(c.start_line && c.start_line !== c.line
          ? {
              start_line: c.start_line,
              line: c.line,
              side: "RIGHT" as const,
              start_side: "RIGHT" as const,
            }
          : { line: c.line ?? c.start_line!, side: "RIGHT" as const }),
      })),
    });
  }
  core.endGroup();
}
