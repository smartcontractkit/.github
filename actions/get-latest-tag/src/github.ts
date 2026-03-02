import * as core from "@actions/core";
import * as github from "@actions/github";

import { GetResponseTypeFromEndpointMethod } from "@octokit/types";

export type OctokitType = ReturnType<typeof github.getOctokit>;
type ListMatchingRefsResponse = GetResponseTypeFromEndpointMethod<
  OctokitType["rest"]["git"]["listMatchingRefs"]
>;

export type MatchingRefs = ListMatchingRefsResponse["data"];
export type MatchingRef = ListMatchingRefsResponse["data"][number];

export async function listTags(
  octokit: OctokitType,
  owner: string,
  repo: string,
  prefix: string,
): Promise<MatchingRefs> {
  core.info(`Listing tags for ${owner}/${repo} with prefix ${prefix}`);

  try {
    const tags = await octokit.paginate(octokit.rest.git.listMatchingRefs, {
      owner,
      repo,
      ref: `tags/${prefix}`,
      per_page: 100,
    });

    core.info(`Found ${tags.length} tags matching prefix ${prefix}`);
    core.debug(`Tags: ${JSON.stringify(tags, null, 2)}`);

    return tags;
  } catch (error) {
    throw new Error(`Failed to list tags: ${error}`);
  }
}
