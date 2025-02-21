import { validate, doValidationErrorsExist } from "../validations/validate";
import {
  FileValidationResult,
  ValidationType,
} from "../validations/validation-check";
import { RunInputs } from "../run";
import { VALIDATOR_IGNORE_LINE } from "../strings";

import { describe, it, expect } from "vitest";
import { ParsedFiles } from "../parse-files";

const DEFAULT_RUN_INPUTS: RunInputs = {
  evaluateMode: false,
  validateRunners: false,
  validateActionRefs: false,
  validateActionNodeVersion: false,
  validateActionsCacheVersion: false,
  validateAllActionDefinitions: false,
  rootDir: "",
  diffOnly: false,
};

describe(validate.name, () => {
  it("should validate an empty file", async () => {
    const inputs = DEFAULT_RUN_INPUTS;
    const parsedFiles: ParsedFiles = [];
    const octokit = {} as any;
    const result = await validate(inputs, parsedFiles, octokit);
    expect(result).toEqual([]);
  });

  it("should validate a file with all validators disabled", async () => {
    const inputs = DEFAULT_RUN_INPUTS;
    const parsedFiles: ParsedFiles = [
      {
        filename: ".github/workflows/test.yml",
        lines: [
          {
            lineNumber: 1,
            content: "line 1",
            operation: "add",
            ignored: false,
          },
        ],
      },
    ];
    const octokit = {} as any;
    const result = await validate(inputs, parsedFiles, octokit);
    expect(result).toEqual([
      {
        filename: ".github/workflows/test.yml",
        lineValidations: [
          {
            filename: ".github/workflows/test.yml",
            line: parsedFiles[0].lines[0],
            messages: [],
          },
        ],
      } satisfies FileValidationResult,
    ]);
  });

  it("should perform ignores-comment validation with all validators disabled", async () => {
    const inputs = DEFAULT_RUN_INPUTS;
    const parsedFiles: ParsedFiles = [
      {
        filename: ".github/workflows/test.yml",
        lines: [
          {
            lineNumber: 1,
            content: `contents ${VALIDATOR_IGNORE_LINE}`,
            operation: "add",
            ignored: false,
          },
        ],
      },
    ];
    const octokit = {} as any;
    const result = await validate(inputs, parsedFiles, octokit);
    expect(result).toEqual([
      {
        filename: ".github/workflows/test.yml",
        lineValidations: [
          {
            filename: ".github/workflows/test.yml",
            line: parsedFiles[0].lines[0],
            messages: [
              {
                message: "new ignore comment found",
                type: ValidationType.IGNORE_COMMENT,
                severity: "error",
              },
            ],
          },
        ],
      } satisfies FileValidationResult,
    ]);
  });

  it("should perform actions/cache version validation when enabled", async () => {
    const inputs = { ...DEFAULT_RUN_INPUTS, validateActionsCacheVersion: true };
    const parsedFiles: ParsedFiles = [
      {
        filename: ".github/workflows/test.yml",
        lines: [
          {
            lineNumber: 1,
            content: `uses: actions/cache@v2`,
            operation: "add",
            ignored: false,
          },
        ],
      },
    ];
    const octokit = {} as any;
    const result = await validate(inputs, parsedFiles, octokit);
    expect(result).toEqual([
      {
        filename: ".github/workflows/test.yml",
        lineValidations: [
          {
            filename: ".github/workflows/test.yml",
            line: parsedFiles[0].lines[0],
            messages: [
              {
                message:
                  "This version (v2) of actions/cache is being deprecated. Please update to v4.",
                type: ValidationType.ACTIONS_CACHE,
                severity: "error",
              },
            ],
          },
        ],
      } satisfies FileValidationResult,
    ]);
  });
});

