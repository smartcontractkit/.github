import { FileLine } from "../parse-files.js";
import {
  ValidationCheck,
  ValidationMessage,
  ValidationType,
} from "./validation-check.js";
import { extractActionReferenceFromLine } from "./action-reference-validations.js";

interface FileLineActionsCacheVersion extends FileLine {
  ref?: string;
}

interface ActionsCacheVersionValidationOpts {}

export class ActionsCacheVersionValidation implements ValidationCheck {
  private options: ActionsCacheVersionValidationOpts;

  constructor(options?: ActionsCacheVersionValidationOpts) {
    this.options = options ?? {};
  }

  async validateLine(line: FileLine): Promise<ValidationMessage[]> {
    const { ref } = extractActionsCacheVersion(line);
    if (!ref) {
      return [];
    }

    const isRefUpToDate =
      ref === "v4" || ref === "v3" || ref === "v4.2.0" || ref === "v3.4.0";
    if (isRefUpToDate) {
      return [];
    }

    return [
      {
        type: ValidationType.ACTIONS_CACHE,
        severity: line.operation === "add" ? "error" : "warning",
        message: `This version (${ref}) of actions/cache is being deprecated. Please update to v4.`,
      },
    ];
  }
}

function extractActionsCacheVersion(
  fileLine: FileLine,
): FileLineActionsCacheVersion {
  const actionsCacheVersion = extractActionsCacheFromLine(fileLine.content);
  if (!actionsCacheVersion) {
    return fileLine;
  }

  return {
    ...fileLine,
    ref: actionsCacheVersion,
  };
}

export function extractActionsCacheFromLine(line: string): string | undefined {
  const actionReference = extractActionReferenceFromLine(line);
  if (!actionReference) {
    return;
  }

  const { owner, repo, ref } = actionReference;
  if (owner === "actions" && repo === "cache") {
    return ref;
  }
}
