import * as github from "@actions/github";
import { getInvokeContext } from "../run";
import { vi, describe, it, expect } from "vitest";

vi.mock("@actions/core", async () => {
  return (await import("./__helpers__/test-utils.js")).coreLoggingStubs();
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
