/**
 * This runs through the whole action e2e with mocks/fixtures.
 *
 * To update these fixtures, if needed you will have to go through a few steps.
 *
 * 1. Skip all the individual tests here
 * 2. Delete the e2e fixtures in __fixtures__
 * 3. Create a new PR triggering the missing codeowners error (ie. delete the file)
 *    - Cancel the org-wide workflow run that will be triggered OR
 *    - Remove the existing comment from the org-wide workflow after it appears
 *      (otherwise the github requests will wrongly return comments with the fingerprint)
 * 4. Unskip the first test, and run the first test, recording new fixtures
 *    - Note: this will add a comment to the PR
 * 5. Update PR from 3, but breaking the codeowners file (ie. invalid team)
 *    - Cancel the org-wide workflow run that will be triggered OR
 *    - The org-wide-workflow should fail to edit your commment. However, if it does edit your comment,
 *      then ideally you will revert it back to the previous contents.
 * 6. Unskip the second test, and run the second test, recording new fixtures
 * 7. Repeat for last test, but with a valid codeowners file.
 */
import {
  getNock,
  getTestOctokit,
  coreLoggingStubs,
} from "./__helpers__/test-utils.js";
import { vi, beforeEach, describe, it, expect } from "vitest";

import type * as GithubImport from "@actions/github";
import type * as CoreImport from "@actions/core";

const nockBack = getNock();

let coreMocks: ReturnType<typeof coreLoggingStubs> = coreLoggingStubs({});

vi.mock("@actions/core", async () => {
  const getBooleanInput: typeof CoreImport.getBooleanInput = vi.fn(
    (key: string) => {
      if (key === "enforce") return true;

      throw new Error(`Mock failure - unknown boolean input: ${key}`);
    },
  );

  const mock = await (
    await import("./__helpers__/test-utils.js")
  ).coreLoggingStubs({ getBooleanInput });

  coreMocks = mock;

  return mock;
});

describe("run()", () => {
  beforeEach(() => {
    if (nockBack.currentMode === "lockdown") {
      process.env.GITHUB_TOKEN = "fake-token";
    }

    // Clear all mocks before each test
    vi.clearAllMocks();
    vi.resetModules();
    // Clear the spy before each test
    coreMocks.setFailed.mockClear();
  });

  it(
    "should run against new PR (missing codeowners)",
    { sequential: true },
    async () => {
      const { nockDone } = await nockBack("e2e-missing-codeowners.json");
      const mocktokit = getTestOctokit(nockBack.currentMode);

      vi.doMock("@actions/github", async () => {
        const actual =
          await vi.importActual<typeof GithubImport>("@actions/github");

        return {
          ...actual,
          context: getContext("548a4f558af394da35fd6c856a786e657a311897"),
          getOctokit: () => {
            return mocktokit;
          },
        };
      });

      const { run } = await import("../run");

      await run();

      // Verify that setFailed was called for missing CODEOWNERS
      expect(coreMocks.setFailed).toHaveBeenCalledWith(
        "No CODEOWNERS file found.",
      );

      nockDone();
    },
  );

  it(
    "should run against new PR (invalid codeowners)",
    { sequential: true },
    async () => {
      const { nockDone } = await nockBack("e2e-invalid-codeowners.json");
      const mocktokit = getTestOctokit(nockBack.currentMode);

      vi.doMock("@actions/github", async () => {
        const actual =
          await vi.importActual<typeof GithubImport>("@actions/github");

        return {
          ...actual,
          context: getContext("ebccba522f2e60b23a5eb5ee64e2aa19376cb1e0"),
          getOctokit: () => {
            return mocktokit;
          },
        };
      });

      const { run } = await import("../run");

      await run();

      // Verify that setFailed was called for invalid CODEOWNERS
      expect(coreMocks.setFailed).toHaveBeenCalledWith(
        "CODEOWNERS file contains errors.",
      );

      nockDone();
    },
  );

  it(
    "should run against existing PR (fixed/added codeowners)",
    { sequential: true },
    async () => {
      const { nockDone } = await nockBack("e2e-fixed-or-added-codeowners.json");
      const mocktokit = getTestOctokit(nockBack.currentMode);

      vi.doMock("@actions/github", async () => {
        const actual =
          await vi.importActual<typeof GithubImport>("@actions/github");

        return {
          ...actual,
          context: getContext("9e593eee5e8badfd2d2158b6fcb703b0d11d58aa"),
          getOctokit: () => {
            return mocktokit;
          },
        };
      });

      const { run } = await import("../run");

      await run();

      // Verify that error and setFailed was NOT called
      expect(coreMocks.error).not.toHaveBeenCalled();
      expect(coreMocks.setFailed).not.toHaveBeenCalled();

      nockDone();
    },
  );
});

function getContext(sha: string) {
  return {
    repo: { owner: "smartcontractkit", repo: "releng-test" },
    actor: "erikburt",
    eventName: "pull_request",
    payload: {
      // https://github.com/smartcontractkit/releng-test/pull/136
      pull_request: {
        number: 136,
        base: {
          ref: "main",
          sha: "abc123",
        },
        head: {
          ref: "test/remove-codeowners",
          sha,
        },
      },
    },
  };
}
