import { IgnoresCommentValidation } from "../validations/ignores-comment-validation.js";
import { VALIDATOR_IGNORE_LINE } from "../strings.js";
import { FileLine, ParsedFile } from "../utils.js";
import { getNock } from "./__helpers__/test-utils.js";

import { vi, describe, it, expect } from "vitest";

const nockBack = getNock();

vi.mock("@actions/core", () => ({
  setFailed: (msg: string) => {
    console.log(`setFailed (stub): ${msg}`);
  },
  error: (msg: string) => {
    console.log(`error (stub): ${msg}`);
  },
  warning: (msg: string) => {
    console.log(`warn (stub): ${msg}`);
  },
  info: (msg: string) => {
    console.log(`info (stub): ${msg}`);
  },
  debug: (msg: string) => {
    console.log(`debug (stub): ${msg}`);
  },
}));

const jobLine: FileLine = {
  lineNumber: 1,
  content: "      new-job:",
  operation: "add",
  ignored: false,
};

const actionsRunnerLineWithIgnore: FileLine = {
  lineNumber: 2,
  content: `      runs-on: ubuntu-latest ${VALIDATOR_IGNORE_LINE}`,
  operation: "add",
  ignored: false,
};

const actionsRunnerLineWithBadIgnore: FileLine = {
  lineNumber: 2,
  content: "      runs-on: ubuntu-latest-16cores-64gb # not-ghv-ignore-text!!",
  operation: "add",
  ignored: false,
};

const actionsReferenceLineWithIgnore: FileLine = {
  lineNumber: 2,
  content: `        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1 ${VALIDATOR_IGNORE_LINE}`,
  operation: "add",
  ignored: false,
};

describe(IgnoresCommentValidation.name, () => {
  it("should validate no changes", async () => {
    const subject = new IgnoresCommentValidation();
    const result = await subject.validate({
      filename: "foo.yml",
      lines: [],
    });
    expect(result).toEqual({ filename: "foo.yml", lineValidations: [] });
  });

  it("should validate ignore comment changes", async () => {
    const subject = new IgnoresCommentValidation();
    const noWorkflowChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [
        { lineNumber: 1, content: "line 1", operation: "add", ignored: false },
        { lineNumber: 2, content: "line 2", operation: "add", ignored: false },
      ],
    };
    const result = await subject.validate(noWorkflowChanges);
    expect(result).toEqual({
      filename: ".github/workflows/test.yml",
      lineValidations: [],
    });
  });

  it("should not error with unchanged ignore", async () => {
    const subject = new IgnoresCommentValidation();

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [
        jobLine,
        { ...actionsRunnerLineWithIgnore, operation: "unchanged" },
      ],
    };

    const result = await subject.validate(simpleChanges);
    const lineValidationsWithErrors = result.lineValidations.filter(
      (lv) => lv.messages.length > 0,
    );
    expect(lineValidationsWithErrors.length).toEqual(0);
  });

  it("should not error with malformed ignore", async () => {
    const subject = new IgnoresCommentValidation();

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [jobLine, actionsRunnerLineWithBadIgnore],
    };

    const result = await subject.validate(simpleChanges);
    const lineValidationsWithErrors = result.lineValidations.filter(
      (lv) => lv.messages.length > 0,
    );
    expect(lineValidationsWithErrors.length).toEqual(0);
  });

  it("should error on action reference with new ignore", async () => {
    const subject = new IgnoresCommentValidation();

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [jobLine, actionsReferenceLineWithIgnore],
    };

    const result = await subject.validate(simpleChanges);
    const lineValidationsWithErrors = result.lineValidations.filter(
      (lv) => lv.messages.length > 0,
    );
    expect(lineValidationsWithErrors.length).toEqual(1);

    const lineValidation = lineValidationsWithErrors[0];
    expect(lineValidation.line.lineNumber).toEqual(
      simpleChanges.lines[1].lineNumber,
    );
    expect(lineValidation.messages.length).toEqual(1);
    expect(lineValidation.messages[0].message).toEqual(
      `new ignore comment found`,
    );
    expect(lineValidation.messages[0].severity).toEqual("error");
  });

  it("should error with added ignore", async () => {
    const subject = new IgnoresCommentValidation();

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [jobLine, actionsRunnerLineWithIgnore],
    };

    const result = await subject.validate(simpleChanges);
    const lineValidationsWithErrors = result.lineValidations.filter(
      (lv) => lv.messages.length > 0,
    );
    expect(lineValidationsWithErrors.length).toEqual(1);

    const lineValidation = lineValidationsWithErrors[0];
    expect(lineValidation.line.lineNumber).toEqual(
      simpleChanges.lines[1].lineNumber,
    );
    expect(lineValidation.messages.length).toEqual(1);
    expect(lineValidation.messages[0].message).toEqual(
      `new ignore comment found`,
    );
    expect(lineValidation.messages[0].severity).toEqual("error");
  });
});
