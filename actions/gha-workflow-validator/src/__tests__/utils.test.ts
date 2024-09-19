import {
  filterForRelevantChanges,
  parseGithubDiff,
  doValidationErrorsExist,
  processLineValidationResults,
} from "../utils.js";
import { GithubFiles, getComparison } from "../github.js";
import { getNock, getTestOctokit } from "./__helpers__/test-utils.js";

import { vi, describe, it, expect } from "vitest";
import {
  FileValidationResult,
  LineValidationResult,
  ValidationMessage,
  ValidationType,
} from "../validations/validation-check.js";

const nockBack = getNock();

vi.mock("@actions/core", async () => {
  return (await import("./__helpers__/test-utils.js")).coreLoggingStubs();
});

const simplePatchResponse: GithubFiles = [
  {
    sha: "5a48bbc24f05c3b98273f60152ffa976f4baa9bb",
    filename: ".github/workflows/test.yml",
    status: "added",
    additions: 23,
    deletions: 0,
    changes: 23,
    blob_url:
      "https://github.com/smartcontractkit/fake-repository/blob/2327b89b5aa6d70308e639cd86a69250bd4014c9/.github%2Fworkflows%2Ftest.yml",
    raw_url:
      "https://github.com/smartcontractkit/fake-repository/raw/2327b89b5aa6d70308e639cd86a69250bd4014c9/.github%2Fworkflows%2Ftest.yml",
    contents_url:
      "https://api.github.com/repos/smartcontractkit/fake-repository/contents/.github%2Fworkflows%2Ftest.yml?ref=2327b89b5aa6d70308e639cd86a69250bd4014c9",
    patch:
      '@@ -0,0 +1,23 @@\n+name: schedule-update-actions\n+\n+on:\n+  schedule:\n+    - cron: "0 0 * * *"\n+\n+jobs:\n+  update-actions:\n+    runs-on: ubuntu-latest\n+    permissions:\n+      id-token: write\n+      contents: write\n+      pull-requests: write\n+      actions: read\n+    steps:\n+      - name: Update custom actions\n+        uses: smartcontractkit/.github/actions/update-actions@7ac9af09dda8c553593d2153a975b43b6958fa9f # update-actions@0.1.3\n+        with:\n+          aws-role-arn: ${{ secrets.AWS_ROLE_ARN }}\n+          aws-lambda-url: ${{ secrets.AWS_LAMBDA_URL }}\n+          aws-role-arn-updater: ${{ secrets.AWS_ROLE_ARN_UPDATER }}\n+          aws-lambda-url-updater: ${{ secrets.AWS_LAMBDA_URL_UPDATER }}\n+          aws-region: ${{ secrets.AWS_REGION }}\n\\ No newline at end of file',
  },
];

describe(filterForRelevantChanges.name, () => {
  it("filters for relevant changes (empty)", () => {
    const filteredFiles = filterForRelevantChanges([], false);
    expect(filteredFiles).toEqual([]);
  });

  it("filters for relevant changes (irrelevant)", () => {
    const files = [
      {
        filename: ".github/workflows/not-a-workflow.txt",
      },
      {
        filename: "workflows/not-a-workflow.yml",
      },
    ];
    const filteredFiles = filterForRelevantChanges(files as GithubFiles, false);
    expect(filteredFiles).toEqual([]);
  });

  it("filters for relevant changes (simple)", () => {
    const filteredFiles = filterForRelevantChanges(simplePatchResponse, false);
    expect(filteredFiles).toEqual(simplePatchResponse);
  });

  it("filters for relevant changes (workflows)", () => {
    const files = [
      {
        filename: ".github/workflows/workflow-1.yml",
      },
      {
        filename: ".github/workflows/workflow-2.yaml",
      },
      {
        filename: ".github/workflows/not-a-workflow.txt",
      },
      {
        filename: "workflows/not-a-workflow.yml",
      },
    ];

    const filteredFiles = filterForRelevantChanges(files as GithubFiles, false);
    expect(filteredFiles).toEqual(files.slice(0, 2));
  });

  it("filters for relevant changes (actions)", () => {
    const files = [
      {
        filename: ".github/actions/yml/action-1.yml",
      },
      {
        filename: ".github/actions/yaml/action-2.yaml",
      },
      {
        filename: ".github/actions/txt/not-a-workflow.txt",
      },
      {
        filename: "actions/not-a-action.yml",
      },
    ];

    const filteredFiles = filterForRelevantChanges(files as GithubFiles, false);
    expect(filteredFiles).toEqual(files.slice(0, 2));
  });

  it("filters for relevant changes (all actions)", () => {
    const files = [
      {
        filename: ".github/actions/yml/action-1.yml",
      },
      {
        filename: ".github/actions/yaml/action-2.yaml",
      },
      {
        filename: "actions/foo/action.yml",
      },
      {
        filename: "actions/bar/action.yaml",
      },
      {
        filename: ".github/actions/txt/not-a-workflow.txt",
      },
      {
        filename: "actions/not/an-action.yml",
      },
    ];

    const filteredFiles = filterForRelevantChanges(files as GithubFiles, true);
    expect(filteredFiles).toEqual(files.slice(0, 4));
  });
});

