import * as core from "@actions/core";
import * as github from "@actions/github";
import { getComparison } from "./github.js";
import { validateActionReferenceChanges } from "./action-reference-validations.js";
import {
  filterForRelevantChanges,
  logErrors,
  parseAllAdditions,
  setSummary,
} from "./utils.js";

const inputKeys = {
  includeAllActionDefinitions: "include-all-action-definitions",
};

export async function run() {
  const { token, owner, repo, base, head, prNumber } = getInvokeContext();
  const octokit = github.getOctokit(token);

  const includeAllActionDefinitions = core.getBooleanInput(
    inputKeys.includeAllActionDefinitions,
  );

  const allFiles = await getComparison(octokit, owner, repo, base, head);
  const ghaWorkflowFiles = filterForRelevantChanges(
    allFiles,
    includeAllActionDefinitions,
  );
  const ghaWorkflowPatchAdditions = parseAllAdditions(ghaWorkflowFiles);

  if (ghaWorkflowPatchAdditions.length === 0) {
    return core.info("No workflow files found in the changeset.");
  }

  const actionReferenceValidations = await validateActionReferenceChanges(
    octokit,
    ghaWorkflowPatchAdditions,
  );
  const validationFailed = actionReferenceValidations.some(
    (validation) => validation.lineValidations.length > 0,
  );
  const invokedThroughPr = !prNumber;
  const urlPrefix = `https://github.com/${owner}/${repo}/blob/${head}`;

  if (!validationFailed) {
    return core.info("No errors found in workflow files.");
  }

  logErrors(actionReferenceValidations, invokedThroughPr);
  await setSummary(actionReferenceValidations, urlPrefix);
  core.info(
    `Summary: https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`,
  );
  return core.setFailed(
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

  let base: string | undefined = undefined;
  let head: string | undefined = undefined;

  core.debug(`Event name: ${context.eventName}`);

  if (context.eventName === "pull_request" && pull_request) {
    base = pull_request.base.sha;
    head = pull_request.head.sha;
  } else if (context.eventName === "push") {
    head = context.payload.after;
    base = context.payload.before;
  }

  if (!base || !head) {
    core.debug(`Base: ${base}, Head: ${head}`);
    core.setFailed("Either base or head commit SHA is not determined.");
    return process.exit(1);
  }

  core.debug(
    `Owner: ${owner}, Repo: ${repo}, Base: ${base}, Head: ${head}, PR: ${
      pull_request?.number ?? "N/A"
    }`,
  );

  return { token, owner, repo, base, head, prNumber: pull_request?.number };
}
