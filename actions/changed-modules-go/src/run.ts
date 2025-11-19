import * as core from "@actions/core";
import * as github from "@actions/github";

import { getInvokeContext, getInputs, RunInputs } from "./run-inputs";
import { getAllGoModuleRoots, matchModules, filterPaths } from "./path-ops";
import { getChangedFilesGit } from "./git";

import { getChangedFilesForPR } from "./github";

import type { OctokitType } from "./github";
import type { InvokeContext } from "./run-inputs";

export async function run(): Promise<void> {
  try {
    // 1. Get inputs and context
    core.startGroup("Inputs and Context");
    const context = getInvokeContext();
    core.info(
      `Extracted Context: ${JSON.stringify({ context, ...{ token: "<redacted>" } }, null, 2)}`,
    );

    const inputs = getInputs();
    core.info(`Extracted Inputs: ${JSON.stringify(inputs, null, 2)}`);

    const octokit = github.getOctokit(context.token);
    core.endGroup();

    // 2. Get all go modules
    core.startGroup("Determining modules");

    const goModuleDirsRelative = await getAllGoModuleRoots();
    core.info(`Found ${goModuleDirsRelative.length} Go modules.`);
    core.debug(`Go modules: ${JSON.stringify(goModuleDirsRelative, null, 2)}`);
    core.endGroup();

    // 3. Filter modules based on ignore patterns
    core.startGroup("Filtering modules");
    const filteredGoModuleDirs = filterPaths(
      goModuleDirsRelative,
      inputs.ignoreModules,
    );
    core.info(
      `After filtering, ${filteredGoModuleDirs.length} Go modules remain.`,
    );
    core.debug(
      `Filtered Go modules: ${JSON.stringify(filteredGoModuleDirs, null, 2)}`,
    );
    core.endGroup();

    // 4. Determine changed modules
    core.startGroup("Determining changed modules");
    const modifiedModules = await determineChangedModules(
      octokit,
      context,
      filteredGoModuleDirs,
      inputs,
    );
    core.endGroup();

    core.info(`Modified modules: ${modifiedModules.join(", ")}`);
    core.setOutput("modified-modules", modifiedModules.join(", "));
  } catch (error) {
    core.endGroup();
    core.setFailed(`Action failed: ${error}`);
  }
}

async function determineChangedModules(
  octokit: OctokitType,
  context: InvokeContext,
  modules: string[],
  inputs: RunInputs,
) {
  // Special handling for scheduled events
  if (context.event.eventName === "schedule") {
    core.info("Schedule event detected.");
    if (inputs.scheduleBehaviour === "all") {
      core.info(
        "Schedule behaviour set to 'all'. All modules will be considered changed.",
      );
      return modules;
    } else if (inputs.scheduleBehaviour === "none") {
      core.info(
        "Schedule behaviour set to 'none'. No modules will be considered changed.",
      );
      return [];
    }
    // type guard to ensure all cases are handled
    const never: never = inputs.scheduleBehaviour;
  }

  // Get changed files for other event types
  const changedFiles = await getChangedFiles(octokit, context);
  core.info(`Found ${changedFiles.length} changed files.`);
  core.debug(`Changed files: ${JSON.stringify(changedFiles, null, 2)}`);

  // Filter changed files based on ignore patterns
  const filteredChangedFiles = filterPaths(changedFiles, inputs.ignoreFiles);
  core.info(
    `After filtering, ${filteredChangedFiles.length} changed files remain.`,
  );
  core.debug(
    `Filtered changed files: ${JSON.stringify(filteredChangedFiles, null, 2)}`,
  );

  // Match changed files to modules
  const filesToModules = matchModules(filteredChangedFiles, modules);
  const modulePaths = filesToModules.map(([_, module]) => module);
  const uniqueModulePaths = Array.from(new Set(modulePaths));

  core.info(`Modified modules: ${uniqueModulePaths.join(", ")}`);
  return uniqueModulePaths;
}

async function getChangedFiles(
  octokit: OctokitType,
  { owner, repo, event }: InvokeContext,
): Promise<string[]> {
  switch (event.eventName) {
    case "pull_request":
      const files = await getChangedFilesForPR(
        octokit,
        owner,
        repo,
        event.prNumber,
      );
      return files.map((f) => f.filename);
    case "push":
      core.info(
        `Push event detected. Base: ${event.base}, Head: ${event.head}`,
      );
      return await getChangedFilesGit(event.base, event.head);
    case "merge_group":
      core.info(
        `Merge Group event detected. Base: ${event.base}, Head: ${event.head}`,
      );
      return await getChangedFilesGit(event.base, event.head);
    default:
      throw new Error(
        `Cannot determine changed files for unsupported event type: ${event}`,
      );
  }
}
