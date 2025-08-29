import {
  ActionRefValidation,
  extractActionReferenceFromLine,
} from "../validations/action-reference-validations.js";
import { FileLine } from "../parse-files.js";
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

describe(ActionRefValidation.name, () => {
  it("should validate no action references (statuses:write) ", async () => {
    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionRefValidation(octokit);
    const line: FileLine = {
      lineNumber: 1,
      content: "        statuses: write",
      operation: "add",
      ignored: false,
    };
    const messages = await subject.validateLine(line);
    expect(messages).toEqual([]);
  });

  it("should validate single action reference (untrusted)", async () => {
    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionRefValidation(octokit, {
      validateNodeVersion: false,
    });

    const untrustedActionValid: FileLine = {
      lineNumber: 2,
      content:
        "        uses: untrusted/action@4ffde65f46336ab88eb53be808477a3936bae111 # v4.1.1",
      operation: "add",
      ignored: false,
    };

    const messages = await subject.validateLine(untrustedActionValid);
    expect(messages).toEqual([]);
  });

  it("should validate action reference (trusted actions/*)", async () => {
    const { nockDone } = await nockBack("actions-checkout-validation.json");
    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionRefValidation(octokit);

    const actionsCheckoutLineBadRef: FileLine = {
      lineNumber: 2,
      content: "        uses: actions/checkout@v4",
      operation: "add",
      ignored: false,
    };

    const messages = await subject.validateLine(actionsCheckoutLineBadRef);
    expect(messages).toEqual([]);
    nockDone();
  });

  it("should validate action reference (trusted smartcontractkit/*)", async () => {
    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionRefValidation(octokit, {
      validateNodeVersion: false,
    });

    const smartcontractKitLineBadRef: FileLine = {
      lineNumber: 2,
      content: "        uses: smartcontractkit/action@v4 # comment",
      operation: "add",
      ignored: false,
    };

    const messages = await subject.validateLine(smartcontractKitLineBadRef);
    expect(messages).toEqual([]);
  });

  it("should invalidate action reference (sha-ref / no comment)", async () => {
    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionRefValidation(octokit, {
      validateNodeVersion: false,
    });

    const actionsCheckoutLineBadRef: FileLine = {
      lineNumber: 2,
      content:
        "        uses: actions/checkout@de90cc6fb38fc0963ad72b210f1f284cd68cea36",
      operation: "add",
      ignored: false,
    };

    const messages = await subject.validateLine(actionsCheckoutLineBadRef);
    expect(messages).toMatchSnapshot();
  });

  it("should invalidate single action reference (no version comment)", async () => {
    const { nockDone } = await nockBack(
      "dorny-paths-filter-de90cc6fb38fc0963ad72b210f1f284cd68cea36.json",
    );

    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionRefValidation(octokit);

    const untrustedActionNoComment: FileLine = {
      lineNumber: 2,
      content:
        "        uses: dorny/paths-filter@de90cc6fb38fc0963ad72b210f1f284cd68cea36",
      operation: "add",
      ignored: false,
    };

    const messages = await subject.validateLine(untrustedActionNoComment);
    expect(messages).toMatchSnapshot();
    nockDone();
  });

  it("should invalidate single action reference (bad sha ref)", async () => {
    const { nockDone } = await nockBack("dory-paths-filter-v3-0-2.json");

    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionRefValidation(octokit);

    const untrustedActionBadRef: FileLine = {
      lineNumber: 2,
      content: "        uses: dorny/paths-filter@v3.0.2 # comment",
      operation: "add",
      ignored: false,
    };

    const messages = await subject.validateLine(untrustedActionBadRef);
    expect(messages).toMatchSnapshot();
    nockDone();
  });

  it("should invalidate single action reference (node16)", async () => {
    const { nockDone } = await nockBack(
      "actions-checkout-validation-node16.json",
    );
    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionRefValidation(octokit);

    const actionsCheckoutLineOutdatedRef: FileLine = {
      lineNumber: 2,
      content:
        "        uses: actions/checkout@7739b9ba2efcda9dde65ad1e3c2dbe65b41dfba7 # v3.6.0",
      operation: "add",
      ignored: false,
    };

    const messages = await subject.validateLine(actionsCheckoutLineOutdatedRef);
    expect(messages).toMatchSnapshot();
    nockDone();
  });

  it("should validate single action reference (node24)", async () => {
    const { nockDone } = await nockBack(
      "actions-checkout-validation-node24.json",
    );
    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionRefValidation(octokit);

    const actionsCheckoutLineNode24Ref: FileLine = {
      lineNumber: 2,
      content:
        "        uses: actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0",
      operation: "add",
      ignored: false,
    };

    const messages = await subject.validateLine(actionsCheckoutLineNode24Ref);
    expect(messages).toMatchSnapshot();
    nockDone();
  });

  it("should invalidate single action reference (all errors)", async () => {
    const { nockDone } = await nockBack("dorny-paths-filter-v2_11_0.json");
    const octokit = getTestOctokit(nockBack.currentMode);
    const subject = new ActionRefValidation(octokit);

    const untrustedActionAllErrors: FileLine = {
      lineNumber: 2,
      content: "        uses: dorny/paths-filter@v2.11.0",
      operation: "add",
      ignored: false,
    };

    const messages = await subject.validateLine(untrustedActionAllErrors);
    expect(messages).toMatchSnapshot();
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

  it("extracts action reference (quoted / trusted)", () => {
    const line =
      '        - uses: "smartcontractkit/.github/actions/foo@bar" # foo@1.0.0';
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

  it("extracts action reference (quoted / untrusted)", () => {
    const line = '        - uses: "dorny/paths-filter@bar" # v1.0.0';
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
    const line = "-      uses: ./.github/actions/local-action # comment";
    const actionReference = extractActionReferenceFromLine(line);
    expect(actionReference).toBeUndefined();
  });

  it("parses local reference as no reference (with single quotes)", () => {
    const line = "-      uses: './.github/actions/local-action' # comment";
    const actionReference = extractActionReferenceFromLine(line);
    expect(actionReference).toBeUndefined();
  });

  it("parses local reference as no reference (with double quotes)", () => {
    const line = '-      uses: "./.github/actions/local-action" # comment';
    const actionReference = extractActionReferenceFromLine(line);
    expect(actionReference).toBeUndefined();
  });

  it("parses invalid reference as no reference (unmatched quote)", () => {
    const line = '-      uses: "./.github/actions/local-action # comment';
    const actionReference = extractActionReferenceFromLine(line);
    expect(actionReference).toBeUndefined();
  });

  it("parses invalid reference as no reference (unmatched quote 2)", () => {
    const line = "-      uses: \"./.github/actions/local-action' # comment";
    const actionReference = extractActionReferenceFromLine(line);
    expect(actionReference).toBeUndefined();
  });

  it("parses invalid reference as no reference (misplaced quotes)", () => {
    const line = '-      uses: "./.github/actions/"local-action # comment';
    const actionReference = extractActionReferenceFromLine(line);
    expect(actionReference).toBeUndefined();
  });
});