describe(doValidationErrorsExist.name, () => {
  it("should return true with no line validations", () => {
    const fileValidations: FileValidationResult[] = [
      {
        filename: ".github/workflows/test.yml",
        lineValidations: [],
      },
    ];
    const result = doValidationErrorsExist(fileValidations);
    expect(result).toBe(false);
  });

  it("should return true with only warning validations", () => {
    const fileValidations: FileValidationResult[] = [
      {
        filename: ".github/workflows/test.yml",
        lineValidations: [
          {
            filename: ".github/workflows/test.yml",
            line: {
              lineNumber: 1,
              content: "line 1",
              operation: "add",
              ignored: false,
            },
            messages: [
              {
                message: "Error",
                type: ValidationType.VERSION_COMMENT,
                severity: "warning",
              },
            ],
          },
        ],
      },
    ];
    const result = doValidationErrorsExist(fileValidations);
    expect(result).toBe(false);
  });

  it("should return true with only ignored validations", () => {
    const fileValidations: FileValidationResult[] = [
      {
        filename: ".github/workflows/test.yml",
        lineValidations: [
          {
            filename: ".github/workflows/test.yml",
            line: {
              lineNumber: 1,
              content: "line 1",
              operation: "add",
              ignored: false,
            },
            messages: [
              {
                message: "Error",
                type: ValidationType.VERSION_COMMENT,
                severity: "warning",
              },
            ],
          },
          {
            filename: ".github/workflows/test.yml",
            line: {
              lineNumber: 1,
              content: "line 1",
              operation: "add",
              ignored: false,
            },
            messages: [
              {
                message: "Error",
                type: ValidationType.VERSION_COMMENT,
                severity: "ignored",
              },
            ],
          },
        ],
      },
    ];
    const result = doValidationErrorsExist(fileValidations);
    expect(result).toBe(false);
  });

  it("should return true with warning and ignored validations", () => {
    const fileValidations: FileValidationResult[] = [
      {
        filename: ".github/workflows/test.yml",
        lineValidations: [
          {
            filename: ".github/workflows/test.yml",
            line: {
              lineNumber: 1,
              content: "line 1",
              operation: "add",
              ignored: false,
            },
            messages: [
              {
                message: "Error",
                type: ValidationType.VERSION_COMMENT,
                severity: "ignored",
              },
            ],
          },
        ],
      },
    ];
    const result = doValidationErrorsExist(fileValidations);
    expect(result).toBe(false);
  });

  it("should return false with single error", () => {
    const fileValidations: FileValidationResult[] = [
      {
        filename: ".github/workflows/test.yml",
        lineValidations: [
          {
            filename: ".github/workflows/test.yml",
            line: {
              lineNumber: 1,
              content: "line 1",
              operation: "add",
              ignored: false,
            },
            messages: [
              {
                message: "Error",
                type: ValidationType.VERSION_COMMENT,
                severity: "error",
              },
            ],
          },
        ],
      },
    ];
    const result = doValidationErrorsExist(fileValidations);
    expect(result).toBe(true);
  });

  it("should return false with all types", () => {
    const fileValidations: FileValidationResult[] = [
      {
        filename: ".github/workflows/test.yml",
        lineValidations: [
          {
            filename: ".github/workflows/test.yml",
            line: {
              lineNumber: 1,
              content: "line 1",
              operation: "add",
              ignored: false,
            },
            messages: [
              {
                message: "Error",
                type: ValidationType.VERSION_COMMENT,
                severity: "error",
              },
            ],
          },
          {
            filename: ".github/workflows/test.yml",
            line: {
              lineNumber: 1,
              content: "line 1",
              operation: "add",
              ignored: false,
            },
            messages: [
              {
                message: "Error",
                type: ValidationType.VERSION_COMMENT,
                severity: "warning",
              },
            ],
          },
          {
            filename: ".github/workflows/test.yml",
            line: {
              lineNumber: 1,
              content: "line 1",
              operation: "add",
              ignored: false,
            },
            messages: [
              {
                message: "Error",
                type: ValidationType.VERSION_COMMENT,
                severity: "ignored",
              },
            ],
          },
        ],
      },
    ];
    const result = doValidationErrorsExist(fileValidations);
    expect(result).toBe(true);
  });
});
