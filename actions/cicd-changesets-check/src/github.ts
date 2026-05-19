import * as github from "@actions/github";

type Octokit = ReturnType<typeof github.getOctokit>;

export const CHANGESET_SIGNATURE = `<!-- changeset-check-action-signature -->`;

interface ListCommentsParams {
  owner: string;
  repo: string;
  issue_number: number;
}

interface ListFilesParams {
  owner: string;
  repo: string;
  pull_number: number;
}

export async function getCommentId(
  octokit: Octokit,
  params: ListCommentsParams,
): Promise<number | null> {
  const comments = await octokit.paginate(octokit.rest.issues.listComments, params);
  const changesetComment = comments.find((comment) =>
    comment.body?.includes(CHANGESET_SIGNATURE),
  );
  return changesetComment ? changesetComment.id : null;
}

export async function getHasChangeset(
  octokit: Octokit,
  params: ListFilesParams,
): Promise<boolean> {
  const files = await octokit.rest.pulls.listFiles(params);
  const changesetFiles = files.data.filter(
    (file) => file.filename.startsWith(".changeset") && file.status === "added",
  );
  return changesetFiles.length > 0;
}
