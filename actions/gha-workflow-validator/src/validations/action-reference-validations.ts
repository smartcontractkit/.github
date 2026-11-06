import { ParsedFile, FileLine } from "../parse-files.js";
import { Octokit, getActionFileFromGithub } from "../github.js";
import {
  UseReference,
  UseReferenceIndex,
  UseReferenceLookup,
} from "../use-references.js";
import {
  WorkflowLockfile,
  getLockedActionRefs,
  toActionPinKey,
} from "../lockfile.js";
import * as core from "@actions/core";
import {
  ValidationCheck,
  ValidationMessage,
  FileValidationResult,
  LineValidationResult,
  ValidationType,
} from "./validation-check.js";

const OLDEST_ALLOWABLE_NODE_VERSION = 24;

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
  references?: UseReferenceIndex;
  lockfile?: WorkflowLockfile;
  rootDir?: string;
}

const USES_FORMAT_MESSAGE = (value: string) =>
  `Expected format {owner}/{repo}[/path]@{ref}. Actual '${value}'`;

export class ActionRefValidation implements ValidationCheck {
  private options: ActionRefValidationOptions;
  private reported = new WeakSet<UseReference>();

  constructor(
    readonly octokit: Octokit,
    options?: ActionRefValidationOptions,
  ) {
    this.options = options ?? { validateNodeVersion: true };
  }

  async validateLine(
    line: FileLine,
    filename?: string,
  ): Promise<ValidationMessage[]> {
    if (line.operation === "unchanged") {
      return [];
    }

    const lockedActionRefs = filename
      ? getLockedActionRefs(
          this.options.lockfile,
          filename,
          this.options.rootDir,
        )
      : undefined;

    const references: UseReferenceLookup =
      this.options.references && filename
        ? this.options.references.get(filename, line.lineNumber)
        : "fallback";

    if (references === "fallback") {
      const fileLineActionReference = extractActionReference(line);
      return validateActionReference(
        this.octokit,
        this.options,
        fileLineActionReference.actionReference,
        lockedActionRefs,
      );
    }

    const messages: ValidationMessage[] = [];
    for (const reference of references) {
      if (reference.kind !== "action") continue;

      // A multiline reference is indexed on every line it spans. Report it once,
      // on the first changed line. This runs before any await.
      if (this.reported.has(reference)) continue;
      this.reported.add(reference);

      const actionReference = toActionReference(reference);
      if (!actionReference) {
        messages.push({
          type: ValidationType.USES_FORMAT,
          severity: "error",
          message: USES_FORMAT_MESSAGE(reference.value),
        });
        continue;
      }

      messages.push(
        ...(await validateActionReference(
          this.octokit,
          this.options,
          actionReference,
          lockedActionRefs,
        )),
      );
    }

    return messages;
  }
}

async function validateActionReference(
  octokit: Octokit,
  options: ActionRefValidationOptions,
  actionRef: ActionReference | undefined,
  lockedActionRefs: string[] | undefined,
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

  // A workflow onboarded to the lockfile no longer needs SHA references or
  // version comments. Its references are pinned by the lockfile instead.
  const isLocked = lockedActionRefs !== undefined;

  const validationErrors: ValidationMessage[] = [];

  const trustedActionTagRefValidation = validateTrustedActionTagRef(actionRef);
  const shaRefValidation = isLocked ? undefined : validateShaRef(actionRef);
  const versionCommentValidation = isLocked
    ? undefined
    : validateVersionCommentExists(actionRef);
  const lockfileCoverageValidation = isLocked
    ? validateLockfileCoverage(actionRef, lockedActionRefs)
    : undefined;
  const node24ActionValidation = options.validateNodeVersion
    ? await validateNodeActionVersion(octokit, actionRef)
    : undefined;

  if (trustedActionTagRefValidation) {
    core.debug(
      `Trusted Tag Ref Validation failed for ${actionRef.owner}/${actionRef.repo}${actionRef.repoPath}@${actionRef.ref}`,
    );
    validationErrors.push(trustedActionTagRefValidation);
  }
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
  if (lockfileCoverageValidation) {
    core.debug(
      `Lockfile Coverage Validation Failed for ${actionRef.owner}/${actionRef.repo}${actionRef.repoPath}@${actionRef.ref} - ${lockfileCoverageValidation.message}`,
    );
    validationErrors.push(lockfileCoverageValidation);
  }
  if (node24ActionValidation) {
    core.debug(
      `Node 24 Validation Failed for ${actionRef.owner}/${actionRef.repo}${actionRef.repoPath}@${actionRef.ref} - ${node24ActionValidation.message}`,
    );
    validationErrors.push(node24ActionValidation);
  }

  return validationErrors;
}

