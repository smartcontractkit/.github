import {
  combineParsedFiles,
  filterForRelevantChanges,
  getParsedFilesForValidation,
  parseGithubDiff,
  ParsedFiles,
  combineFileLines,
  FileLine,
} from "../parse-files.js";
import { getComparison, GithubFiles } from "../github.js";
import { InvokeContext, RunInputs } from "../run.js";
import { getNock, getTestOctokit } from "./__helpers__/test-utils.js";
const nockBack = getNock();

import { join } from "path";
import { describe, it, expect } from "vitest";

const defaultContext: InvokeContext = {
  token: "token",
  owner: "owner",
  repo: "repo",
  base: undefined,
  head: undefined,
  prNumber: -1,
};

const defaultInputs: RunInputs = {
  evaluateMode: false,
  validateRunners: false,
  validateActionRefs: false,
  validateActionNodeVersion: false,
  validateAllActionDefinitions: false,
  rootDir: __dirname,
  diffOnly: false,
};

describe(getParsedFilesForValidation.name, () => {
  it("should return actions/workflow files for PR", async () => {
    const { nockDone } = await nockBack(
      `${getParsedFilesForValidation.name}-pr.json`,
    );
    const octokit = getTestOctokit(nockBack.currentMode);

    // https://github.com/smartcontractkit/.github/commit/72a01b25a8d31c8fe3dee5e74eaf936eb42064ec
    const context = {
      owner: "smartcontractkit",
      repo: ".github",
      prNumber: 1,
      base: "31e00facdd8f57a2bc7868b5e4c8591bf2aa3727",
      head: "72a01b25a8d31c8fe3dee5e74eaf936eb42064ec",
      token: "token",
    };

    const result = await getParsedFilesForValidation(
      context,
      { ...defaultInputs, diffOnly: true },
      octokit,
    );

    const files = result.map((f) => f.filename);
    expect(files).toEqual([
      `.github/workflows/pull-request-main.yml`,
      `.github/workflows/push-main.yml`,
    ]);

    nockDone();
  });

  it("should return *all* actions/workflow files for PR", async () => {
    const { nockDone } = await nockBack(
      `${getParsedFilesForValidation.name}-pr-all.json`,
    );
    const octokit = getTestOctokit(nockBack.currentMode);

    // https://github.com/smartcontractkit/.github/commit/72a01b25a8d31c8fe3dee5e74eaf936eb42064ec
    const context = {
      owner: "smartcontractkit",
      repo: ".github",
      prNumber: 1,
      base: "31e00facdd8f57a2bc7868b5e4c8591bf2aa3727",
      head: "72a01b25a8d31c8fe3dee5e74eaf936eb42064ec",
      token: "token",
    };

    const inputs = {
      ...defaultInputs,
      validateAllActionDefinitions: true,
      diffOnly: true,
    };

    const result = await getParsedFilesForValidation(context, inputs, octokit);

    const files = result.map((f) => f.filename);
    expect(files).toEqual([
      `.github/workflows/pull-request-main.yml`,
      `.github/workflows/push-main.yml`,
      `actions/ci-test-ts/action.yml`,
      `apps/go-mod-validator/action.yaml`,
    ]);

    nockDone();
  });

  it("should return actions/workflow files non-pr", async () => {
    const { nockDone } = await nockBack(
      `${getParsedFilesForValidation.name}-non-pr-all.json`,
    );
    const context: InvokeContext = {
      ...defaultContext,
      prNumber: undefined,
    };

    const inputs = { ...defaultInputs, rootDir: join(__dirname, "/fake-repo") };

    const result = await getParsedFilesForValidation(
      context,
      inputs,
      {} as any,
    );

    const files = result.map((f) => {
      const index = f.filename.indexOf("__tests__");
      return f.filename.slice(index);
    });
    expect(files).toEqual([
      "__tests__/fake-repo/.github/workflows/bar.yml",
      "__tests__/fake-repo/.github/workflows/foo.yaml",
      "__tests__/fake-repo/.github/actions/test-yml/action.yml",
      "__tests__/fake-repo/.github/actions/test-yaml/action.yaml",
    ]);
    nockDone();
  });

  it("should all return actions/workflow files non-pr", async () => {
    const context: InvokeContext = {
      ...defaultContext,
      prNumber: undefined,
    };

    const inputs = {
      ...defaultInputs,
      validateAllActionDefinitions: true,
      rootDir: join(__dirname, "/fake-repo"),
    };

    const result = await getParsedFilesForValidation(
      context,
      inputs,
      {} as any,
    );

    const files = result.map((f) => {
      const index = f.filename.indexOf("__tests__");
      return f.filename.slice(index);
    });
    expect(files).toEqual([
      "__tests__/fake-repo/.github/workflows/bar.yml",
      "__tests__/fake-repo/.github/workflows/foo.yaml",
      "__tests__/fake-repo/.github/actions/test-yml/action.yml",
      "__tests__/fake-repo/action.yml",
      "__tests__/fake-repo/directory/action.yml",
      "__tests__/fake-repo/.github/actions/test-yaml/action.yaml",
      "__tests__/fake-repo/action.yml",
    ]);
  });
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

describe(combineFileLines.name, () => {
  it("should merge separate files properly", () => {
    const existingFile: ParsedFiles = [
      {
        filename: "file1.yml",
        lines: [
          {
            lineNumber: 1,
            content: "foo",
            operation: "unchanged",
            ignored: false,
          },
        ],
      },
    ];

    const diffFile: ParsedFiles = [
      {
        filename: "file2.yml",
        lines: [
          { lineNumber: 1, content: "bar", operation: "add", ignored: false },
        ],
      },
    ];

    const result = combineParsedFiles(existingFile, diffFile);

    expect(result[0]).toEqual(existingFile[0]);
    expect(result[1]).toEqual(diffFile[0]);
  });

  it("should merge separate and overlapping files properly", () => {
    const seperateFileLines: FileLine[] = [
      { lineNumber: 1, content: "foo", operation: "unchanged", ignored: false },
    ];
    const combinedFileLinesExisting: FileLine[] = [
      { lineNumber: 1, content: "foo", operation: "unchanged", ignored: false },
      { lineNumber: 2, content: "foo", operation: "unchanged", ignored: false },
    ];
    const combinedFileLinesDiff: FileLine[] = [
      { lineNumber: 2, content: "foo", operation: "add", ignored: false },
    ];

    const existingFile: ParsedFiles = [
      {
        filename: "only-existing.yml",
        lines: seperateFileLines,
      },
      {
        filename: "combined.yml",
        lines: combinedFileLinesExisting,
      },
    ];

    const diffFile: ParsedFiles = [
      {
        filename: "only-diff.yml",
        lines: seperateFileLines,
      },
      {
        filename: "combined.yml",
        lines: combinedFileLinesDiff,
      },
    ];

    const result = combineParsedFiles(existingFile, diffFile);

    expect(result[0]).toEqual(existingFile[0]);
    expect(result[1]).toEqual({
      filename: "combined.yml",
      lines: [combinedFileLinesExisting[0], combinedFileLinesDiff[0]],
    });
    expect(result[2]).toEqual(diffFile[0]);
  });
});

describe(combineFileLines.name, () => {
  it("should use existing lines if diff is empty", () => {
    const existingLines: FileLine[] = [
      { lineNumber: 1, content: "foo", operation: "unchanged", ignored: false },
      { lineNumber: 2, content: "bar", operation: "unchanged", ignored: false },
      { lineNumber: 3, content: "baz", operation: "unchanged", ignored: false },
    ];

    const result = combineFileLines(existingLines, []);
    expect(result).toEqual(existingLines);
  });

  it("should use diff lines if existing is empty", () => {
    const diffLines: FileLine[] = [
      { lineNumber: 1, content: "foo", operation: "unchanged", ignored: false },
      { lineNumber: 2, content: "bar", operation: "add", ignored: false },
      { lineNumber: 3, content: "baz", operation: "unchanged", ignored: false },
    ];

    const result = combineFileLines([], diffLines);
    expect(result).toEqual(diffLines);
  });

  it("should merge lines properly", () => {
    const existingLines: FileLine[] = [
      { lineNumber: 1, content: "foo", operation: "unchanged", ignored: false },
      { lineNumber: 2, content: "bar", operation: "unchanged", ignored: false },
      { lineNumber: 3, content: "baz", operation: "unchanged", ignored: false },
    ];

    const diffLines: FileLine[] = [
      { lineNumber: 2, content: "bar", operation: "add", ignored: false },
    ];

    const result = combineFileLines(existingLines, diffLines);
    expect(result[0]).toEqual(existingLines[0]);
    expect(result[1]).toEqual(diffLines[0]);
    expect(result[2]).toEqual(existingLines[2]);
  });
});
