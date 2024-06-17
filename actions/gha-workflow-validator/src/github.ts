import * as core from "@actions/core";
import * as github from "@actions/github";
import { GetResponseTypeFromEndpointMethod } from "@octokit/types";
import { join } from "node:path";

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
    actionFile = await getFileFromGithub(octokit, owner, repo, yamlPath, ref);
  }
  return actionFile;
}

async function getFileFromGithub(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref: string,
) {
  try {
    core.debug(`Getting file through Github - ${owner}/${repo}${path}@${ref}`);

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
    const requestPath = `${owner}/${repo}${path}@${ref}`;
    if (error.status) {
      core.warning(
        `Encountered Github Request Error while getting file - ${requestPath}. (${error.status} - ${error.message})`,
      );
    } else {
      core.warning(
        `Encountered Unknown Error while getting file - ${requestPath} - ${error}`,
      );
    }
  }
}
