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
): Promise<GoModDefaultBranchLookupResult> {
  const {
    data: { status },
  } = await gh.rest.repos.compareCommits({
    repo,
    owner,
    base: defaultBranch,
    head: commitSha,
  });

  const isInDefault = status === "identical" || status === "behind";
  return {
    isInDefault,
    commitSha,
  };
}

async function isTagInDefaultBranch(
  gh: Octokit,
  defaultBranch: string,
  mod: GoModuleWithTag,
): Promise<GoModDefaultBranchLookupResult> {
  let commitSha = "";
  try {
    const tag = await gh.rest.git.getRef({
      owner: mod.owner,
      repo: mod.repo,
      ref: `tags/${mod.tag}`,
    });

    // lightweight tags show up as "commit" type, annotated tags show up as "tag" type
    const isAnnotatedTag = tag.data.object.type === "tag";
    if (isAnnotatedTag) {
      const getTagResp = await gh.rest.git.getTag({
        owner: mod.owner,
        repo: mod.repo,
        tag_sha: tag.data.object.sha,
      });
      commitSha = getTagResp.data.object.sha;
    } else {
      commitSha = tag.data.object.sha;
    }

    return isCommitInDefaultBranch(gh, defaultBranch, {
      ...mod,
      commitSha,
    });
  } catch (e) {
    let eStr = "unknown";
    if (e instanceof Error) {
      eStr = e.message;
    } else if (typeof e === "string") {
      eStr = e;
    }

    return {
      isInDefault: "unknown",
      commitSha,
      reason: eStr,
    };
  }
}

interface GoModDefaultBranchKnownLookupResult {
  isInDefault: boolean;
  commitSha: string;
}

interface GoModDefaultBranchUnknownResult {
  isInDefault: "unknown";
  /**
   * Additional information when "isInDefault" is "unknown"
   */
  reason: string;
  commitSha: string;
}

export type GoModDefaultBranchLookupResult =
  | GoModDefaultBranchKnownLookupResult
  | GoModDefaultBranchUnknownResult;

// Create a singleton cache for storing promises
const cache: { [key: string]: Promise<GoModDefaultBranchLookupResult> } = {};

/**
 * Checks if a given Go module in its respective GitHub repository's default branch.
 *
 * The version can be a tag or a commit.
 *
 * @param gh - The Octokit client used to make API requests to GitHub.
 * @param mod - The Go module to validate.
 * @param defaultBranch - The default branch of the repository.
 *
 * @returns A boolean indicating whether the version exists in the repository.
 */
export async function isGoModReferencingDefaultBranch(
  gh: Octokit,
  mod: GoModule,
  defaultBranch: string,
  c = cache,
): Promise<GoModDefaultBranchLookupResult> {
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
      return {
        isInDefault: false,
        commitSha: "",
      };
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
