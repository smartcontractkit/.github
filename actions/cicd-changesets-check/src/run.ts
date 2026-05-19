import * as core from "@actions/core";
import * as github from "@actions/github";
import { randomBytes } from "node:crypto";
import { getCommentId, getHasChangeset } from "./github";
import { getAbsentMessage, getApproveMessage } from "./messages";

export async function run(): Promise<void> {
  try {
    const githubToken = core.getInput("token", { required: true });

    const pullRequest = github.context.payload.pull_request;
    if (!pullRequest) {
      core.setFailed("This action can only be run on pull_request events");
      return;
    }

    const octokit = github.getOctokit(githubToken);

    const [commentId, hasChangeset] = await Promise.all([
      getCommentId(octokit, {
        issue_number: pullRequest.number,
        ...github.context.repo,
      }),
      getHasChangeset(octokit, {
        pull_number: pullRequest.number,
        ...github.context.repo,
      }),
    ]);

    const changesetFilename = randomBytes(8).toString("hex");
    const addChangesetUrl = `${pullRequest.head.repo.html_url}/new/${pullRequest.head.ref}?filename=.changeset/${changesetFilename}.md`;

    const message = hasChangeset
      ? getApproveMessage(github.context.sha)
      : getAbsentMessage(github.context.sha, addChangesetUrl);

    core.setOutput("has-changeset", hasChangeset.toString());

    if (commentId) {
      await octokit.rest.issues.updateComment({
        comment_id: commentId,
        body: message,
        ...github.context.repo,
      });
    } else {
      await octokit.rest.issues.createComment({
        ...github.context.repo,
        issue_number: pullRequest.number,
        body: message,
      });
    }

    const failOnMissing = core.getBooleanInput("fail-on-missing");

    if (!hasChangeset && failOnMissing) {
      core.setFailed("No changeset found for this PR");
    } else if (!hasChangeset) {
      core.warning("No changeset found for this PR");
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unexpected error occurred");
    }
  }
}
