import { FileLine } from "../parse-files.js";
import { UseReferenceIndex } from "../use-references.js";
import {
  ValidationCheck,
  ValidationMessage,
  ValidationType,
} from "./validation-check.js";
import {
  extractActionReferenceFromLine,
  toActionReference,
} from "./action-reference-validations.js";

interface ActionsCacheVersionValidationOpts {
  references?: UseReferenceIndex;
}

export class ActionsCacheVersionValidation implements ValidationCheck {
  private options: ActionsCacheVersionValidationOpts;

  constructor(options?: ActionsCacheVersionValidationOpts) {
    this.options = options ?? {};
  }

  async validateLine(
    line: FileLine,
    filename?: string,
  ): Promise<ValidationMessage[]> {
    const references =
      this.options.references && filename
        ? this.options.references.get(filename, line.lineNumber)
        : "fallback";

    const refs =
      references === "fallback"
        ? [extractActionsCacheFromLine(line.content)].filter(
            (ref): ref is string => ref !== undefined,
          )
        : references.flatMap((use) => {
            if (use.kind !== "action") return [];
            const action = toActionReference(use);
            return action?.owner === "actions" && action.repo === "cache"
              ? [action.ref]
              : [];
          });

    return refs.flatMap((ref) => {
      if (ref.startsWith("v5")) {
        return [];
      }

      return [
        {
          type: ValidationType.ACTIONS_CACHE,
          severity: line.operation === "add" ? "error" : "warning",
          message: `This version (${ref}) of actions/cache is being deprecated. Please update to v5`,
        } as ValidationMessage,
      ];
    });
  }
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
