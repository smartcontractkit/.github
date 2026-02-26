import * as core from "@actions/core";
import * as github from "@actions/github";

import { join } from "path";

import {
  generateExportAtRef,
  parseApidiffOutput,
  installApidiff,
  diffExports,
} from "./apidiff";
import { validateGitRepositoryRoot, getRepoTags } from "./git";
import { upsertPRComment } from "./github";
import { CL_LOCAL_DEBUG, getInputs, getInvokeContext } from "./run-inputs";
import {
  formatApidiffMarkdown,
  formatApidiffJobSummary,
} from "./string-processor";

import { findLatestVersionFromTags, getGoModuleName } from "./util";

import type { InvokeContext, RunInputs } from "./run-inputs";
export async function run(): Promise<void> {
  try {
    // 1. Get inputs and context
    core.startGroup("Inputs and Context");
    const inputs = getInputs();
    const context = getInvokeContext();
    const octokit = github.getOctokit(context.token);

    await validateGitRepositoryRoot(inputs.repositoryRoot);

    if (context.event.eventName === "workflow_dispatch") {
      if (!inputs.headRefOverride) {
        core.error("head-ref-override input is required for workflow_dispatch events.");
      }
      if (!inputs.baseRefOverride) {
        core.error("base-ref-override input is required for workflow_dispatch events.");
      }
      throw new Error("Missing required inputs for workflow_dispatch event.");
    };

    const qualifiedModuleDirectory = join(
      inputs.repositoryRoot,
      inputs.moduleDirectory,
    );
    core.info(`Qualified module directory: ${qualifiedModuleDirectory}`);
    const moduleName = await getGoModuleName(qualifiedModuleDirectory);
    core.info(`Module name: ${moduleName}`);

    core.endGroup();

    // 2. Install apidiff tool
    core.startGroup("Installing apidiff");
    await installApidiff(qualifiedModuleDirectory, inputs.apidiffVersion);
    core.endGroup();

    // 3. Generate exports
    core.startGroup("Generating Exports");
    const headRef = inputs.headRefOverride || context.event.head;
    const headExport = await generateExportAtRef(
      qualifiedModuleDirectory,
      headRef,
    );
    core.info(`Generated head export at: ${headExport.path}`);

    const baseRef = inputs.baseRefOverride || context.event.base;
    const baseExport = await generateExportAtRef(
      qualifiedModuleDirectory,
      baseRef,
    );
    core.info(`Generated base export at: ${baseExport.path}`);

    // TODO: support comparing against latest tagged version (DX-2323)
    // const latestExport = await generateExportForLatestVersion(
    //   context,
    //   inputs.repositoryRoot,
    //   inputs.moduleDirectory,
    // );
    // if (latestExport) {
    //   core.info(`Generated latest version export at: ${latestExport.path}`);
    // }
    core.endGroup();

    // 4. Diff and parse export
    core.startGroup("Diff, Parse Exports");
    core.info(`Diffing base (${baseExport.ref}) -> head (${headExport.ref})`);
    const baseHeadDiff = await diffExports(baseExport, headExport);

    // TODO: support comparing against latest tagged version (DX-2323)
    // let latestHeadDiff = null;
    // if (latestExport) {
    //   core.info(
    //     `Diffing latest (${latestExport.ref}) -> head (${headExport.ref})`,
    //   );
    //   latestHeadDiff = await diffExports(latestExport, headExport);
    // }
    core.endGroup();

    // 5. Parse apidiff outputs
    core.startGroup("Parsing apidiff Outputs");

    const parsedResult = parseApidiffOutput(moduleName, baseHeadDiff);
    if (core.isDebug()) {
      core.debug(JSON.stringify(parsedResult));
    }

    // 4. Format and output results
    core.startGroup("Formatting and Outputting Results");
    formatApidiffJobSummary(parsedResult);

    if (context.event.eventName === "pull_request") {
      const markdownOutputIncompatibleOnly = formatApidiffMarkdown(
        parsedResult,
        inputs.summaryUrl,
        true,
      );

      if (CL_LOCAL_DEBUG) {
        core.info("Markdown Output (Incompatible Only):");
        core.info(markdownOutputIncompatibleOnly);
      }

      if (inputs.postComment) {
        await upsertPRComment(
          octokit,
          context.owner,
          context.repo,
          context.event.prNumber,
          markdownOutputIncompatibleOnly,
          moduleName,
        );
      }
    }
    core.endGroup();

    const incompatibleCount = [parsedResult].reduce(
      (sum, diff) => sum + diff.incompatible.length,
      0,
    );
    core.info(`Total incompatible changes: ${incompatibleCount}`);
    if (inputs.enforceCompatible && incompatibleCount > 0) {
      core.setFailed(
        `Incompatible API changes detected. See PR comment, or summary for details.`,
      );
    }
  } catch (error) {
    core.endGroup();
    core.setFailed(`Action failed: ${error}`);
  }
}

// TODO: support comparing against latest tagged version (DX-2323)
async function generateExportForLatestVersion(
  context: InvokeContext,
  repositoryRoot: string,
  moduleDirectory: string,
) {
  if (context.event.eventName !== "push") {
    return null;
  }
  core.info("Push event detected. Diffing with latest tagged version.");
  const tags = await getRepoTags(repositoryRoot);
  const latest = findLatestVersionFromTags(moduleDirectory, tags);
  if (!latest) {
    core.info("Latest version not found. Skipping export generation.");
    return null;
  }

  const qualifiedModuleDirectory = join(repositoryRoot, moduleDirectory);
  return generateExportAtRef(qualifiedModuleDirectory, latest.tag);
}