function validateTrustedActionTagRef(
  actionReference: ActionReference,
): ValidationMessage | undefined {
  // If the action is not from a trusted source, we don't require it to use a tag reference, so return early with no error.
  if (!actionReference.trusted) {
    return;
  }

  const sha1Regex = /^[0-9a-f]{40}$/;
  const sha256Regex = /^[0-9a-f]{256}$/;

  const isUsingShaRef =
    sha1Regex.test(actionReference.ref) ||
    sha256Regex.test(actionReference.ref);
  if (!isUsingShaRef) return;

  return {
    message: `Trusted actions should use a major version tag, if available.`,
    type: ValidationType.TRUSTED_TAG_REF,
    severity: "warning",
  };
}

function validateShaRef(
  actionReference: ActionReference,
): ValidationMessage | undefined {
  // If the action is from a trusted source, we don't require it to use a SHA reference, so return early with no error.
  if (actionReference.trusted) return;

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
  if (actionReference.trusted || actionReference.comment) return;

  return {
    message: `No version comment found`,
    type: ValidationType.VERSION_COMMENT,
    severity: "warning",
  };
}

function validateLockfileCoverage(
  actionReference: ActionReference,
  lockedActionRefs: string[],
): ValidationMessage | undefined {
  const actionIdentifier = toActionPinKey(
    actionReference.owner,
    actionReference.repo,
    actionReference.ref,
  );

  if (lockedActionRefs.includes(actionIdentifier)) return;

  return {
    message: `${actionIdentifier} is not pinned in .github/workflows/actions.lock for this workflow. Run \`gh actions-lock\` to add it.`,
    type: ValidationType.LOCKFILE_COVERAGE,
    severity: "error",
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
  if (!matches) {
    return;
  }

  const nodeVersionParsed = parseInt(matches[1], 10);
  if (nodeVersionParsed < OLDEST_ALLOWABLE_NODE_VERSION) {
    return {
      message: `Action is using node${nodeVersionParsed}. Versions older than node${OLDEST_ALLOWABLE_NODE_VERSION} are being deprecated. Use a newer version of the action if possible.`,
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
export function toActionReference(
  use: UseReference,
): ActionReference | undefined {
  const value = use.value.trim();
  const parts = value.split("@");
  if (parts.length !== 2 || parts[1].length === 0) {
    return undefined;
  }

  const [identifier, ref] = parts;
  const segments = identifier.split("/");
  if (segments.length < 2 || segments.some((segment) => segment.length === 0)) {
    return undefined;
  }

  const [owner, repo, ...path] = segments;
  return {
    owner,
    repo,
    repoPath: (path.length > 0 ? "/" : "") + path.join("/"),
    ref,
    comment: use.comment,
    isWorkflowFile: false,
    trusted: isTrustedOwner(owner),
  };
}

function isTrustedOwner(owner: string): boolean {
  return (
    owner === "actions" || owner === "smartcontractkit" || owner === "github"
  );
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

  if (
    actionIdentifier.startsWith("./") ||
    actionIdentifier.startsWith(".\\") ||
    actionIdentifier.startsWith("$/") ||
    actionIdentifier.startsWith("docker://")
  ) {
    // Local or Docker reference - do not extract or validate these.
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
    trusted: isTrustedOwner(owner),
  };
}
