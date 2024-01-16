import { execSync } from "child_process";
import { execWithOutput } from "../../utils";
import {
  getLocalRemoteTagDiff,
  deleteTags,
  createLightweightTags,
  GitTag,
  pushTags,
  getRemoteTagNames,
  getLocalTags,
} from "./repo-tags";
import { createRepo } from "./utilts.testutils";

describe("repo-tags", () => {
  describe(getLocalRemoteTagDiff.name, () => {
    it("should return the correct tags", async () => {
      const testTags = await createTestRepoWithRemote("repo-tags", true);

      const tags = await getLocalRemoteTagDiff(testTags.localRepoPath);
      expect(tags.map((t) => t.name)).toEqual(
        testTags.localOnlyTags.map((t) => t.name)
      );
    });
  });

  describe("deleteTags", () => {
    it("should delete the given tags", async () => {
      const testTags = await createTestRepoWithRemote("repo-tags", true);

      const tags = await getLocalRemoteTagDiff(testTags.localRepoPath);
      await deleteTags(tags, testTags.localRepoPath);

      const notags = await getLocalRemoteTagDiff(testTags.localRepoPath);
      expect(tags.map((t) => t.name)).toEqual(
        testTags.localOnlyTags.map((t) => t.name)
      );
      expect(notags).toEqual([]);
    });
  });

  describe("createLightweightTags", () => {
    it("should create the given tags", async () => {
      const repo = await createRepo("repo-tags");
      const tags = await createLightweightTags(
        [
          { name: "tag-1", ref: "HEAD" },
          { name: "tag-2", ref: "HEAD" },
        ],
        repo
      );

      const stdout = await listTagTypes(tags, repo);
      expect(stdout).toMatchInlineSnapshot(`
        [
          {
            "name": "tag-1",
            "type": "commit",
          },
          {
            "name": "tag-2",
            "type": "commit",
          },
        ]
      `);
    });
  });

  describe("pushTags", () => {
    it("should push lightweight versions of tags", async () => {
      const testTags = await createTestRepoWithRemote("repo-tags", true);
      const beforeTagTypes = await listTagTypes(
        testTags.localOnlyTags,
        testTags.localRepoPath
      );
      await pushTags(testTags.localRepoPath);
      const afterTagTypes = await listTagTypes(
        testTags.localOnlyTags,
        testTags.localRepoPath
      );

      expect(beforeTagTypes.every((t) => t.type === "tag")).toBe(true);
      expect(afterTagTypes.every((t) => t.type === "commit")).toBe(true);
      expect(beforeTagTypes.map((t) => t.name).sort()).toEqual(
        afterTagTypes.map((t) => t.name).sort()
      );
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
  });

  describe(getRemoteTagNames.name, () => {
    it("should return empty array if no remote tags exist", async () => {
      const testRepoConfig = await createTestRepoWithRemote("repo-tags");

      expect(testRepoConfig.localOnlyTags).toEqual([]);
      expect(testRepoConfig.sharedTags).toEqual([]);

      const remoteTags = await getRemoteTagNames('origin', testRepoConfig.localRepoPath);
      expect(remoteTags).toEqual([]);
    });
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
    3
  );

  return { remoteRepoPath, localRepoPath, sharedTags, localOnlyTags };
}

async function createAnnotatedTestTags(
  repoPath: string,
  key: string,
  count: number
): Promise<GitTag[]> {
  const newTags = new Array(count).fill(null).map(async (_, i) => {
    const name = `tag-${key}-${i}`;
    const msg = `This is tag ${key}-${i}`;
    const ref = await execWithOutput("git", ["rev-parse", "HEAD"], {
      cwd: repoPath,
    });

    execSync(`cd ${repoPath} && git tag -a ${name} -m "${msg}" ${ref}`);

    return { name, ref } satisfies GitTag;
  });

  return Promise.all(newTags);
}

async function listTagTypes(tags: GitTag[], repoPath: string) {
  const types = tags.map(async (t) => {
    const type = await execWithOutput("git", ["cat-file", "-t", t.name], {
      cwd: repoPath,
    });

    return { type, name: t.name };
  });

  return Promise.all(types);
}
