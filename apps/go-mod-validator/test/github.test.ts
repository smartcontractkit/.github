import { validateDependency } from "../src/github";
import { Octokit } from "octokit";

describe("verify pseudo dependency version is on the default branch", () => {
  const owner = "smartcontractkit";
  const repo = "go-plugin";
  const dependencyPath = `${owner}/${repo}`;
  const defaultBranch = "main";

  const commitSha = "b3b91517de16";
  const dependencyVersion = "v0.0.0-20240208201424-b01055353c1f";
  const commitStatus = "behind";

  let octokitClient: Octokit;

  beforeEach(() => {
    octokitClient = new Octokit();
  });

  it("Success: should check if the commit is present on the default branch", async () => {
    const mockResponseRepo = {
      data: { default_branch: defaultBranch },
      status: 200,
      headers: {},
      url: "",
    };
    const mockResponseCommit = {
      data: { status: commitStatus },
      status: 200,
      headers: {},
      url: "",
    };
    jest
      .spyOn(octokitClient, "request")
      .mockResolvedValueOnce(mockResponseRepo)
      .mockResolvedValueOnce(mockResponseCommit);

    const repoObject = await validateDependency(
      dependencyPath,
      dependencyVersion,
      octokitClient,
    );

    expect(repoObject).toEqual(true);
  });

  it("Fail: should throw an error if the compare commits request fails", async () => {
    const mockResponseRepo = {
      data: { default_branch: defaultBranch },
      status: 200,
      headers: {},
      url: "",
    };
    jest
      .spyOn(octokitClient, "request")
      .mockResolvedValueOnce(mockResponseRepo)
      .mockRejectedValueOnce(new Error("Request failed"));

    const result = validateDependency(
      dependencyPath,
      dependencyVersion,
      octokitClient,
    );
    await expect(result).rejects.toThrow("Request failed");
  });
});

describe("verify dependency version is on the default branch", () => {
  const owner = "smartcontractkit";
  const repo = "go-plugin";
  const dependencyPath = `${owner}/${repo}`;
  const defaultBranch = "main";

  const commitSha = "b3b91517de16";
  const dependencyVersion = "v0.1.0";
  const commitStatus = "behind";

  let octokitClient: Octokit;

  beforeEach(() => {
    octokitClient = new Octokit();
  });

  it("Success: should check if the commit is present on the default branch", async () => {
    const mockResponseRepo = {
      data: { default_branch: defaultBranch },
      status: 200,
      headers: {},
      url: "",
    };
    const mockResponseTags = {
      data: [{ name: dependencyVersion, commit: { sha: commitSha } }],
      status: 200,
      headers: {},
      url: "",
    };
    const mockResponseCommit = {
      data: { status: commitStatus },
      status: 200,
      headers: {},
      url: "",
    };
    jest
      .spyOn(octokitClient, "request")
      .mockResolvedValueOnce(mockResponseRepo)
      .mockResolvedValueOnce(mockResponseTags)
      .mockResolvedValueOnce(mockResponseCommit);

    const repoObject = await validateDependency(
      dependencyPath,
      dependencyVersion,
      octokitClient,
    );

    expect(repoObject).toEqual(true);
  });

  it("Fail: should throw an error if the get tags request fails", async () => {
    const mockResponseRepo = {
      data: { default_branch: defaultBranch },
      status: 200,
      headers: {},
      url: "",
    };
    jest
      .spyOn(octokitClient, "request")
      .mockResolvedValueOnce(mockResponseRepo)
      .mockRejectedValueOnce(new Error("Request failed"));

    const result = validateDependency(
      dependencyPath,
      dependencyVersion,
      octokitClient,
    );
    await expect(result).rejects.toThrow("Request failed");
  });
});
