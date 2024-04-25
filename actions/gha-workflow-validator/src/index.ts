import * as core from "@actions/core";
import * as github from "@actions/github";
import { PullRequest, getComparison } from "./github.js";
import { validateActionReferenceChanges } from "./action-reference-validations.js";
import { annotatePR, filterForGithubWorkflowChanges, formatGithubComment, parseAllAdditions, setSummary } from "./utils.js";

(async () => {
  const { token, owner, repo, base, head, prNumber } = getInvokeContext();
  const octokit = github.getOctokit(token);

  const allFiles = await getComparison(octokit, owner, repo, base, head);
  const ghaWorkflowFiles = filterForGithubWorkflowChanges(allFiles);
  const ghaWorkflowPatchAdditions = parseAllAdditions(ghaWorkflowFiles);

  const containsWorkflowModifications = ghaWorkflowPatchAdditions.some(file => {
    return (file.filename.startsWith('.github/workflows') || file.filename.startsWith('.github/actions')) && (file.filename.endsWith('.yml') || file.filename.endsWith('.yaml'))
  });

  if (containsWorkflowModifications) {
    const actionReferenceValidations = await validateActionReferenceChanges(octokit, ghaWorkflowPatchAdditions)
    const validationFailed = actionReferenceValidations.some(validation => validation.lineValidations.length > 0);
    const invokedThroughPr = prNumber !== undefined;
    const urlPrefix = `https://github.com/${owner}/${repo}/blob/${head}`;

    if (validationFailed && invokedThroughPr) {
      // const errorMessage = formatGithubComment(actionReferenceValidations, owner, repo, head);
      // await PullRequest.upsertComment(octokit, owner, repo, prNumber, errorMessage);
      annotatePR(actionReferenceValidations);
      setSummary(actionReferenceValidations, urlPrefix);
      return core.setFailed("Errors found in workflow files. See comment on for details.");
    } else if (validationFailed) {
      // If the action is not invoked through a PR, we can't comment on the PR
      setSummary(actionReferenceValidations, urlPrefix);
      return core.setFailed("Errors found in workflow files.");
    } else if (!validationFailed && invokedThroughPr) {
      await PullRequest.deleteCommentIfExists(octokit, owner, repo, prNumber);
    }
  }
})().catch((err) => {
  core.error("Uncaught Error - " + err);
  core.setFailed(err.message);
});

function getInvokeContext() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.setFailed('GitHub token is not set.');
    process.exit(1);
  }

  const { owner, repo } = github.context.repo;
  const pr = github.context.payload.pull_request;
  let base: string | undefined = undefined;
  let head: string = 'HEAD';

  core.debug(`Event name: ${github.context.eventName}`);

  if (github.context.eventName === 'pull_request') {
    base = pr?.base?.sha;
    head = pr?.head?.sha;
    core.debug(`PR: ${pr?.number} to compare: ${base}...${head} `);
  } else if (github.context.eventName === 'push') {
    head = github.context.payload.after;
    base = github.context.payload.before;
  }

  if (!base) {
    core.setFailed('Base commit SHA is not determined.');
    process.exit(1);
  }

  core.debug(`Owner: ${owner}, Repo: ${repo}, Base: ${base}, Head: ${head}`);

  return { token, owner, repo, base, head, prNumber: pr?.number };
}

