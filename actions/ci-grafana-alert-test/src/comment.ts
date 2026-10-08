import * as core from "@actions/core";
import type * as github from "@actions/github";

export const SUMMARY_COMMENT_MARKER = "<!-- ci-grafana-alert-test:summary -->";

// GitHub rejects comment bodies above 65536 characters; leave room for the
// marker and truncation note.
const MAX_COMMENT_LENGTH = 60_000;

export type Octokit = ReturnType<typeof github.getOctokit>;

function withMarker(body: string): string {
  const truncated =
    body.length > MAX_COMMENT_LENGTH
      ? `${body.slice(0, MAX_COMMENT_LENGTH)}\n\n(summary truncated — see the step summary for the full table)`
      : body;
  return `${truncated}\n\n${SUMMARY_COMMENT_MARKER}`;
}

export async function findPullRequestNumber(
  octokit: Octokit,
  owner: string,
  repo: string,
  sha: string,
): Promise<number | undefined> {
  const pullRequests = await octokit.paginate(
    octokit.rest.repos.listPullRequestsAssociatedWithCommit,
    { owner, repo, commit_sha: sha, per_page: 100 },
  );
  return pullRequests.find(
    (pullRequest) =>
      pullRequest.state === "open" && pullRequest.head.sha === sha,
  )?.number;
}

export async function upsertSummaryComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
): Promise<void> {
  try {
    const comments = await octokit.paginate(octokit.rest.issues.listComments, {
      owner,
      repo,
      issue_number: prNumber,
      per_page: 100,
    });
    const existing = comments.find((comment) =>
      comment.body?.includes(SUMMARY_COMMENT_MARKER),
    );
    const marked = withMarker(body);

    if (existing) {
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existing.id,
        body: marked,
      });
    } else {
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: marked,
      });
    }
  } catch (error) {
    core.warning(`Failed to upsert the PR summary comment: ${String(error)}`);
  }
}
