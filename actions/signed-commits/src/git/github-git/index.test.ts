// src/__tests__/createCommitOnBranch.test.js
import fetch from "node-fetch";
import { getOctokit } from "@actions/github";
import nock from "nock";
import path from "path";
import { CreateCommitOnBranchInput } from "../../generated/graphql";
import { getRemoteHeadOid } from "./index";
import { createCommitOnBranch } from "./index";

import { it, expect } from "vitest";

// nock-back provides the recording and playback functionality
const nockBack = nock.back;
// Set the fixture path and nockBack mode
nockBack.fixtures = path.join(__dirname, "__fixtures__");
nockBack.setMode("lockdown"); // Change to 'lockdown' to use existing fixtures

// Test to record the fixture
it("creates a commit on a branch", async () => {
  const { nockDone } = await nockBack("createCommitOnBranch.json");

  const token =
    nockBack.currentMode === "lockdown"
      ? "fake-token"
      : process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN must be set when recording fixtures");
  }
  const octokit = getOctokit(token, {
    request: {
      fetch,
    },
  });

  const fileContents = "hello world";
  const base64FileContents = Buffer.from(fileContents).toString("base64");
  const branch = {
    repositoryNameWithOwner: "smartcontractkit-test/changesets-test",
    branchName: "main",
  };
  const [owner, repo] = branch.repositoryNameWithOwner.split("/");
  const expectedHeadOid = await getRemoteHeadOid(octokit, {
    branch: branch.branchName,
    owner,
    repo,
  });

  const input: CreateCommitOnBranchInput = {
    expectedHeadOid,
    branch,
    message: {
      headline: "Create a new something",
      body: "This is the body of the commit message",
    },
    fileChanges: {
      additions: [{ contents: base64FileContents, path: "test.txt" }],
      deletions: [],
    },
  };

  const data = await createCommitOnBranch(octokit, input);

  expect(data).toMatchObject({
    createCommitOnBranch: {
      commit: {
        url: expect.stringContaining(
          "https://github.com/smartcontractkit-test/changesets-test/commit/",
        ),
      },
    },
  });

  nockDone(); // Ensure nockBack knows we're done recording
});
