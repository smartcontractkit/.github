import { validateActionReferenceChanges } from '../action-reference-validations.js';
import { getTestOctokit } from './__helpers__/test-utils.js'
import nock from "nock";
import path from "path";
import { ParsedFile } from '../utils.js';

// nock-back provides the recording and playback functionality
const nockBack = nock.back;
// Set the fixture path and nockBack mode
nockBack.fixtures = path.join(__dirname, "__fixtures__");

// Change to 'lockdown' to use existing fixtures
// Valid values = lockdown, record, wild, dryrun, update
nockBack.setMode("record");

if (nockBack.currentMode === "lockdown") {
  nock.disableNetConnect();
}

describe("validateActionReferenceChanges", () => {



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
    const { nockDone } = await nockBack("actions-checkout-validation.json");
    const octokit = getTestOctokit(nockBack.currentMode);

    const simpleChanges: ParsedFile[] = [
      {
        filename: ".github/workflows/test.yml",
        sha: "abc",
        addedLines: [
          { lineNumber: 1, content: "      - name: test step"},
          { lineNumber: 2,
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
        ],
      }
    ];

    const result = await validateActionReferenceChanges(octokit, simpleChanges);
    expect(result).toEqual([]);
    nockDone();
  });
});
