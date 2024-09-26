import { mapAndFilterUndefined, ParsedFile, FileLine } from "../utils.js";
import * as core from "@actions/core";
import {
  ValidationCheck,
  FileValidationResult,
  LineValidationResult,
  ValidationType,
} from "./validation-check.js";
import { VALIDATOR_IGNORE_LINE } from "../strings.js";

interface FileLineIgnoresComment extends FileLine {
  containsIgnoreComment: boolean;
}

interface IgnoresCommentValidationOpts {}

export class IgnoresCommentValidation implements ValidationCheck {
  private options: IgnoresCommentValidationOpts;

  constructor(options?: IgnoresCommentValidationOpts) {
    this.options = options ?? {};
  }

  async validate(parsedFile: ParsedFile): Promise<FileValidationResult> {
    core.debug(`Validating ignores comments in ${parsedFile.filename}`);
    const { filename } = parsedFile;

    const ignoreComments = mapAndFilterUndefined(
      parsedFile.lines,
      extractIgnoresComment,
    );

    const lineValidations: LineValidationResult[] = ignoreComments.map(
      (line) => {
        return {
          filename,
          line: line,
          messages: [
            {
              type: ValidationType.IGNORE_COMMENT,
              severity: "error",
              message: "new ignore comment found",
            },
          ],
        } as LineValidationResult;
      },
    );

    return {
      filename,
      lineValidations,
    };
  }
}

function extractIgnoresComment(
  fileLine: FileLine,
): FileLineIgnoresComment | undefined {
  if (
    fileLine.operation !== "add" ||
    !fileLine.content.includes(VALIDATOR_IGNORE_LINE)
  ) {
    return;
  }
  return {
    ...fileLine,
    containsIgnoreComment: true,
  };
}
