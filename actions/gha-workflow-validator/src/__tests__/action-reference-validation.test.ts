import { validateActionReferenceChanges } from '../action-reference-validations.js';
import { ParsedFile } from '../utils.js';
import { getNock, getTestOctokit } from './__helpers__/test-utils.js'

const nockBack = getNock();

const defaultActionsCheckoutFile = { lineNumber: 2,
  content: "        actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1",
  actionReference: {
    owner: "actions",
    repo: "checkout",
    repoPath: "",
    ref: "b4ffde65f46336ab88eb53be808477a3936bae11",
    comment: "v4.1.1",
    line: "        actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1",
  }
}

describe(validateActionReferenceChanges.name, () => {

  it("should validate no changes", async () => {
    const octokit = getTestOctokit(nockBack.currentMode);
    const result = await validateActionReferenceChanges(octokit, []);
    expect(result).toEqual([]);
  });

  it("should validate no action references", async () => {
    const octokit = getTestOctokit(nockBack.currentMode);
    const noWorkflowChanges: ParsedFile[] = [
      {
        filename: ".github/workflows/test.yml",
        sha: "abc",
        addedLines: [
          { lineNumber: 1, content: "line 1" },
          { lineNumber: 2, content: "line 2" },
        ],
      }
    ];
    const result = await validateActionReferenceChanges(octokit, noWorkflowChanges);
    expect(result).toEqual([]);
  });

  it("should validate single action reference", async () => {
    const { nockDone } = await nockBack("actions-checkout-validation.json")
    const octokit = getTestOctokit(nockBack.currentMode);

    const simpleChanges: ParsedFile[] = [
      {
        filename: ".github/workflows/test.yml",
        sha: "abc",
        addedLines: [
          { lineNumber: 1, content: "      - name: test step"},
          defaultActionsCheckoutFile,
        ],
      }
    ];

    const result = await validateActionReferenceChanges(octokit, simpleChanges);
    expect(result).toEqual([]);
    nockDone();
  });

  it("should invalidate single action reference (no version comment)", async () => {
    const { nockDone } = await nockBack("actions-checkout-validation.json")

    const octokit = getTestOctokit(nockBack.currentMode);

    const simpleChanges: ParsedFile[] = [
      {
        filename: ".github/workflows/test.yml",
        sha: "abc",
        addedLines: [
          { lineNumber: 1, content: "      - name: test step"},
          {
            ...defaultActionsCheckoutFile,
            actionReference: {
              ...defaultActionsCheckoutFile.actionReference,
              comment: "",
            }
          }
        ],
      }
    ];

    const result = await validateActionReferenceChanges(octokit, simpleChanges);
    const errorsArray = result.filter(file => file.lineValidations.length > 0);
    expect(errorsArray.length).toEqual(1);

    const error = errorsArray[0];
    const lineValidationsArray = error.lineValidations;
    expect(lineValidationsArray.length).toEqual(1);

    const lineValidation = lineValidationsArray[0];
    expect(lineValidation.line.lineNumber).toEqual(simpleChanges[0].addedLines[1].lineNumber);
    expect(lineValidation.validationErrors.length).toEqual(1);
    expect(lineValidation.validationErrors[0].message).toEqual("No version comment found");

    nockDone();
  });

  it("should invalidate single action reference (bad sha ref)", async () => {
    const { nockDone } = await nockBack("actions-checkout-validation-v4.json")

    const octokit = getTestOctokit(nockBack.currentMode);

    const badRef = "v4";
    const simpleChanges: ParsedFile[] = [
      {
        filename: ".github/workflows/test.yml",
        sha: "abc",
        addedLines: [
          { lineNumber: 1, content: "      - name: test step"},
          {
            ...defaultActionsCheckoutFile,
            actionReference: {
              ...defaultActionsCheckoutFile.actionReference,
              ref: badRef,
            }
          }
        ],
      }
    ];

    const result = await validateActionReferenceChanges(octokit, simpleChanges);
    const errorsArray = result.filter(file => file.lineValidations.length > 0);
    expect(errorsArray.length).toEqual(1);

    const error = errorsArray[0];
    const lineValidationsArray = error.lineValidations;
    expect(lineValidationsArray.length).toEqual(1);

    const lineValidation = lineValidationsArray[0];
    expect(lineValidation.line.lineNumber).toEqual(simpleChanges[0].addedLines[1].lineNumber);
    expect(lineValidation.validationErrors.length).toEqual(1);
    expect(lineValidation.validationErrors[0].message).toEqual(`${badRef} is not a valid SHA1`);

    nockDone();
  });

  it("should invalidate single action reference (node16)", async () => {
    const { nockDone } = await nockBack("actions-checkout-validation-node16.json");
    const octokit = getTestOctokit(nockBack.currentMode);

    const simpleChanges: ParsedFile[] = [
      {
        filename: ".github/workflows/test.yml",
        sha: "abc",
        addedLines: [
          { lineNumber: 1, content: "      - name: test step"},
          {
            ...defaultActionsCheckoutFile,
            actionReference: {
              ...defaultActionsCheckoutFile.actionReference,
              ref: "7739b9ba2efcda9dde65ad1e3c2dbe65b41dfba7",
              comment: "# v3.6.0",
            }
          }
        ],
      }
    ];

    const result = await validateActionReferenceChanges(octokit, simpleChanges);
    const errorsArray = result.filter(file => file.lineValidations.length > 0);
    expect(errorsArray.length).toEqual(1);

    const error = errorsArray[0];
    const lineValidationsArray = error.lineValidations;
    expect(lineValidationsArray.length).toEqual(1);

    const lineValidation = lineValidationsArray[0];
    expect(lineValidation.line.lineNumber).toEqual(simpleChanges[0].addedLines[1].lineNumber);
    expect(lineValidation.validationErrors.length).toEqual(1);
    expect(lineValidation.validationErrors[0].message).toEqual("Action is using node16");

    nockDone();
  });


  it("should invalidate single action reference (all errors)", async () => {
    const { nockDone } = await nockBack("actions-checkout-validation-v3_6_0.json");
    const octokit = getTestOctokit(nockBack.currentMode);

    const badRef = "v3.6.0";
    const simpleChanges: ParsedFile[] = [
      {
        filename: ".github/workflows/test.yml",
        sha: "abc",
        addedLines: [
          { lineNumber: 1, content: "      - name: test step"},
          {
            ...defaultActionsCheckoutFile,
            actionReference: {
              ...defaultActionsCheckoutFile.actionReference,
              ref: badRef,
              comment: "",
            }
          }
        ],
      }
    ];

    const result = await validateActionReferenceChanges(octokit, simpleChanges);
    const errorsArray = result.filter(file => file.lineValidations.length > 0);
    expect(errorsArray.length).toEqual(1);

    const error = errorsArray[0];
    const lineValidationsArray = error.lineValidations;
    expect(lineValidationsArray.length).toEqual(1);

    const lineValidation = lineValidationsArray[0];
    expect(lineValidation.line.lineNumber).toEqual(simpleChanges[0].addedLines[1].lineNumber);
    expect(lineValidation.validationErrors.length).toEqual(3);

    expect(lineValidation.validationErrors.some(error => error.message === "No version comment found")).toEqual(true);
    expect(lineValidation.validationErrors.some(error => error.message === "Action is using node16")).toEqual(true);
    expect(lineValidation.validationErrors.some(error => error.message === `${badRef} is not a valid SHA1`)).toEqual(true);

    nockDone();
  });
});
