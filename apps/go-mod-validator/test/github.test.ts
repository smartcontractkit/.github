/* eslint @typescript-eslint/no-explicit-any: 0 */
import { isGoModReferencingBranch, Octokit } from "../src/github";
import { describe, expect, it, vi } from "vitest";
import { GoModule } from "../src/deps";

vi.mock("@actions/core", async (importOriginal: any) => ({
  ...(await importOriginal(typeof import("@actions/core"))),
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
  debug: () => {
    // noop
  },
}));

const owner = "smartcontractkit";
const repo = "go-plugin";
const goModPath = `github.com/${owner}/${repo}`;

const mockOctokit = vi.mocked<{
  rest: Pick<Octokit["rest"], "repos" | "git">;
}>(
  {
    rest: {
      repos: {
        compareCommits: vi.fn() as any,
      } satisfies Partial<Octokit["rest"]["repos"]> as any,
      git: {
        getRef: vi.fn() as any,

        getTag: vi.fn() as any,
      } satisfies Partial<Octokit["rest"]["git"]> as any,
    },
  },
  {
    partial: true,
    deep: true,
  },
) as any; // NOTE: All the fancy typing above is just to make it easier
// to fill out the mock fields when you need to. Comment out this "as any"
// and you'll get autocomplete support when defining return values.

describe("isGoModReferencingBranch", () => {
  const fullRepo = {
    owner,
    repo,
  };

  describe("pseudo-versions", () => {
    const commitSha = "b3b91517de16";
    const version = `v0.0.0-20240208201424-${commitSha}`;
    const goMod: GoModule = {
      ...fullRepo,
      path: goModPath,
      version,
      commitSha,
      name: `${goModPath}@${version}`,
      goModFilePath: ".",
    };

    it("should check if the commit is present on the default branch", async () => {
      mockOctokit.rest.repos.compareCommits.mockResolvedValueOnce({
        data: {
          status: "behind",
        },
      });

      const result = await isGoModReferencingBranch(
        mockOctokit,
        goMod,
        "main",
        {},
      );

      expect(mockOctokit.rest.git.getRef).not.toHaveBeenCalled();
      expect(mockOctokit.rest.git.getTag).not.toHaveBeenCalled();
      expect(result).toEqual({ isInBranch: true, commitSha });
    });

    it("should throw an error if the compare commits request fails", async () => {
      const errMessage = "not found";
      mockOctokit.rest.repos.compareCommits.mockRejectedValue(errMessage);

      const isReferencingDefaultBranch = () =>
        isGoModReferencingBranch(mockOctokit, goMod, "main", {});

      expect(mockOctokit.rest.git.getRef).not.toHaveBeenCalled();
      expect(mockOctokit.rest.git.getTag).not.toHaveBeenCalled();
      await expect(isReferencingDefaultBranch).rejects.toThrowError(errMessage);
    });
  });

  describe("regular versions", () => {
    const version = "v0.1.0";
    const goMod: GoModule = {
      ...fullRepo,
      path: goModPath,
      version,
      tag: version,
      name: `${goModPath}@${version}`,
      goModFilePath: ".",
    };

    it("should check if the commit is present on the default branch", async () => {
      const tagSha = "f1be6620749f";
      const commitSha = "e5f4a3b";
      mockOctokit.rest.repos.compareCommits.mockResolvedValueOnce({
        data: {
          status: "behind",
        },
      });

      mockOctokit.rest.git.getRef.mockResolvedValueOnce({
        data: {
          object: {
            sha: tagSha,
            type: "tag",
            url: "",
          },
        },
      });

      mockOctokit.rest.git.getTag.mockResolvedValueOnce({
        data: {
          object: {
            type: "commit",
            sha: commitSha,
            url: "",
          },
        },
      });

      const result = await isGoModReferencingBranch(
        mockOctokit,
        goMod,
        "main",
        {},
      );

      expect(result).toEqual({
        isInBranch: true,
        commitSha,
      });
    });

    it("should return an unknown resolution if an api call fails", async () => {
      const errMsg = "not found";
      mockOctokit.rest.git.getRef.mockRejectedValue(errMsg);

      const result = isGoModReferencingBranch(mockOctokit, goMod, "main", {});
      expect(result).resolves.toEqual({
        isInBranch: "unknown",
        commitSha: "",
        reason: errMsg,
      });
    });
  });
});
