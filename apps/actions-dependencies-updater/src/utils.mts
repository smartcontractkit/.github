import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import * as log from "./logger.mjs";
import { Action, WorkflowByName } from "./workflows.mjs";

/**
 * Get an environment variable or throw an error if it's not set
 * @param envVariableName The name of the environment variable
 * @returns The value of the environment variable
 */
export function getEnvironmentVariableOrExit(envVariableName: string): string {
  const variable = process.env[envVariableName];
  if (!variable) {
    log.error(`Mandatory environment variable not set: ${envVariableName}`);
    process.exit(1);
  }
  return variable;
}

export function validateRepositoryOrExit(repoDir: string) {
  if (!repoDir) {
    log.error("No repository directory provided.");
    process.exit(1);
  }

  if (!existsSync(repoDir)) {
    log.error(`Directory does not exist: ${repoDir}`);
    process.exit(1);
  }

  const gitDir = join(repoDir, ".git");
  if (!existsSync(gitDir)) {
    log.error(`Directory is not a git repository: ${repoDir}`);
    process.exit(1);
  }

  const workflowDir = join(repoDir, ".github", "workflows");
  if (!existsSync(workflowDir)) {
    log.info(
      `No workflows directory found: ${workflowDir} - nothing to check/update`,
    );
    process.exit(0);
  }
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
    .filter((v) => !!v) as VersionIdentifier[];

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
  const filteredSortedVersions = versions.filter(v => (!v.prerelease)).sort((a, b) => {
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    return a.patch - b.patch;
  });

  return filteredSortedVersions[filteredSortedVersions.length - 1];
}

type VersionIdentifier = NonNullable<ReturnType<typeof parseTagToVersion>>;

/**
 * Parse a tag to a version object
 * @param tag The tag to parse
 * @returns The version object
 */
export function parseTagToVersion(tag: string) {
  const originalTag = tag;

  let prefix = "";
  if (tag.includes("@")) {
    const parts = tag.split("@");
    tag = parts[1];
    prefix = parts[0];
  }

  // ^ - start of line
  // v? - optional 'v'
  // (\d+) - major version
  // (?:\.(\d+))? - optional minor version
  // (?:\.(\d+))? - optional patch version
  const versionRegex = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/;
  const isPrerelease = tag.includes("beta") || tag.includes("alpha");

  const match = tag.match(versionRegex);
  if (match) {
    const major = match[1];
    const minor = match[2] || '0'; // Default to '0' if not present
    const patch = match[3] || '0'; // Default to '0' if not present

    return { major: parseInt(major), minor: parseInt(minor), patch: parseInt(patch), prefix: prefix, tag: originalTag, prerelease: isPrerelease};
  }

  return { major: 0, minor: 0, patch: 0, prefix: 'v', tag: 'error', prerelease: true };
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
  const allDeprecatedPaths: string[] = [];

  for (const workflow of Object.values(workflowsByName)) {
    for (const job of workflow.jobs) {
      const deprecatedPaths = job.dependencies
        .filter(
          (dependency) =>
            dependency.type === "node12" || dependency.type === "node16",
        )
        .map(createPathStrings)
        .flat();
      allDeprecatedPaths.push(...deprecatedPaths);
    }
  }

  const uniquePaths = Array.from(new Set(allDeprecatedPaths)).sort();
  return uniquePaths;
}

function createPathStrings(action: Action): string[] {
  return action.referencePaths.map((path) =>
    [...path, action.identifier, action.type].join(" -> "),
  );
}

/**
 * Given an action identifier, check if it uses a sha reference. This is to ensure that the parsed
 * action was from an immutable reference.
 * @param identifier the action identifier
 * @returns true if the identifier is a sha reference
 */
export function isShaRefIdentifier(identifier: string) {
  const sha1Regex = /^[0-9a-f]{40}$/;
  const sha256Regex = /^[0-9a-f]{256}$/;
  const ref = identifier.split("@")[1];
  return (ref && sha1Regex.test(ref)) || sha256Regex.test(ref);
}
