import { getInvokeContext } from "../run";
import { vi, describe, it, expect } from "vitest";

vi.mock("@actions/core", () => ({
  setFailed: (msg: string) => {
    console.log(`setFailed (stub): ${msg}`);
  },
  error: (msg: string) => {
    console.log(`error (stub): ${msg}`);
  },
  warning: (msg: string) => {
    console.log(`warn (stub): ${msg}`);
  },
  info: (msg: string) => {
    console.log(`info (stub): ${msg}`);
  },
  debug: (msg: string) => {
    console.log(`debug (stub): ${msg}`);
  },
}));

vi.mock("@actions/github", () => ({
  context: {
    repo: { owner: "owner", repo: "repo" },
    eventName: "push",
    payload: { before: "before", after: "after" },
  },
}));

describe(getInvokeContext.name, () => {
  it("should exit without github token", async () => {
    delete process.env.GITHUB_TOKEN;
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      return undefined as never;
    });
    getInvokeContext();
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should return context", async () => {
    process.env.GITHUB_TOKEN = "token";
    const result = getInvokeContext();

    expect(result).toEqual({
      token: "token",
      owner: "owner",
      repo: "repo",
      base: "before",
      head: "after",
    });
  });
});
