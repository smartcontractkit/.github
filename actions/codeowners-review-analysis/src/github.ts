import * as core from "@actions/core";
import * as github from "@actions/github";
import { GetResponseTypeFromEndpointMethod } from "@octokit/types";

const MARKDOWN_FINGERPRINT = "<!-- chainlink-codeowners-review-analysis -->";

export type OctokitType = ReturnType<typeof github.getOctokit>;
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

export async function upsertPRComment(
  octokit: OctokitType,
  owner: string,
  repo: string,
  pull_number: number,
  commentBody: string,
): Promise<void> {
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

/**
 * Gets the CODEOWNERS file content from the repository.
 */
export async function getCodeownersFile(
  octokit: OctokitType,
  owner: string,
  repo: string,
) {
  const possibleFilenames = [
    ".github/CODEOWNERS",
    "CODEOWNERS",
    "docs/CODEOWNERS",
  ];

  const headSha = await getHeadSHAOfDefaultBranch(octokit, owner, repo);
  core.info(`Default branch HEAD SHA: ${headSha}`);

  for (const filename of possibleFilenames) {
    const response = await getFile(octokit, owner, repo, filename, headSha);
    if (response?.content) {
      return response;
    }
  }

  return undefined;
}

/**
 * Gets a file from specified ref.
 * See https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28#get-repository-content
 */
async function getFile(
  octokit: OctokitType,
  owner: string,
  repo: string,
  path: string,
  ref: string,
) {
  try {
    core.info(`GitHub getContent: ${owner}/${repo} path:${path} ref:${ref}`);

    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    if (!("type" in data)) {
      throw new Error(
        `Expected a file at ${owner}/${repo}/${path}, but received no type information.`,
      );
    } else if (data.type !== "file") {
      // Not a file (could be dir, symlink, submodule)
      throw new Error(
        `Expected a file at ${owner}/${repo}/${path}, but received type "${data.type}".`,
      );
    } else if (!data.content) {
      throw new Error("No content found in getContent response.");
    }

    // Decode base64 content (GitHub may insert newlines in base64 payloads).
    const preprocessedContent = data.content.replace(/\n/g, "");
    const decodedContent = Buffer.from(preprocessedContent, "base64").toString(
      "utf-8",
    );

    const htmlUrl = `https://github.com/${owner}/${repo}/blob/${ref}/${encodeURI(path)}`;

    return { content: decodedContent, htmlUrl };
  } catch (error: any) {
    const requestPath = `${owner}/${repo}/${path}`;
    if (error?.status) {
      core.warning(
        `GitHub Request Error while getting file - ${requestPath}. (${error.status} - ${error.message})`,
      );
    } else {
      core.warning(
        `Unknown Error while getting file - ${requestPath} - ${String(error)}`,
      );
    }
    return { content: "", htmlUrl: "" };
  }
}

async function getHeadSHAOfDefaultBranch(
  octokit: OctokitType,
  owner: string,
  repo: string,
): Promise<string> {
  try {
    const response = await octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: 1,
    });
    if (response.data.length > 0) {
      return response.data[0].sha;
    }
    return "";
  } catch (error) {
    core.warning(`Failed to get default branch for ${owner}/${repo}: ${error}`);
    return "";
  }
}

export async function getSummaryUrl(
  octokit: OctokitType,
  owner: string,
  repo: string,
): Promise<string> {
  const runId = github.context.runId;

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
