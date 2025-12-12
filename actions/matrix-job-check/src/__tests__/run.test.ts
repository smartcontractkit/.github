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
function mockCore(inputs: Record<string, string | boolean>) {
  vi.doMock("@actions/core", async () => {
    const { booleans, strings } = splitInputs(inputs);

    const getInput: typeof CoreImport.getInput = vi.fn((key: string) => {
      if (key in strings) return strings[key]!;
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
        // https://github.com/smartcontractkit/chainlink/actions/runs/20164299007
        "workflow-run-id": "20164299007",
        "job-name-prefix": "Core Tests",
        "assert-jobs-exist": true,
        "assert-successful": true,
        "assert-no-failures": true,
        "assert-no-cancels": true,
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
      expect(coreMocks.setFailed).not.toHaveBeenCalled();

      nockDone();
    },
  );

  it(
    "should pass against against a skipped matrix job run (assert-successful=false)",
    { sequential: true },
    async () => {
      mockCore({
        // https://github.com/smartcontractkit/chainlink/actions/runs/20164299007
        "workflow-run-id": "20164299007",
        "job-name-prefix": "GolangCI Lint",
        "assert-jobs-exist": true,
        "assert-successful": false,
        "assert-no-failures": true,
        "assert-no-cancels": true,
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
      expect(coreMocks.setFailed).not.toHaveBeenCalled();

      nockDone();
    },
  );

  it(
    "should fail against a skipped matrix job run (assert-successful=true)",
    { sequential: true },
    async () => {
      mockCore({
        // https://github.com/smartcontractkit/chainlink/actions/runs/20164299007
        "workflow-run-id": "20164299007",
        "job-name-prefix": "GolangCI Lint",
        "assert-jobs-exist": true,
        "assert-successful": true,
        "assert-no-failures": true,
        "assert-no-cancels": true,
      });

      const { nockDone } = await nockBack("e2e-skipped-matrix-2.json");
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
        "Action failed: Error: The following jobs are not successful: GolangCI Lint (skipped)",
      );

      nockDone();
    },
  );

  it(
    "should fail against a failed matrix job run (assert-no-failures=true)",
    { sequential: true },
    async () => {
      mockCore({
        // https://github.com/smartcontractkit/chainlink/actions/runs/20178008851
        "workflow-run-id": "20178008851",
        "job-name-prefix": "Core Tests",
        "assert-jobs-exist": true,
        "assert-successful": false,
        "assert-no-failures": true,
        "assert-no-cancels": true,
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

  it(
    "should fail against a matrix with a cancelled job run (assert-no-cancels=true)",
    { sequential: true },
    async () => {
      mockCore({
        // https://github.com/smartcontractkit/chainlink/actions/runs/20169575977
        "workflow-run-id": "20169575977",
        "job-name-prefix": "Core Tests",
        "assert-jobs-exist": true,
        "assert-successful": false,
        "assert-no-failures": true,
        "assert-no-cancels": true,
      });

      const { nockDone } = await nockBack("e2e-cancelled-matrix.json");
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
        "Action failed: Error: The following jobs were cancelled: Core Tests (go_core_tests)",
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

function splitInputs(inputs: Record<string, string | boolean>) {
  return Object.entries(inputs).reduce(
    (acc, [key, value]) => {
      if (typeof value === "boolean") {
        acc.booleans[key] = value;
      } else {
        acc.strings[key] = value;
      }
      return acc;
    },
    {
      booleans: {} as Record<string, boolean>,
      strings: {} as Record<string, string>,
    },
  );
}
