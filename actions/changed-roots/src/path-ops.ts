import * as core from "@actions/core";
import * as glob from "@actions/glob";

import * as path from "path";

import micromatch from "micromatch";

/** Normalize to POSIX-ish repo-relative paths */
function normalizePath(p: string): string {
  // convert backslashes to forward slashes
  let s = p.replace(/\\/g, "/");

  // special-case root
  if (s === "." || s === "./") return ".";

  // strip leading ./ and extra slashes
  s = s.replace(/^.\//, "").replace(/\/+$/, "");
  return s;
}

/** Sort modules deepest-first so submodules are preferred */
function sortDeepestFirst(mods: string[]): string[] {
  return [...new Set(mods)].sort((a, b) => {
    const da = a === "." ? 0 : a.split("/").length;
    const db = b === "." ? 0 : b.split("/").length;
    // deeper first
    if (db !== da) return db - da;
    // tie-breaker: longer string first
    return b.length - a.length;
  });
}

/**
 * Matches a single file path to a module directory.
 * Ensure moduleDirectories are sorted deepest-first and normalized before calling.
 */
export function matchModule(file: string, moduleDirectories: string[]): string {
  const fileNorm = normalizePath(file);

  for (const mod of moduleDirectories) {
    if (mod === ".") {
      // Root module matches anything if present
      return ".";
    }

    // Build patterns that include the directory itself and anything under it.
    // Using dot: true so patterns match dotfiles/dirs like .github/**.
    const patterns = [mod, `${mod}/**`];

    if (micromatch.isMatch(fileNorm, patterns, { dot: true })) {
      return mod;
    }
  }

  return "";
}

/**
 * Map each file to its best-matching module directory.
 * Skips files that don't belong to any provided module.
 */
export function matchModules(
  files: string[],
  moduleDirectories: string[],
): [string, string][] {
  core.startGroup("Matching modified files to modules");

  // Normalize & pre-sort once
  const normalizedFiles = files.map(normalizePath);
  const normalizedModules = sortDeepestFirst(
    moduleDirectories.map(normalizePath),
  );

  const results: [string, string][] = [];
  for (const file of normalizedFiles) {
    const matched = matchModule(file, normalizedModules);
    if (!matched) {
      core.info(`No matching module directory found for file: ${file}`);
      continue;
    }
    core.info(`Matched ${file} to module directory: ${matched}`);
    results.push([file, matched]);
  }

  core.endGroup();
  return results;
}

/**
 * Recursively gets the relative paths of all directories containing the given root file.
 * Note: relative to directory provided.
 */
export async function getAllRoots(
  rootFile: string,
  directory: string = ".",
): Promise<string[]> {
  core.startGroup(`Finding all ${rootFile} files within ${directory}`);
  const pattern = `${directory}/**/${rootFile}`;
  try {
    const globber = await glob.create(pattern);
    const files = await globber.glob();

    if (files.length === 0) {
      core.warning(`No ${rootFile} files found within ${directory}`);
      return [];
    }
    core.info(`Found ${files.length} ${rootFile} files.`);
    core.info(`Found ${rootFile} files: ${JSON.stringify(files)}`);
    const directories = files.map((f) => {
      const relativePath = path.relative(directory, f);
      return path.dirname(relativePath);
    });
    core.info(`Found root directories: ${JSON.stringify(directories)}`);
    return directories;
  } catch (error) {
    throw new Error(`failed to get ${rootFile} files: ${error}`);
  } finally {
    core.endGroup();
  }
}

export function filterPaths(paths: string[], filePatterns: string[]): string[] {
  core.info(
    `Checking ${paths.length} paths against ${filePatterns.length} patterns.`,
  );

  if (filePatterns.length === 0) {
    core.info(
      "No include patterns specified, defaulting to include all paths.",
    );
    filePatterns.push("**");
  }

  core.debug(`Initial paths: ${JSON.stringify(paths)}`);
  core.debug(`File patterns: ${JSON.stringify(filePatterns)}`);

  // Separate include and exclude patterns explicitly
  const includePatterns = filePatterns.filter((p) => !p.startsWith("!"));
  const excludePatterns = filePatterns
    .filter((p) => p.startsWith("!"))
    .map((p) => p.slice(1)); // strip the leading '!'

  // normalize '.' to '__ROOT__' for matching purposes. As '*', '**' doesn't match '.'
  const normalizeDotForMatch = (p: string) => (p === "." ? "__ROOT__" : p);
  const filteredPaths = paths.filter((rawPath) => {
    const path = normalizeDotForMatch(rawPath);

    const isExcluded =
      excludePatterns.length > 0 &&
      micromatch.isMatch(path, excludePatterns, { dot: true });

    if (isExcluded) {
      core.debug(`Excluded by negation: ${rawPath}`);
      return false;
    }

    const isIncluded =
      includePatterns.length === 0 ||
      micromatch.isMatch(path, includePatterns, { dot: true });

    core.debug(`Path: ${rawPath}, included: ${isIncluded}`);
    return isIncluded;
  });

  core.info(`After filtering, ${filteredPaths.length} paths remain.`);
  core.debug(`Filtered paths: ${JSON.stringify(filteredPaths)}`);

  return filteredPaths;
}
