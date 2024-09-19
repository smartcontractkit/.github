import { mapAndFilterUndefined, ParsedFile, FileLine } from "../utils.js";
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

interface FileLineActionReference extends FileLine {
  actionReference?: ActionReference;
}

interface ActionReference {
  owner: string;
  repo: string;
  repoPath: string;
  ref: string;
  comment?: string;
}

interface ActionReferenceValidationOptions {
  validateNodeVersion: boolean;
}

export class ActionReferenceValidation implements ValidationCheck {
  private options: ActionReferenceValidationOptions;

  constructor(
    readonly octokit: Octokit,
    options?: ActionReferenceValidationOptions,
  ) {
    this.options = options ?? { validateNodeVersion: true };
  }

  async validate(parsedFile: ParsedFile): Promise<FileValidationResult> {
    core.debug(`Validating action references in ${parsedFile.filename}`);
    const { filename } = parsedFile;

    const lineActionRefs = mapAndFilterUndefined(
      parsedFile.lines,
      extractActionReference,
    );

    const lineValidations: LineValidationResult[] =
      await validateActionReferences(
        this.octokit,
        filename,
        this.options,
        lineActionRefs,
      );

    return {
      filename,
      lineValidations,
    };
  }
}

async function validateActionReferences(
  octokit: Octokit,
  filename: string,
  options: ActionReferenceValidationOptions,
  lines: FileLineActionReference[],
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
  options: ActionReferenceValidationOptions,
  actionRef: ActionReference | undefined,
): Promise<ValidationMessage[]> {
  if (!actionRef) {
    return [];
  }

  const validationErrors: ValidationMessage[] = [];

  const shaRefValidation = validateShaRef(actionRef);
  const versionCommentValidation = validateVersionCommentExists(actionRef);
  const node20ActionValidation = options.validateNodeVersion
    ? await validateNodeActionVersion(octokit, actionRef)
    : undefined;

  if (shaRefValidation) {
    validationErrors.push(shaRefValidation);
  }
  if (versionCommentValidation) {
    validationErrors.push(versionCommentValidation);
  }
  if (node20ActionValidation) {
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

  const nodeVersionRegex = /^\s+using:\s*"?node(\d{2})"?/gm;
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

function extractActionReference(
  fileLine: FileLine,
): FileLineActionReference | undefined {
  const actionReference = extractActionReferenceFromLine(fileLine.content);
  if (!actionReference) {
    return;
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

  // example line:
  // - uses: actions/checkout@9bb56186c3b09b4f86b1c65136769dd318469633 # v4.1.2
  const trimSubString = "uses:";
  const usesIndex = trimmedLine.indexOf(trimSubString);

  if (usesIndex === -1) {
    // Not an action reference
    return;
  }

  // trim past the "uses:" substring to get "<owner>/<repo><optional path>@<ref> # <optional comment>""
  const trimmedUses = line
    .substring(line.indexOf(trimSubString) + trimSubString.length)
    .trim();

  if (trimmedUses.startsWith("./")) {
    // Local action reference - do not extract or validate these.
    return;
  }

  const [actionIdentifier, ...comment] = trimmedUses.split("#");
  const [identifier, gitRef] = actionIdentifier.trim().split("@");
  const [owner, repo, ...path] = identifier.split("/");
  const repoPath = (path.length > 0 ? "/" : "") + path.join("/");

  return {
    owner,
    repo,
    repoPath,
    ref: gitRef,
    comment: comment.join().trim(),
  };
}
