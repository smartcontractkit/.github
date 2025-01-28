import * as core from "@actions/core";
import * as github from "@actions/github";

import { getParsedFilesForValidation } from "./parse-files.js";
import { logValidationMessages, setSummary } from "./output.js";
import { validate, doValidationErrorsExist } from "./validations/validate.js";

export interface RunInputs {
  evaluateMode: boolean;
  validateRunners: boolean;
  validateActionRefs: boolean;
  validateActionNodeVersion: boolean;
  validateAllActionDefinitions: boolean;
  rootDir: string;
  diffOnly: boolean;
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

  const fileValidations = await validate(inputs, parsedFiles, octokit);

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
    diffOnly: ["diff-only", core.getBooleanInput],
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
