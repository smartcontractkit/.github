import { RunContext } from "./index.mjs";
import * as log from "./logger.mjs";
import { guessLatestVersion } from "./utils.mjs";

import { join } from "node:path";
import { Octokit } from "octokit";
import { GetResponseTypeFromEndpointMethod } from "@octokit/types";

export interface GithubShaToVersionCache {
  [ownerRepo: string]: {
    [ref: string]: string[];
  };
}

interface GitVersionTag {
  name: string;
  sha: string;
}

type ListMatchingRefsResponse = GetResponseTypeFromEndpointMethod<
  Octokit["rest"]["git"]["listMatchingRefs"]
>;
type GetTagResponse = GetResponseTypeFromEndpointMethod<
  Octokit["rest"]["git"]["getTag"]
>;

/**
 * Gets the version of a repository from a specific commit SHA, assuming there is a tag pointing to that commit.
 * @param owner The owner of the repository
 * @param repo The repository name
 * @param ref The commit SHA
 * @returns The version/tag of the repository at the given commit SHA
 */
export async function getVersionFromSHA(
  ctx: RunContext,
  owner: string,
  repo: string,
  repoPath: string,
  ref: string,
) {
  const ownerRepo = `${owner}/${repo}`;
  const GH_SHA_TO_VER_CACHE = ctx.caches.shaToVersion.get();

  if (!GH_SHA_TO_VER_CACHE[ownerRepo] || !GH_SHA_TO_VER_CACHE[ownerRepo][ref]) {
    addToCache(ctx, ownerRepo, ref, await getVersion(ctx, owner, repo, ref));
  }

  if (repo === ".github" && repoPath) {
    const actionName = repoPath.split("/").pop();
    if (actionName) {
      const monorepoVersions = GH_SHA_TO_VER_CACHE[ownerRepo][ref].filter((v) =>
        v.startsWith(actionName),
      );
      return monorepoVersions[0];
    }
  }

  return GH_SHA_TO_VER_CACHE[ownerRepo][ref][0];
}

export function getLatestVersion(
  ctx: RunContext,
  owner: string,
  repo: string,
  repoPath: string,
): { sha: string; version: string } | undefined {
  log.debug(`Getting latest version for ${owner}/${repo}${repoPath || ""}`);
  // get latest version from cache
  const entry = ctx.caches.shaToVersion.getValue(`${owner}/${repo}`);
  if (entry) {
    const latestVersion = guessLatestVersion(
      Object.values(entry).flat(),
      repo,
      repoPath,
    );
    const tuple = Object.entries(entry).find(([_, versions]) =>
      versions.includes(latestVersion.tag),
    );

    if (tuple) {
      return { sha: tuple[0], version: latestVersion.tag };
    }
  }
}

/**
 * Sends a request to the Github API to get the version of a repository at a specific commit SHA.
 * @param owner
 * @param repo
 * @param ref
 * @returns
 */
async function getVersion(
  ctx: RunContext,
  owner: string,
  repo: string,
  ref: string,
): Promise<string> {
  const ownerRepo = `${owner}/${repo}`;
  log.debug(`Getting versions for ${ownerRepo}@${ref}`);

  const allTags = await getAllTags(ctx, owner, repo);
  allTags.forEach((tag) => addToCache(ctx, ownerRepo, tag.sha, tag.name));
  const filteredTags = allTags
    .filter((versionTag) => versionTag.sha === ref || versionTag.name === ref)
    .map((tag) => tag.name);

  if (filteredTags.length === 0) {
    log.warn(`No tag found for ${owner}/${repo}@${ref}`);
    addToCache(ctx, ownerRepo, ref, "v0.0.0");
    return "v0.0.0";
  }

  if (filteredTags.length === 1) {
    log.debug(`Found tag for ${owner}/${repo}@${ref}: ${filteredTags[0]}`);
    return filteredTags[0];
  }

  const latestVersion = guessLatestVersion(filteredTags);
  const latestVersionString = `${latestVersion.prefix}${latestVersion.major}.${latestVersion.minor}.${latestVersion.patch}`;
  log.debug(
    `Multiple tags found for ${owner}/${repo}@${ref}. Using latest version: ${latestVersionString}`,
  );
  return latestVersionString;
}

