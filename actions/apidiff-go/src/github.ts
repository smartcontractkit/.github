import * as core from "@actions/core";
import * as github from "@actions/github";

const MARKDOWN_FINGERPRINT = "<!-- chainlink-apidiff-go -->";

export async function upsertPRComment(
  token: string,
  owner: string,
  repo: string,
  pull_number: number,
  commentBody: string,
): Promise<void> {
  const octokit = github.getOctokit(token);

  // 1. List all comments on the PR (issues API covers PR comments)
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: pull_number,
    per_page: 100,
  });

  // 2. Look for a comment containing our identifier
  const existingComment = comments.find((c) =>
    c.body?.includes(MARKDOWN_FINGERPRINT),
  );
  const fingerprintedCommentBody = commentBody + `\n\n${MARKDOWN_FINGERPRINT}`;

  try {
    if (existingComment) {
      // 3a. Update the existing comment
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existingComment.id,
        body: fingerprintedCommentBody,
      });
    } else {
      // 3b. Create a new comment
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pull_number,
        body: fingerprintedCommentBody,
      });
    }
  } catch (error) {
    core.warning(`Failed to upsert PR comment: ${error}`);
  }
}

export async function getSummaryUrl(
  token: string,
  owner: string,
  repo: string,
): Promise<string> {
  const runId = github.context.runId;

  const octokit = github.getOctokit(token);
  try {
    const { data } = await octokit.rest.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: runId,
    });

    if (data.jobs.length !== 1) {
      core.warning(
        `Expected exactly one job in workflow run, found ${data.jobs.length}. Cannot determine summary URL.`,
      );
      return "";
    }

    // Example format: https://github.com/smartcontractkit/chainlink-common/actions/runs/16783814681#summary-47529227742
    return `https://github.com/${owner}/${repo}/actions/runs/${runId}/#summary-${data.jobs[0].id}`;
  } catch (error) {
    core.warning(`Failed to get summary link: ${error}`);
    return "";
  }
}
