import * as github from "@actions/github";
import * as core from "@actions/core";

import { CL_LOCAL_DEBUG, getInvokeContext, getInputs } from "./run-inputs";
import { getChangedFilesForPR } from "./github";
import { findGoModuleRoots, runGoModernize } from "./go-mods";
import { getLocalDiff, filterLocalDiffToPRFiles, createSuggestionCommentsFromDiff } from "./diff-util";}


export async function run(): Promise<void> {
  try {
    core.startGroup("Context");
    const context= getInvokeContext();
    const { token, owner, repo, prNumber } = context;
    core.debug(`Context: ${JSON.stringify(context, null, 2)}`);

    const octokit = github.getOctokit(token);
    const inputs = getInputs();
    core.debug(`Inputs: ${JSON.stringify(inputs)}`);
    core.endGroup();

    core.startGroup("Get Changed Files");
    const changedFiles = await getChangedFilesForPR(
      octokit,
      owner,
      repo,
      prNumber,
    );
    core.info(`Changed files count: ${changedFiles.length}`);
    const changedFilePaths = changedFiles.map(file => file.filename);
    core.debug(`Changed files: ${changedFilePaths.join(", ")}`);
    core.endGroup();

    core.startGroup("Run Go Modernize");
    const goModuleRoots = await findGoModuleRoots();
    await runGoModernize(goModuleRoots);
    core.endGroup();

    core.startGroup("Check for local changes");
    const localDiff = await getLocalDiff(process.cwd());
    if (localDiff.length === 0) {
      core.info("No local changes detected after running modernize.");
      core.endGroup();
      return;
    }
    const modifiedPRPaths = filterLocalDiffToPRFiles(
      localDiff,
      changedFilePaths,
    );
    core.info(`Modified files in PR after modernize: ${modifiedPRPaths.length}`);
    core.debug(`Modified PR files: ${modifiedPRPaths.map(f => f.newPath || f.oldPath).join(", ")}`);
    if (modifiedPRPaths.length === 0) {
      core.info("No modified files overlap with PR changed files.");
      core.endGroup();
      return;
    }

    core.startGroup("Annotate PR with suggestions");

    const suggestions = createSuggestionCommentsFromDiff(modifiedPRPaths);
    


    core.endGroup();









  } catch (error) {
    core.endGroup();
    core.setFailed(`Action failed: ${error}`);
  }
}
