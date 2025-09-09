import * as core from "@actions/core";

import { installApidiff, runApidiff } from "./apidiff";
import { setupWorktree, cleanupWorktrees } from "./git-worktree";
import { getSummaryUrl, upsertPRComment } from "./github";
import { getInputs, getInvokeContext } from "./run-inputs";
import { parseApidiffOutputs, formatApidiffMarkdown } from "./string-processor";

export async function run(): Promise<void> {
  try {
    // 1. Get inputs and context
    core.startGroup("Inputs and Context");
    const inputs = getInputs();
    const context = getInvokeContext();
    core.endGroup();

    // 2. Set up worktrees for comparing old (base) vs new (head) refs
    const worktreeResult = await setupWorktree(
      inputs.directory,
      inputs.baseRef,
      inputs.headRef,
      context.repo, // Repository name from GitHub context
    );

    // 3. Run API diff between the two worktrees
    await installApidiff(inputs.apidiffVersion);
    const apidiffOutputs = await runApidiff(
      worktreeResult.baseRepoPath, // Base directory (old version)
      worktreeResult.headRepoPath, // Head directory (new version)
      inputs.goModPaths, // Relative paths to go.mod files
    );

    const parsedOutputs = parseApidiffOutputs(apidiffOutputs);
    if (core.isDebug()) {
      core.debug(JSON.stringify(parsedOutputs));
    }

    // 4. Format and output results
    core.startGroup("Formatting and Outputting Results");
    const markdownOutputAll = formatApidiffMarkdown(parsedOutputs, "", true);
    await core.summary.addRaw(markdownOutputAll).write();

    if (context.prNumber) {
      const summaryUrl = await getSummaryUrl(
        context.token,
        context.owner,
        context.repo,
      );

      const markdownOutputIncompatibleOnly = formatApidiffMarkdown(
        parsedOutputs,
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

    const incompatibleCount = parsedOutputs.reduce(
      (sum, diff) => sum + diff.incompatible.length,
      0,
    );
    core.info(`Total incompatible changes: ${incompatibleCount}`);
    if (inputs.enforceCompatible && incompatibleCount > 0) {
      core.setFailed(
        `Incompatible API changes detected. See PR comment, or summary for details.`,
      );
    }

    // Clean up worktrees when done
    await cleanupWorktrees(worktreeResult);
  } catch (error) {
    core.endGroup();
    core.setFailed(`Action failed: ${error}`);
  }
}
