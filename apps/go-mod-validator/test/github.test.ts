import { isGoModReferencingDefaultBranch } from "../src/github";
import { describe, expect, it, vi } from "vitest";
import listTagsFixture from "./data/list_tags.json";
import { GoModule } from "../src/deps";

const owner = "smartcontractkit";
const repo = "go-plugin";
const goModPath = `github.com/${owner}/${repo}`;
const mockGet = vi.fn();
const mockCompareCommits = vi.fn();
const mockListTags = vi.fn();
const mockOctokit: any = {
  rest: {
    repos: {
      get: mockGet,
      compareCommits: mockCompareCommits,
      listTags: mockListTags,
    },
  },
};
describe("isGoModReferencingDefaultBranch", () => {
  describe("pseudo-versions", () => {
    const commitSha = "b3b91517de16";
    const version = `v0.0.0-20240208201424-${commitSha}`;
    const goMod: GoModule = { path: goModPath, version };

    it("should check if the commit is present on the default branch", async () => {
      mockGet.mockResolvedValueOnce({
        data: { default_branch: "main" },
      });
      mockCompareCommits.mockResolvedValueOnce({
        data: {
          status: "behind",
        },
      });

      const referencesDefault = await isGoModReferencingDefaultBranch(
        goMod,
        mockOctokit,
      );

      expect(mockListTags).to.not.toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalledWith({ owner, repo });
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
      mockGet.mockResolvedValue({
        data: { default_branch: "main" },
      });
      mockCompareCommits.mockRejectedValue(errMessage);

      const isReferencingDefaultBranch = () =>
        isGoModReferencingDefaultBranch(goMod, mockOctokit);
      expect(mockListTags).to.not.toHaveBeenCalled();
      await expect(isReferencingDefaultBranch).rejects.toThrowError(errMessage);
    });
  });

  describe("regular versions", () => {
    const version = "v0.1.0";
    const goMod: GoModule = {
      path: goModPath,
      version,
    };

    it("should check if the commit is present on the default branch", async () => {
      mockGet.mockResolvedValueOnce({
        data: { default_branch: "main" },
      });
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

      const repoObject = await isGoModReferencingDefaultBranch(
        goMod,
        mockOctokit,
      );
      expect(mockListTags).toHaveBeenCalledOnce();
      expect(mockCompareCommits).toHaveBeenCalledWith({
        owner,
        repo,
        base: "main",
        head: expectedCommitSha,
      });
      expect(repoObject).toEqual(true);
    });

    it("should throw an error if listing tags fails", async () => {
      const errMessage = "not found";
      mockListTags.mockRejectedValue(errMessage);

      const result = isGoModReferencingDefaultBranch(goMod, mockOctokit);
      await expect(result).rejects.toThrow(errMessage);
    });
  });
});
