import { validateDependency } from "../src/github";
import { getOctokit } from "@actions/github";
import fetch from "node-fetch";
import * as fs from "fs";
import { describe, expect, it } from "vitest";
const nock = require("nock");

describe("verify pseudo dependency version is on the default branch", () => {
  const owner = "smartcontractkit";
  const repo = "go-plugin";
  const dependencyPath = `github.com/${owner}/${repo}`;

  const commitSha = "b3b91517de16";
  const dependencyVersion = `v0.0.0-20240208201424-${commitSha}`;

  const octokitClient = getOctokit("fake-token", {
    request: { fetch },
  });

  it("should check if the commit is present on the default branch", async () => {
    const mockGetRepoResponse = JSON.parse(
      fs.readFileSync(`${__dirname}/data/get_repo.json`, "utf8"),
    );
    const mockCompareCommitsResponse = JSON.parse(
      fs.readFileSync(`${__dirname}/data/compare_commits.json`, "utf8"),
    );

    nock(`https://api.github.com/repos`)
      .get(`/${owner}/${repo}`)
      .reply(200, mockGetRepoResponse);

    nock(`https://api.github.com/repos`)
      .get(
        `/${owner}/${repo}/compare/${mockGetRepoResponse.default_branch}...${commitSha}`,
      )
      .reply(200, mockCompareCommitsResponse);

    const repoObject = await validateDependency(
      dependencyPath,
      dependencyVersion,
      octokitClient,
    );

    expect(repoObject).toEqual(true);
  });

  it("should throw an error if the compare commits request fails", async () => {
    const errMessage = "not found";
    const mockGetRepoResponse = JSON.parse(
      fs.readFileSync(`${__dirname}/data/get_repo.json`, "utf8"),
    );

    nock(`https://api.github.com/repos`)
      .get(`/${owner}/${repo}`)
      .reply(404, errMessage);

    nock(`https://api.github.com/repos`)
      .get(
        `/${owner}/${repo}/compare/${mockGetRepoResponse.default_branch}...${commitSha}`,
      )
      .reply(404, errMessage);

    const result = validateDependency(
      dependencyPath,
      dependencyVersion,
      octokitClient,
    );
    await expect(result).rejects.toThrow(errMessage);
  });
});

describe("verify dependency version is on the default branch", () => {
  const owner = "smartcontractkit";
  const repo = "go-plugin";
  const dependencyPath = `github.com/${owner}/${repo}`;
  const defaultBranch = "main";

  // const commitSha = "b3b91517de16";
  const dependencyVersion = "v0.1.0";
  const commitStatus = "behind";

  const octokitClient = getOctokit("fake-token", {
    request: { fetch },
  });

  it("should check if the commit is present on the default branch", async () => {
    const mockGetRepoResponse = JSON.parse(
      fs.readFileSync(`${__dirname}/data/get_repo.json`, "utf8"),
    );
    const mockListTagsResponse = JSON.parse(
      fs.readFileSync(`${__dirname}/data/list_tags.json`, "utf8"),
    );
    const mockCompareCommitsResponse = JSON.parse(
      fs.readFileSync(`${__dirname}/data/compare_commits.json`, "utf8"),
    );

    nock(`https://api.github.com/repos`)
      .get(`/${owner}/${repo}`)
      .reply(200, mockGetRepoResponse);

    nock(`https://api.github.com/repos`)
      .get(`/${owner}/${repo}/tags`)
      .reply(200, mockListTagsResponse);

    // find mock commit sha
    const commitSha = mockListTagsResponse.reduce((acc, obj) => {
      if (acc) return acc; // If a match is already found, return it
      return obj["name"] === dependencyVersion ? obj.commit.sha : null;
    }, null);

    nock(`https://api.github.com/repos`)
      .get(
        `/${owner}/${repo}/compare/${mockGetRepoResponse.default_branch}...${commitSha}`,
      )
      .reply(200, mockCompareCommitsResponse);

    const repoObject = await validateDependency(
      dependencyPath,
      dependencyVersion,
      octokitClient,
    );

    expect(repoObject).toEqual(true);
  });

  it("should throw an error if the compare commits request fails", async () => {
    const errMessage = "not found";
    const mockGetRepoResponse = JSON.parse(
      fs.readFileSync(`${__dirname}/data/get_repo.json`, "utf8"),
    );

    nock(`https://api.github.com/repos`)
      .get(`/${owner}/${repo}`)
      .reply(200, mockGetRepoResponse);

    nock(`https://api.github.com/repos`)
      .get(`/${owner}/${repo}/tags`)
      .reply(404, errMessage);

    const result = validateDependency(
      dependencyPath,
      dependencyVersion,
      octokitClient,
    );
    await expect(result).rejects.toThrow(errMessage);
  });
});
