import { isGoModReferencingDefaultBranch } from "../src/github";
import { describe, expect, it, vi } from "vitest";
import listTagsFixture from "./data/list_tags.json";
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
const mockCompareCommits = vi.fn();
const mockListTags = vi.fn();
const mockOctokit: any = {
  rest: {
    repos: {
      compareCommits: mockCompareCommits,
      listTags: mockListTags,
    },
  },
};

describe("isGoModReferencingDefaultBranch", () => {
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
      mockCompareCommits.mockResolvedValueOnce({
        data: {
          status: "behind",
        },
      });

      const referencesDefault = await isGoModReferencingDefaultBranch(
        goMod,
        "main",
        mockOctokit,
        {},
      );

      expect(mockListTags).to.not.toHaveBeenCalled();
      expect(mockCompareCommits).toHaveBeenCalledWith({
        owner,
        repo,
        base: "main",
        head: commitSha,
      });
      expect(referencesDefault).toBeTruthy();
    });

    it("should throw an error if the compare commits request fails", async () => {
      const errMessage = "not found";
      mockCompareCommits.mockRejectedValue(errMessage);

      const isReferencingDefaultBranch = () =>
        isGoModReferencingDefaultBranch(goMod, "main", mockOctokit, {});
      expect(mockListTags).to.not.toHaveBeenCalled();
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
      mockCompareCommits.mockResolvedValueOnce({
        data: {
          status: "behind",
        },
      });
      mockListTags.mockResolvedValueOnce({
        data: listTagsFixture,
      });

      const expectedCommitSha = listTagsFixture.find(
        (tag) => tag.name === version,
      )?.commit.sha;
      expect(expectedCommitSha).toBeDefined();

      const isValid = await isGoModReferencingDefaultBranch(
        goMod,
        "main",
        mockOctokit,
        {},
      );
      expect(mockListTags).toHaveBeenCalledOnce();
      expect(mockCompareCommits).toHaveBeenCalledWith({
        owner,
        repo,
        base: "main",
        head: expectedCommitSha,
      });
      expect(isValid).toEqual(true);
    });

    it("should throw an error if listing tags fails", async () => {
      const errMessage = "not found";
      mockListTags.mockRejectedValue(errMessage);

      const result = isGoModReferencingDefaultBranch(
        goMod,
        "",
        mockOctokit,
        {},
      );
      await expect(result).rejects.toThrow(errMessage);
    });
  });
});
