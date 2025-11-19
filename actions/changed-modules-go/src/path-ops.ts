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
 * Recursively gets the relative paths of all go.mod files in the specified directory.
 * Note: relative to process.cwd().
 */
export async function getAllGoModuleRoots(
  subDir: string = ".",
): Promise<string[]> {
  core.startGroup(`Finding all go.mod files within ${subDir}`);
  const pattern = `${subDir}/**/go.mod`;
  try {
    const globber = await glob.create(pattern);
    const files = await globber.glob();

    if (files.length === 0) {
      core.warning(`No go.mod files found within ${subDir}`);
      return [];
    }
    core.info(`Found ${files.length} go.mod files.`);
    core.info(`Found go.mod files: ${JSON.stringify(files)}`);
    const directories = files.map((f) => {
      const relativePath = path.relative(process.cwd(), f);
      return path.dirname(relativePath);
    });
    core.info(`Found go.mod directories: ${JSON.stringify(directories)}`);
    return directories;
  } catch (error) {
    throw new Error(`failed to get go.mod files: ${error}`);
  } finally {
    core.endGroup();
  }
}

export function filterPaths(
  paths: string[],
  ignorePatterns: string[],
): string[] {
  core.info(
    `Checking ${paths.length} paths against ${ignorePatterns.length} ignore patterns.`,
  );
  core.debug(`Initial paths: ${JSON.stringify(paths)}`);
  core.debug(`Ignore patterns: ${JSON.stringify(ignorePatterns)}`);

  // micromatch.isMatch(file, patterns) -> true if the file matches ANY of the patterns
  // Use { dot: true } so patterns can match dotfiles if intended (common in repos).
  const filteredPaths = paths.filter((path) => {
    const isIgnored = micromatch.isMatch(path, ignorePatterns, { dot: true });
    core.debug(`Path: ${path}, is ignored: ${isIgnored}`);
    return !isIgnored;
  });

  core.info(`After filtering, ${filteredPaths.length} paths remain.`);
  core.debug(`Filtered paths: ${JSON.stringify(filteredPaths)}`);

  return filteredPaths;
}
