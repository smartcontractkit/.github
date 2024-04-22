import * as core from "@actions/core";
import * as github from "@actions/github";
import {
  GetResponseTypeFromEndpointMethod,
} from "@octokit/types";
import { join } from "node:path";
import { RequestError } from "@octokit/request-error";

export type Octokit = ReturnType<typeof github.getOctokit>;
type CompareResponse = GetResponseTypeFromEndpointMethod<Octokit["rest"]["repos"]["compareCommitsWithBasehead"]>;
export type GithubFiles = CompareResponse["data"]["files"];

export async function getComparison(
  octokit: Octokit,
  owner: string,
  repo: string,
  base: string,
  head: string,
): Promise<GithubFiles> {

  const diff = await octokit.rest.repos.compareCommitsWithBasehead({
    owner,
    repo,
    basehead: `${base}...${head}`
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
  ghClient: Octokit,
  owner: string,
  repo: string,
  repoPath: string,
  ref: string,
) {
  const actionFileGetter = async (path: string) => {
    try {
      const response = await ghClient.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if ("content" in response.data) {
        return Buffer.from(response.data.content, "base64").toString();
      }
      throw Error("No content found in getContent response");
    } catch (error) {
      const requestPath = `${owner}/${repo}/${path}@${ref}`;
      if (error instanceof RequestError) {
        core.warning(
          `Encountered Github Request Error for ${requestPath}. (${error.status} - ${error.message})`
        );
      } else {
        core.warning(`Encountered Unknown Error for ${requestPath} - ${error}`);
      }
    }
  };


  const ymlPath = join(repoPath, "action.yml");
  const yamlPath = join(repoPath, "action.yaml");

  let actionFile = await actionFileGetter(ymlPath);
  if (!actionFile) {
    actionFile = await actionFileGetter(yamlPath);
  }
  return actionFile;
}

export async function commentOnPr(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
) {
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
}