/**
 * Adds a version to the cache
 * @param owner The owner of the repository
 * @param repo The repository name
 * @param ref The commit SHA/ref
 * @param version The version/tag of the repository at the given commit SHA
 */
function addToCache(
  ctx: RunContext,
  ownerRepo: string,
  ref: string,
  version: string,
) {
  if (!ctx.caches.shaToVersion.exists(ownerRepo)) {
    ctx.caches.shaToVersion.set(ownerRepo, {});
  }

  const entry = ctx.caches.shaToVersion.getValue(ownerRepo);
  if (!entry[ref]) {
    entry[ref] = [];
  } else if (entry[ref].includes(version)) {
    return;
  }

  log.debug(`Adding to cache: ${ownerRepo}@${ref} => ${version}`);
  entry[ref].push(version);
}

async function getAllTags(
  ctx: RunContext,
  owner: string,
  repo: string,
): Promise<GitVersionTag[]> {
  try {
    ctx.debug.tagRequests++;
    const response = (await ctx.octokit.request(
      "GET /repos/{owner}/{repo}/git/matching-refs/tags",
      { owner, repo },
    )) as ListMatchingRefsResponse;

    const allTagsPromise = response.data.map<Promise<GitVersionTag>>(
      async (entry) => {
        const version = entry.ref.trim().substring("refs/tags/".length);

        let responseSha: string = entry.object.sha.trim();

        // If the tag is an annotated tag, we need to get the SHA of the commit it points to
        if (entry.object.type !== "commit") {
          log.debug(
            `Found annotated tag for ${owner}/${repo}@${entry.ref}. Requesting.`,
          );

          const apiPath = entry.object.url.substring(
            "https://api.github.com".length,
          );
          const shaOrUndefined = await getCommitForAnnotatedTag(ctx, apiPath);

          responseSha = shaOrUndefined || responseSha;
        }

        return {
          name: version,
          sha: responseSha,
        };
      },
    );

    return Promise.all(allTagsPromise);
  } catch (e) {
    log.error(`Request failed: ${e}`);
    return [];
  }
}

async function getCommitForAnnotatedTag(
  ctx: RunContext,
  apiPath: string,
): Promise<string | undefined> {
  try {
    ctx.debug.tagRequests++;
    const response = (await ctx.octokit.request(
      "GET " + apiPath,
    )) as GetTagResponse;

    if (!response.data.object?.sha) {
      // Sometimes the response is empty when using octokit (even though its a 200)
      log.warn(`Request ${apiPath} produced no SHA`);
      return;
    }

    return response.data.object.sha.trim();
  } catch (e) {
    log.error(`Request failed (${apiPath}): ${e}`);
  }
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
export async function getActionFile(
  ctx: RunContext,
  owner: string,
  repo: string,
  repoPath: string,
  ref: string,
) {
  const ymlPath = join(repoPath, "action.yml");
  const yamlPath = join(repoPath, "action.yaml");

  let actionFile = await getFile(
    ctx,
    owner,
    repo,
    ymlPath,
    ref,
  );
  if (!actionFile) {
    actionFile = await getFile(
      ctx,
      owner,
      repo,
      yamlPath,
      ref,
    );
  }
  return actionFile;
}

export async function getFile(
  ctx: RunContext,
  owner: string,
  repo: string,
  path: string,
  ref: string,
) {
  try {
    if (path.startsWith("/")) path = path.substring(1);
    if (path.startsWith("./")) path = path.substring(2);

    if (path === "") {
      log.error("Empty path provided to github.getFile. Returning empty.");
      return;
    }

    log.debug(
      `Getting file through Github - ${owner}/${repo}@${ref}, file: ${path}`,
    );

    ctx.debug.contentRequests++;
    const response = await ctx.octokit.rest.repos.getContent({
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
      log.warn(
        `Encountered Github Request Error while getting file - ${requestPath}. (${error.status} - ${error.message})`,
      );
    } else {
      log.warn(
        `Encountered Unknown Error while getting file - ${requestPath} - ${error}`,
      );
    }
  }
}
