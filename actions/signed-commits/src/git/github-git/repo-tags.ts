import * as core from "@actions/core";
import { execWithOutput } from "../../utils";

export interface GitTag {
  name: string;
  ref: string;
  originalName?: string;
  majorVersion?: boolean;
}

/**
 * Pushes any missing tags to the remote first replacing those tags with lightweight versions.
 * We replace annotated tags with lightweight ones because we cannot sign annotated tags, but
 * lightweight tags pointing to signed commits will show up as verified in GitHub.
 */
export async function pushTags(
  tagSeparator: string,
  createMajorVersionTags: boolean,
  cwd?: string,
  rootPackageInfo?: { name: string; version: string },
) {
  const localTags = await getLocalTags(cwd);
  const remoteTagNames = await getRemoteTagNames(cwd);
  const newTags = computeTagDiff(localTags, remoteTagNames); // tags only present locally

  // Delete the local annotated tags that will be rewritten as lightweight tags
  await deleteTags(newTags, cwd);

  // Local only tags may have tags for previous versions that are present on the remote
  // But the remote's tags may have been rewritten with a different separator.
  const rewrittenTags = replaceTagSeparator(newTags, tagSeparator);

  const finalTags = rootPackageInfo
    ? rewriteRootPackageTags(rewrittenTags, tagSeparator, rootPackageInfo)
    : rewrittenTags;
  core.debug(
    `Final tags to push: ${finalTags.map((tag) => tag.name).join(", ")}`,
  );

  // Filter out rewritten tags that are already present on the remote.
  const filteredRewrittenTags = computeTagDiff(finalTags, remoteTagNames);
  core.debug(
    `Filtered rewritten tags to push: ${filteredRewrittenTags
      .map((tag) => tag.name)
      .join(", ")}`,
  );
  const createdTags = await createLightweightTags(filteredRewrittenTags, cwd);
  await execWithOutput("git", ["push", "origin", "--tags"], { cwd });

  if (createMajorVersionTags) {
    const majorVersionTags = getMajorVersionTags(
      filteredRewrittenTags,
      tagSeparator,
      rootPackageInfo,
    );
    const createdMajorTags = await createLightweightTags(majorVersionTags, cwd);

    // force push the major version tags
    for (const tag of createdMajorTags) {
      await execWithOutput("git", ["push", "--force", "origin", tag.name], {
        cwd,
      });
    }

    return [...createdTags, ...createdMajorTags];
  }

  return createdTags;
}

/**
 * Returns a list of tags that are present locally.
 */
export async function getLocalTags(cwd?: string): Promise<GitTag[]> {
  const stdout = await execWithOutput("git", ["tag", "--list"], { cwd });

  const tags: Promise<GitTag>[] = stdout
    .split("\n")
    .filter((line) => !!line)
    .map(async (name) => {
      const ref = await execWithOutput("git", ["rev-list", "-1", name], {
        cwd,
      });
      return { name, ref: ref };
    });

  return await Promise.all(tags);
}

export async function createLightweightTags(
  tags: GitTag[],
  cwd?: string,
): Promise<GitTag[]> {
  const createdTags = tags.map(async (tag) => {
    // Force rewrite tags if they are major versions, as these are mutable
    const maybeForceFlag = tag.majorVersion ? ["-f"] : [];
    await execWithOutput("git", ["tag", tag.name, tag.ref, ...maybeForceFlag], {
      cwd,
    });
    return tag;
  });

  return await Promise.all(createdTags);
}

export async function deleteTags(
  tags: GitTag[],
  cwd?: string,
): Promise<GitTag[]> {
  const deleteCommands = tags.map(async (tag) => {
    await execWithOutput("git", ["tag", "-d", tag.name], { cwd });
    return tag;
  });

  return await Promise.all(deleteCommands);
}

/**
 * Compute the diff between two tag sets
 */
export function computeTagDiff(
  localTags: GitTag[],
  remoteTags: string[],
): GitTag[] {
  const remoteSet = new Set(remoteTags);
  const diff = localTags.filter((tag) => !remoteSet.has(tag.name));

  return diff;
}

export async function getRemoteTagNames(cwd?: string): Promise<string[]> {
  // Checkout action uses origin for the remote
  // https://github.com/actions/checkout/blob/main/src/git-source-provider.ts#L111
  const stdout = await execWithOutput(
    "git",
    // Note that --refs will filter out peeled tags from the output
    // meaning that annotated tags will only have one entry in the output
    // which is the ref to the tag itself, rather than the ref to the commit.
    //
    // On the other hand, lightweight tags will have their ref to the commit
    // that they point to.
    ["ls-remote", "--refs", "--tags", "origin"],
    { cwd },
  );

  const tags = stdout
    .split("\n")
    .filter((line) => !!line)
    .map((line) => {
      const [_ref, tag] = line.split("\t");
      return tag.replace("refs/tags/", "");
    });

  return tags;
}

/**
 * Replaces the tag separator in the list of tags.
 * @param tags The list of tags to update.
 * @param separator The separator to replace the @ separator with.
 * @returns The updated list of tags.
 */
