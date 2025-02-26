import { ParsedFile, FileLine } from "../parse-files.js";
import { Octokit, getActionFileFromGithub } from "../github.js";
import * as core from "@actions/core";
import {
  ValidationCheck,
  ValidationMessage,
  FileValidationResult,
  LineValidationResult,
  ValidationType,
} from "./validation-check.js";

const CURRENT_NODE_VERSION = 20;

interface FileLineActionRef extends FileLine {
  actionReference?: ActionReference;
}

interface ActionReference {
  owner: string;
  repo: string;
  repoPath: string;
  ref: string;
  comment?: string;
  isWorkflowFile?: boolean;
  trusted: boolean;
}

interface ActionRefValidationOptions {
  validateNodeVersion: boolean;
}

export class ActionRefValidation implements ValidationCheck {
  private options: ActionRefValidationOptions;

  constructor(
    readonly octokit: Octokit,
    options?: ActionRefValidationOptions,
  ) {
    this.options = options ?? { validateNodeVersion: true };
  }

  async validateLine(line: FileLine): Promise<ValidationMessage[]> {
    if (line.operation === "unchanged") {
      return [];
    }

    const fileLineActionReference = extractActionReference(line);
    return validateActionReference(
      this.octokit,
      this.options,
      fileLineActionReference.actionReference,
    );
  }
}

async function validateActionReferences(
  octokit: Octokit,
  filename: string,
  options: ActionRefValidationOptions,
  lines: FileLineActionRef[],
): Promise<LineValidationResult[]> {
  const lineValidationResults: LineValidationResult[] = [];

  for (const line of lines) {
    const validationErrors = await validateActionReference(
      octokit,
      options,
      line.actionReference,
    );

    if (validationErrors.length > 0) {
      lineValidationResults.push({
        filename,
        line,
        messages: validationErrors,
      });
    }
  }

  return lineValidationResults;
}

async function validateActionReference(
  octokit: Octokit,
  options: ActionRefValidationOptions,
  actionRef: ActionReference | undefined,
): Promise<ValidationMessage[]> {
  if (!actionRef) {
    return [];
  }

  if (actionRef.isWorkflowFile) {
    core.debug(
      `Skipping validation for workflow reference: ${actionRef.owner}/${actionRef.repo}/${actionRef.repoPath}`,
    );
    return [];
  }

  const validationErrors: ValidationMessage[] = [];

  const shaRefValidation = validateShaRef(actionRef);
  const versionCommentValidation = validateVersionCommentExists(actionRef);
  const node20ActionValidation = options.validateNodeVersion
    ? await validateNodeActionVersion(octokit, actionRef)
    : undefined;

  if (!actionRef.trusted && shaRefValidation) {
    core.debug(
      `SHA Ref Validation Failed for ${actionRef.owner}/${actionRef.repo}${actionRef.repoPath}@${actionRef.ref} - ${shaRefValidation.message}`,
    );
    validationErrors.push(shaRefValidation);
  }
  if (versionCommentValidation && !(actionRef.trusted && shaRefValidation)) {
    // Don't error on trusted actions that are using tags
    core.debug(
      `Version Comment Validation Failed for ${actionRef.owner}/${actionRef.repo}${actionRef.repoPath}@${actionRef.ref} - ${versionCommentValidation.message}`,
    );
    validationErrors.push(versionCommentValidation);
  }
  if (node20ActionValidation) {
    core.debug(
      `Node 20 Validation Failed for ${actionRef.owner}/${actionRef.repo}${actionRef.repoPath}@${actionRef.ref} - ${node20ActionValidation.message}`,
    );
    validationErrors.push(node20ActionValidation);
  }

  return validationErrors;
}

function validateShaRef(
  actionReference: ActionReference,
): ValidationMessage | undefined {
  const sha1Regex = /^[0-9a-f]{40}$/;
  if (sha1Regex.test(actionReference.ref)) return;

  const sha256Regex = /^[0-9a-f]{256}$/;
  if (sha256Regex.test(actionReference.ref)) return;

  return {
    message: `${actionReference.ref} is not a valid SHA reference`,
    type: ValidationType.SHA_REF,
    severity: "error",
  };
}

