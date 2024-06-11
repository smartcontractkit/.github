import { getComparison, getActionFileFromGithub } from "../github";
import { getNock, getTestOctokit } from "./__helpers__/test-utils.js";

import { describe, it, expect } from "vitest";

const nockBack = getNock();

describe(getActionFileFromGithub.name, () => {
  it("should return action.yml file", async () => {
    const { nockDone } = await nockBack("action-yml.json");
    const octokit = getTestOctokit(nockBack.currentMode);

    const repoRequestOptions = {
      owner: "smartcontractkit",
      repo: ".github",
      repoPath: "/actions/signed-commits",
      ref: "main",
    };
    const { owner, repo, repoPath, ref } = repoRequestOptions;
    const result = await getActionFileFromGithub(
      octokit,
      owner,
      repo,
      repoPath,
      ref,
    );

    expect(result?.includes("name: changesets-action-signed-commits")).toBe(
      true,
    );

    nockDone();
  });

  it("should return action.yaml fallback file", async () => {
    const { nockDone } = await nockBack("action-yaml-fallback.json");
    const octokit = getTestOctokit(nockBack.currentMode);

    // Action which uses action.yaml instead of action.yml
    const repoRequestOptions = {
      owner: "ludeeus",
      repo: "action-shellcheck",
      repoPath: "",
      ref: "00cae500b08a931fb5698e11e79bfbd38e612a38",
    };

    const { owner, repo, repoPath, ref } = repoRequestOptions;
    const result = await getActionFileFromGithub(
      octokit,
      owner,
      repo,
      repoPath,
      ref,
    );

    expect(result?.includes('name: "ShellCheck"')).toBe(true);

    nockDone();
  });
});

describe(getComparison.name, () => {
  it("should return comparison", async () => {
    const { nockDone } = await nockBack("comparison.json");
    const octokit = getTestOctokit(nockBack.currentMode);

    const repoRequestOptions = {
      owner: "smartcontractkit",
      repo: "ccip",
      base: "0e479c925b8a3fa26e69b35cc5282057d153acf9",
      head: "839332f9561e449c6e331909fa5c11a726ab4b1b",
    };
    const { owner, repo, base, head } = repoRequestOptions;
    const result = await getComparison(octokit, owner, repo, base, head);

    expect(result?.length).toBeDefined();
    expect(result?.length).toEqual(27);

    nockDone();
  });
});
