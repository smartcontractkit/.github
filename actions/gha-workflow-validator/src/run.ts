import * as core from "@actions/core";
import * as github from "@actions/github";
import { getComparison, Octokit } from "./github.js";
import { ActionReferenceValidation } from "./action-reference-validations.js";
import { FileValidationResult } from "./validation-check.js";
import {
  getAllWorkflowAndActionFiles,
  filterForRelevantChanges,
  logErrors,
  parseGithubDiff,
  parseFiles,
  ParsedFile,
  setSummary,
} from "./utils.js";

interface RunInputs {
  validateRunners: boolean;
  validateActionRefs: boolean;
  validateActionNodeVersion: boolean;
  validateAllActionDefinitions: boolean;

  rootDir: string;
}

type InvokeContext = ReturnType<typeof getInvokeContext>;

export async function run() {
  const context = getInvokeContext();
  const inputs = getInputs();
  const octokit = github.getOctokit(context.token);

  const parsedFiles = await getParsedFilesForValidation(
    context,
    inputs,
    octokit,
  );
  if (parsedFiles.length === 0) {
    core.info("No workflow files found in the changeset.");
    process.exit(0);
  }

  const validations = await validate(inputs, parsedFiles, octokit);
  const validationFailed = validations.some(
    (validation) => validation.lineValidations.length > 0,
  );

  const invokedThroughPr = !context.prNumber;
  const urlPrefix = `https://github.com/${context.owner}/${context.repo}/blob/${context.head}`;

  if (!validationFailed) {
    return core.info("No errors found in workflow files.");
  }

  logErrors(validations, invokedThroughPr);
  await setSummary(validations, urlPrefix);
  core.info(
    `Summary: https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`,
  );
  return core.setFailed(
    "Errors found in workflow files. See inlined annotations on PR changes, or workflow summary for details.",
  );
}

export async function getParsedFilesForValidation(
  context: InvokeContext,
  inputs: RunInputs,
  octokit: Octokit,
): Promise<ParsedFile[]> {
  if (context.prNumber) {
    if (!context.base || !context.head) {
      core.setFailed(
        `Missing one of base or head commit SHA. Base: ${context.base}, Head: ${context.head}`,
      );
      process.exit(1);
    }
    core.debug(
      `Getting diff workflow/actions files for PR: ${context.prNumber}`,
    );
    const allFiles = await getComparison(
      github.getOctokit(context.token),
      context.owner,
      context.repo,
      context.base,
      context.head,
    );
    const ghaWorkflowFiles = filterForRelevantChanges(
      allFiles,
      inputs.validateAllActionDefinitions,
    );
    return parseGithubDiff(ghaWorkflowFiles);
  } else {
    core.debug("Getting all workflow/action files in the repository.");
    const filePaths = await getAllWorkflowAndActionFiles(
      inputs.rootDir,
      inputs.validateAllActionDefinitions,
    );
    return parseFiles(filePaths);
  }
}

export async function validate(
  inputs: RunInputs,
  parsedFiles: ParsedFile[],
  octokit: Octokit,
): Promise<FileValidationResult[]> {
  const validationResults = [];
  const actionReferenceValidator = new ActionReferenceValidation(octokit, {
    validateNodeVersion: inputs.validateActionNodeVersion,
  });
  for (const file of parsedFiles) {
    core.debug(`Processing: ${file.filename}`);
    validationResults.push(await actionReferenceValidator.validate(file));
  }
  return validationResults;
}

export function getInvokeContext() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    core.setFailed("GitHub token is not set.");
    return process.exit(1);
  }

  const { context } = github;
  const { pull_request } = context.payload;
  const { owner, repo } = github.context.repo;

  const base: string | undefined = pull_request?.base.sha;
  const head: string | undefined = pull_request?.head.sha;
  const prNumber: number | undefined = pull_request?.number;

  core.debug(`Event name: ${context.eventName}`);
  core.debug(
    `Owner: ${owner}, Repo: ${repo}, Base: ${base}, Head: ${head}, PR: ${
      prNumber ?? "N/A"
    }`,
  );

  return { token, owner, repo, base, head, prNumber };
}

function getInputs(): RunInputs {
  const isLocalDebug = process.env.CL_LOCAL_DEBUG;

  const inputKeys = {
    validateRunners: "validate-runners",
    validateActionRefs: "validate-action-refs",
    validateActionNodeVersions: "validate-action-node-versions",
    includeAllActionDefinitions: "include-all-action-definitions",
    rootDir: "root-directory",
  };

  if (isLocalDebug) {
    // change all dashes to underscore in input keys because most shells don't support dashes in env variables
    for (const [key, value] of Object.entries(inputKeys)) {
      inputKeys[key as keyof typeof inputKeys] = value.replace(/-/g, "_");
    }
  }

  return {
    validateRunners: core.getBooleanInput("validate_runners"),
    validateActionRefs: core.getBooleanInput("validate_action_refs"),
    validateActionNodeVersion: core.getBooleanInput(
      "validate_action_node_versions",
    ),
    validateAllActionDefinitions: core.getBooleanInput(
      "include_all_action_definitions",
    ),
    rootDir: core.getInput("root_directory"),
  };
}
