import * as core from "@actions/core";
import * as glob from "@actions/glob";

import * as path from "path";

export function matchModules(
  files: string[],
  moduleDirectories: string[],
): [string, string][] {
  core.startGroup("Matching modified files to modules");
  core.info(`Matching files: ${JSON.stringify(files)}`);
  core.info(`Module directories: ${JSON.stringify(moduleDirectories)}`);

  const dirSet = new Set(moduleDirectories);
  const results: [string, string][] = [];
  for (const file of files) {
    const dir = matchModule(file, dirSet);
    if (!dir) {
      core.info(`No matching module directory found for file: ${file}`);
      continue;
    }
    core.info(`Matched ${file} to module directory: ${dir}`);
    results.push([file, dir]);
  }

  core.endGroup();
  return results;
}

export function matchModule(
  file: string,
  moduleDirectories: Set<String>,
): string {
  let fileDirectory = path.dirname(file);
  let found: string | null = null;

  // Walk up: dir1/dir2/file.ts -> dir1/dir2 -> dir1 -> '.'
  while (
    fileDirectory !== "." &&
    fileDirectory !== "/" &&
    fileDirectory !== ""
  ) {
    if (moduleDirectories.has(fileDirectory)) {
      return fileDirectory;
    }
    fileDirectory = path.posix.dirname(fileDirectory);
  }

  if (fileDirectory === "." && moduleDirectories.has(".")) {
    return ".";
  } else if (fileDirectory === "." && moduleDirectories.has("./")) {
    return "./";
  }

  return found || "";
}

/**
 * Recursively gets the relative paths of all go.mod files in the specified directory.
 * Note: relative to process.cwd().
 */
export async function getAllGoModuleRoots(
  subDir: string = "./",
): Promise<string[]> {
  core.startGroup("Finding all go.mod files");
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
