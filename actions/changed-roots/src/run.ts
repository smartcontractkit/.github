import * as core from "@actions/core";
import * as github from "@actions/github";

import { getInvokeContext, getInputs, RunInputs } from "./run-inputs";
import { getAllRoots, matchModules, filterPaths } from "./path-ops";
import { getChangedFilesGit } from "./git";

import { getChangedFilesForPR } from "./github";

import type { OctokitType } from "./github";
import type { InvokeContext } from "./run-inputs";

interface Outputs {
  changedRoots: string[];
}

function setOutputs(outputs: Outputs) {
  const csvOut = outputs.changedRoots.join(", ");
  core.info(`(output) roots-csv: ${csvOut}`);
  core.setOutput("roots-csv", csvOut);

  const jsonOut = JSON.stringify(outputs.changedRoots);
  core.info(`(output) roots-json: ${jsonOut}`);
  core.setOutput("roots-json", jsonOut);
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

    // 2. Find all roots
    core.startGroup("Determining roots");

    const allRoots = await getAllRoots(inputs.rootFile, inputs.repositoryRoot);
    core.info(`Found ${allRoots.length} roots.`);
    core.debug(`Roots: ${JSON.stringify(allRoots, null, 2)}`);
    core.endGroup();

    // 3. Filter roots based on root patterns
    core.startGroup("Filtering roots");
    const filteredRoots = filterPaths(allRoots, inputs.rootPatterns);
    core.info(`After filtering, ${filteredRoots.length} roots remain.`);
    core.debug(`Filtered roots: ${JSON.stringify(filteredRoots, null, 2)}`);
    core.endGroup();

    // 4. Determine changed roots
    core.startGroup("Determining changed roots");
    const changedRoots = await determineChangedRoots(
      octokit,
      context,
      filteredRoots,
      inputs,
    );
    core.endGroup();

    core.info(`Changed roots: ${changedRoots.join(", ")}`);
    setOutputs({ changedRoots });
  } catch (error) {
    core.endGroup();
    core.setFailed(`Action failed: ${error}`);
  }
}

/**
 * Determines the changed roots based on the event type.
 */
async function determineChangedRoots(
  octokit: OctokitType,
  { owner, repo, event }: InvokeContext,
  roots: string[],
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
      return determineRootsFromChangedFiles(inputs, changedFiles, roots);

    case "push":
      core.info("Determining changed files for Push event.");
      const changedFilesPush = await getChangedFilesGit(
        event.base,
        event.head,
        inputs.repositoryRoot,
      );
      return determineRootsFromChangedFiles(inputs, changedFilesPush, roots);

    case "merge_group":
      core.info("Determining changed files for Merge Group event.");
      const changedFilesMG = await getChangedFilesGit(
        event.base,
        event.head,
        inputs.repositoryRoot,
      );
      return determineRootsFromChangedFiles(inputs, changedFilesMG, roots);

    case "no-change":
      core.info('A "no-change" event detected. Handling accordingly.');
      return determineRootsForNoChangeEvent(inputs, roots);

    default:
      event satisfies never; // type guard to ensure all cases are handled
      throw new Error(`Unsupported event ${JSON.stringify(event)}`);
  }
}

/**
 * Determines the roots affected by the given changed files.
 */
function determineRootsFromChangedFiles(
  { filePatterns }: RunInputs,
  changedFiles: string[],
  roots: string[],
): string[] {
  const changedFilesFiltered = filterPaths(changedFiles, filePatterns);

  const filesToRoots = matchModules(changedFilesFiltered, roots);
  const rootPaths = filesToRoots.map(([_, root]) => root);
  const uniqueRootPaths = Array.from(new Set(rootPaths));

  core.info(`Found ${uniqueRootPaths.length} changed roots.`);
  core.debug(`Changed roots: ${JSON.stringify(uniqueRootPaths, null, 2)}`);

  return uniqueRootPaths;
}

/**
 * Determines the roots affected when a "no-change" event is detected.
 * A no-change event is one that does not have an associated changeset, such as schedule or workflow_dispatch.
 */
async function determineRootsForNoChangeEvent(
  inputs: RunInputs,
  roots: string[],
): Promise<string[]> {
  switch (inputs.noChangeBehaviour) {
    case "all":
      core.info(
        "No-change behaviour set to 'all'. All roots will be considered changed.",
      );
      return roots;

    case "none":
      core.info(
        "No-change behaviour set to 'none'. No roots will be considered changed.",
      );
      return [];

    case "root":
      core.info(
        "No-change behaviour set to 'root'. Only the root (if exists) will be considered changed.",
      );
      return roots.includes(".") ? ["."] : [];

    case "latest-commit":
      core.info(
        "No-change behaviour set to 'latest-commit'. Determining changed files from the latest commit.",
      );
      const changedFilesPush = await getChangedFilesGit(
        "HEAD~1",
        "HEAD",
        inputs.repositoryRoot,
      );
      return determineRootsFromChangedFiles(inputs, changedFilesPush, roots);

    default:
      inputs.noChangeBehaviour satisfies never; // type guard to ensure all cases are handled
      throw new Error(
        `Unvalidated/Unhandled no-change behaviour: ${inputs.noChangeBehaviour}`,
      );
  }
}
