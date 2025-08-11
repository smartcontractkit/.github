import { IgnoresCommentValidation } from "../validations/ignores-comment-validation.js";
import { VALIDATOR_IGNORE_LINE } from "../strings.js";
import { FileLine } from "../parse-files.js";
import { vi, describe, it, expect } from "vitest";

vi.mock("@actions/core", async () => {
  return (await import("./__helpers__/test-utils.js")).coreLoggingStubs();
});

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
    const messages = await subject.validateLine({
      lineNumber: 0,
      content: "",
      operation: "unchanged",
      ignored: false,
    });
    expect(messages).toEqual([]);
  });

  it("should validate no ignore comment changes", async () => {
    const subject = new IgnoresCommentValidation();
    const line: FileLine = {
      lineNumber: 1,
      content: "line 1",
      operation: "add",
      ignored: false,
    };
    const messages = await subject.validateLine(line);
    expect(messages).toEqual([]);
  });

  it("should not error with unchanged ignore", async () => {
    const subject = new IgnoresCommentValidation();
    const line: FileLine = {
      ...actionsRunnerLineWithIgnore,
      operation: "unchanged",
    };
    const messages = await subject.validateLine(line);
    expect(messages).toEqual([]);
  });

  it("should not error with malformed ignore", async () => {
    const subject = new IgnoresCommentValidation();
    const line: FileLine = actionsRunnerLineWithBadIgnore;
    const messages = await subject.validateLine(line);
    expect(messages).toEqual([]);
  });

  it("should error on action reference with new ignore", async () => {
    const subject = new IgnoresCommentValidation();
    const line: FileLine = actionsReferenceLineWithIgnore;
    const messages = await subject.validateLine(line);
    expect(messages.length).toEqual(1);
    expect(messages[0].message).toEqual(`new ignore comment found`);
    expect(messages[0].severity).toEqual("error");
  });

  it("should error with added ignore", async () => {
    const subject = new IgnoresCommentValidation();
    const line: FileLine = actionsRunnerLineWithIgnore;
    const messages = await subject.validateLine(line);
    expect(messages.length).toEqual(1);
    expect(messages[0].message).toEqual(`new ignore comment found`);
    expect(messages[0].severity).toEqual("error");
  });
});