describe(parseGithubDiff.name, () => {
  it("parses all additions (empty)", () => {
    const parsedFiles = parseGithubDiff([]);
    expect(parsedFiles).toEqual([]);
  });

  it("parses all additions (simple)", () => {
    const parsedFiles = parseGithubDiff(simplePatchResponse);
    expect(parsedFiles).toMatchSnapshot();
  });

  it("parses all additions (complex)", async () => {
    const { nockDone } = await nockBack("comparison-utils-test.json");
    const octokit = getTestOctokit(nockBack.currentMode);

    const repoRequestOptions = {
      owner: "smartcontractkit",
      repo: "ccip",
      base: "0e479c925b8a3fa26e69b35cc5282057d153acf9",
      head: "839332f9561e449c6e331909fa5c11a726ab4b1b",
    };
    const { owner, repo, base, head } = repoRequestOptions;
    const response = await getComparison(octokit, owner, repo, base, head);
    const parsedFiles = parseGithubDiff(response);
    expect(parsedFiles).toMatchSnapshot();

    nockDone();
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

describe(processLineValidationResults.name, () => {
  it("should combine empty results", () => {
    const results = processLineValidationResults([]);
    expect(results).toEqual([]);
  });

  it("should combine single result", () => {
    const singleLineValidation: LineValidationResult = {
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
    };
    const results = processLineValidationResults([singleLineValidation]);
    expect(results).toEqual([singleLineValidation]);
  });

  it("should combine two results for the same line", () => {
    const lineOneValidationOne: LineValidationResult = {
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
    };

    const lineOneValidationTwo: LineValidationResult = {
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
          type: ValidationType.NODE_VERSION,
          severity: "warning",
        },
      ],
    };

    const results = processLineValidationResults([
      lineOneValidationOne,
      lineOneValidationTwo,
    ]);
    expect(results.length).toBe(1);

    const combinedLineValidation = results[0];
    expect(combinedLineValidation.messages).toEqual([
      ...lineOneValidationOne.messages,
      ...lineOneValidationTwo.messages,
    ]);
  });

  it("should combine two results for two lines (and sort by line)", () => {
    const lineTwoValidationOne: LineValidationResult = {
      filename: ".github/workflows/test.yml",
      line: {
        lineNumber: 2,
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
    };

    const lineTwoValidationTwo: LineValidationResult = {
      filename: ".github/workflows/test.yml",
      line: {
        lineNumber: 2,
        content: "line 1",
        operation: "add",
        ignored: false,
      },
      messages: [
        {
          message: "Error",
          type: ValidationType.NODE_VERSION,
          severity: "warning",
        },
      ],
    };

    const lineOneValidationOne: LineValidationResult = {
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
    };

    const lineOneValidationTwo: LineValidationResult = {
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
          type: ValidationType.NODE_VERSION,
          severity: "warning",
        },
      ],
    };

    const results = processLineValidationResults([
      lineOneValidationOne,
      lineOneValidationTwo,
      lineTwoValidationOne,
      lineTwoValidationTwo,
    ]);
    expect(results.length).toBe(2);

    const line1LV = results[0];
    expect(line1LV.messages).toEqual([
      ...lineOneValidationOne.messages,
      ...lineOneValidationTwo.messages,
    ]);

    const line2LV = results[0];
    expect(line2LV.messages).toEqual([
      ...lineTwoValidationOne.messages,
      ...lineTwoValidationTwo.messages,
    ]);
  });

  it("should lower severity for ignored lines", () => {
    const message: ValidationMessage = {
      message: "Error",
      type: ValidationType.VERSION_COMMENT,
      severity: "error",
    };

    const singleLineValidation: LineValidationResult = {
      filename: ".github/workflows/test.yml",
      line: {
        lineNumber: 1,
        content: "line 1",
        operation: "add",
        ignored: true,
      },
      messages: [message],
    };
    const results = processLineValidationResults([singleLineValidation]);
    expect(results).toEqual([
      {
        ...singleLineValidation,
        messages: [{ ...message, severity: "ignored" }],
      },
    ]);
  });

  it("should lower severity for ignored lines but not new ignore comments", () => {
    const ignoresCommentMessage: ValidationMessage = {
      message: "Error",
      type: ValidationType.IGNORE_COMMENT,
      severity: "error",
    };

    const lowerableMessage: ValidationMessage = {
      message: "Error",
      type: ValidationType.VERSION_COMMENT,
      severity: "error",
    };

    const singleLineValidation: LineValidationResult = {
      filename: ".github/workflows/test.yml",
      line: {
        lineNumber: 1,
        content: "line 1",
        operation: "add",
        ignored: true,
      },
      messages: [ignoresCommentMessage, lowerableMessage],
    };
    const results = processLineValidationResults([singleLineValidation]);
    expect(results).toEqual([
      {
        ...singleLineValidation,
        messages: [
          ignoresCommentMessage,
          { ...lowerableMessage, severity: "ignored" },
        ],
      },
    ]);
  });
});