export function replaceTagSeparator(
  tags: GitTag[],
  separator: string,
): GitTag[] {
  if (separator === "@") {
    return tags;
  }

  return tags.map((tag) => {
    // For scoped packages like @scope/foo@1.0.0, we need to replace only the last @
    // which is the separator between package name and version, not the @ in the scope
    const lastAtIndex = tag.name.lastIndexOf("@");
    let newTagName = tag.name;
    if (lastAtIndex !== -1) {
      newTagName =
        tag.name.substring(0, lastAtIndex) +
        separator +
        tag.name.substring(lastAtIndex + 1);
    }
    return {
      ...tag,
      name: newTagName,
      originalName: newTagName != tag.name ? tag.name : undefined,
    };
  });
}

/**
 * Rewrites tags for root packages to use v<version> format instead of <name><separator><version>.
 * Dynamically detects the separator for each tag.
 * @param tags The list of tags to update.
 * @param rootPackageInfo The root package information.
 * @returns The updated list of tags.
 */
export function rewriteRootPackageTags(
  tags: GitTag[],
  tagSeparator: string,
  rootPackageInfo: { name: string; version: string },
): GitTag[] {
  return tags.map((tag) => {
    core.debug(
      `Analyzing tag: ${tag.name} with separator: ${tagSeparator} for root package: ${rootPackageInfo.name}`,
    );
    const info = parseTagName(tag.name, tagSeparator);
    core.debug(`Parsed tag info: ${JSON.stringify(info)} for tag: ${tag.name}`);
    if (info && info.pkg === rootPackageInfo.name) {
      core.debug(`Rewriting root package tag ${tag.name} to v${info.version}`);
      return {
        name: `v${info.version}`,
        ref: tag.ref,
        originalName: tag.originalName || tag.name,
      };
    }
    core.debug(`Tag ${tag.name} is not a root package tag, returning as-is`);
    // Not a root package tag, return as-is
    return tag;
  });
}

/**
 * Gets the list of major version tags from the list of tags.
 * @param tags The list of tags to filter
 * @param separator The separator for the list of tags
 * @param rootPackageInfo Optional root package info to exclude from major version tag creation
 * @returns The list of major version tags
 */
export function getMajorVersionTags(
  tags: GitTag[],
  separator: string,
  rootPackageInfo?: { name: string; version: string },
): GitTag[] {
  const tagNamesSeen = new Set<string>();
  return tags.reduce((acc, tag) => {
    const info = parseTagName(tag.name, separator);
    if (!info) {
      return acc;
    }

    // Skip major version tag creation for root packages since they use v<version> format
    if (rootPackageInfo && info.pkg === rootPackageInfo.name) {
      return acc;
    }

    // Do not create major version tags for version 0 (e.g., pkg/v0 from pkg/v0.1.2)
    if (info.major === "0") {
      core.debug(
        `Skipping major version tag creation for ${tag.name} as its major version is 0.`,
      );
      return acc;
    }

    // Don't add a v to the tag, if the separator already ends with a v
    const majorTag = separator.endsWith("v")
      ? `${info.pkg}${separator}${info.major}`
      : `${info.pkg}${separator}v${info.major}`;

    if (tagNamesSeen.has(majorTag)) {
      return acc;
    }
    tagNamesSeen.add(majorTag);
    acc.push({
      name: majorTag,
      ref: tag.ref,
      majorVersion: true,
    });
    return acc;
  }, [] as GitTag[]);
}

/**
 * Parses a tag name into its package name and version components.
 * @param tagName The tag name to parse
 * @param separator The separator of the current tag
 * @returns The parsed tag
 */
export function parseTagName(tagName: string, separator: string) {
  // Package name patterns:
  // - Regular package: [a-zA-Z0-9-]+
  // - Scoped package: @[a-zA-Z0-9-]+/[a-zA-Z0-9-]+
  // Combined pattern: (?:@[a-zA-Z0-9-]+/)?[a-zA-Z0-9-]+
  // Should match tags like:
  // - foo@1.2.3, foo/1.2.3, foo/v1.2.3
  // - @scope/foo@1.2.3, @scope/foo/1.2.3, @scope/foo/v1.2.3
  const escapedSeparator = separator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tagRegex = new RegExp(
    `^((?:@[a-zA-Z0-9-]+/)?[a-zA-Z0-9-]+)${escapedSeparator}(\\d+)\\.(\\d+)\\.(\\d+)$`,
  );
  const match = tagRegex.exec(tagName);
  if (!match || match.length < 5) {
    core.debug(
      `parseTagName: No match for tagName "${tagName}" with separator "${separator}" using regex "${tagRegex}"`,
    );
    return;
  }

  const name = match[1];
  const version = `${match[2]}.${match[3]}.${match[4]}`;
  const majorVersion = match[2] ?? "0";

  return {
    pkg: name,
    version: version,
    major: majorVersion,
    minor: match[3],
    patch: match[4],
  };
}
