import { getComparison, getActionFileFromGithub, commentOnPrOrUpdateExisting, deleteCommentOnPRIfExists, } from "./github";
import { COMMENT_HEADER } from "./strings";
import { getOctokit } from "@actions/github";
import nock from "nock";
import path from "path";
import fetch from "node-fetch";

// nock-back provides the recording and playback functionality
const nockBack = nock.back;
// Set the fixture path and nockBack mode
nockBack.fixtures = path.join(__dirname, "__fixtures__");

// Change to 'lockdown' to use existing fixtures
// Valid values = lockdown, record, wild, dryrun, update
nockBack.setMode("lockdown");

if (nockBack.currentMode === "lockdown") {
  nock.disableNetConnect();
}

describe("getActionFileFromGithub", () => {
  it("should return action.yml file", async () => {
    const { nockDone } = await nockBack("action-yml.json");
    const octokit = getTestOctokit();

    const repoRequestOptions  = {
      owner: "smartcontractkit",
      repo: ".github",
      repoPath: "/actions/signed-commits",
      ref: "main",
    }
    const { owner, repo, repoPath, ref } = repoRequestOptions;
    const result = await getActionFileFromGithub(octokit, owner, repo, repoPath, ref);

    expect(result?.includes("name: changesets-action-signed-commits")).toBe(true);

    nockDone();
  });

  it("should return action.yaml fallback file", async () => {
    const { nockDone } = await nockBack("action-yaml-fallback.json");
    const octokit = getTestOctokit();

    // Action which uses action.yaml instead of action.yml
    const repoRequestOptions  = {
      owner: "ludeeus",
      repo: "action-shellcheck",
      repoPath: "",
      ref: "00cae500b08a931fb5698e11e79bfbd38e612a38",
    }

    const { owner, repo, repoPath, ref } = repoRequestOptions;
    const result = await getActionFileFromGithub(octokit, owner, repo, repoPath, ref);

    expect(result?.includes("name: \"ShellCheck\"")).toBe(true);

    nockDone();
  });
});

describe("getComparison", () => {
  it("should return comparison", async () => {
    const { nockDone } = await nockBack("comparison.json");
    const octokit = getTestOctokit();

    const repoRequestOptions  = {
      owner: "smartcontractkit",
      repo: "ccip",
      base: "0e479c925b8a3fa26e69b35cc5282057d153acf9",
      head: "839332f9561e449c6e331909fa5c11a726ab4b1b",
    }
    const { owner, repo, base, head } = repoRequestOptions;
    const result = await getComparison(octokit, owner, repo, base, head);

    expect(result?.length).toBeDefined();
    expect(result?.length).toEqual(27);

    nockDone();
  });
});

// todo
describe("commentOnPrOrUpdateExisting", () => {
  it("should create new comment", async () => {
    const { nockDone } = await nockBack("create-comment.json");
    const octokit = getTestOctokit();

    const repoRequestOptions  = {
      owner: "smartcontractkit-test",
      repo: "gha-validator-test",
      prNumber: 1,
    }
    const { owner, repo,  } = repoRequestOptions;
    const result = await commentOnPrOrUpdateExisting(octokit, owner, repo, 1, COMMENT_HEADER + "\n placeholder test comment");

    expect(result).toBeDefined();
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeUndefined();

    nockDone();
  });


  it("should update existing comment", async () => {
    const { nockDone } = await nockBack("update-comment.json");
    const octokit = getTestOctokit();

    const repoRequestOptions  = {
      owner: "smartcontractkit-test",
      repo: "gha-validator-test",
      prNumber: 1,
    }
    const { owner, repo,  } = repoRequestOptions;
    const result = await commentOnPrOrUpdateExisting(octokit, owner, repo, 1, COMMENT_HEADER + "\n placeholder updated test comment");

    expect(result).toBeDefined();
    expect(result.updatedAt).toBeDefined();
    expect(result.createdAt).toBeUndefined();

    nockDone();
  });
});

describe("deleteCommentOnPRIfExists", () => {
  it("should delete existing comment", async () => {
    const { nockDone } = await nockBack("delete-comment.json");
    const octokit = getTestOctokit();

    const repoRequestOptions  = {
      owner: "smartcontractkit-test",
      repo: "gha-validator-test",
      prNumber: 1,
    }
    const { owner, repo,  } = repoRequestOptions;
    const result = await deleteCommentOnPRIfExists(octokit, owner, repo, 1);

    expect(result).toBe(true);

    nockDone();
  });
});

function getTestOctokit() {
  const token = nockBack.currentMode === "lockdown" ? "fake-token" : process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("GITHUB_TOKEN must be set when recording fixtures");
  }

  return getOctokit(token, {
    request: {
      fetch,
    },
  });
}
