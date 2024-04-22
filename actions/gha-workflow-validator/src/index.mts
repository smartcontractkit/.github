import * as core from "@actions/core";
import * as github from "@actions/github";
import { commentOnPr, getComparison } from "./github.mjs";
import { ValidationResult, validateActionReferenceChanges } from "./action-reference-validations.mjs";
import { ActionReference, parseAllAdditions } from "./utils.mjs";

(async () => {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error('GitHub token is not set.');
  }

  const octokit = github.getOctokit(token);

  const { owner, repo } = github.context.repo;


  const pr = github.context.payload.pull_request;
  let base: string | undefined = undefined;
  let head: string = 'HEAD';

  if (github.context.eventName === 'pull_request') {
    base = pr?.base?.sha;
    head = pr?.head?.sha;
  } else if (github.context.eventName === 'push') {
    head = github.context.payload.after;
    base = github.context.payload.before;
  }

  if (!base) {
    throw new Error('Base commit SHA is not determined.');
  }

  const files = await getComparison(octokit, owner, repo, base, head);
  const filteredFiles =  files?.filter(entry => {
    return (entry.filename.startsWith('.github/workflows') || entry.filename.startsWith('.github/actions'))
    && (entry.filename.endsWith('.yml') || entry.filename.endsWith('.yaml'))
  });

  const patchAdditions = parseAllAdditions(filteredFiles);

  const actionReferenceValidations = await validateActionReferenceChanges(octokit, patchAdditions)

  const errorMessage = createErrorOutput(actionReferenceValidations);
  if (errorMessage) {
    core.setFailed("Errors found in workflow files. See error output for details.");

    if (pr) {
      commentOnPr(octokit, owner, repo, pr.number, errorMessage);
    }
  }

})().catch((err) => {
  core.error(err);
  core.setFailed(err.message);
});


function createErrorOutput(validationResults: ValidationResult[]): string {
  if  (validationResults.length === 0) {
    return "";
  }

  let errorOutput = "";

  for (const result of validationResults) {
    let currentFileErrorMessage = `${result.filename}`

    const lineErrors = result.lineValidations.map(lineErrors => {
      let lineMsg = `\n  - Line ${lineErrors.line.lineNumber} (${lineErrors.line.content.trim()}): `;
      lineMsg += lineErrors.validationErrors.reduce((acc, curr) => {
        return acc + "    - " + curr.message + "\n";
      }, "\n");

      return lineMsg;
    });

    currentFileErrorMessage += lineErrors.join(", ");
    errorOutput += currentFileErrorMessage + "\n";
  }

  return errorOutput;
}