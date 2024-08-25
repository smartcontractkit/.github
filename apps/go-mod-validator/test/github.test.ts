import { isGoModReferencingDefaultBranch } from "../src/github";
import { describe, expect, it, vi } from "vitest";
import listTagsFixture from "./data/list_tags.json";
import { getVersionType, GoModule } from "../src/deps";

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

// Mock data for tests
// https://cs.opensource.google/go/x/mod/+/refs/tags/v0.20.0:module/pseudo_test.go
// https://cs.opensource.google/go/x/mod/+/refs/tags/v0.20.0:module/pseudo.go;l=164
const pseudoTests = [
  { major: "", older: "", version: "v0.0.0-20060102150405-hash" },
  { major: "v0", older: "", version: "v0.0.0-20060102150405-hash" },
  { major: "v1", older: "", version: "v1.0.0-20060102150405-hash" },
  { major: "v2", older: "", version: "v2.0.0-20060102150405-hash" },
  { major: "unused", older: "v0.0.0", version: "v0.0.1-0.20060102150405-hash" },
  { major: "unused", older: "v1.2.3", version: "v1.2.4-0.20060102150405-hash" },
  {
    major: "unused",
    older: "v1.2.99999999999999999",
    version: "v1.2.100000000000000000-0.20060102150405-hash",
  },
  {
    major: "unused",
    older: "v1.2.3-pre",
    version: "v1.2.3-pre.0.20060102150405-hash",
  },
  {
    major: "unused",
    older: "v1.3.0-pre",
    version: "v1.3.0-pre.0.20060102150405-hash",
  },
  {
    major: "unused",
    older: "v0.0.0--",
    version: "v0.0.0--.0.20060102150405-hash",
  },
  {
    major: "unused",
    older: "v1.0.0+metadata",
    version: "v1.0.1-0.20060102150405-hash+metadata",
  },
  {
    major: "unused",
    older: "v2.0.0+incompatible",
    version: "v2.0.1-0.20060102150405-hash+incompatible",
  },
  {
    major: "unused",
    older: "v2.3.0-pre+incompatible",
    version: "v2.3.0-pre.0.20060102150405-hash+incompatible",
  },
  {
    major: "unused",
    older: "unused",
    version: "v0.0.5-0.20220116011046-fa5810519dcb",
  },
];

describe.only("getVersionType", () => {
  for (const { version } of pseudoTests) {
    it("should return the correct version type", () => {
      const verType = getVersionType(version);
      expect(verType).toMatchSnapshot();
    });
  }

  it("should parse out the git sha correctly", () => {
    let version = "v0.2.2-0.20240808143317-6b16fc28887d";
    let verType = getVersionType(version);
    expect(verType).toEqual({ commitSha: "6b16fc28887d", tag: undefined });

    version = "v0.0.1-beta-test.0.20240709043547-03612098f799";
    verType = getVersionType(version);
    expect(verType).toEqual({ commitSha: "03612098f799", tag: undefined });
  });
});

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
        isGoModReferencingDefaultBranch(goMod, "main", mockOctokit);
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

      const result = isGoModReferencingDefaultBranch(goMod, "", mockOctokit);
      await expect(result).rejects.toThrow(errMessage);
    });
  });
});
