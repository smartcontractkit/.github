import { execSync } from "child_process";
import { execWithOutput } from "../../utils";
import {
  deleteTags,
  createLightweightTags,
  GitTag,
  pushTags,
  getRemoteTagNames,
  getLocalTags,
  replaceTagSeparator,
  getMajorVersionTags,
  parseTagName,
  rewriteRootPackageTags,
} from "./repo-tags";
import { createRepo, createCommit } from "./utils.testutils";

import { describe, it, expect } from "vitest";

describe("repo-tags", () => {
  describe("deleteTags", () => {
    it("should delete the given tags", async () => {
      const testTags = await createTestRepoWithRemote("repo-tags", true);

      await deleteTags(testTags.localOnlyTags, testTags.localRepoPath);

      const localTags = await getLocalTags(testTags.localRepoPath);
      const remoteTags = await getRemoteTagNames(testTags.localRepoPath);

      expect(remoteTags).toEqual(localTags.map((t) => t.name));
    });
  });

  describe("createLightweightTags", () => {
    function validateLightWeightTags(
      result: Awaited<ReturnType<typeof listTagTypes>>,
      tagNames: string[],
    ) {
      expect(result.length).toBe(tagNames.length);
      expect(result.map((t) => t.name)).toEqual(tagNames);
      expect(result.every((t) => t.type === "commit")).toBe(true);
    }

    it("should create the given tags (@)", async () => {
      const repo = await createRepo("repo-tags");
      const tagNames = ["foo@tag-1", "bar@tag-2"];
      const tags = tagNames.map((name) => ({ name, ref: "HEAD" }));

      await createLightweightTags(tags, repo);

      const result = await listTagTypes(tagNames, repo);
      validateLightWeightTags(result, tagNames);
    });

    it("should create the given tags (/)", async () => {
      const repo = await createRepo("repo-tags");
      const tagNames = ["foo/tag-1", "bar/tag-2"];
      const tags = tagNames.map((name) => ({ name, ref: "HEAD" }));

      await createLightweightTags(tags, repo);

      const result = await listTagTypes(tagNames, repo);
      validateLightWeightTags(result, tagNames);
    });

    it("should create the given tags (/v)", async () => {
      const repo = await createRepo("repo-tags");
      const tagNames = ["foo/vtag-1", "bar/vtag-2"];
      const tags = tagNames.map((name) => ({ name, ref: "HEAD" }));

      await createLightweightTags(tags, repo);

      const result = await listTagTypes(tagNames, repo);
      validateLightWeightTags(result, tagNames);
    });

    it("should force create major version tags (/)", async () => {
      const repo = await createRepo("repo-tags");
      const tagNames = ["foo/v1", "bar/v2"];

      // 1. Push original major version tags
      const mvTags = tagNames.map((name) => ({
        name,
        ref: "HEAD^", // Use previous commit
        majorVersion: true,
      }));
      await createLightweightTags(mvTags, repo);

      const firstResult = await listTagTypes(tagNames, repo);
      validateLightWeightTags(firstResult, tagNames);

      // Push new major version tags, should force rewrite existing tags
      const newMVTags = tagNames.map((name) => ({
        name,
        ref: "HEAD", // Use current commit
        majorVersion: true,
      }));
      await createLightweightTags(newMVTags, repo);

      const newResult = await listTagTypes(tagNames, repo);
      validateLightWeightTags(newResult, tagNames);
      expect(newResult.map((t) => t.ref)).not.toEqual(
        firstResult.map((t) => t.ref),
      );
    });
  });

  describe("replaceTagSeparator", () => {
    it("should return tags unchanged when separator is '@'", () => {
      const input = [
        { name: "foo@1.0.0", ref: "abc" },
        { name: "bar@2.0.0", ref: "def" },
      ];
      const result = replaceTagSeparator(input, "@");
      expect(result).toEqual(input);
    });

    it("should replace '@' with new separator and set originalName", () => {
      const input = [
        { name: "foo@1.0.0", ref: "abc" },
        { name: "bar@2.0.0", ref: "def" },
      ];
      const result = replaceTagSeparator(input, "/");
      expect(result).toEqual([
        { name: "foo/1.0.0", ref: "abc", originalName: "foo@1.0.0" },
        { name: "bar/2.0.0", ref: "def", originalName: "bar@2.0.0" },
      ]);
    });

    it("should replace '@' with new separator and set originalName", () => {
      const input = [
        { name: "foo@1.0.0", ref: "abc" },
        { name: "bar@2.0.0", ref: "def" },
      ];
      const result = replaceTagSeparator(input, "/v");
      expect(result).toEqual([
        { name: "foo/v1.0.0", ref: "abc", originalName: "foo@1.0.0" },
        { name: "bar/v2.0.0", ref: "def", originalName: "bar@2.0.0" },
      ]);
    });

    it("should handle scoped packages correctly", () => {
      const input = [
        { name: "@scope/foo@1.0.0", ref: "abc" },
        { name: "@other/bar@2.0.0", ref: "def" },
      ];

      // Test with / separator
      const result1 = replaceTagSeparator(input, "/");
      expect(result1).toEqual([
        {
          name: "@scope/foo/1.0.0",
          ref: "abc",
          originalName: "@scope/foo@1.0.0",
        },
        {
          name: "@other/bar/2.0.0",
          ref: "def",
          originalName: "@other/bar@2.0.0",
        },
      ]);

      // Test with /v separator
      const result2 = replaceTagSeparator(input, "/v");
      expect(result2).toEqual([
        {
          name: "@scope/foo/v1.0.0",
          ref: "abc",
          originalName: "@scope/foo@1.0.0",
        },
        {
          name: "@other/bar/v2.0.0",
          ref: "def",
          originalName: "@other/bar@2.0.0",
        },
      ]);
    });
  });

  describe("getMajorVersionTags", () => {
    it("should return major version tags for valid tags", () => {
      const input = [
        { name: "foo@1.2.3", ref: "ref1" },
        { name: "foo@1.2.3", ref: "ref1" }, // duplicate, should be ignored
        { name: "bar@0.1.0", ref: "ref1" }, // skipped: major === "0"
        { name: "baz@2.3.4", ref: "ref1" },
      ];
      const result = getMajorVersionTags(input, "@");
      expect(result).toEqual([
        { name: "foo@v1", ref: "ref1", majorVersion: true },
        { name: "baz@v2", ref: "ref1", majorVersion: true },
      ]);
    });

    it("should respect different separators", () => {
      const input = [{ name: "foo/3.4.5", ref: "ref4" }];
      const result = getMajorVersionTags(input, "/");
      expect(result).toEqual([
        { name: "foo/v3", ref: "ref4", majorVersion: true },
      ]);
    });

    it("should respect different separators (/v)", () => {
      const input = [{ name: "foo/v3.4.5", ref: "ref4" }];
      const result = getMajorVersionTags(input, "/v");
      expect(result).toEqual([
        { name: "foo/v3", ref: "ref4", majorVersion: true },
      ]);
    });

    it("should explicitly skip creating major version tags if major version is '0'", () => {
      const testScenarios = [
        {
          description: "using '@' separator",
          separator: "@",
          tags: [
            { name: "pkg-a@0.1.2", ref: "ref1" }, // Skip
            { name: "pkg-b@1.2.3", ref: "ref2" }, // Keep
            { name: "pkg-c@0.4.5", ref: "ref3" }, // Skip
          ],
          expected: [{ name: "pkg-b@v1", ref: "ref2", majorVersion: true }],
        },
        {
          description: "using '/' separator",
          separator: "/",
          tags: [
            { name: "pkg-d/0.6.7", ref: "ref4" }, // Skip
            { name: "pkg-e/2.3.4", ref: "ref5" }, // Keep
            { name: "pkg-f/0.0.0", ref: "refX" }, // Skip
          ],
          expected: [{ name: "pkg-e/v2", ref: "ref5", majorVersion: true }],
        },
        {
          description: "using '/v' separator",
          separator: "/v",
          tags: [
            { name: "pkg-g/v0.8.9", ref: "ref6" }, // Skip
            { name: "pkg-h/v3.4.5", ref: "ref7" }, // Keep
          ],
          expected: [{ name: "pkg-h/v3", ref: "ref7", majorVersion: true }],
        },
        {
          description: "using '--' separator",
          separator: "--",
          tags: [
            { name: "complex-pkg--0.1.0", ref: "ref9" }, // Skip
            { name: "complex-pkg--4.0.0", ref: "ref10" }, // Keep
            { name: "another-pkg--0.0.0", ref: "ref11" }, // Skip
          ],
          expected: [
            { name: "complex-pkg--v4", ref: "ref10", majorVersion: true },
          ],
        },
        {
          description: "with no tags resulting in major versions",
          separator: "@",
          tags: [
            { name: "zeromajor@0.1.2", ref: "refA" },
            { name: "anotherzero@0.3.4", ref: "refB" },
          ],
          expected: [],
        },
        {
          description: "with only tags that should result in major versions",
          separator: "/",
          tags: [
            { name: "onemajor/1.1.2", ref: "refC" },
            { name: "twomajor/2.3.4", ref: "refD" },
          ],
          expected: [
            { name: "onemajor/v1", ref: "refC", majorVersion: true },
            { name: "twomajor/v2", ref: "refD", majorVersion: true },
          ],
        },
      ];

      for (const { description, separator, tags, expected } of testScenarios) {
        const result = getMajorVersionTags(tags, separator);
        expect(result, description).toEqual(expected);
      }
    });

    it("should handle scoped packages correctly", () => {
      const input = [
        { name: "@scope/foo@1.2.3", ref: "ref1" },
        { name: "@scope/bar@2.3.4", ref: "ref2" },
        { name: "@other/baz@0.1.0", ref: "ref3" }, // skipped: major === "0"
      ];
      const result = getMajorVersionTags(input, "@");
      expect(result).toEqual([
        { name: "@scope/foo@v1", ref: "ref1", majorVersion: true },
        { name: "@scope/bar@v2", ref: "ref2", majorVersion: true },
      ]);
    });

    it("should handle scoped packages with different separators", () => {
      const input = [
        { name: "@scope/foo/1.2.3", ref: "ref1" },
        { name: "@scope/bar/v2.3.4", ref: "ref2" },
      ];

      // Test with / separator
      const result1 = getMajorVersionTags(input.slice(0, 1), "/");
      expect(result1).toEqual([
        { name: "@scope/foo/v1", ref: "ref1", majorVersion: true },
      ]);

      // Test with /v separator
      const result2 = getMajorVersionTags(input.slice(1, 2), "/v");
      expect(result2).toEqual([
        { name: "@scope/bar/v2", ref: "ref2", majorVersion: true },
      ]);
    });

    it("should explicitly skip creating major version tags if major version is '0'", () => {
      const testScenarios = [
        {
          description: "using '@' separator",
          separator: "@",
          tags: [
            { name: "pkg-a@0.1.2", ref: "ref1" }, // Skip
            { name: "pkg-b@1.2.3", ref: "ref2" }, // Keep
            { name: "pkg-c@0.4.5", ref: "ref3" }, // Skip
          ],
          expected: [{ name: "pkg-b@v1", ref: "ref2", majorVersion: true }],
        },
        {
          description: "using '/' separator",
          separator: "/",
          tags: [
            { name: "pkg-d/0.6.7", ref: "ref4" }, // Skip
            { name: "pkg-e/2.3.4", ref: "ref5" }, // Keep
            { name: "pkg-f/0.0.0", ref: "refX" }, // Skip
          ],
          expected: [{ name: "pkg-e/v2", ref: "ref5", majorVersion: true }],
        },
        {
          description: "using '/v' separator",
          separator: "/v",
          tags: [
            { name: "pkg-g/v0.8.9", ref: "ref6" }, // Skip
            { name: "pkg-h/v3.4.5", ref: "ref7" }, // Keep
          ],
          expected: [{ name: "pkg-h/v3", ref: "ref7", majorVersion: true }],
        },
        {
          description: "using '--' separator",
          separator: "--",
          tags: [
            { name: "complex-pkg--0.1.0", ref: "ref9" }, // Skip
            { name: "complex-pkg--4.0.0", ref: "ref10" }, // Keep
            { name: "another-pkg--0.0.0", ref: "ref11" }, // Skip
          ],
          expected: [
            { name: "complex-pkg--v4", ref: "ref10", majorVersion: true },
          ],
        },
        {
          description: "with no tags resulting in major versions",
          separator: "@",
          tags: [
            { name: "zeromajor@0.1.2", ref: "refA" },
            { name: "anotherzero@0.3.4", ref: "refB" },
          ],
          expected: [],
        },
        {
          description: "with only tags that should result in major versions",
          separator: "/",
          tags: [
            { name: "onemajor/1.1.2", ref: "refC" },
            { name: "twomajor/2.3.4", ref: "refD" },
          ],
          expected: [
            { name: "onemajor/v1", ref: "refC", majorVersion: true },
            { name: "twomajor/v2", ref: "refD", majorVersion: true },
          ],
        },
        {
          description: "using '@' separator with scoped packages",
          separator: "@",
          tags: [
            { name: "@scope/pkg-a@0.1.2", ref: "ref1" }, // Skip
            { name: "@scope/pkg-b@1.2.3", ref: "ref2" }, // Keep
            { name: "@other/pkg-c@0.4.5", ref: "ref3" }, // Skip
          ],
          expected: [
            { name: "@scope/pkg-b@v1", ref: "ref2", majorVersion: true },
          ],
        },
        {
          description: "using '/' separator with scoped packages",
          separator: "/",
          tags: [
            { name: "@scope/pkg-d/0.6.7", ref: "ref4" }, // Skip
            { name: "@scope/pkg-e/2.3.4", ref: "ref5" }, // Keep
          ],
          expected: [
            { name: "@scope/pkg-e/v2", ref: "ref5", majorVersion: true },
          ],
        },
        {
          description: "using '/v' separator with scoped packages",
          separator: "/v",
          tags: [
            { name: "@scope/pkg-g/v0.8.9", ref: "ref6" }, // Skip
            { name: "@scope/pkg-h/v3.4.5", ref: "ref7" }, // Keep
          ],
          expected: [
            { name: "@scope/pkg-h/v3", ref: "ref7", majorVersion: true },
          ],
        },
      ];

      for (const { description, separator, tags, expected } of testScenarios) {
        const result = getMajorVersionTags(tags, separator);
        expect(result, description).toEqual(expected);
      }
    });
  });

  describe("parseTagName", () => {
    it("should parse valid tag names correctly", () => {
      const result = parseTagName("foo@1.2.3", "@");
      expect(result).toEqual({
        pkg: "foo",
        version: "1.2.3",
        major: "1",
        minor: "2",
        patch: "3",
      });
    });

    it("should parse valid tag names correctly (/)", () => {
      const result = parseTagName("foo/1.2.3", "/");
      expect(result).toEqual({
        pkg: "foo",
        version: "1.2.3",
        major: "1",
        minor: "2",
        patch: "3",
      });
    });

    it("should parse valid tag names correctly (/v)", () => {
      const result = parseTagName("foo/v1.2.3", "/v");
      expect(result).toEqual({
        pkg: "foo",
        version: "1.2.3",
        major: "1",
        minor: "2",
        patch: "3",
      });
    });

    it("should parse valid scoped tag names correctly (@)", () => {
      const result = parseTagName("@scope/foo@1.2.3", "@");
      expect(result).toEqual({
        pkg: "@scope/foo",
        version: "1.2.3",
        major: "1",
        minor: "2",
        patch: "3",
      });
    });

    it("should parse valid scoped tag names correctly (/)", () => {
      const result = parseTagName("@scope/foo/1.2.3", "/");
      expect(result).toEqual({
        pkg: "@scope/foo",
        version: "1.2.3",
        major: "1",
        minor: "2",
        patch: "3",
      });
    });

    it("should parse valid scoped tag names correctly (/v)", () => {
      const result = parseTagName("@scope/foo/v1.2.3", "/v");
      expect(result).toEqual({
        pkg: "@scope/foo",
        version: "1.2.3",
        major: "1",
        minor: "2",
        patch: "3",
      });
    });

    it("should return undefined for invalid tag names", () => {
      expect(parseTagName("invalid-tag", "@")).toBeUndefined();
      expect(parseTagName("foo@1.2", "@")).toBeUndefined();
    });

    it("should parse tags with major version 0", () => {
      const result = parseTagName("foo@0.1.2", "@");
      expect(result).toEqual({
        pkg: "foo",
        version: "0.1.2",
        major: "0",
        minor: "1",
        patch: "2",
      });
    });
  });

  describe("pushTags", () => {
    it("should push lightweight versions of tags (@)", async () => {
      const testTags = await createTestRepoWithRemote("repo-tags", true);
      const tagNames = testTags.localOnlyTags.map((t) => t.name);

      const beforeTagTypes = await listTagTypes(
        tagNames,
        testTags.localRepoPath,
      );
      await pushTags("@", false, testTags.localRepoPath);
      const afterTagTypes = await listTagTypes(
        tagNames,
        testTags.localRepoPath,
      );

      expect(beforeTagTypes.every((t) => t.type === "tag")).toBe(true);
      expect(afterTagTypes.every((t) => t.type === "commit")).toBe(true);
      expect(beforeTagTypes.map((t) => t.name).sort()).toEqual(
        afterTagTypes.map((t) => t.name).sort(),
      );
    });

    it("should push lightweight versions of tags (/)", async () => {
      const testTags = await createTestRepoWithRemote("repo-tags", true);
      const tagNames = testTags.localOnlyTags.map((t) => t.name);
      const beforeTagTypes = await listTagTypes(
        tagNames,
        testTags.localRepoPath,
      );

      const createdTags = await pushTags("/", false, testTags.localRepoPath);
      expect(createdTags.length).toBe(testTags.localOnlyTags.length);
      expect(createdTags.every((t) => t.name.includes("/"))).toBe(true);
      for (const cTag of createdTags) {
        expect(
          testTags.localOnlyTags.some(
            (lTag) => lTag.name === cTag.originalName,
          ),
        ).toBe(true);
      }

      const afterTagTypes = await listTagTypes(
        createdTags.map((t) => t.name),
        testTags.localRepoPath,
      );
      expect(beforeTagTypes.every((t) => t.type === "tag")).toBe(true);
      expect(afterTagTypes.every((t) => t.type === "commit")).toBe(true);

      for (const cTag of createdTags) {
        expect(afterTagTypes.some((t) => t.name === cTag.name)).toBe(true);
      }
    });

    it("should not push try and push remote tags again", async () => {
      // create repo and origin with no tags
      const testTags = await createTestRepoWithRemote("repo-tags");

      // 1. Create a tag that uses the / separator. Mimicking that it was added in previous publish.
      // This will exist on the remote and locally because when the repo is cloned, it will pull the tags from the remote.
      await createLightweightTag(
        testTags.localRepoPath,
        "foo/1.0.0", // rewritten from foo@1.0.0
        "HEAD^",
      );
      execSync(`cd ${testTags.localRepoPath} && git push origin --tags`);

      // 2. Create local tags as though changeset publish was run.
      // ========================================
      // This tag will be created by changesets because it doesn't exist locally or on the remote, even though this version
      // has technically been published before.
      await createAnnotatedTestTag(testTags.localRepoPath, "foo@1.0.0", true);
      // Some new random tag for a new version.
      await createAnnotatedTestTag(testTags.localRepoPath, "bar@1.2.3", false);

      // This should not try and push the foo/1.0.0 tag again.
      const pushedTags = await pushTags("/", false, testTags.localRepoPath);

      // The fact that it got here means it's probably working.
      // As git will exit with a non-zero status code as it's trying to push a tag that already exists on the remote.
      // Do some basic validation anyways...
      expect(pushedTags.length).toBe(1);
      expect(pushedTags[0].name).toBe("bar/1.2.3");

      const tagTypes = await listTagTypes(
        [pushedTags[0].name],
        testTags.localRepoPath,
      );
      expect(tagTypes.every((t) => t.type === "commit")).toBe(true);
    });

    it("should not update major version tags accidentally", async () => {
      // create repo and origin with no tags
      const testTags = await createTestRepoWithRemote("repo-tags");

      // 1. Create a tag that uses the / separator. Mimicking that it was added in previous publish.
      // This will exist on the remote and locally because when the repo is cloned, it will pull the tags from the remote.
      await createLightweightTag(
        testTags.localRepoPath,
        "foo/1.0.0", // rewritten from foo@1.0.0
        "HEAD^",
      );
      await createLightweightTag(testTags.localRepoPath, "foo/v1", "HEAD^");
      execSync(`cd ${testTags.localRepoPath} && git push origin --tags`);

      // 2. Create local tags as though changeset publish was run.
      // ========================================
      // This tag will be created by changesets because it doesn't exist locally or on the remote, even though this version
      // has technically been published before.
      await createAnnotatedTestTag(testTags.localRepoPath, "foo@1.0.0", true);

      // Some new random tag for a new version.
      await createAnnotatedTestTag(testTags.localRepoPath, "bar@1.2.3", false);

      // This should not try and push the foo/1.0.0 tag again.
      // It should also not update the foo/v1 tag.
      const pushedTags = await pushTags("/", false, testTags.localRepoPath);

      expect(pushedTags.length).toBe(1);
      expect(pushedTags[0].name).toBe("bar/1.2.3");

      const tagTypes = await listTagTypes(
        [pushedTags[0].name],
        testTags.localRepoPath,
      );
      expect(tagTypes.every((t) => t.type === "commit")).toBe(true);
    });

    it("should push lightweight versions of tags (complex) (/)", async () => {
      const testTags = await createTestRepoWithRemote("repo-tags", true);
      // 1st pass - push tags. Should now have 6 remote tags:
      // - 3 with <pkg>/<tag> format
      // - 3 with <pkg>@<tag> format
      const createdTags = await pushTags("/", false, testTags.localRepoPath);
      expect(createdTags.length).toBe(testTags.localOnlyTags.length);
      expect(createdTags.every((t) => t.name.includes("/"))).toBe(true);
      for (const cTag of createdTags) {
        expect(
          testTags.localOnlyTags.some(
            (lTag) => lTag.name === cTag.originalName,
          ),
        ).toBe(true);
      }

      // 2nd pass - create new local only tags, and check diff with tag rewrites
      // should have 6 remote tags, and 3 local only tags
      const newLocalOnlyTestTags = await createAnnotatedTestTags(
        testTags.localRepoPath,
        "new-local-only",
        3,
      );
      const createdTags2 = await pushTags("/", false, testTags.localRepoPath);

      expect(createdTags2.length).toBe(newLocalOnlyTestTags.length);
      for (const cTag of createdTags2) {
        expect(
          newLocalOnlyTestTags.some((lTag) => lTag.name === cTag.originalName),
        ).toBe(true);
      }
    });

    it("should push lightweight versions of tags and major version tags (@)", async () => {
      const testTags = await createTestRepoWithRemote("repo-tags", true);
      const tagNames = testTags.localOnlyTags.map((t) => t.name);
      const beforeTagTypes = await listTagTypes(
        tagNames,
        testTags.localRepoPath,
      );

      const createdTags = await pushTags("@", true, testTags.localRepoPath);

      const expectedTagNames = [
        "local-only-0@v1",
        "local-only-1@v2",
        "local-only-2@v3",
        "local-only-0@1.0.0",
        "local-only-1@2.1.0",
        "local-only-2@3.2.0",
      ];
      const createdTagNames = createdTags.map((t) => t.name);
      expect(createdTagNames.sort()).toEqual(expectedTagNames.sort());
      const afterTagTypes = await listTagTypes(
        createdTagNames,
        testTags.localRepoPath,
      );

      expect(beforeTagTypes.every((t) => t.type === "tag")).toBe(true);
      expect(afterTagTypes.every((t) => t.type === "commit")).toBe(true);
    });

    it("should push lightweight versions of tags and major version tags (/)", async () => {
      const testTags = await createTestRepoWithRemote("repo-tags", true);
      const tagNames = testTags.localOnlyTags.map((t) => t.name);
      const beforeTagTypes = await listTagTypes(
        tagNames,
        testTags.localRepoPath,
      );

      const createdTags = await pushTags("/", true, testTags.localRepoPath);

      const expectedTagNames = [
        "local-only-0/v1",
        "local-only-1/v2",
        "local-only-2/v3",
        "local-only-0/1.0.0",
        "local-only-1/2.1.0",
        "local-only-2/3.2.0",
      ];
      const createdTagNames = createdTags.map((t) => t.name);
      expect(createdTagNames.sort()).toEqual(expectedTagNames.sort());
      const afterTagTypes = await listTagTypes(
        createdTagNames,
        testTags.localRepoPath,
      );

      expect(beforeTagTypes.every((t) => t.type === "tag")).toBe(true);
      expect(afterTagTypes.every((t) => t.type === "commit")).toBe(true);
    });

    it("should push lightweight versions of tags and major version tags (complex) (/)", async () => {
      const testTags = await createTestRepoWithRemote("repo-tags", true);
      const tagNames = testTags.localOnlyTags.map((t) => t.name);
      const beforeTagTypes = await listTagTypes(
        tagNames,
        testTags.localRepoPath,
      );

      const createdTags = await pushTags("/", true, testTags.localRepoPath);
      const expectedTagNames = [
        "local-only-0/v1",
        "local-only-1/v2",
        "local-only-2/v3",
        "local-only-0/1.0.0",
        "local-only-1/2.1.0",
        "local-only-2/3.2.0",
      ];
      const createdTagNames = createdTags.map((t) => t.name);
      expect(createdTagNames.sort()).toEqual(expectedTagNames.sort());
      const afterTagTypes = await listTagTypes(
        createdTagNames,
        testTags.localRepoPath,
      );
      expect(beforeTagTypes.every((t) => t.type === "tag")).toBe(true);
      expect(afterTagTypes.every((t) => t.type === "commit")).toBe(true);

      // 2nd pass - create a new tag that should overwrite a previously created major version tag
      const newTagName = "local-only-0@1.2.0"; // Should overwrite local-only-0/v1
      await createAnnotatedTestTag(testTags.localRepoPath, newTagName);

      const createdTags2 = await pushTags("/", true, testTags.localRepoPath);
      const createdTagNames2 = createdTags2.map((t) => t.name);
      const expectedTagNames2 = ["local-only-0/1.2.0", "local-only-0/v1"];
      expect(createdTagNames2.sort()).toEqual(expectedTagNames2.sort());
      const afterTagTypes2 = await listTagTypes(
        createdTagNames2,
        testTags.localRepoPath,
      );
      expect(afterTagTypes2.every((t) => t.type === "commit")).toBe(true);

      const mvTagToCheck = "local-only-0/v1";
      const oldMVTag = afterTagTypes.find((t) => t.name === mvTagToCheck);
      const newMVTag = afterTagTypes2.find((t) => t.name === mvTagToCheck);

      expect(oldMVTag).toBeDefined();
      expect(newMVTag).toBeDefined();
      expect(oldMVTag?.ref).not.toEqual(newMVTag?.ref);
    });
  });

  describe(getLocalTags.name, () => {
    it("should return empty array if no local tags exist", async () => {
      const testRepoConfig = await createTestRepoWithRemote("repo-tags");

      expect(testRepoConfig.localOnlyTags).toEqual([]);
      expect(testRepoConfig.sharedTags).toEqual([]);

      const remoteTags = await getLocalTags(testRepoConfig.localRepoPath);
      expect(remoteTags).toEqual([]);
    });

    it("should return local tags", async () => {
      const testRepoConfig = await createTestRepoWithRemote("repo-tags", true);

      const localTags = await getLocalTags(testRepoConfig.localRepoPath);
      expect(localTags.sort()).toEqual(
        [...testRepoConfig.localOnlyTags, ...testRepoConfig.sharedTags].sort(),
      );
    });
  });

  describe(getRemoteTagNames.name, () => {
    it("should return empty array if no remote tags exist", async () => {
      const testRepoConfig = await createTestRepoWithRemote("repo-tags");

      expect(testRepoConfig.localOnlyTags).toEqual([]);
      expect(testRepoConfig.sharedTags).toEqual([]);

      const remoteTags = await getRemoteTagNames(testRepoConfig.localRepoPath);
      expect(remoteTags).toEqual([]);
    });
  });

  it("should return remote tags", async () => {
    const testRepoConfig = await createTestRepoWithRemote("repo-tags", true);

    const remoteTagNames = await getRemoteTagNames(
      testRepoConfig.localRepoPath,
    );
    expect(remoteTagNames.sort()).toEqual(
      testRepoConfig.sharedTags.map((t) => t.name).sort(),
    );
  });
});

