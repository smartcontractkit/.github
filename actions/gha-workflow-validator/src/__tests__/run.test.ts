import * as github from "@actions/github";
import {
  getParsedFilesForValidation,
  getInvokeContext,
  InvokeContext,
  RunInputs,
} from "../run";
import { vi, describe, it, expect } from "vitest";
import { getNock, getTestOctokit } from "./__helpers__/test-utils.js";
import { join } from "path";

const nockBack = getNock();

vi.mock("@actions/core", async () => {
  return (await import("./__helpers__/test-utils.js")).coreLoggingStubs();
});

const defaultContext: InvokeContext = {
  token: "token",
  owner: "owner",
  repo: "repo",
  base: "before",
  head: "after",
  prNumber: 1,
};

const defaultInputs: RunInputs = {
  evaluateMode: false,
  validateRunners: false,
  validateActionRefs: false,
  validateActionNodeVersion: false,
  validateAllActionDefinitions: false,
  rootDir: __dirname,
};

describe(getParsedFilesForValidation.name, () => {
  it("should fail if pr, but base/head not available", async () => {
    const context: InvokeContext = {
      token: "token",
      owner: "owner",
      repo: "repo",
      base: undefined,
      head: undefined,
      prNumber: 1,
    };
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      return undefined as never;
    });

    getParsedFilesForValidation(context, {} as any, {} as any);
    expect(mockExit).toHaveBeenCalledWith(1);
  });

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
      defaultInputs,
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

    const inputs = { ...defaultInputs, validateAllActionDefinitions: true };

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

describe(getInvokeContext.name, () => {
  it("should exit without github token", async () => {
    delete process.env.GITHUB_TOKEN;
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      return undefined as never;
    });
    getInvokeContext();
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should return context (event: pull_request)", async () => {
    process.env.GITHUB_TOKEN = "token";
    const mockedContext = {
      repo: { owner: "owner", repo: "repo" },
      eventName: "pull_request",
      payload: {
        pull_request: {
          base: { sha: "before" },
          head: { sha: "after" },
          number: 1,
        },
      },
    };
    Object.defineProperty(github, "context", { value: mockedContext });

    const result = getInvokeContext();
    expect(result).toEqual({
      token: "token",
      owner: "owner",
      repo: "repo",
      base: "before",
      head: "after",
      prNumber: 1,
    });
  });

  it("should not return context (event: push_event)", async () => {
    process.env.GITHUB_TOKEN = "token";
    const mockedContext = {
      repo: { owner: "owner", repo: "repo" },
      eventName: "push",
      payload: { before: "before", after: "after" },
    };
    Object.defineProperty(github, "context", { value: mockedContext });

    const result = getInvokeContext();
    expect(result).toEqual({
      token: "token",
      owner: "owner",
      repo: "repo",
    });
  });
});
