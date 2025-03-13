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
export async function pushTags(tagSeparator: string, createMajorVersionTags: boolean, cwd?: string) {
  const newTags = await getLocalRemoteTagDiff(cwd);

  // Delete the local annotated tags that will be rewritten as lightweight tags
  await deleteTags(newTags, cwd);

  const tagsToCreate = await getTagsToCreate(tagSeparator, createMajorVersionTags, newTags);
  const createdTags = await createLightweightTags(
    tagsToCreate,
    cwd,
  );
  await execWithOutput("git", ["push", "origin", "--tags"], { cwd });

  return createdTags;
}

/**
 * From the local tags, returns the lightweight tags that need to be created.
 * This does two things:
 * 1. Rewrites the tags with the new separator
 * 2. Creates major version tags
 * @param tagSeparator The separator to use for the tags (either @ or /)
 * @param tagsToProcess The tags that were present locally but not on the remote
 * @returns The tags that need to be created;
 */
export async function getTagsToCreate(
  tagSeparator: string,
  createMajorVersionTags: boolean,
  tagsToProcess: GitTag[]
): Promise<GitTag[]> {
  const tagsToCreate: GitTag[] = [];

  // Rewritten tags
  for (const tag of tagsToProcess) {
    const newTagName = tag.name.replace("@", tagSeparator);
    tagsToCreate.push({
      name: newTagName,
      ref: tag.ref,
      originalName: newTagName != tag.name ? tag.name : undefined,
    });
  }

  const tagNames = new Set<string>();

  // [a-z-]+ is the package name
  // @ is the separator of the local tags (changesets)
  // (\d+) is the major/minor/patch version
  const tagRegex = new RegExp(`^[a-z-]+@(\d+)\.(\d+)\.(\d+)$`);

  // Major version tags
  for (const tag of tagsToProcess) {
    const [name, version] = tag.name.split("@");
    const match = tagRegex.exec(version);
    if (!match || match.length < 4) {
      continue;
    }
    const majorVersion = match[1] ?? "0";
    if (majorVersion == "0") {
      continue;
    }
    const majorTag = `${name}/v${majorVersion}`;
    if (tagNames.has(majorTag)) {
      continue;
    }
    tagNames.add(majorTag);
    tagsToCreate.push({
      name: majorTag,
      ref: tag.ref,
      majorVersion: true,
    });
  }

  return tagsToCreate;
}

/**
 * Returns the tags that are present locally but not on the remote.
 */
export async function getLocalRemoteTagDiff(cwd?: string): Promise<GitTag[]> {
  const localTags = await getLocalTags(cwd);
  // Checkout action uses origin for the remote
  // https://github.com/actions/checkout/blob/main/src/git-source-provider.ts#L111
  const remoteTagNames = await getRemoteTagNames("origin", cwd);

  return computeTagDiff(localTags, remoteTagNames);
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
    const maybeForceFlag = tag.majorVersion ? [ "-f" ] : [];
    await execWithOutput("git", ["tag", tag.name, tag.ref, ...maybeForceFlag], { cwd });
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

export async function getRemoteTagNames(
  remote: string,
  cwd?: string,
): Promise<string[]> {
  const stdout = await execWithOutput(
    "git",
    // Note that --refs will filter out peeled tags from the output
    // meaning that annotated tags will only have one entry in the output
    // which is the ref to the tag itself, rather than the ref to the commit.
    //
    // On the other hand, lightweight tags will have their ref to the commit
    // that they point to.
    ["ls-remote", "--refs", "--tags", remote],
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