async function createTestRepoWithRemote(name: string, createTags?: boolean) {
  // create a "local" repo to create tags in
  const localRepoPath = await createRepo(`${name}-local`);

  // create a "remote" to push tags to
  const remoteRepoPath = await createRepo(`${name}-remote`);

  // add the remote to the local repo
  execSync(`cd ${localRepoPath} && git remote add origin ${remoteRepoPath}`);

  if (!createTags) {
    return { remoteRepoPath, localRepoPath, sharedTags: [], localOnlyTags: [] };
  }

  // create a couple of tags in the local repo
  const sharedTags = await createAnnotatedTestTags(localRepoPath, "shared", 3);
  // push the tags to the remote
  execSync(`cd ${localRepoPath} && git push origin --tags`);

  // create a few more tags
  const localOnlyTags = await createAnnotatedTestTags(
    localRepoPath,
    "local-only",
    3,
  );

  return { remoteRepoPath, localRepoPath, sharedTags, localOnlyTags };
}

async function createAnnotatedTestTags(
  repoPath: string,
  key: string,
  count: number,
): Promise<GitTag[]> {
  const newTags = new Array(count).fill(null).map(async (_, i) => {
    const name = `${key}-${i}@${i + 1}.${i}.0`;
    return createAnnotatedTestTag(repoPath, name);
  });

  return Promise.all(newTags);
}

