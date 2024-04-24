import * as core from "@actions/core";
import * as github from "@actions/github";
import { GetResponseTypeFromEndpointMethod } from "@octokit/types";
import { join } from "node:path";
import { COMMENT_HEADER } from "./strings.js";

export type Octokit = ReturnType<typeof github.getOctokit>;
type CompareResponse = GetResponseTypeFromEndpointMethod<
  Octokit["rest"]["repos"]["compareCommitsWithBasehead"]
>;
export type GithubFiles = CompareResponse["data"]["files"];

export async function getComparison(
  octokit: Octokit,
  owner: string,
  repo: string,
  base: string,
  head: string,
): Promise<GithubFiles> {
  core.debug(`Comparing ${owner}/${repo} commits ${base}...${head}`);

  const diff = await octokit.rest.repos.compareCommitsWithBasehead({
    owner,
    repo,
    basehead: `${base}...${head}`,
    // <before>...<after> or <earlier>...<later>
  });

  return diff.data.files;
}

/**
 * Gets the action definition file from Github and performs some error handling and retry logic.
 * If there's an error or no content is returned from github upon initial invocation, it will
 * retry the request once but switching between .yml and .yaml for the action definition
 * filename.
 * @param ghClient The octokit github client
 * @param requestObject The request object
 * @returns The action definition as a string or undefined if it failed
 */
export async function getActionFileFromGithub(
  octokit: Octokit,
  owner: string,
  repo: string,
  repoPath: string,
  ref: string,
) {
  const ymlPath = join(repoPath, "action.yml");
  const yamlPath = join(repoPath, "action.yaml");

  let actionFile = await getFileFromGithub(octokit, owner, repo, ymlPath, ref);
  if (!actionFile) {
    actionFile =  await getFileFromGithub(octokit, owner, repo, yamlPath, ref);
  }
  return actionFile;
}

export async function commentOnPrOrUpdateExisting(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
) {
  const comments = await getAllCommentsOnPr(octokit, owner, repo, prNumber);
  const existingComment = comments.find(
    (comment) => comment.body?.startsWith(COMMENT_HEADER),
  );

  if (existingComment) {
    const response = await updateComment(octokit, owner, repo, existingComment.id, body);
    return { commentId: response.data.id, updatedAt: response.data.updated_at }
  } else {
    const response = await createComment(octokit, owner, repo, prNumber, body);
    return { commentId: response.data.id, createdAt: response.data.created_at };
  }
}

export async function deleteCommentOnPRIfExists(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
) {
  const comments = await getAllCommentsOnPr(octokit, owner, repo, prNumber);
  const existingComment = comments.find(
    (comment) => comment.body?.startsWith(COMMENT_HEADER),
  );

  if (existingComment) {
    await octokit.rest.issues.deleteComment({
      owner,
      repo,
      comment_id: existingComment.id,
    });

    return true;
  }

  return false;
}

async function getAllCommentsOnPr(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
) {
  core.debug(`Getting comments on PR ${prNumber}`);
  return await octokit.paginate(octokit.rest.issues.listComments, {
    owner: owner,
    repo: repo,
    issue_number: prNumber,
  });
}

async function createComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
) {
  core.debug(`Commenting on PR ${prNumber}`);
  return octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
}

async function updateComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  commentId: number,
  body: string,
) {
  core.debug(`Updating comment ${commentId}`);
  return await octokit.rest.issues.updateComment({
    owner,
    repo,
    comment_id: commentId,
    body,
  });
}

async function getFileFromGithub(octokit: Octokit, owner: string, repo: string, path: string, ref: string) {
    try {
      core.debug(`Getting file through Github - ${owner}/${repo}/${path}@${ref}`);

      const response = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if ("content" in response.data) {
        return Buffer.from(response.data.content, "base64").toString();
      }
      throw Error("No content found in getContent response");
    } catch (error: any) {
      const requestPath = `${owner}/${repo}/${path}@${ref}`;
      if (error.status) {
        core.warning(
          `Encountered Github Request Error while getting file - ${requestPath}. (${error.status} - ${error.message})`,
        );
      } else {
        core.warning(`Encountered Unknown Error while getting file - ${requestPath} - ${error}`);
      }
    }
}