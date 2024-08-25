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

// Create a singleton cache for storing promises
const cache: { [key: string]: Promise<boolean> } = {};

/**
 * Checks if a given Go module in its respective GitHub repository's default branch.
 *
 * The version can be a tag or a commit.
 *
 * @param mod - The Go module to validate.
 * @param defaultBranch - The default branch of the repository.
 * @param gh - The Octokit client used to make API requests to GitHub.
 *
 * @returns A boolean indicating whether the version exists in the repository.
 */
export async function isGoModReferencingDefaultBranch(
  mod: GoModule,
  defaultBranch: string,
  gh: Octokit,
  c = cache,
): Promise<boolean> {
  const cacheKey = `${mod.path}:${mod.version}:${defaultBranch}`;

  // Check if the result is already in the cache
  if (cacheKey in c) {
    return c[cacheKey];
  }

  // Store the promise in the cache
  const promise = (async () => {
    core.debug(
      `Processing module: ${mod.name} ${mod.path} ${mod.version} ${mod.goModFilePath}`,
    );

    if ("commitSha" in mod) {
      return isCommitInDefaultBranch(gh, defaultBranch, mod);
    } else if ("tag" in mod) {
      return isTagInDefaultBranch(gh, defaultBranch, mod);
    } else {
      core.warning(`Unable to parse commit sha nor tag for module ${mod.name}`);
      return false;
    }
  })();

  c[cacheKey] = promise;

  return promise;
}

const defaultBranchCache: Record<string, Promise<string>> = {};
function defaultBranchCacheKey(owner: string, repo: string) {
  return `${owner}/${repo}`;
}
export async function getDefaultBranch(
  gh: Octokit,
  { owner, repo }: BaseGoModule,
) {
  const key = defaultBranchCacheKey(owner, repo);
  if (key in defaultBranchCache) {
    return defaultBranchCache[key];
  }
  const promise = (async () => {
    const resp = await gh.rest.repos.get({ owner, repo });

    return resp.data.default_branch;
  })();

  defaultBranchCache[key] = promise;
  return promise;
}