async function createLightweightTag(
  repoPath: string,
  name: string,
  refQuery: string = "HEAD",
): Promise<GitTag> {
  const ref = await execWithOutput("git", ["rev-parse", refQuery], {
    cwd: repoPath,
  });

  execSync(`cd ${repoPath} && git tag ${name} ${ref}`);

  return { name, ref } satisfies GitTag;
}

async function createAnnotatedTestTag(
  repoPath: string,
  name: string,
  createNewCommit: boolean = true,
): Promise<GitTag> {
  if (createNewCommit) {
    createCommit(repoPath);
  }

  const msg = `This is tag ${name}`;
  const ref = await execWithOutput("git", ["rev-parse", "HEAD"], {
    cwd: repoPath,
  });

  execSync(`cd ${repoPath} && git tag -a '${name}' -m "${msg}" ${ref}`);

  return { name, ref } satisfies GitTag;
}

async function listTagTypes(tagNames: string[], cwd: string) {
  const types = tagNames.map(async (name) => {
    const ref = await execWithOutput("git", ["rev-list", "-n 1", name], {
      cwd,
    });
    const type = await execWithOutput("git", ["cat-file", "-t", name], {
      cwd,
    });

    return { type, name, ref };
  });

  return Promise.all(types);
}

describe("rewriteRootPackageTags", () => {
  it("should rewrite root package tags to v<version> format", () => {
    const tags: GitTag[] = [
      { name: "my-package@1.2.3", ref: "ref1" },
      { name: "other-package@2.3.4", ref: "ref2" },
      { name: "my-package@9.0.1", ref: "ref3" },
    ];
    const rootPackageInfo = { name: "my-package", version: "1.2.3" };
    const tagSeparator = "@";
    const result = rewriteRootPackageTags(tags, tagSeparator, rootPackageInfo);

    expect(result).toEqual([
      { name: "v1.2.3", ref: "ref1", originalName: "my-package@1.2.3" },
      { name: "other-package@2.3.4", ref: "ref2" },
      { name: "v9.0.1", ref: "ref3", originalName: "my-package@9.0.1" },
    ]);
  });

  it("should preserve originalName if it already exists", () => {
    const tags: GitTag[] = [
      { name: "my-package@1.2.3", ref: "ref1", originalName: "original-name" },
      { name: "other-package@2.3.4", ref: "ref2" },
    ];
    const rootPackageInfo = { name: "my-package", version: "1.2.3" };
    const tagSeparator = "@";

    const result = rewriteRootPackageTags(tags, tagSeparator, rootPackageInfo);

    expect(result).toEqual([
      { name: "v1.2.3", ref: "ref1", originalName: "original-name" },
      { name: "other-package@2.3.4", ref: "ref2" },
    ]);
  });

  it("should not rewrite tags that don't match the root package name", () => {
    const tags: GitTag[] = [
      { name: "other-package/v1.2.3", ref: "ref1" },
      { name: "different-package/v2.3.4", ref: "ref2" },
      { name: "unrelated/v3.4.5", ref: "ref3" },
    ];
    const rootPackageInfo = { name: "my-package", version: "1.2.3" };
    const tagSeparator = "/v";
    const result = rewriteRootPackageTags(tags, tagSeparator, rootPackageInfo);

    expect(result).toEqual([
      { name: "other-package/v1.2.3", ref: "ref1" },
      { name: "different-package/v2.3.4", ref: "ref2" },
      { name: "unrelated/v3.4.5", ref: "ref3" },
    ]);
  });

  it("should handle empty tag list", () => {
    const tags: GitTag[] = [];
    const rootPackageInfo = { name: "my-package", version: "1.2.3" };
    const tagSeparator = "@";
    const result = rewriteRootPackageTags(tags, tagSeparator, rootPackageInfo);

    expect(result).toEqual([]);
  });

  it("should handle tags with no detectable separator (uses default @)", () => {
    const tags: GitTag[] = [
      { name: "my-package1.2.3", ref: "ref1" }, // No separator detected
      { name: "my-package@2.3.4", ref: "ref2" }, // Normal tag
    ];
    const rootPackageInfo = { name: "my-package", version: "1.2.3" };
    const tagSeparator = "@";
    const result = rewriteRootPackageTags(tags, tagSeparator, rootPackageInfo);

    // The first tag won't be rewritten because parseTagName with "@" won't match "my-package1.2.3"
    // The second tag will be rewritten normally
    expect(result).toEqual([
      { name: "my-package1.2.3", ref: "ref1" }, // Unchanged because parseTagName fails
      { name: "v2.3.4", ref: "ref2", originalName: "my-package@2.3.4" },
    ]);
  });

  it("should handle scoped root package tags correctly", () => {
    const tags: GitTag[] = [
      { name: "@scope/my-package@1.2.3", ref: "ref1" },
      { name: "@other/package@2.3.4", ref: "ref2" },
      { name: "@scope/my-package@9.0.1", ref: "ref3" },
    ];
    const rootPackageInfo = { name: "@scope/my-package", version: "1.2.3" };
    const tagSeparator = "@";
    const result = rewriteRootPackageTags(tags, tagSeparator, rootPackageInfo);

    expect(result).toEqual([
      { name: "v1.2.3", ref: "ref1", originalName: "@scope/my-package@1.2.3" },
      { name: "@other/package@2.3.4", ref: "ref2" },
      { name: "v9.0.1", ref: "ref3", originalName: "@scope/my-package@9.0.1" },
    ]);
  });

  it("should handle scoped root packages with different separators", () => {
    const tags: GitTag[] = [
      { name: "@scope/my-package/1.2.3", ref: "ref1" },
      { name: "@scope/my-package/v9.0.1", ref: "ref2" },
    ];
    const rootPackageInfo = { name: "@scope/my-package", version: "1.2.3" };

    // Test with / separator
    const result1 = rewriteRootPackageTags([tags[0]], "/", rootPackageInfo);
    expect(result1).toEqual([
      { name: "v1.2.3", ref: "ref1", originalName: "@scope/my-package/1.2.3" },
    ]);

    // Test with /v separator
    const result2 = rewriteRootPackageTags([tags[1]], "/v", rootPackageInfo);
    expect(result2).toEqual([
      { name: "v9.0.1", ref: "ref2", originalName: "@scope/my-package/v9.0.1" },
    ]);
  });

  it("should not rewrite scoped tags that don't match the root package name", () => {
    const tags: GitTag[] = [
      { name: "@other/package/v1.2.3", ref: "ref1" },
      { name: "@different/package/v2.3.4", ref: "ref2" },
    ];
    const rootPackageInfo = { name: "@scope/my-package", version: "1.2.3" };
    const tagSeparator = "/v";
    const result = rewriteRootPackageTags(tags, tagSeparator, rootPackageInfo);

    expect(result).toEqual([
      { name: "@other/package/v1.2.3", ref: "ref1" },
      { name: "@different/package/v2.3.4", ref: "ref2" },
    ]);
  });
});
