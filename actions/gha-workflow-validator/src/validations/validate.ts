import * as core from "@actions/core";

import { ActionRefValidation } from "./action-reference-validations.js";
import { ActionsRunnerValidation } from "./actions-runner-validations.js";
import { IgnoresCommentValidation } from "./ignores-comment-validation.js";
import { ActionsCacheVersionValidation } from "./actions-cache-validation.js";

import { RunInputs } from "../run.js";
import { Octokit } from "../github.js";
import {
  FileValidationResult,
  LineValidationResult,
  ValidationMessage,
  ValidationType,
  ValidationCheck,
} from "./validation-check.js";

import { ParsedFiles, ParsedFile, FileLine } from "../parse-files.js";

function getValidators(
  {
    validateActionNodeVersion,
    validateActionRefs,
    validateRunners,
    validateActionsCacheVersion,
  }: RunInputs,
  octokit: Octokit,
): ValidationCheck[] {
  const validators: ValidationCheck[] = [new IgnoresCommentValidation()];
  if (validateActionRefs)
    validators.push(
      new ActionRefValidation(octokit, {
        validateNodeVersion: validateActionNodeVersion,
      }),
    );
  if (validateRunners) validators.push(new ActionsRunnerValidation());
  if (validateActionsCacheVersion)
    validators.push(new ActionsCacheVersionValidation());

  return validators;
}

export async function validate(
  inputs: RunInputs,
  parsedFiles: ParsedFiles,
  octokit: Octokit,
): Promise<FileValidationResult[]> {
  core.debug(`Validating ${parsedFiles.length} files`);

  const validators = getValidators(inputs, octokit);

  const fileValidationResults: FileValidationResult[] = [];
  for (const file of parsedFiles) {
    core.info(`Validating: ${file.filename}`);

    const fileValidationResult = await validateFile(
      file.filename,
      file,
      validators,
    );
    fileValidationResults.push(fileValidationResult);
  }

  core.debug("Validation complete.");
  return fileValidationResults;
}

async function validateFile(
  filename: string,
  file: ParsedFile,
  validators: ValidationCheck[],
): Promise<FileValidationResult> {
  core.info(`Validating ${filename}`);

  const lineValidationResults: LineValidationResult[] = [];
  for (const line of file.lines) {
    core.debug(`Validating: ${file.filename}#${line.lineNumber}`);

    const lineValidationResult = await validateLine(
      file.filename,
      line,
      validators,
    );
    lineValidationResults.push(lineValidationResult);
  }
  lineValidationResults.sort((a, b) => a.line.lineNumber - b.line.lineNumber);

  core.info(
    `Found ${lineValidationResults.length} total problems in ${file.filename}`,
  );

  return {
    filename,
    lineValidations: lineValidationResults,
  };
}

async function validateLine(
  filename: string,
  line: FileLine,
  validators: ValidationCheck[],
): Promise<LineValidationResult> {
  if (line.ignored && line.operation === "unchanged") {
    return {
      filename: filename,
      line,
      messages: [],
    };
  }

  const messages = (
    await Promise.all(
      validators.map(async (validator) => {
        return validator.validateLine(line);
      }),
    )
  ).flat();

  const processedMessages = messages.map((message) => {
    // lower severity for ignored lines, unless the message is an ignore comment
    const shouldIgnore =
      line.ignored && message.type !== ValidationType.IGNORE_COMMENT;
    return {
      ...message,
      severity: shouldIgnore ? "ignored" : message.severity,
    } as ValidationMessage;
  });

  return {
    filename: filename,
    line,
    messages: processedMessages,
  };
}

export function doValidationErrorsExist(files: FileValidationResult[]) {
  return files.some((file) =>
    file.lineValidations.some((lv) =>
      lv.messages.some((m) => m.severity === "error"),
    ),
  );
}
