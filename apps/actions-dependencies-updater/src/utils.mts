import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import * as semver from "semver";

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
  let versions: VersionIdentifier[] = tags
    .map((tag) => parseTagToVersion(tag))
    .filter((v) => v) as VersionIdentifier[];

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

  // Sort the versions ascending
  versions.sort((a, b) => semver.compare(a.version, b.version));
  return versions[versions.length - 1];
}

type VersionIdentifier = NonNullable<ReturnType<typeof parseTagToVersion>>;

/**
 * Parse a tag to a version object
 * @param tag The tag to parse
 * @returns The version object
 */
function parseTagToVersion(tag: string) {
  const originalTag = tag;

  let prefix = "";
  if (tag.includes("@")) {
    const parts = tag.split("@");
    tag = parts[1];
    prefix = parts[0];
  }

  const coerced = semver.coerce(tag);

  if (!coerced) {
    log.error(`Failed to parse version from tag: ${tag}`);
    return;
  }

  return {
    major: coerced.major,
    minor: coerced.minor,
    patch: coerced.patch,
    version: coerced.version,
    prefix: prefix,
    tag: originalTag,
  };
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

export function compileDeprecatedPaths(workflowsByName: WorkflowByName) {
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

  const uniquePaths = Array.from(new Set(deprecatedPaths)).sort();
  return uniquePaths;
}

function createPathStrings(action: Action): string[] {
  return action.referencePaths.map((path) =>
    [...path, action.identifier, action.type].join(" -> "),
  );
}