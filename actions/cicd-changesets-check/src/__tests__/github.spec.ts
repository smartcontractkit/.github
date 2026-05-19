import { describe, it, expect, vi } from "vitest";
import { getPackageName } from "../github";

function createMockOctokit(content: string | null, throws = false) {
  return {
    rest: {
      repos: {
        getContent: throws
          ? vi.fn().mockRejectedValue(new Error("Not Found"))
          : vi.fn().mockResolvedValue({
              data:
                content !== null
                  ? { content: Buffer.from(content).toString("base64") }
                  : { content: undefined },
            }),
      },
    },
  } as any;
}

describe("getPackageName", () => {
  it("returns the package name from package.json", async () => {
    const octokit = createMockOctokit(JSON.stringify({ name: "my-package" }));
    const result = await getPackageName(octokit, {
      owner: "org",
      repo: "repo",
      ref: "main",
    });
    expect(result).toBe("my-package");
  });

  it("returns null when package.json has no name field", async () => {
    const octokit = createMockOctokit(JSON.stringify({ version: "1.0.0" }));
    const result = await getPackageName(octokit, {
      owner: "org",
      repo: "repo",
      ref: "main",
    });
    expect(result).toBeNull();
  });

  it("returns null when package.json does not exist", async () => {
    const octokit = createMockOctokit(null, true);
    const result = await getPackageName(octokit, {
      owner: "org",
      repo: "repo",
      ref: "main",
    });
    expect(result).toBeNull();
  });

  it("returns null when content field is missing from response", async () => {
    const octokit = createMockOctokit(null);
    const result = await getPackageName(octokit, {
      owner: "org",
      repo: "repo",
      ref: "main",
    });
    expect(result).toBeNull();
  });

  it("passes the correct ref to the API", async () => {
    const octokit = createMockOctokit(JSON.stringify({ name: "test" }));
    await getPackageName(octokit, {
      owner: "myorg",
      repo: "myrepo",
      ref: "feature-branch",
    });
    expect(octokit.rest.repos.getContent).toHaveBeenCalledWith({
      owner: "myorg",
      repo: "myrepo",
      path: "package.json",
      ref: "feature-branch",
    });
  });
});
