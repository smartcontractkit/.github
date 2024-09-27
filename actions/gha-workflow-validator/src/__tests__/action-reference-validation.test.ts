import {
  ActionReferenceValidation,
  extractActionReferenceFromLine,
} from "../validations/action-reference-validations.js";
import { FileLine, ParsedFile } from "../utils.js";
import { getNock, getTestOctokit } from "./__helpers__/test-utils.js";

import { vi, describe, it, expect } from "vitest";

const nockBack = getNock();

vi.mock("@actions/core", async () => {
  return (await import("./__helpers__/test-utils.js")).coreLoggingStubs();
});

const JOB_STEP_LINE: FileLine = {
  lineNumber: 1,
  content: "      - name: test step",
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

  it("should validate single action reference (untrusted)", async () => {
    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionReferenceValidation(octokit, {
      validateNodeVersion: false,
    });

    const untrustedActionValid: FileLine = {
      lineNumber: 2,
      content:
        "        uses: untrusted/action@4ffde65f46336ab88eb53be808477a3936bae111 # v4.1.1",
      operation: "add",
      ignored: false,
    };

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [JOB_STEP_LINE, untrustedActionValid],
    };

    const result = await subject.validate(simpleChanges);
    expect(result).toEqual({
      filename: ".github/workflows/test.yml",
      lineValidations: [],
    });
  });

  it("should validate action reference (trusted actions/*)", async () => {
    const { nockDone } = await nockBack("actions-checkout-validation.json");
    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionReferenceValidation(octokit);

    const actionsCheckoutLineBadRef: FileLine = {
      lineNumber: 2,
      content: "        uses: actions/checkout@v4",
      operation: "add",
      ignored: false,
    };

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [JOB_STEP_LINE, actionsCheckoutLineBadRef],
    };

    const result = await subject.validate(simpleChanges);
    expect(result).toEqual({
      filename: ".github/workflows/test.yml",
      lineValidations: [],
    });
    nockDone();
  });

  it("should validate action reference (trusted smartcontractkit/*)", async () => {
    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionReferenceValidation(octokit, {
      validateNodeVersion: false,
    });

    const smartcontractKitLineBadRef: FileLine = {
      lineNumber: 2,
      content: "        uses: smartcontractkit/action@v4 # comment",
      operation: "add",
      ignored: false,
    };

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [JOB_STEP_LINE, smartcontractKitLineBadRef],
    };

    const result = await subject.validate(simpleChanges);
    expect(result).toEqual({
      filename: ".github/workflows/test.yml",
      lineValidations: [],
    });
  });

  it("should invalidate action reference (sha-ref / no comment)", async () => {
    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionReferenceValidation(octokit, {
      validateNodeVersion: false,
    });

    const actionsCheckoutLineBadRef: FileLine = {
      lineNumber: 2,
      content:
        "        uses: actions/checkout@de90cc6fb38fc0963ad72b210f1f284cd68cea36",
      operation: "add",
      ignored: false,
    };

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [JOB_STEP_LINE, actionsCheckoutLineBadRef],
    };

    const result = await subject.validate(simpleChanges);
    const lineValidations = result.lineValidations.filter(
      (lv) => lv.messages.length > 0,
    );
    expect(lineValidations.length).toEqual(1);
    const lineValidation = lineValidations[0];
    expect(lineValidation.messages).toMatchSnapshot();
  });

  it("should invalidate single action reference (no version comment)", async () => {
    const { nockDone } = await nockBack(
      "dorny-paths-filter-de90cc6fb38fc0963ad72b210f1f284cd68cea36.json",
    );

    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionReferenceValidation(octokit);

    const untrustedActionNoComment: FileLine = {
      lineNumber: 2,
      content:
        "        uses: dorny/paths-filter@de90cc6fb38fc0963ad72b210f1f284cd68cea36",
      operation: "add",
      ignored: false,
    };

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [JOB_STEP_LINE, untrustedActionNoComment],
    };

    const result = await subject.validate(simpleChanges);
    const lineValidations = result.lineValidations.filter(
      (lv) => lv.messages.length > 0,
    );
    expect(lineValidations.length).toEqual(1);
    const lineValidation = lineValidations[0];
    expect(lineValidation.messages).toMatchSnapshot();
    nockDone();
  });

  it("should invalidate single action reference (bad sha ref)", async () => {
    const { nockDone } = await nockBack("dory-paths-filter-v3-0-2.json");

    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionReferenceValidation(octokit);

    const untrustedActionBadRef: FileLine = {
      lineNumber: 2,
      content: "        uses: dorny/paths-filter@v3.0.2 # comment",
      operation: "add",
      ignored: false,
    };

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [JOB_STEP_LINE, untrustedActionBadRef],
    };

    const result = await subject.validate(simpleChanges);
    const lineValidations = result.lineValidations.filter(
      (lv) => lv.messages.length > 0,
    );
    expect(lineValidations.length).toEqual(1);
    const lineValidation = lineValidations[0];
    expect(lineValidation.messages).toMatchSnapshot();
    nockDone();
  });

  it("should invalidate single action reference (node16)", async () => {
    const { nockDone } = await nockBack(
      "actions-checkout-validation-node16.json",
    );
    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionReferenceValidation(octokit);

    const actionsCheckoutLineOutdatedRef: FileLine = {
      lineNumber: 2,
      content:
        "        uses: actions/checkout@7739b9ba2efcda9dde65ad1e3c2dbe65b41dfba7 # v3.6.0",
      operation: "add",
      ignored: false,
    };

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [JOB_STEP_LINE, actionsCheckoutLineOutdatedRef],
    };

    const result = await subject.validate(simpleChanges);
    const lineValidations = result.lineValidations.filter(
      (lv) => lv.messages.length > 0,
    );

    expect(lineValidations.length).toEqual(1);
    const lineValidation = lineValidations[0];
    expect(lineValidation.messages).toMatchSnapshot();
    nockDone();
  });

  it("should invalidate single action reference (all errors)", async () => {
    const { nockDone } = await nockBack("dorny-paths-filter-v2_11_0.json");
    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionReferenceValidation(octokit);

    const untrustedActionAllErrors: FileLine = {
      lineNumber: 2,
      content: "        uses: dorny/paths-filter@v2.11.0",
      operation: "add",
      ignored: false,
    };

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [JOB_STEP_LINE, untrustedActionAllErrors],
    };

    const result = await subject.validate(simpleChanges);
    const lineValidations = result.lineValidations.filter(
      (lv) => lv.messages.length > 0,
    );
    expect(lineValidations.length).toEqual(1);
    const lineValidation = lineValidations[0];
    expect(lineValidation.messages).toMatchSnapshot();
    nockDone();
  });
});

