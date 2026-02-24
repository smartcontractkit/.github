import * as core from "@actions/core";
import * as github from "@actions/github";

import { getInvokeContext, getInputs, RunInputs } from "./run-inputs";
import { getAllGoModuleRoots, matchModules, filterPaths } from "./path-ops";
import { getChangedFilesGit } from "./git";

import { getChangedFilesForPR } from "./github";

import type { OctokitType } from "./github";
import type { InvokeContext } from "./run-inputs";

interface Outputs {
  modifiedModules: string[];
}

function setOutputs(outputs: Outputs) {
  const csvOut = outputs.modifiedModules.join(", ");
  core.info(`(output) modules-csv: ${csvOut}`);
  core.setOutput("modules-csv", csvOut);

  const jsonOut = JSON.stringify(outputs.modifiedModules);
  core.info(`(output) modules-json: ${jsonOut}`);
  core.setOutput("modules-json", jsonOut);
}

export async function run(): Promise<void> {
  try {
    // 1. Get inputs and context
    core.startGroup("Inputs and Context");
    const context = getInvokeContext();
    core.info(
      `Extracted Context: ${JSON.stringify({ ...context, token: "<redacted>" }, null, 2)}`,
    );

    const inputs = getInputs();
    core.info(`Extracted Inputs: ${JSON.stringify(inputs, null, 2)}`);

    const octokit = github.getOctokit(context.token);
    core.endGroup();

    // 2. Get all go modules
    core.startGroup("Determining modules");

    const goModuleDirsRelative = await getAllGoModuleRoots(
      inputs.repositoryRoot,
    );
    core.info(`Found ${goModuleDirsRelative.length} Go modules.`);
    core.debug(`Go modules: ${JSON.stringify(goModuleDirsRelative, null, 2)}`);
    core.endGroup();

    // 3. Filter modules based on ignore patterns
    core.startGroup("Filtering modules");
    const filteredGoModuleDirs = filterPaths(
      goModuleDirsRelative,
      inputs.modulePatterns,
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
    setOutputs({ modifiedModules });
  } catch (error) {
    core.endGroup();
    core.setFailed(`Action failed: ${error}`);
  }
}

/**
 * Determines the changed modules based on the event type.
 */
async function determineChangedModules(
  octokit: OctokitType,
  { owner, repo, event }: InvokeContext,
  modules: string[],
  inputs: RunInputs,
) {
  switch (event.eventName) {
    case "pull_request":
      core.info("Determining changed files for Pull Request event.");
      const files = await getChangedFilesForPR(
        octokit,
        owner,
        repo,
        event.prNumber,
      );
      const changedFiles = files.map((f) => f.filename);
      return determineModulesFromChangedFiles(inputs, changedFiles, modules);

    case "push":
      core.info("Determining changed files for Push event.");
      const changedFilesPush = await getChangedFilesGit(
        event.base,
        event.head,
        inputs.repositoryRoot,
      );
      return determineModulesFromChangedFiles(
        inputs,
        changedFilesPush,
        modules,
      );

    case "merge_group":
      core.info("Determining changed files for Merge Group event.");
      const changedFilesMG = await getChangedFilesGit(
        event.base,
        event.head,
        inputs.repositoryRoot,
      );
      return determineModulesFromChangedFiles(inputs, changedFilesMG, modules);

    case "no-change":
      core.info('A "no-change" event detected. Handling accordingly.');
      return determineModulesForNoChangeEvent(inputs, modules);

    default:
      event satisfies never; // type guard to ensure all cases are handled
      throw new Error(`Unsupported event ${JSON.stringify(event)}`);
  }
}

/**
 * Determines the modules affected by the given changed files.
 */
function determineModulesFromChangedFiles(
  { filePatterns }: RunInputs,
  changedFiles: string[],
  modules: string[],
): string[] {
  const changedFilesFiltered = filterPaths(changedFiles, filePatterns);

  const filesToModules = matchModules(changedFilesFiltered, modules);
  const modulePaths = filesToModules.map(([_, module]) => module);
  const uniqueModulePaths = Array.from(new Set(modulePaths));

  core.info(`Found ${uniqueModulePaths.length} modified modules.`);
  core.debug(`Modified modules: ${JSON.stringify(uniqueModulePaths, null, 2)}`);

  return uniqueModulePaths;
}

/**
 * Determines the modules affected when a "no-change" event is detected.
 * A no-change event is one that does not have an associated changeset, such as schedule or workflow_dispatch.
 */
async function determineModulesForNoChangeEvent(
  inputs: RunInputs,
  modules: string[],
): Promise<string[]> {
  switch (inputs.noChangeBehaviour) {
    case "all":
      core.info(
        "No-change behaviour set to 'all'. All modules will be considered changed.",
      );
      return modules;

    case "none":
      core.info(
        "No-change behaviour set to 'none'. No modules will be considered changed.",
      );
      return [];

    case "root":
      core.info(
        "No-change behaviour set to 'root'. Only the root module (if exists) will be considered changed.",
      );
      return modules.includes(".") ? ["."] : [];

    case "latest-commit":
      core.info(
        "No-change behaviour set to 'latest-commit'. Determining changed files from the latest commit.",
      );
      const changedFilesPush = await getChangedFilesGit(
        "HEAD~1",
        "HEAD",
        inputs.repositoryRoot,
      );
      return determineModulesFromChangedFiles(
        inputs,
        changedFilesPush,
        modules,
      );

    default:
      inputs.noChangeBehaviour satisfies never; // type guard to ensure all cases are handled
      throw new Error(
        `Unvalidated/Unhandled no-change behaviour: ${inputs.noChangeBehaviour}`,
      );
  }
}
