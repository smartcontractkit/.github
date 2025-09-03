import * as core from "@actions/core";
import * as github from "@actions/github";

const MARKDOWN_FINGERPRINT = "<!-- chainlink-codeowners-sanity-check -->";

type Octokit = ReturnType<typeof github.getOctokit>;
export type CodeOwnersError = Awaited<
  ReturnType<Octokit["rest"]["repos"]["codeownersErrors"]>
>["data"]["errors"][0];

type CodeownersCheckResult =
  | { kind: "success"; errors: [] }
  | { kind: "errors"; errors: CodeOwnersError[] }
  | { kind: "not_found" }
  | { kind: "failure"; message: string };

export async function checkCodeOwners(
  token: string,
  owner: string,
  repo: string,
  ref: string,
): Promise<CodeownersCheckResult> {
  const octokit = github.getOctokit(token);

  try {
    const { data } = await octokit.rest.repos.codeownersErrors({
      owner,
      repo,
      ref,
    });

    if (data?.errors?.length > 0) {
      return { kind: "errors", errors: data.errors };
    }

    if (data?.errors?.length === 0) {
      return { kind: "success", errors: [] };
    }

    return { kind: "failure", message: "Unexpected response from Github" };
  } catch (error: any) {
    if (error?.status === 404) {
      return { kind: "not_found" };
    }

    return { kind: "failure", message: error.message };
  }
}

/**
 * Creates or updates a PR comment with the given body, identified by a fingerprint.
 */
export async function upsertPRComment(
  token: string,
  owner: string,
  repo: string,
  pull_number: number,
  commentBody: string,
): Promise<void> {
  core.debug("Upserting PR comment");
  const commentId = await findPRCommentByFingerprint(
    token,
    owner,
    repo,
    pull_number,
  );

  const octokit = github.getOctokit(token);
  const fingerprintedCommentBody = commentBody + `\n\n${MARKDOWN_FINGERPRINT}`;
  try {
    if (commentId === -1) {
      // not found
      core.debug("Creating new PR comment");
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pull_number,
        body: fingerprintedCommentBody,
      });
    } else {
      core.debug(`Updating existing PR comment ID: ${commentId}`);
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: commentId,
        body: fingerprintedCommentBody,
      });
    }
  } catch (error) {
    core.warning(`Failed to upsert PR comment: ${error}`);
  }
}

/**
 * Updates an existing PR comment with the given body, identified by a fingerprint.
 * If the comment does not exist, it will not create one.
 */
export async function updatePRComment(
  token: string,
  owner: string,
  repo: string,
  pull_number: number,
  commentBody: string,
): Promise<void> {
  core.debug("Updating PR comment");
  const commentId = await findPRCommentByFingerprint(
    token,
    owner,
    repo,
    pull_number,
  );

  if (commentId === -1) {
    core.info("No existing comment found, not updating.");
    return;
  }

  const octokit = github.getOctokit(token);
  const fingerprintedCommentBody = commentBody + `\n\n${MARKDOWN_FINGERPRINT}`;
  try {
    core.debug(`Updating existing PR comment ID: ${commentId}`);
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: commentId,
      body: fingerprintedCommentBody,
    });
  } catch (error) {
    core.warning(`Failed to update PR comment: ${error}`);
  }
}

async function findPRCommentByFingerprint(
  token: string,
  owner: string,
  repo: string,
  pull_number: number,
): Promise<number> {
  core.debug(`Finding PR comment for pull request #${pull_number}`);
  const octokit = github.getOctokit(token);
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: pull_number,
    per_page: 100,
  });

  const existingComment = comments.find((c) =>
    c.body?.includes(MARKDOWN_FINGERPRINT),
  );
  const commentId = existingComment ? existingComment.id : -1;
  core.info(`Found existing comment ID: ${commentId}`);
  return commentId;
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
