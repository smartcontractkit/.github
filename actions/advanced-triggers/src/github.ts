import * as core from "@actions/core";
import * as github from "@actions/github";
import { GetResponseTypeFromEndpointMethod } from "@octokit/types";

export type OctokitType = ReturnType<typeof github.getOctokit>;
type ListFilesResponse = GetResponseTypeFromEndpointMethod<
  OctokitType["rest"]["pulls"]["listFiles"]
>;
export type PRFiles = ListFilesResponse["data"];

type CompareResponse = GetResponseTypeFromEndpointMethod<
  OctokitType["rest"]["repos"]["compareCommits"]
>;
export type CompareFiles = CompareResponse["data"]["files"];

export async function getChangedFilesForPR(
  octokit: OctokitType,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PRFiles> {
  core.debug(`Fetching changed files for ${owner}/${repo} PR #${prNumber}`);

  const prFiles = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  return prFiles;
}

export async function getChangedFilesForMergeGroup(
  octokit: OctokitType,
  owner: string,
  repo: string,
  base: string,
  head: string,
): Promise<string[]> {
  core.debug(
    `Fetching changed files for ${owner}/${repo} merge group ${base}...${head}`,
  );

  const files = await octokit.paginate(
    octokit.rest.repos.compareCommits,
    {
      owner,
      repo,
      base,
      head,
      per_page: 100,
    },
    (response: CompareResponse) =>
      response.data.files?.map((f: CompareFiles[number]) => f.filename) ?? [],
  );

  return files;
}
