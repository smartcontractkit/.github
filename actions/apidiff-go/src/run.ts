import * as core from "@actions/core";
import * as github from "@actions/github";

import { join } from "path";

import {
  generateExportAtRef,
  parseApidiffOutput,
  installApidiff,
  diffExports,
} from "./apidiff";
import { validateGitRepositoryRoot, findMergeBase } from "./git";
import { upsertPRComment } from "./github";
import { CL_LOCAL_DEBUG, getInputs, getInvokeContext } from "./run-inputs";
import {
  formatApidiffMarkdown,
  formatApidiffJobSummary,
} from "./string-processor";

import {
  getGoModuleName,
  copySummaryOutputFile,
  recommendVersionBump,
} from "./util";

export async function run(): Promise<void> {
  try {
    // 1. Get inputs and context
    core.startGroup("Inputs and Context");
    const inputs = getInputs();
    const context = getInvokeContext();
    const octokit = github.getOctokit(context.token);

    await validateGitRepositoryRoot(inputs.repositoryRoot);

    const qualifiedModuleDirectory = join(
      inputs.repositoryRoot,
      inputs.moduleDirectory,
    );
    core.info(`Qualified module directory: ${qualifiedModuleDirectory}`);
    const moduleName = await getGoModuleName(qualifiedModuleDirectory);
    core.info(`Module name: ${moduleName}`);

    const headRef = determineRef("head", context, inputs.headRefOverride);
    let baseRef = determineRef("base", context, inputs.baseRefOverride);
    core.info(`Head ref: ${headRef}, Base ref: ${baseRef}`);

    if (!inputs.baseRefOverride) {
      try {
        const mergeBase = await findMergeBase(
          inputs.repositoryRoot,
          headRef,
          baseRef,
        );
        core.info(
          `Using merge base ${mergeBase} instead of target branch HEAD ${baseRef}`,
        );
        baseRef = mergeBase;
      } catch (error) {
        core.warning(
          `Could not find merge base, falling back to base ref ${baseRef}: ${error}`,
        );
      }
    }

    core.endGroup();

    // 2. Install apidiff tool
    core.startGroup("Installing apidiff");
    await installApidiff(qualifiedModuleDirectory, inputs.apidiffVersion);
    core.endGroup();

    // 3. Generate exports
    core.startGroup("Generating Exports");

    const headExport = await generateExportAtRef(
      qualifiedModuleDirectory,
      headRef,
    );
    core.info(`Generated head export at: ${headExport.path}`);

    const baseExport = await generateExportAtRef(
      qualifiedModuleDirectory,
      baseRef,
    );
    core.info(`Generated base export at: ${baseExport.path}`);
    core.endGroup();

    // 4. Diff and parse export
    core.startGroup("Diff, Parse Exports");
    core.info(`Diffing base (${baseExport.ref}) -> head (${headExport.ref})`);
    const baseHeadDiff = await diffExports(baseExport, headExport);

    core.endGroup();

    // 5. Parse apidiff outputs
    core.startGroup("Parsing apidiff Outputs");

    const parsedResult = parseApidiffOutput(moduleName, baseHeadDiff);
    if (core.isDebug()) {
      core.debug(JSON.stringify(parsedResult));
    }

    // 4. Format and output results
    core.startGroup("Formatting and Outputting Results");

    const formatRef = (ref: string, resolvedRef: string) =>
      ref === resolvedRef ? ref : `${ref} (${resolvedRef})`;

    const formattedBaseRef = formatRef(baseRef, baseExport.resolvedRef);
    const formattedHeadRef = formatRef(headRef, headExport.resolvedRef);
    // await so when we copy the file, we know the summary has been written
    const summaryPath = join(
      inputs.repositoryRoot,
      inputs.moduleDirectory,
      "summary.md",
    );
    await formatApidiffJobSummary(
      parsedResult,
      formattedBaseRef,
      formattedHeadRef,
    );
    copySummaryOutputFile(summaryPath);
    core.setOutput("summary-path", summaryPath);

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

    const compatibleCount = parsedResult.compatible.length;
    const incompatibleCount = parsedResult.incompatible.length;
    const metaCount = parsedResult.meta.length;
    core.info(
      `Detected ${compatibleCount} compatible, ${incompatibleCount} incompatible, and ${metaCount} metadata changes.`,
    );

    core.setOutput(
      "version-recommendation",
      recommendVersionBump(parsedResult),
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

function determineRef(
  property: "head" | "base",
  context: ReturnType<typeof getInvokeContext>,
  override?: string,
) {
  if (override) {
    return override;
  }
  if (context.event.eventName === "workflow_dispatch") {
    throw new Error(
      `Missing required ${property}-ref-override input for workflow_dispatch event.`,
    );
  }
  return context.event[property];
}
