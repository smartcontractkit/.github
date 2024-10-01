import * as core from "@actions/core";
import * as github from "@actions/github";
import { getComparison, Octokit } from "./github.js";
import { ActionReferenceValidation } from "./validations/action-reference-validations.js";
import { ActionsRunnerValidation } from "./validations/actions-runner-validations.js";
import { IgnoresCommentValidation } from "./validations/ignores-comment-validation.js";
import { FileValidationResult } from "./validations/validation-check.js";
import {
  doValidationErrorsExist,
  processLineValidationResults,
  getAllWorkflowAndActionFiles,
  filterForRelevantChanges,
  parseGithubDiff,
  parseFiles,
  ParsedFile,
} from "./utils.js";
import { logValidationMessages, setSummary } from "./output.js";

export interface RunInputs {
  evaluateMode: boolean;
  validateRunners: boolean;
  validateActionRefs: boolean;
  validateActionNodeVersion: boolean;
  validateAllActionDefinitions: boolean;
  rootDir: string;
}

export type InvokeContext = ReturnType<typeof getInvokeContext>;

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

  const fileValidations = await validate(context, inputs, parsedFiles, octokit);

  const invokedThroughPr = !!context.prNumber;
  const urlPrefix = `https://github.com/${context.owner}/${context.repo}/blob/${context.head}`;

  logValidationMessages(fileValidations, invokedThroughPr);
  await setSummary(fileValidations, urlPrefix);

  const validationFailed = doValidationErrorsExist(fileValidations);
  core.info(
    `Summary: https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`,
  );
  if (!validationFailed) {
    return core.info("No errors found in workflow files.");
  }

  if (inputs.evaluateMode) {
    core.warning(
      "Errors found in workflow files. Evaluate mode enabled, not failing the workflow.",
    );
    return;
  }
  core.setFailed(
    "Errors found in workflow files. See inlined annotations on PR changes, or workflow summary for details.",
  );
}

// Exported for testing only
export async function getParsedFilesForValidation(
  context: InvokeContext,
  inputs: RunInputs,
  octokit: Octokit,
): Promise<ParsedFile[]> {
  if (!!context.prNumber) {
    if (!context.base || !context.head) {
      core.setFailed(
        `Missing one of base or head commit SHA. Base: ${context.base}, Head: ${context.head}`,
      );
      return process.exit(1);
    }
    core.debug(
      `Getting diff workflow/actions files for PR: ${context.prNumber}`,
    );
    const allFiles = await getComparison(
      octokit,
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

async function validate(
  { prNumber }: InvokeContext,
  inputs: RunInputs,
  parsedFiles: ParsedFile[],
  octokit: Octokit,
): Promise<FileValidationResult[]> {
  core.debug(`Validating ${parseFiles.length} files`);

  const actionReferenceValidator = new ActionReferenceValidation(octokit, {
    validateNodeVersion: inputs.validateActionNodeVersion,
  });
  const actionsRunnerValidator = new ActionsRunnerValidation();
  const ignoresCommentsValidator = new IgnoresCommentValidation();

  const validationResults = [];
  for (const file of parsedFiles) {
    core.info(`Processing: ${file.filename}`);
    if (!!prNumber) {
      file.lines = file.lines.filter((line) => line.operation === "add");
    }

    const ignoresCommentsResults =
      await ignoresCommentsValidator.validate(file);
    const actionReferenceResults = inputs.validateActionRefs
      ? await actionReferenceValidator.validate(file)
      : undefined;
    const actionsRunnerResults = inputs.validateRunners
      ? await actionsRunnerValidator.validate(file)
      : undefined;
    const combinedLineValidations = [
      ignoresCommentsResults,
      actionReferenceResults,
      actionsRunnerResults,
    ]
      .filter((result) => !!result)
      .flatMap((result) => result.lineValidations);

    const processedLineValidations = processLineValidationResults(
      combinedLineValidations,
    );

    core.info(
      `Found ${processedLineValidations.length} total problems in ${file.filename}`,
    );

    if (processedLineValidations.length === 0) {
      continue;
    }

    core.info(
      `Found ${ignoresCommentsResults?.lineValidations.length ?? 0} problems w/ ignore comments`,
    );
    core.info(
      `Found ${actionReferenceResults?.lineValidations.length ?? 0} problems w/ action references`,
    );
    core.info(
      `Found ${actionsRunnerResults?.lineValidations.length ?? 0} problems w/ actions runners`,
    );

    validationResults.push({
      filename: file.filename,
      lineValidations: processedLineValidations,
    });
  }

  core.debug("Validation complete.");
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
  core.debug("Getting inputs for run.");
  const isLocalDebug = process.env.CL_LOCAL_DEBUG;

  const inputKeys: Record<string, [string, Function]> = {
    evaluateMode: ["evaluate-mode", core.getBooleanInput],
    validateRunners: ["validate-runners", core.getBooleanInput],
    validateActionRefs: ["validate-action-refs", core.getBooleanInput],
    validateActionNodeVersions: [
      "validate-action-node-versions",
      core.getBooleanInput,
    ],
    includeAllActionDefinitions: [
      "include-all-action-definitions",
      core.getBooleanInput,
    ],
    rootDir: ["root-directory", core.getInput],
  };

  if (isLocalDebug) {
    // change all dashes to underscore in input keys because most shells don't support dashes in env variables
    for (const [key, value] of Object.entries(inputKeys)) {
      inputKeys[key as keyof typeof inputKeys][0] = value[0].replace(/-/g, "_");
    }
  }

  const inputs = {
    evaluateMode: inputKeys.evaluateMode[1](inputKeys.evaluateMode[0]),
    validateRunners: inputKeys.validateRunners[1](inputKeys.validateRunners[0]),
    validateActionRefs: inputKeys.validateActionRefs[1](
      inputKeys.validateActionRefs[0],
    ),
    validateActionNodeVersion: inputKeys.validateActionNodeVersions[1](
      inputKeys.validateActionNodeVersions[0],
    ),
    validateAllActionDefinitions: inputKeys.includeAllActionDefinitions[1](
      inputKeys.includeAllActionDefinitions[0],
    ),
    rootDir: inputKeys.rootDir[1](inputKeys.rootDir[0]),
  };
  core.debug(`Inputs: ${JSON.stringify(inputs)}`);
  return inputs;
}
