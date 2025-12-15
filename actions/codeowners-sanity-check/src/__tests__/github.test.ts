import { checkCodeOwners, upsertPRComment, updatePRComment } from "../github";
import { getNock, getTestOctokit } from "./__helpers__/test-utils.js";
import { vi, describe, it, expect } from "vitest";
import nock from "nock";

const nockBack = getNock();

vi.mock("@actions/core", async () => {
  return (await import("./__helpers__/test-utils.js")).coreLoggingStubs({});
});

describe(checkCodeOwners.name, () => {
  it("should check codeowners (valid)", async () => {
    const { nockDone } = await nockBack("dot-github-codeowners-valid.json");
    const octokit = getTestOctokit(nockBack.currentMode);
    const result = await checkCodeOwners(
      octokit,
      "smartcontractkit",
      ".github",
      "4d2f6bfd28367da87f493dd8854cbaa59f45a9b8",
    );
    expect(result).toEqual({ kind: "success", errors: [] });
    nockDone();
  });

  it("should check codeowners (invalid)", async () => {
    const { nockDone } = await nockBack(
      "chainlink-github-actions-codeowners-invalid.json",
    );
    const octokit = getTestOctokit(nockBack.currentMode);
    const result = await checkCodeOwners(
      octokit,
      "smartcontractkit",
      "chainlink-github-actions",
      "5a7543e418aa2dc57b75e85581eae30820a8c9ae",
    );
    expect(result).toMatchSnapshot();
    nockDone();
  });

  it("should check codeowners (missing)", async () => {
    const { nockDone } = await nockBack(
      "gha-org-workflows-codeowners-missing.json",
    );
    const octokit = getTestOctokit(nockBack.currentMode);
    const result = await checkCodeOwners(
      octokit,
      "smartcontractkit",
      "gha-org-workflows",
      "def9d574417d336ab11d157c340329dcabbf4366",
    );
    expect(result).toEqual({ kind: "not_found" });
    nockDone();
  });

  it("should fail gracefully on github server error", async () => {
    const ref = "def9d574417d336ab11d157c340329dcabbf4366";

    // mock response
    nock("https://api.github.com/")
      .get(
        `/repos/smartcontractkit/gha-org-workflows/codeowners/errors?ref=${ref}`,
      )
      .reply(500, {
        message: "simulated error",
      });

    const octokit = getTestOctokit(nockBack.currentMode);
    const result = await checkCodeOwners(
      octokit,
      "smartcontractkit",
      "gha-org-workflows",
      ref,
    );
    expect(result).toEqual({ kind: "failure", message: "simulated error" });
  });
});
