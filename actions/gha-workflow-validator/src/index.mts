import * as core from "@actions/core";
import * as github from "@actions/github";
import { commentOnPrOrUpdateExisting, deleteCommentOnPRIfExists, getComparison } from "./github.mjs";
import { ValidationResult, validateActionReferenceChanges } from "./action-reference-validations.mjs";
import { parseAllAdditions } from "./utils.mjs";
import { COMMENT_HEADER, collapsibleContent, addFixingErrorsSuffix, markdownLink } from "./strings.mjs";

(async () => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.setFailed('GitHub token is not set.');
    process.exit(1);
  }

  const octokit = github.getOctokit(token);

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

  const files = await getComparison(octokit, owner, repo, base, head);
  const filteredFiles =  files?.filter(entry => {
    return (entry.filename.startsWith('.github/workflows') || entry.filename.startsWith('.github/actions'))
    && (entry.filename.endsWith('.yml') || entry.filename.endsWith('.yaml'))
  });

  const patchAdditions = parseAllAdditions(filteredFiles);

  const containsWorkflowModifications = patchAdditions.some(file => {
    return (file.filename.startsWith('.github/workflows') || file.filename.startsWith('.github/actions')) && (file.filename.endsWith('.yml') || file.filename.endsWith('.yaml'))
  });

  if (containsWorkflowModifications) {
    const actionReferenceValidations = await validateActionReferenceChanges(octokit, patchAdditions)
    const validationFailed = actionReferenceValidations.some(validation => validation.lineValidations.length > 0);

    if (validationFailed && pr) {
      const errorMessage = formatGithubComment(actionReferenceValidations, owner, repo, head);
      commentOnPrOrUpdateExisting(octokit, owner, repo, pr.number, errorMessage);
      core.setFailed("Errors found in workflow files. See comment on for details.");
    } else if (validationFailed) {
      core.setFailed("Errors found in workflow files. See logs for details.");
      // TODO handle general workflow case
    } else if (pr) {
      deleteCommentOnPRIfExists(octokit, owner, repo, pr.number);
    }
  }
})().catch((err) => {
  core.error(err);
  core.setFailed(err.message);
});


function formatGithubComment(validationResults: ValidationResult[], owner: string, repo: string, ref: string): string {
  let githubComment = COMMENT_HEADER + "\n\n";

  for (const result of validationResults) {
    const fileLinesErrorMessages = result.lineValidations.map(lineErrors => {
      const fileLink = markdownLink(`Line ${lineErrors.line.lineNumber}`, `https://github.com/${owner}/${repo}/blob/${ref}/${result.filename}#L${lineErrors.line.lineNumber}`);
      const lineErrorsMsg = lineErrors.validationErrors.reduce((acc, curr) => {
        return acc + `    - ${curr.message}` + "\n";
      }, "");

      return fileLink + "\n" + lineErrorsMsg;
    });

    githubComment += collapsibleContent(result.filename, fileLinesErrorMessages.join("\n\n")) + "\n";
  };

  return addFixingErrorsSuffix(githubComment);
}