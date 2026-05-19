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
  const comments = await octokit.paginate(
    octokit.rest.issues.listComments,
    params,
  );
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

interface GetPackageNameParams {
  owner: string;
  repo: string;
  ref: string;
}

export async function getPackageName(
  octokit: Octokit,
  params: GetPackageNameParams,
): Promise<string | null> {
  try {
    const response = await octokit.rest.repos.getContent({
      owner: params.owner,
      repo: params.repo,
      path: "package.json",
      ref: params.ref,
    });

    if ("content" in response.data && response.data.content) {
      const content = Buffer.from(response.data.content, "base64").toString();
      const pkg = JSON.parse(content);
      return pkg.name ?? null;
    }
  } catch {
    // package.json not found or not readable
  }
  return null;
}
