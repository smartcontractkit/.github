import * as core from "@actions/core";
import * as github from "@actions/github";

import { getInputs, RunInputs } from "./run-inputs";
import { getAllGoModuleRoots, matchModules } from "./path-ops";
import { getChangedFiles, resolveBaseAndHeadRefs } from "./git";

export async function run(): Promise<void> {
  try {
    // 1. Get inputs and context
    core.startGroup("Inputs and Context");
    const inputs = getInputs();
    // const context = getInvokeContext();
    core.endGroup();

    // 2. Get all go modules in current directory
    const goModuleDirsRelative = await getAllGoModuleRoots(inputs.subDirectory);

    // 3. Get proper SHA refs
    const headRefToResolve = inputs.headRef || "HEAD";
    const baseRefToResolve = chooseBaseRef(inputs, headRefToResolve);
    const { base, head } = await resolveBaseAndHeadRefs(
      process.cwd(),
      headRefToResolve,
      baseRefToResolve,
    );

    // 4. Get all files modified between the two refs
    const changedFiles = await getChangedFiles(process.cwd(), base, head);
    const filesToModules = matchModules(changedFiles, goModuleDirsRelative);
    const modulePaths = filesToModules.map(([_, module]) => module);
    const uniqueModulePaths = Array.from(new Set(modulePaths));

    core.info(`Modified modules: ${uniqueModulePaths.join(", ")}`);
    core.setOutput("modified-modules", uniqueModulePaths.join(", "));
  } catch (error) {
    core.endGroup();
    core.setFailed(`Action failed: ${error}`);
  }
}

/**
 * Chooses the base ref to use, based on the inputs and event context.
 */
function chooseBaseRef(inputs: RunInputs, headRef: string) {
  if (inputs.baseRef) {
    return inputs.baseRef;
  }
  if (github.context.eventName === "pull_request") {
    if (
      !github.context.payload.pull_request ||
      !github.context.payload.pull_request.base.ref
    ) {
      throw new Error("Base ref is not available in pull request context.");
    }
    return github.context.payload.pull_request.base.ref;
  }

  // For push, merge_group, schedule, workflow_dipatch, etc...
  // Compare only the most recent commit
  return `${headRef}^`;
}