describe(extractActionReferenceFromLine.name, () => {
  it("extracts action reference (trusted)", () => {
    const line =
      "        - uses: smartcontractkit/.github/actions/foo@bar # foo@1.0.0";
    const actionReference = extractActionReferenceFromLine(line);

    expect(actionReference).toEqual({
      owner: "smartcontractkit",
      repo: ".github",
      repoPath: "/actions/foo",
      ref: "bar",
      comment: "foo@1.0.0",
      isWorkflowFile: false,
      trusted: true,
    });
  });

  it("extracts action reference (untrusted)", () => {
    const line = "        - uses: dorny/paths-filter@bar # v1.0.0";
    const actionReference = extractActionReferenceFromLine(line);

    expect(actionReference).toEqual({
      owner: "dorny",
      repo: "paths-filter",
      repoPath: "",
      ref: "bar",
      comment: "v1.0.0",
      isWorkflowFile: false,
      trusted: false,
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
      isWorkflowFile: false,
      trusted: true,
    });
  });

  it("it parses workflow reference with isWorkflowFile=true", () => {
    const line =
      "        - uses: smartcontractkit/.github/.github/workflows/worfklow.yml@bar";
    const actionReference = extractActionReferenceFromLine(line);

    expect(actionReference).toEqual({
      owner: "smartcontractkit",
      repo: ".github",
      repoPath: "/.github/workflows/worfklow.yml",
      ref: "bar",
      comment: "",
      isWorkflowFile: true,
      trusted: true,
    });
  });

  it("parses local reference as no reference", () => {
    const line = "-      uses: ./.github/actions/local-action";
    const actionReference = extractActionReferenceFromLine(line);
    expect(actionReference).toBeUndefined();
  });
});
