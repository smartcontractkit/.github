/**
 * This runs through the whole action e2e with mocks/fixtures.
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

// Will be set by mockCore in each test
let coreMocks: ReturnType<typeof coreLoggingStubs>;

/**
 * Helper to mock @actions/core per test
 */
function mockCore({
  inputs = {},
  booleans = {},
}: {
  inputs?: Record<string, string>;
  booleans?: Record<string, boolean>;
} = {}) {
  vi.doMock("@actions/core", async () => {
    const getInput: typeof CoreImport.getInput = vi.fn((key: string) => {
      if (key in inputs) return inputs[key]!;
      throw new Error(`Mock failure - unknown string input: ${key}`);
    });

    const getBooleanInput: typeof CoreImport.getBooleanInput = vi.fn(
      (key: string) => {
        if (key in booleans) return booleans[key]!;
        throw new Error(`Mock failure - unknown boolean input: ${key}`);
      },
    );

    const mock = await (
      await import("./__helpers__/test-utils.js")
    ).coreLoggingStubs({ getBooleanInput, getInput });

    coreMocks = mock;

    return mock;
  });
}

describe("run()", () => {
  beforeEach(() => {
    if (nockBack.currentMode === "lockdown") {
      process.env.GITHUB_TOKEN = "fake-token";
    }

    // Fresh module graph + mocks per test
    vi.resetModules();
    vi.clearAllMocks();

    // Clear the spy if we've already created coreMocks in a previous test
    if (coreMocks?.setFailed) {
      coreMocks.setFailed.mockClear();
    }
  });

  it(
    "should pass against against a successful matrix job run (all assertions true)",
    { sequential: true },
    async () => {
      mockCore({
        inputs: {
          // https://github.com/smartcontractkit/chainlink/actions/runs/20164299007
          "workflow-run-id": "20164299007",
          "job-name-prefix": "Core Tests",
        },
        booleans: {
          "assert-jobs-exist": true,
          "assert-successful": true,
          "assert-no-failures": true,
        },
      });

      const { nockDone } = await nockBack("e2e-successful-matrix.json");
      const mocktokit = getTestOctokit(nockBack.currentMode);

      vi.doMock("@actions/github", async () => {
        const actual =
          await vi.importActual<typeof GithubImport>("@actions/github");

        return {
          ...actual,
          context: getContext(),
          getOctokit: () => {
            return mocktokit;
          },
        };
      });

      // Import after mocks are set up
      const { run } = await import("../run");

      const promise = run();
      await expect(promise).resolves.not.toThrow();

      // Verify that setFailed was called for missing CODEOWNERS
      // expect(coreMocks.setFailed).toHaveBeenCalledWith(
      //   "No CODEOWNERS file found.",
      // );

      nockDone();
    },
  );

  it(
    "should pass against against a skipped matrix job run (assert-successful=false)",
    { sequential: true },
    async () => {
      mockCore({
        inputs: {
          // https://github.com/smartcontractkit/chainlink/actions/runs/20164299007
          "workflow-run-id": "20164299007",
          "job-name-prefix": "GolangCI Lint",
        },
        booleans: {
          "assert-jobs-exist": true,
          "assert-successful": false,
          "assert-no-failures": true,
        },
      });

      const { nockDone } = await nockBack("e2e-skipped-matrix.json");
      const mocktokit = getTestOctokit(nockBack.currentMode);

      vi.doMock("@actions/github", async () => {
        const actual =
          await vi.importActual<typeof GithubImport>("@actions/github");

        return {
          ...actual,
          context: getContext(),
          getOctokit: () => {
            return mocktokit;
          },
        };
      });

      // Import after mocks are set up
      const { run } = await import("../run");

      const promise = run();
      await expect(promise).resolves.not.toThrow();

      // Verify that setFailed was called for missing CODEOWNERS
      // expect(coreMocks.setFailed).toHaveBeenCalledWith(
      //   "No CODEOWNERS file found.",
      // );

      nockDone();
    },
  );

  it(
    "should fail against a skipped matrix job run (assert-successful=true)",
    { sequential: true },
    async () => {
      mockCore({
        inputs: {
          // https://github.com/smartcontractkit/chainlink/actions/runs/20164299007
          "workflow-run-id": "20164299007",
          "job-name-prefix": "GolangCI Lint",
        },
        booleans: {
          "assert-jobs-exist": true,
          "assert-successful": true,
          "assert-no-failures": true,
        },
      });

      const { nockDone } = await nockBack("e2e-skipped-matrix.json");
      const mocktokit = getTestOctokit(nockBack.currentMode);

      vi.doMock("@actions/github", async () => {
        const actual =
          await vi.importActual<typeof GithubImport>("@actions/github");

        return {
          ...actual,
          context: getContext(),
          getOctokit: () => {
            return mocktokit;
          },
        };
      });

      // Import after mocks are set up
      const { run } = await import("../run");

      const promise = run();
      await expect(promise).resolves.not.toThrow();

      expect(coreMocks.setFailed).toHaveBeenCalledWith(
        "Action failed: Error: The following jobs are not successful: GolangCI Lint",
      );

      nockDone();
    },
  );

  it(
    "should fail against a failed matrix job run (assert-no-failures=true)",
    { sequential: true },
    async () => {
      mockCore({
        inputs: {
          // https://github.com/smartcontractkit/chainlink/actions/runs/20178008851
          "workflow-run-id": "20178008851",
          "job-name-prefix": "Core Tests",
        },
        booleans: {
          "assert-jobs-exist": true,
          "assert-successful": false,
          "assert-no-failures": true,
        },
      });

      const { nockDone } = await nockBack("e2e-failed-matrix.json");
      const mocktokit = getTestOctokit(nockBack.currentMode);

      vi.doMock("@actions/github", async () => {
        const actual =
          await vi.importActual<typeof GithubImport>("@actions/github");

        return {
          ...actual,
          context: getContext(),
          getOctokit: () => {
            return mocktokit;
          },
        };
      });

      // Import after mocks are set up
      const { run } = await import("../run");

      const promise = run();
      await expect(promise).resolves.not.toThrow();

      expect(coreMocks.setFailed).toHaveBeenCalledWith(
        "Action failed: Error: The following jobs have failed: Core Tests (go_core_tests)",
      );

      nockDone();
    },
  );
});

function getContext() {
  return {
    repo: { owner: "smartcontractkit", repo: "chainlink" },
    actor: "erikburt",
    eventName: "pull_request",
    payload: {
      pull_request: {
        number: 136,
        base: {
          ref: "main",
          sha: "abc123",
        },
        head: {
          ref: "test/remove-codeowners",
          sha: "does-not-matter-for-tests",
        },
      },
    },
  };
}
