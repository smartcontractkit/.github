import {
  ActionReferenceValidation,
  extractActionReferenceFromLine,
} from "../validations/action-reference-validations.js";
import { FileLine, ParsedFile } from "../utils.js";
import { getNock, getTestOctokit } from "./__helpers__/test-utils.js";

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

const jobStepLine: FileLine = {
  lineNumber: 1,
  content: "      - name: test step",
  operation: "add",
  ignored: false,
};

const actionsCheckoutLineValid: FileLine = {
  lineNumber: 2,
  content:
    "        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1",
  operation: "add",
  ignored: false,
};

const actionsCheckoutLineNoComment: FileLine = {
  lineNumber: 2,
  content:
    "        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11",
  operation: "add",
  ignored: false,
};

const actionsCheckoutLineBadRef: FileLine = {
  lineNumber: 2,
  content: "        uses: actions/checkout@v4 # comment",
  operation: "add",
  ignored: false,
};

const actionsCheckoutLineOutdatedRef: FileLine = {
  lineNumber: 2,
  content:
    "        uses: actions/checkout@7739b9ba2efcda9dde65ad1e3c2dbe65b41dfba7 # v3.6.0",
  operation: "add",
  ignored: false,
};

const actionsCheckoutLineAllErrors: FileLine = {
  lineNumber: 2,
  content: "        uses: actions/checkout@v3.6.0",
  operation: "add",
  ignored: false,
};

describe(ActionReferenceValidation.name, () => {
  it("should validate no changes", async () => {
    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionReferenceValidation(octokit);
    const result = await subject.validate({
      filename: "foo.yml",
      lines: [],
    });
    expect(result).toEqual({ filename: "foo.yml", lineValidations: [] });
  });

  it("should validate no action references", async () => {
    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionReferenceValidation(octokit);
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

  it("should validate single action reference", async () => {
    const { nockDone } = await nockBack("actions-checkout-validation.json");
    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionReferenceValidation(octokit);

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [jobStepLine, actionsCheckoutLineValid],
    };

    const result = await subject.validate(simpleChanges);
    expect(result).toEqual({
      filename: ".github/workflows/test.yml",
      lineValidations: [],
    });
    nockDone();
  });

  it("should invalidate single action reference (no version comment)", async () => {
    const { nockDone } = await nockBack("actions-checkout-validation.json");

    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionReferenceValidation(octokit);

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [jobStepLine, actionsCheckoutLineNoComment],
    };

    const result = await subject.validate(simpleChanges);
    const lineValidations = result.lineValidations.filter(
      (lv) => lv.messages.length > 0,
    );
    expect(lineValidations.length).toEqual(1);

    const lvr = lineValidations[0];
    expect(lvr.line.lineNumber).toEqual(simpleChanges.lines[1].lineNumber);
    expect(lvr.messages.length).toEqual(1);
    expect(lvr.messages[0].message).toEqual("No version comment found");

    nockDone();
  });

  it("should invalidate single action reference (bad sha ref)", async () => {
    const { nockDone } = await nockBack("actions-checkout-validation-v4.json");

    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionReferenceValidation(octokit);

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [jobStepLine, actionsCheckoutLineBadRef],
    };

    const result = await subject.validate(simpleChanges);
    const lineValidations = result.lineValidations.filter(
      (lv) => lv.messages.length > 0,
    );
    expect(lineValidations.length).toEqual(1);

    const lineValidation = lineValidations[0];
    expect(lineValidation.line.lineNumber).toEqual(
      simpleChanges.lines[1].lineNumber,
    );
    expect(lineValidation.messages.length).toEqual(1);
    expect(lineValidation.messages[0].message).toEqual(
      `v4 is not a valid SHA reference`,
    );

    nockDone();
  });

  it("should invalidate single action reference (node16)", async () => {
    const { nockDone } = await nockBack(
      "actions-checkout-validation-node16.json",
    );
    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionReferenceValidation(octokit);

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [jobStepLine, actionsCheckoutLineOutdatedRef],
    };

    const result = await subject.validate(simpleChanges);
    const lineValidations = result.lineValidations.filter(
      (lv) => lv.messages.length > 0,
    );
    expect(lineValidations.length).toEqual(1);

    const lineValidation = lineValidations[0];
    expect(lineValidation.line.lineNumber).toEqual(
      simpleChanges.lines[1].lineNumber,
    );
    expect(lineValidation.messages.length).toEqual(1);
    expect(lineValidation.messages[0].message).toEqual(
      "Action is using node16",
    );

    nockDone();
  });

  it("should invalidate single action reference (all errors)", async () => {
    const { nockDone } = await nockBack(
      "actions-checkout-validation-v3_6_0.json",
    );
    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionReferenceValidation(octokit);

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [jobStepLine, actionsCheckoutLineAllErrors],
    };

    const result = await subject.validate(simpleChanges);
    const lineValidations = result.lineValidations.filter(
      (lv) => lv.messages.length > 0,
    );
    expect(lineValidations.length).toEqual(1);

    const lineValidation = lineValidations[0];
    expect(lineValidation.line.lineNumber).toEqual(
      simpleChanges.lines[1].lineNumber,
    );
    expect(lineValidation.messages.length).toEqual(3);

    expect(
      lineValidation.messages.some(
        (error) => error.message === "No version comment found",
      ),
    ).toEqual(true);
    expect(
      lineValidation.messages.some(
        (error) => error.message === "Action is using node16",
      ),
    ).toEqual(true);
    expect(
      lineValidation.messages.some(
        (error) => error.message === `v3.6.0 is not a valid SHA reference`,
      ),
    ).toEqual(true);

    nockDone();
  });
});

describe(extractActionReferenceFromLine.name, () => {
  it("extracts action reference", () => {
    const line =
      "        - uses: smartcontractkit/.github/actions/foo@bar # foo@1.0.0";
    const actionReference = extractActionReferenceFromLine(line);

    expect(actionReference).toEqual({
      owner: "smartcontractkit",
      repo: ".github",
      repoPath: "/actions/foo",
      ref: "bar",
      comment: "foo@1.0.0",
    });
  });

  it("extracts action reference (no comment)", () => {
    const line = "        - uses: smartcontractkit/.github/actions/foo@bar";
    const actionReference = extractActionReferenceFromLine(line);

    expect(actionReference).toEqual({
      owner: "smartcontractkit",
      repo: ".github",
      repoPath: "/actions/foo",
      ref: "bar",
      comment: "",
    });
  });

  it("parses local reference as no reference", () => {
    const line = "-      uses: ./.github/actions/local-action";
    const actionReference = extractActionReferenceFromLine(line);
    expect(actionReference).toBeUndefined();
  });
});