function validateVersionCommentExists(
  actionReference: ActionReference,
): ValidationMessage | undefined {
  if (actionReference.comment) return;

  return {
    message: `No version comment found`,
    type: ValidationType.VERSION_COMMENT,
    severity: "warning",
  };
}

async function validateNodeActionVersion(
  octokit: Octokit,
  actionRef: ActionReference,
): Promise<ValidationMessage | undefined> {
  const actionFile = await getActionFileFromGithub(
    octokit,
    actionRef.owner,
    actionRef.repo,
    actionRef.repoPath,
    actionRef.ref,
  );

  if (!actionFile) {
    core.warning(
      `No action file found for ${actionRef.owner}/${actionRef.repo}${actionRef.repoPath}@${actionRef.ref}`,
    );
    return;
  }

  const nodeVersionRegex = /^\s+using:\s*["']?node(\d{2})["']?/gm;
  const matches = nodeVersionRegex.exec(actionFile);
  if (matches && matches[1] !== `${CURRENT_NODE_VERSION}`) {
    return {
      message: `Action is using node${matches[1]}`,
      type: ValidationType.NODE_VERSION,
      severity: "warning",
    };
  }

  return;
}

function extractActionReference(fileLine: FileLine): FileLineActionRef {
  const actionReference = extractActionReferenceFromLine(fileLine.content);
  if (!actionReference) {
    return fileLine;
  }

  if (actionReference.isWorkflowFile) {
    core.debug(`Found workflow file reference: ${fileLine.content}`);
  }

  return {
    ...fileLine,
    actionReference,
  };
}

// Only exported for use in tests
export function extractActionReferenceFromLine(
  line: string,
): ActionReference | undefined {
  const trimmedLine = line.trim();

  if (trimmedLine.startsWith("#")) {
    // commented line
    return;
  }

  // example line (after trimming):
  // - uses: actions/checkout@v4.2.1
  // or
  // uses: actions/checkout@v4.2.1
  const possibleTrimmedPrefixes = ["- uses: ", "uses: "];
  const trimSubString = possibleTrimmedPrefixes.find((prefix) =>
    trimmedLine.startsWith(prefix),
  );

  if (!trimSubString) {
    // Not an action reference
    return;
  }

  // trim past the "uses:" substring to get "<owner>/<repo><optional path>@<ref> # <optional comment>"
  const trimmedUses = line
    .substring(line.indexOf(trimSubString) + trimSubString.length)
    .trim();

  let [actionIdentifier, ...comment] = trimmedUses.split("#");

  // Check if the action reference is quoted
  const isDoubleQuoted = actionIdentifier.startsWith(`"`);
  const isSingleQuoted = actionIdentifier.startsWith(`'`);
  if (isDoubleQuoted || isSingleQuoted) {
    actionIdentifier = actionIdentifier.substring(1).trim();

    const searchQuote = isDoubleQuoted ? `"` : `'`;
    const indexOfQuote = actionIdentifier.indexOf(`${searchQuote}`);

    if (indexOfQuote === -1 || indexOfQuote !== actionIdentifier.length - 1) {
      core.warning(
        "Invalid action reference - unmatched/misplaced quote (skipping): " +
          line,
      );
      return;
    } else {
      actionIdentifier = actionIdentifier.substring(0, indexOfQuote);
    }
  }

  if (actionIdentifier.startsWith("./")) {
    // Local action reference - do not extract or validate these.
    return;
  }

  const [identifier, gitRef] = actionIdentifier.trim().split("@");
  const [owner, repo, ...path] = identifier.split("/");
  const repoPath = (path.length > 0 ? "/" : "") + path.join("/");

  return {
    owner,
    repo,
    repoPath,
    ref: gitRef,
    comment: comment.join().trim(),
    isWorkflowFile: repoPath.endsWith(".yml") || repoPath.endsWith(".yaml"),
    trusted: owner === "actions" || owner === "smartcontractkit",
  };
}
