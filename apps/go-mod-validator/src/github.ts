import * as github from "@actions/github";
import * as core from "@actions/core";
import {
  BaseGoModule,
  GoModule,
  GoModuleWithCommitSha,
  GoModuleWithTag,
} from "./deps";

export type Octokit = ReturnType<typeof github.getOctokit>;

async function isCommitInDefaultBranch(
  gh: Octokit,
  defaultBranch: string,
  { repo, owner, commitSha }: GoModuleWithCommitSha,
): Promise<boolean> {
  const {
    data: { status },
  } = await gh.rest.repos.compareCommits({
    repo,
    owner,
    base: defaultBranch,
    head: commitSha,
  });

  return status === "identical" || status === "behind";
}

async function isTagInDefaultBranch(
  gh: Octokit,
  defaultBranch: string,
  mod: GoModuleWithTag,
): Promise<boolean> {
  const { data: repoTags } = await gh.rest.repos.listTags({
    owner: mod.owner,
    repo: mod.repo,
  });

  for (const repoTag of repoTags) {
    if (repoTag.name != mod.tag) {
      continue;
    }

    return isCommitInDefaultBranch(gh, defaultBranch, {
      ...mod,
      commitSha: repoTag.commit.sha,
    });
  }

  return false;
}

/**
 * Checks if a given go module in its respective GitHub repository's default branch.
 *
 * The version can be a tag or a commit.
 *
 * @param path - The path of the GitHub repository in the format "github.com/owner/repo".
 * @param version - The version to validate.
 * @param gh - The Octokit client used to make API requests to GitHub.
 *
 * @returns A boolean indicating whether the version exists in the repository.
 */
export async function isGoModReferencingDefaultBranch(
  mod: GoModule,
  defaultBranch: string,
  gh: Octokit,
) {
  core.debug(
    `Processing module: ${mod.name} ${mod.path} ${mod.version} ${mod.goModFilePath}`,
  );

  if ("commitSha" in mod) {
    return isCommitInDefaultBranch(gh, defaultBranch, mod);
  } else if ("tag" in mod) {
    return isTagInDefaultBranch(gh, defaultBranch, mod);
  } else {
    core.warning(`Unable to parse commit sha nor tag for module ${mod.name}`);
  }

  return false;
}

/**
 * Memoized function to get the default branch of a repository.
 */
export function defaultBranchGetter(gh: Octokit) {
  return async function getRepoDefaultBranch({ owner, repo }: BaseGoModule) {
    const resp = await gh.rest.repos.get({ owner, repo });

    return resp.data.default_branch;
  };
}
