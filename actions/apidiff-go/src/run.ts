import * as core from "@actions/core";

import { installApidiff, runApidiff } from "./apidiff";
import { setupWorktree, cleanupWorktrees } from "./git-worktree";
import { getSummaryUrl, upsertPRComment } from "./github";
import { getInputs, getInvokeContext } from "./run-inputs";
import { parseApidiffOutput, formatApidiffMarkdown } from "./string-processor";

export async function run(): Promise<void> {
  try {
    // 1. Get inputs and context
    core.startGroup("Inputs and Context");
    const inputs = getInputs();
    const context = getInvokeContext();
    core.endGroup();

    // 2. Set up worktrees for comparing old (base) vs new (head) refs
    core.startGroup("Setting up git worktree");
    const worktreeResult = await setupWorktree(
      inputs.directory,
      inputs.baseRef,
      inputs.headRef,
      context.repo, // Repository name from GitHub context
    );
    core.info(`Main repo (${context.head}): ${worktreeResult.headRepoPath}`);
    core.info(`Worktree (${context.base}): ${worktreeResult.baseRepoPath}`);
    core.endGroup();

    // 3. Run API diff between the two worktrees
    core.startGroup("Running apidiff");
    await installApidiff();
    const apidiffOutput = await runApidiff(
      worktreeResult.baseRepoPath, // Base directory (old version)
      worktreeResult.headRepoPath, // Head directory (new version)
      inputs.goModPath, // Relative path to go.mod
    );

    const parsedOutput = parseApidiffOutput(apidiffOutput);
    if (core.isDebug()) {
      core.debug(JSON.stringify(parsedOutput));
    }
    core.endGroup();

    // 4. Format and output results
    core.startGroup("Formatting and Outputting Results");
    const markdownOutputAll = formatApidiffMarkdown(parsedOutput, "", true);
    await core.summary.addRaw(markdownOutputAll).write();

    if (context.prNumber) {
      const summaryUrl = await getSummaryUrl(
        context.token,
        context.owner,
        context.repo,
      );

      const markdownOutputIncompatibleOnly = formatApidiffMarkdown(
        parsedOutput,
        summaryUrl,
        false,
      );
      await upsertPRComment(
        context.token,
        context.owner,
        context.repo,
        context.prNumber,
        markdownOutputIncompatibleOnly,
      );
    }

    core.endGroup();

    if (inputs.enforceCompatible && parsedOutput.incompatible.length > 0) {
      core.setFailed(`Incompatible API changes detected.`);
    }

    // Clean up worktrees when done
    await cleanupWorktrees(worktreeResult);
  } catch (error) {
    core.endGroup();
    core.setFailed(`Action failed: ${error}`);
  }
}
