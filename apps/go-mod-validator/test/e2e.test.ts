import {
  describe,
  vi,
  it,
  expect,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import { getNock, getTestOctokit } from "./__helpers__/nock";
import * as core from "@actions/core";
import { join } from "path";

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

const mockGithubContext = {
  payload: {},
  repo: {},
};

const mockOctokit = getTestOctokit("record");
vi.doMock("@actions/github", () => ({
  getOctokit: () => mockOctokit,
  context: mockGithubContext,
}));

function setup(repoName: string, commitSha: string) {
  process.env["INPUT_GO-MOD-DIR"] = join(
    "./test/__fixtures__",
    repoName,
    commitSha,
  );
  process.env["INPUT_GITHUB-TOKEN"] = process.env.GITHUB_TOKEN;
  process.env["INPUT_DEP-PREFIX"] = "github.com/smartcontractkit";
  process.env["GITHUB_STEP_SUMMARY"] = "/dev/null";
}

describe("e2e tests", () => {
  const annotationSpy = vi.spyOn(core, "error");

  afterEach(() => {
    annotationSpy.mockClear();
    delete process.env["GITHUB_EVENT_NAME"];
  });

  it("chainlink - should match snapshot", { timeout: 100_000 }, async () => {
    setup("chainlink");
    const { run } = await import("../src/go-mod-validator");
    const summary = await run();
    expect(annotationSpy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "[./test/data/chainlink/core/scripts/go.mod] dependency github.com/smartcontractkit/chain-selectors@v1.0.10 // indirect not on default branch (main).
      Version(tag): v1.0.10
      Tree: https://github.com/smartcontractkit/chain-selectors/tree/v1.0.10
      Commit: https://github.com/smartcontractkit/chain-selectors/commit/00e6f0f6de86f013ca2047a175d4f0a909b4b068",
          {
            "file": "./test/data/chainlink/core/scripts/go.mod",
            "startLine": 272,
          },
        ],
        [
          "[./test/data/chainlink/core/scripts/go.mod] dependency github.com/smartcontractkit/go-plugin@v0.0.0-20240208201424-b3b91517de16 not on default branch (main).
      Version(commit): b3b91517de16
      Tree: https://github.com/smartcontractkit/go-plugin/tree/b3b91517de16
      Commit: https://github.com/smartcontractkit/go-plugin/commit/b3b91517de16 ",
          {
            "file": "./test/data/chainlink/core/scripts/go.mod",
            "startLine": 369,
          },
        ],
        [
          "[./test/data/chainlink/core/scripts/go.mod] dependency github.com/smartcontractkit/wsrpc@v0.7.3 // indirect not on default branch (main).
      Version(tag): v0.7.3
      Tree: https://github.com/smartcontractkit/wsrpc/tree/v0.7.3
      Commit: https://github.com/smartcontractkit/wsrpc/commit/c691d6729bfbdbac704df13decf5e2e37eb3b672",
          {
            "file": "./test/data/chainlink/core/scripts/go.mod",
            "startLine": 280,
          },
        ],
        [
          "[./test/data/chainlink/go.mod] dependency github.com/smartcontractkit/chain-selectors@v1.0.10 not on default branch (main).
      Version(tag): v1.0.10
      Tree: https://github.com/smartcontractkit/chain-selectors/tree/v1.0.10
      Commit: https://github.com/smartcontractkit/chain-selectors/commit/00e6f0f6de86f013ca2047a175d4f0a909b4b068",
          {
            "file": "./test/data/chainlink/go.mod",
            "startLine": 73,
          },
        ],
        [
          "[./test/data/chainlink/go.mod] dependency github.com/smartcontractkit/go-plugin@v0.0.0-20240208201424-b3b91517de16 not on default branch (main).
      Version(commit): b3b91517de16
      Tree: https://github.com/smartcontractkit/go-plugin/tree/b3b91517de16
      Commit: https://github.com/smartcontractkit/go-plugin/commit/b3b91517de16 ",
          {
            "file": "./test/data/chainlink/go.mod",
            "startLine": 348,
          },
        ],
        [
          "[./test/data/chainlink/go.mod] dependency github.com/smartcontractkit/wsrpc@v0.7.3 not on default branch (main).
      Version(tag): v0.7.3
      Tree: https://github.com/smartcontractkit/wsrpc/tree/v0.7.3
      Commit: https://github.com/smartcontractkit/wsrpc/commit/c691d6729bfbdbac704df13decf5e2e37eb3b672",
          {
            "file": "./test/data/chainlink/go.mod",
            "startLine": 84,
          },
        ],
        [
          "[./test/data/chainlink/integration-tests/go.mod] dependency github.com/smartcontractkit/go-plugin@v0.0.0-20240208201424-b3b91517de16 not on default branch (main).
      Version(commit): b3b91517de16
      Tree: https://github.com/smartcontractkit/go-plugin/tree/b3b91517de16
      Commit: https://github.com/smartcontractkit/go-plugin/commit/b3b91517de16 ",
          {
            "file": "./test/data/chainlink/integration-tests/go.mod",
            "startLine": 525,
          },
        ],
        [
          "[./test/data/chainlink/integration-tests/load/go.mod] dependency github.com/smartcontractkit/go-plugin@v0.0.0-20240208201424-b3b91517de16 not on default branch (main).
      Version(commit): b3b91517de16
      Tree: https://github.com/smartcontractkit/go-plugin/tree/b3b91517de16
      Commit: https://github.com/smartcontractkit/go-plugin/commit/b3b91517de16 ",
          {
            "file": "./test/data/chainlink/integration-tests/load/go.mod",
            "startLine": 518,
          },
        ],
      ]
    `);
    expect(summary).toMatchInlineSnapshot(`
        "
        #### Fixing Errors

        <details>
        <summary>Instructions</summary>

        Types of Errors:

        1. Dependency not on default branch - Check for the dependency's commit on the upstream repository and use one of the commits from the default branch of the upstream repository. If you click on the commit link that gets generated, on the UI you will see the branches that a commit belongs to, which will not be the default branch.

        NOTE: If you see that the commit should be on the default branch, but it isn't, this means that the "default branch" setting of the repository is incorrect. Please update the default branch of the repository to the correct branch.

        e.g., 
        - For dependency github.com/smartcontractkit/grpc-proxy@v0.1.0, upstream repository is \`github.com/smartcontractkit/grpc-proxy\` and \`v0.1.0\` is the tag that produced the dependency, which isn't created from the default branch.
          Update it to use one of the tags from the default repository using \`go mod tidy\`.
        - For dependency github.com/smartcontractkit/go-plugin@v0.0.0-20240208201424-b3b91517de16, upstream repository is \`github.com/smartcontractkit/go-plugin\` and \`b3b91517de16\` is the commit that produced the dependency, which isn't on the default branch.
          Update it to use one of the commits from the default repository using \`go mod tidy\`. Ideally we should update it to use a tag like the example above.

        </details>

        "
      `);
  });

  describe.only("pull request mode", () => {
    beforeAll(() => {
      process.env["GITHUB_EVENT_NAME"] = "pull_request";
    });
    afterAll(() => {
      delete process.env["GITHUB_EVENT_NAME"];
    });

    it("should produce a diff", { timeout: 100_000 }, async () => {
      const base = "f185128e739dcf6562e9ba96075062193e96cc7a";
      const head = "da8b9a5504339746d955cd745440ed3a012431de";
      setup("chainlink", head);
      const nock = getNock("record");
      const { nockDone } = await nock(
        `chainlink-pull-request-base:${base}-head:${head}.json`,
      );

      mockGithubContext.payload = {
        pull_request: {
          base: {
            sha: base,
          },
          head: {
            sha: head,
          },
        },
      };
      mockGithubContext.repo = {
        owner: "smartcontractkit",
        repo: "chainlink",
      };

      const { run } = await import("../src/go-mod-validator");
      const summary = await run();
      expect(annotationSpy.mock.calls).toMatchSnapshot();
      expect(summary).toMatchSnapshot();
      nockDone();
    });

    it("should not produce a diff", { timeout: 100_000 }, async () => {
      const base = "7eec696575101ece78084fa9367314d1a6464f2a";
      const head = "1356b654d5baa16ca0c1a41f300fa131e614d2f8";
      setup("chainlink", head);
      const nock = getNock("record");
      const { nockDone } = await nock(
        `chainlink-pull-request-base:${base}-head:${head}.json`,
      );

      mockGithubContext.payload = {
        pull_request: {
          base: {
            sha: base,
          },
          head: {
            sha: head,
          },
        },
      };
      mockGithubContext.repo = {
        owner: "smartcontractkit",
        repo: "chainlink",
      };

      const { run } = await import("../src/go-mod-validator");
      const summary = await run();
      expect(annotationSpy.mock.calls).toMatchSnapshot();
      expect(summary).toMatchSnapshot();
      nockDone();
    });
  });

  it("crib - should match snapshot", { timeout: 100_000 }, async () => {
    setup("crib");
    const { run } = await import("../src/go-mod-validator");
    const summary = await run();

    expect(annotationSpy.mock.calls).toMatchInlineSnapshot(`[]`);
    expect(summary).toMatchInlineSnapshot(
      `"validation successful for all go.mod dependencies"`,
    );
  });

  it(
    "chainlink-data-streams - should match snapshot",
    { timeout: 50_000 },
    async () => {
      setup("chainlink-data-streams");
      const { run } = await import("../src/go-mod-validator");
      const summary = await run();

      expect(annotationSpy.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "[./test/data/chainlink-data-streams/go.mod] dependency github.com/smartcontractkit/go-plugin@v0.0.0-20240208201424-b3b91517de16 not on default branch (main).
        Version(commit): b3b91517de16
        Tree: https://github.com/smartcontractkit/go-plugin/tree/b3b91517de16
        Commit: https://github.com/smartcontractkit/go-plugin/commit/b3b91517de16 ",
            {
              "file": "./test/data/chainlink-data-streams/go.mod",
              "startLine": 78,
            },
          ],
        ]
      `);
      expect(summary).toMatchInlineSnapshot(`
        "
        #### Fixing Errors

        <details>
        <summary>Instructions</summary>

        Types of Errors:

        1. Dependency not on default branch - Check for the dependency's commit on the upstream repository and use one of the commits from the default branch of the upstream repository. If you click on the commit link that gets generated, on the UI you will see the branches that a commit belongs to, which will not be the default branch.

        NOTE: If you see that the commit should be on the default branch, but it isn't, this means that the "default branch" setting of the repository is incorrect. Please update the default branch of the repository to the correct branch.

        e.g., 
        - For dependency github.com/smartcontractkit/grpc-proxy@v0.1.0, upstream repository is \`github.com/smartcontractkit/grpc-proxy\` and \`v0.1.0\` is the tag that produced the dependency, which isn't created from the default branch.
          Update it to use one of the tags from the default repository using \`go mod tidy\`.
        - For dependency github.com/smartcontractkit/go-plugin@v0.0.0-20240208201424-b3b91517de16, upstream repository is \`github.com/smartcontractkit/go-plugin\` and \`b3b91517de16\` is the commit that produced the dependency, which isn't on the default branch.
          Update it to use one of the commits from the default repository using \`go mod tidy\`. Ideally we should update it to use a tag like the example above.

        </details>

        "
      `);
    },
  );
});
