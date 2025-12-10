import * as core from "@actions/core";
import * as github from "@actions/github";

export type OctokitType = ReturnType<typeof github.getOctokit>;

function getMarkdownFingerprint(moduleName: string): string {
  return `<!-- chainlink-apidiff-go ${moduleName} -->`;
}

export async function upsertPRComment(
  octokit: OctokitType,
  owner: string,
  repo: string,
  pull_number: number,
  commentBody: string,
  moduleName: string,
): Promise<void> {
  // 1. List all comments on the PR (issues API covers PR comments)
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: pull_number,
    per_page: 100,
  });

  const markdownFingerprint = getMarkdownFingerprint(moduleName);

  // 2. Look for a comment containing our identifier
  const existingComment = comments.find((c) =>
    c.body?.includes(markdownFingerprint),
  );
  const fingerprintedCommentBody = commentBody + `\n\n${markdownFingerprint}`;

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
