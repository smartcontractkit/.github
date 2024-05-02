import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import * as log from "./logger.mjs";
import { Action, WorkflowByName } from "./workflows.mjs";

/**
 * Get an environment variable or throw an error if it's not set
 * @param envVariableName The name of the environment variable
 * @returns The value of the environment variable
 */
export function getEnvironmentVariableOrThrow(envVariableName: string): string {
  const variable = process.env[envVariableName];
  if (!variable) {
    throw Error(`${envVariableName} not set`);
  }
  return variable;
}

/**
 * From a list of tags, "guess" the latest version.
 * @param tags A list of tags, without the prefixed with "refs/tags/"
 * @returns The latest version
 */
export function guessLatestVersion(
  tags: string[],
  repo?: string,
  repoPath?: string,
) {
  let versions = tags.map((tag) => parseTagToVersion(tag));

  // support for the .github monorepo
  if (repo === ".github" && repoPath) {
    let actionName = repoPath.split("/").pop();
    if (actionName === "signed-commits")
      actionName = "changesets-signed-commits"; // hacky fix
    log.debug(
      `Guessing latest version for monorepo action: ${actionName} (${repo})`,
    );
    if (actionName) {
      versions = versions.filter((v) => v.prefix === actionName);
    }
  }

  // Sort the versions by comparing major, minor, and patch numbers
  versions.sort((a, b) => {
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    return a.patch - b.patch;
  });

  // Return the last element in the sorted array, which is the latest version
  return versions[versions.length - 1];
}

/**
 * Parse a tag to a version object
 * @param tag The tag to parse
 * @returns The version object
 */
function parseTagToVersion(tag: string): {
  major: number;
  minor: number;
  patch: number;
  prefix: string;
  tag: string;
} {
  const originalTag = tag;

  let prefix = "";
  if (tag.includes("@")) {
    const parts = tag.split("@");
    tag = parts[1];
    prefix = parts[0];
  }

  const versionRegex = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/;
  // ^ - start of line
  // v? - optional 'v'
  // (\d+) - major version
  // (?:\.(\d+))? - optional minor version
  // (?:\.(\d+))? - optional patch version

  const match = tag.match(versionRegex);

  if (match) {
    const major = match[1];
    const minor = match[2] || "0"; // Default to '0' if not present
    const patch = match[3] || "0"; // Default to '0' if not present

    return {
      major: parseInt(major),
      minor: parseInt(minor),
      patch: parseInt(patch),
      prefix: prefix,
      tag: originalTag,
    };
  }

  return { major: 0, minor: 0, patch: 0, prefix: "v", tag: "error" };
}

/**
 * Lists all yml or yaml files within a directory
 * @param directory the directory/path
 * @returns A list of all yml/yaml files contained in that directory
 */
export async function listAllYamlFiles(directory: string) {
  if (!existsSync(directory)) {
    log.warn("Directory does not exist: ", directory);
    return [];
  }

  const files = await readdir(directory).then((files) =>
    files
      .map((f) => join(directory, f))
      .filter((f) => f.includes(".yml") || f.includes(".yaml")),
  );

  return files;
}

export async function getActionYamlPath(directory: string) {
  const yamlFiles = (await listAllYamlFiles(directory)).filter(
    (file) => file.endsWith("action.yml") || file.endsWith("action.yaml"),
  );

  if (yamlFiles.length === 0) {
    log.warn(
      "Found invalid reference to local action yaml. No action file found: ",
      directory,
    );
    return;
  }

  return yamlFiles[0];
}

export function checkDeprecated(workflowsByName: WorkflowByName) {
  const deprecatedPaths: string[] = [];

  for (const workflow of Object.values(workflowsByName)) {
    for (const job of workflow.jobs) {
      for (const dependency of job.directDependencies) {
        if (dependency.type === "node12" || dependency.type === "node16") {
          deprecatedPaths.push(...createPathStrings(dependency));
        }
      }

      for (const dependency of job.indirectDependencies ?? []) {
        if (dependency.type === "node12" || dependency.type === "node16") {
          deprecatedPaths.push(...createPathStrings(dependency));
        }
      }
    }
  }

  return deprecatedPaths;
}

function createPathStrings(action: Action): string[] {
  return action.referencePaths.map((path) =>
    [...path, action.identifier, action.type].join(" -> "),
  );
}
