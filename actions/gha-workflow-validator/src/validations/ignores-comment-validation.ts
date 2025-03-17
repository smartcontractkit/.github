import { FileLine } from "../parse-files.js";
import {
  ValidationCheck,
  ValidationMessage,
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

  async validateLine(line: FileLine): Promise<ValidationMessage[]> {
    if (line.operation === "unchanged") {
      return [];
    }

    const fileLineActionsRunner = extractIgnoresComment(line);

    if (!fileLineActionsRunner.containsIgnoreComment) {
      return [];
    }

    return [
      {
        type: ValidationType.IGNORE_COMMENT,
        severity: "error",
        message: "new ignore comment found",
      },
    ] as ValidationMessage[];
  }
}

function extractIgnoresComment(fileLine: FileLine): FileLineIgnoresComment {
  // ensure only added lines are subject to this validation
  // to avoid retriggering errors for previously ignored (and unchanged) lines
  const containsIgnoreComment = fileLine.content.includes(
    VALIDATOR_IGNORE_LINE,
  );

  return {
    ...fileLine,
    containsIgnoreComment,
  };
}
