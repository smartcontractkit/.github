import { setSummary } from "../output.js";
import { vi, afterEach, describe, it, expect } from "vitest";
import * as core from "@actions/core";
import {
  FileValidationResult,
  ValidationType,
} from "../validations/validation-check.js";
import { FIXING_ERRORS } from "../strings.js";

vi.mock("@actions/core", async (importOriginal) => {
  const stubs = (await import("./__helpers__/test-utils.js")).coreLoggingStubs();

  const summary: any = {};
  summary.addTable = vi.fn().mockReturnValue(summary);
  summary.addSeparator = vi.fn().mockReturnValue(summary);
  summary.addRaw = vi.fn().mockReturnValue(summary);
  summary.write = vi.fn().mockReturnValue(summary);

  return {
    ...stubs,
    summary,
  }
});

describe(setSummary.name, () => {

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should set summary with no input", async () => {
    setSummary([], "prefix.com");
    const { summary } = core;

    expect(summary.addTable).toHaveBeenCalledTimes(1);
    expect(summary.addTable).toMatchSnapshot();
    expect(summary.addSeparator).toHaveBeenCalledTimes(1);
    expect(summary.addRaw).toHaveBeenCalledTimes(1);
    expect(summary.addRaw).toHaveBeenCalledWith(FIXING_ERRORS);
    expect(summary.write).toHaveBeenCalledTimes(1);
  });

  it("should set summary with no errors ", async () => {
    const validationResult: FileValidationResult[] = [
      {
        filename: "foo.yml",
        lineValidations: [
          {
            filename: "foo.yml",
            line: {
              lineNumber: 1,
              content: "line 1",
              operation: "add",
              ignored: false,
            },
            messages: []
          },
          {
            filename: "foo.yml",
            line: {
              lineNumber: 3,
              content: "line 2",
              operation: "add",
              ignored: false,
            },
            messages: []
          },
        ],
      }
    ]

    setSummary(validationResult, "prefix.com");
    const { summary } = core;

    expect(summary.addTable).toHaveBeenCalledTimes(1);
    expect(summary.addTable).toMatchSnapshot();
    expect(summary.addSeparator).toHaveBeenCalledTimes(1);
    expect(summary.addRaw).toHaveBeenCalledTimes(1);
    expect(summary.addRaw).toHaveBeenCalledWith(FIXING_ERRORS);
    expect(summary.write).toHaveBeenCalledTimes(1);
  });

  it("should set summary with single file", async () => {
    const validationResult: FileValidationResult[] = [
      {
        filename: "foo.yml",
        lineValidations: [
          {
            filename: "foo.yml",
            line: {
              lineNumber: 1,
              content: "line 1",
              operation: "add",
              ignored: false,
            },
            messages: [{
              type: ValidationType.SHA_REF,
              severity: "error",
              message: "sha ref error",
            }]
          },
          {
            filename: "foo.yml",
            line: {
              lineNumber: 3,
              content: "line 2",
              operation: "add",
              ignored: false,
            },
            messages: [{
              type: ValidationType.VERSION_COMMENT,
              severity: "warning",
              message: "version comment warning",
            }]
          },
        ],
      }
    ]

    setSummary(validationResult, "prefix.com");
    const { summary } = core;

    expect(summary.addTable).toHaveBeenCalledTimes(1);
    expect(summary.addTable).toMatchSnapshot();
    expect(summary.addSeparator).toHaveBeenCalledTimes(1);
    expect(summary.addRaw).toHaveBeenCalledTimes(1);
    expect(summary.addRaw).toHaveBeenCalledWith(FIXING_ERRORS);
    expect(summary.write).toHaveBeenCalledTimes(1);
  });

  it("should set summary with multiple files", async () => {
    const validationResult: FileValidationResult[] = [
      {
        filename: "foo.yml",
        lineValidations: [
          {
            filename: "foo.yml",
            line: {
              lineNumber: 1,
              content: "line 1",
              operation: "add",
              ignored: false,
            },
            messages: [{
              type: ValidationType.SHA_REF,
              severity: "error",
              message: "sha ref error",
            }]
          },
          {
            filename: "foo.yml",
            line: {
              lineNumber: 3,
              content: "line 2",
              operation: "add",
              ignored: false,
            },
            messages: [{
              type: ValidationType.VERSION_COMMENT,
              severity: "warning",
              message: "version comment warning",
            }]
          },
        ],
      },
      {
        filename: "bar.yml",
        lineValidations: [
          {
            filename: "foo.yml",
            line: {
              lineNumber: 1337,
              content: "line 1337",
              operation: "add",
              ignored: false,
            },
            messages: [{
              type: ValidationType.SHA_REF,
              severity: "error",
              message: "sha ref error",
            }]
          },
          {
            filename: "foo.yml",
            line: {
              lineNumber: 1338,
              content: "line 1338",
              operation: "add",
              ignored: false,
            },
            messages: [{
              type: ValidationType.VERSION_COMMENT,
              severity: "warning",
              message: "version comment warning",
            }]
          },
        ],
      }
    ]

    setSummary(validationResult, "prefix.com");
    const { summary } = core;

    expect(summary.addTable).toHaveBeenCalledTimes(1);
    expect(summary.addTable).toMatchSnapshot();
    expect(summary.addSeparator).toHaveBeenCalledTimes(1);
    expect(summary.addRaw).toHaveBeenCalledTimes(1);
    expect(summary.addRaw).toHaveBeenCalledWith(FIXING_ERRORS);
    expect(summary.write).toHaveBeenCalledTimes(1);
  });
});
