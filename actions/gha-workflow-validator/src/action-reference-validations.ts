import { ActionReference, FileAddition, ParsedFile } from './utils.js';
import { Octokit, getActionFileFromGithub } from './github.js';
import * as core from "@actions/core";

export interface ValidationResult {
  filename: string;
  sha: string;
  lineValidations: LineValidationResult[];
}

interface LineValidationResult {
  line: FileAddition;
  validationErrors: ValidationError[];
}

type ValidationError = { message: string; };

export async function validateActionReferenceChanges(octokit: Octokit, changes: ParsedFile[]): Promise<ValidationResult[]> {
  core.debug(`Validating action reference changes, on ${changes.length} changes`)

  const resultsPromise = changes.map(async (change) => {
    const lineValidationPromises  = change.addedLines.filter(addedLine => addedLine.actionReference).map(async (line) => {
      const validationErrors = (line.actionReference) ? await validateLine(octokit, line.actionReference) : [];
      return { line: line, validationErrors };
    });

    const nonEmptyLineValidations = (await Promise.all(lineValidationPromises)).filter((error) => error.validationErrors.length > 0);

    return {
      filename: change.filename,
      sha: change.sha,
      lineValidations: nonEmptyLineValidations,
    };
  });

  const filteredResults = (await Promise.all(resultsPromise)).filter((result) => result.lineValidations.length > 0);
  core.debug(`Found ${filteredResults.length} files with validation errors`);
  return filteredResults
}

async function validateLine(octokit: Octokit, line: ActionReference): Promise<ValidationError[]> {
  const validationErrors: ValidationError[] = [];

  const shaRefValidation = usesShaRef(line);
  const versionCommentValidation = hasVersionComment(line);
  const node20ActionValidation = await isNode20Action(octokit, line);

  if (shaRefValidation) {
    validationErrors.push({ message: shaRefValidation });
  }
  if (versionCommentValidation) {
    validationErrors.push({ message: versionCommentValidation });
  }
  if (node20ActionValidation) {
    validationErrors.push({ message: node20ActionValidation });
  }

  return validationErrors;
}

function usesShaRef(change: ActionReference) {
  const sha1Regex = /^[0-9a-f]{40}$/;
  if(sha1Regex.test(change.ref)) return;

  return `${change.ref} is not a valid SHA1`;
}

function hasVersionComment(change: ActionReference) {
  if (change.comment) return;

  return `No version comment found`
}

async function isNode20Action(ghClient: Octokit, change: ActionReference) {
  const actionFile = await getActionFileFromGithub(
    ghClient,
    change.owner,
    change.repo,
    change.repoPath,
    change.ref,
  );

  if (!actionFile) {
    core.warning(`No action file found for ${change.owner}/${change.repo}${change.repoPath}@${change.ref}`);
    return;
  }

  const nodeVersionRegex = /^\s+using:\s*"?node(\d{2})"?/gm;
  const matches = nodeVersionRegex.exec(actionFile);
  if (matches && matches[1] !== '20') {
    return `Action is using node${matches[1]}`;
  }

  return;
}