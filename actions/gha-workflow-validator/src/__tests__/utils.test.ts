import { parseAllAdditions, } from '../utils.js';
import { GithubFiles, getComparison } from '../github.js';
import { getNock, getTestOctokit } from './__helpers__/test-utils.js'

import { describe, it, expect } from 'vitest';

const nockBack = getNock();

const simplePatchResponse: GithubFiles = [
  {
    sha: "5a48bbc24f05c3b98273f60152ffa976f4baa9bb",
    filename: ".github/workflows/test.yml",
    status: "added",
    additions: 23,
    deletions: 0,
    changes: 23,
    blob_url: "https://github.com/smartcontractkit/fake-repository/blob/2327b89b5aa6d70308e639cd86a69250bd4014c9/.github%2Fworkflows%2Ftest.yml",
    raw_url: "https://github.com/smartcontractkit/fake-repository/raw/2327b89b5aa6d70308e639cd86a69250bd4014c9/.github%2Fworkflows%2Ftest.yml",
    contents_url: "https://api.github.com/repos/smartcontractkit/fake-repository/contents/.github%2Fworkflows%2Ftest.yml?ref=2327b89b5aa6d70308e639cd86a69250bd4014c9",
    patch: "@@ -0,0 +1,23 @@\n+name: schedule-update-actions\n+\n+on:\n+  schedule:\n+    - cron: \"0 0 * * *\"\n+\n+jobs:\n+  update-actions:\n+    runs-on: ubuntu-latest\n+    permissions:\n+      id-token: write\n+      contents: write\n+      pull-requests: write\n+      actions: read\n+    steps:\n+      - name: Update custom actions\n+        uses: smartcontractkit/.github/actions/update-actions@7ac9af09dda8c553593d2153a975b43b6958fa9f # update-actions@0.1.3\n+        with:\n+          aws-role-arn: ${{ secrets.AWS_ROLE_ARN }}\n+          aws-lambda-url: ${{ secrets.AWS_LAMBDA_URL }}\n+          aws-role-arn-updater: ${{ secrets.AWS_ROLE_ARN_UPDATER }}\n+          aws-lambda-url-updater: ${{ secrets.AWS_LAMBDA_URL_UPDATER }}\n+          aws-region: ${{ secrets.AWS_REGION }}\n\\ No newline at end of file"
  }
];

describe(parseAllAdditions.name, () => {
  it("parses all additions (empty)", () => {
    const parsedFiles = parseAllAdditions([]);
    expect(parsedFiles).toEqual([]);
  });

  it("parses all additions (simple)", () => {
    const parsedFiles = parseAllAdditions(simplePatchResponse);
    expect(parsedFiles).toMatchSnapshot();
  });

  it("parses all additions (complex)", async () => {
    const { nockDone } = await nockBack("comparison-utils-test.json");
    const octokit = getTestOctokit(nockBack.currentMode);

    const repoRequestOptions  = {
      owner: "smartcontractkit",
      repo: "ccip",
      base: "0e479c925b8a3fa26e69b35cc5282057d153acf9",
      head: "839332f9561e449c6e331909fa5c11a726ab4b1b",
    }
    const { owner, repo, base, head } = repoRequestOptions;
    const response = await getComparison(octokit, owner, repo, base, head);
    const parsedFiles = parseAllAdditions(response);
    expect(parsedFiles).toMatchSnapshot();

    nockDone();
  });

  it("parses local reference as no reference", () => {
    const parsedFiles = parseAllAdditions([
      {
        "sha": "sha",
        "filename": ".github/workflows/test-workflow.yml",
        "status": "modified",
        "additions": 2,
        "deletions": 2,
        "changes": 4,
        "blob_url": "",
        "raw_url": "",
        "contents_url": "",
        "patch": "@@ -24,2 +24,2 @@ runs:\n   steps:\n     - name: test-step\n+       -      uses: ./.github/actions/local-action\n"
      },
    ]);
    const anyActionReferencesExist = parsedFiles.some(entry => entry.addedLines.some(line => line.actionReference))
    expect(anyActionReferencesExist).toEqual(false);
  });
});

