import { describe, expect, vi, test } from "vitest";
import { join } from "node:path";
import * as utils from "./utils.mjs";

describe(utils.getActionYamlPath.name, () => {
  const actionsDir = join(__dirname, "__tests__", "actions");

  test("gets one file when there's both yml, and yaml files", async () => {
    const directory = join(actionsDir, "both-yml-yaml");
    const result = await utils.getActionYamlPath(directory);
    expect(result).toBeDefined();
  });

  test("gets action.yml when one exists", async () => {
    const directory = join(actionsDir, "single-yml");
    const result = await utils.getActionYamlPath(directory);
    expect(result).toEqual(join(directory, "action.yml"));
  });

  test("gets action.yaml when no .yml exists", async () => {
    const directory = join(actionsDir, "single-yaml");
    const result = await utils.getActionYamlPath(directory);
    expect(result).toEqual(join(directory, "action.yaml"));
  });

  test("gets no path when none exists", async () => {
    const result = await utils.getActionYamlPath(actionsDir);
    expect(result).toBeUndefined();
  });
});

describe(utils.listAllYamlFiles.name, () => {
  const actionsDir = join(__dirname, "__tests__", "actions");

  test("lists all yaml files (two)", async () => {
    const directory = join(actionsDir, "both-yml-yaml");
    const result = await utils.listAllYamlFiles(directory);
    expect(result.length).toEqual(2);
    expect(result).toContain(join(directory, "action.yml"));
    expect(result).toContain(join(directory, "action.yaml"));
  });

  test("lists all yaml files (single)", async () => {
    const directory = join(actionsDir, "single-yml");
    const result = await utils.listAllYamlFiles(directory);
    expect(result.length).toEqual(1);
    expect(result[0]).toEqual(join(directory, "action.yml"));
  });

  test("lists all yaml files (none)", async () => {
    const result = await utils.listAllYamlFiles(actionsDir);
    expect(result).toEqual([]);
  });
});

describe(utils.guessLatestVersion.name, () => {
  test("guesses the latest version", () => {
    const tags = ["v1.0.0", "v1.2.3"];
    const result = utils.guessLatestVersion(tags);
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prefix: "",
      tag: "v1.2.3",
      prerelease: false,
    });
  });

  test("guesses the latest version for monorepo action", () => {
    const tags = ["foo@1.0.0", "foo@1.0.1", "bar@1.0.0", "bar@1.0.1"];
    const result = utils.guessLatestVersion(tags, ".github", "actions/foo");
    expect(result).toEqual({
      major: 1,
      minor: 0,
      patch: 1,
      prefix: "foo",
      tag: "foo@1.0.1",
      prerelease: false,
    });
  });

  test("guesses the latest version w/ preleases", () => {
    const tags = ["v1.0.0", "v1.2.3", "v2-beta.1"];
    const result = utils.guessLatestVersion(tags);
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prefix: "",
      tag: "v1.2.3",
      prerelease: false,
    });
  });

  test("guesses the latest version w/ weird tags", () => {
    // https://github.com/aws-actions/amazon-ecr-login/releases/tag/untagged-83fe763342087b6dbcd0
    const tags = ["v1.0.0", "v1.2.3", "untagged-83fe763342087b6dbcd0"];
    const result = utils.guessLatestVersion(tags);
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prefix: "",
      tag: "v1.2.3",
      prerelease: false,
    });
  });
});

describe(utils.parseTagToVersion.name, () => {
  test("parses a tag to a version", () => {
    const tag = "v1.2.3";
    const result = utils.parseTagToVersion(tag);
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prefix: "",
      tag,
      prerelease: false,
    });
  });

  test("parses a bad tag to an error", () => {
    // https://github.com/mikefarah/yq/releases/tag/releaseTest-manpage8
    const tag = "releaseTest-manpage8";
    const result = utils.parseTagToVersion(tag);
    expect(result).toEqual({
      major: 0,
      minor: 0,
      patch: 0,
      prefix: "v",
      tag: "error",
      prerelease: true,
    });
  });

  test("parses a bad tag to an error 2", () => {
    // https://github.com/aws-actions/amazon-ecr-login/releases/tag/untagged-83fe763342087b6dbcd0
    const tag = "untagged-83fe763342087b6dbcd0";
    const result = utils.parseTagToVersion(tag);
    expect(result).toEqual({
      major: 0,
      minor: 0,
      patch: 0,
      prefix: "v",
      tag: "error",
      prerelease: true,
    });
  });

  test("parses a monorepo tag", () => {
    const tag = "action@1.2.3";
    const result = utils.parseTagToVersion(tag);
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prefix: "action",
      tag,
      prerelease: false,
    });
  });

  test("parses a beta tag", () => {
    const tag = "v1.2.3-beta.1";
    const result = utils.parseTagToVersion(tag);
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prefix: "",
      tag,
      prerelease: true,
    });
  });

  test("parses an alpha tag", () => {
    const tag = "v1.2.3-alpha.1";
    const result = utils.parseTagToVersion(tag);
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prefix: "",
      tag,
      prerelease: true,
    });
  });

  test("parses a short form tag - major only", () => {
    const tag = "v1";
    const result = utils.parseTagToVersion(tag);
    expect(result).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prefix: "",
      tag,
      prerelease: false,
    });
  });

  test("parses a short form tag - major minor", () => {
    const tag = "v1.2";
    const result = utils.parseTagToVersion(tag);
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 0,
      prefix: "",
      tag,
      prerelease: false,
    });
  });
});
