import { doValidationErrorsExist } from "../validations/validate";
import { FileValidationResult, ValidationType } from "../validations/validation-check";

import { describe, it, expect } from "vitest";

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
