import * as core from "@actions/core";
import * as semver from "semver";
import { basename, join } from "path";
import { readFileSync, existsSync } from "fs";

export function findLatestVersionFromTags(modulePath: string, tags: string[]) {
  const prefix = `${modulePath}/v`;
  core.info(
    `Finding latest version with prefix '${prefix}' from ${tags.length} tags.`,
  );
  if (tags.length === 0) {
    core.info("No tags found.");
    return null;
  }

  const filteredTags = tags.filter((tag) => tag.startsWith(prefix));
  core.info(`Filtered to ${filteredTags.length} tags with prefix '${prefix}'.`);
  core.debug(`Filtered tags: ${filteredTags.join(", ")}`);

  const versions = filteredTags
    .map((tag) => tag.slice(prefix.length))
    .filter((v: string) => semver.valid(v) !== null);
  core.info(`Found ${versions.length} valid semantic versions for module.`);
  core.debug(`Versions found: ${versions.join(", ")}`);

  if (versions.length === 0) {
    core.info("No valid semantic versions found for module.");
    return null;
  }

  const sorted = versions.sort(semver.rcompare);
  const latestVersion = sorted[0];
  core.info(`Latest version for module '${modulePath}' is: ${latestVersion}`);

  return {
    version: latestVersion,
    tag: `${modulePath}/v${latestVersion}`,
  };
}

/**
 * Extracts the module name from go.mod file
 */
export async function getGoModuleName(moduleDir: string): Promise<string> {
  try {
    const goModPath = join(moduleDir, "go.mod");

    if (!existsSync(goModPath)) {
      core.warning(`go.mod not found at ${goModPath}, using directory name`);
      return basename(moduleDir);
    }

    const goModContent = readFileSync(goModPath, "utf8");
    const moduleMatch = goModContent.match(/^module\s+(.+)$/m);

    if (moduleMatch && moduleMatch[1]) {
      return moduleMatch[1].trim();
    }

    core.warning(
      `Could not parse module name from ${goModPath}, using directory name`,
    );
    return basename(moduleDir);
  } catch (error) {
    core.warning(`Error reading go.mod: ${error}, using directory name`);
    return basename(moduleDir);
  }
}

/**
 * Normalize a Git ref so it can be safely used as part of a filename.
 * Example: "feature/new-ui" -> "feature_new-ui"
 * Result will contain only: letters, numbers, `_`, `-`, `.`
 */
export function normalizeRefForFilename(ref: string): string {
  if (ref == null || ref.trim() === "") {
    throw new Error("Cannot normalize empty or null ref");
  }

  let safe = ref.trim();
  // Replace path separators & spaces with underscores
  safe = safe.replace(/[\/\s]+/g, "_");
  // Remove unsafe filename characters
  safe = safe.replace(/[^a-zA-Z0-9._-]/g, "");
  // Collapse multiple underscores
  safe = safe.replace(/_+/g, "_");
  // Prevent filenames like ".hidden"
  safe = safe.replace(/^\.+/, "");

  if (safe === "") {
    throw new Error(`Ref '${ref}' could not be normalized to a safe filename`);
  }

  return safe;
}
