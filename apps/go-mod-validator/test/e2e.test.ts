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

vi.setConfig({
  testTimeout: 60000,
});

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

const nock = getNock("lockdown");
const mockOctokit = getTestOctokit(nock.currentMode);
const mockGithubContext = {
  payload: {},
  repo: {},
};
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

async function setupPR(repo: string, base: string, head: string) {
  setup(repo, head);
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
    repo,
  };

  const fixtureName = `${repo}-pull-request-base:${base}-head:${head}.json`;
  const { nockDone } = await nock(fixtureName);
  return nockDone;
}

async function setupNonPR(repo: string, commitSha: string) {
  setup(repo, commitSha);
  const fixtureName = `${repo}-commit:${commitSha}.json`;
  const { nockDone } = await nock(fixtureName);
  return nockDone;
}

describe("e2e tests", () => {
  const annotationSpy = vi.spyOn(core, "error");

  async function testEntrypoint() {
    vi.resetModules();
    const { run } = await import("../src/go-mod-validator");
    const summary = await run();
    expect(annotationSpy.mock.calls).toMatchSnapshot();
    expect(summary).toMatchSnapshot();
  }

  afterEach(() => {
    annotationSpy.mockClear();
  });

  describe.skip("chainlink", () => {
    describe("non pull request mode", () => {
      it("should fail on wsrpc", async () => {
        const nockDone = await setupNonPR(
          "chainlink",
          "c97838d904aa7ac07fc4a48cd05db4c4859e5355",
        );
        await testEntrypoint();
        nockDone();
      });
    });
    describe("pull request mode", () => {
      const setupChainlinkPR = async (base: string, head: string) =>
        setupPR("chainlink", base, head);

      afterAll(() => {
        mockGithubContext.payload = {};
        mockGithubContext.repo = {};
      });

      it("should pass on this diff", async () => {
        const base = "f185128e739dcf6562e9ba96075062193e96cc7a";
        const head = "da8b9a5504339746d955cd745440ed3a012431de";
        setup("chainlink", head);
        const nockDone = await setupChainlinkPR(base, head);

        await testEntrypoint();
        nockDone();
      });

      it("should pass on this diff", async () => {
        const base = "7eec696575101ece78084fa9367314d1a6464f2a";
        const head = "1356b654d5baa16ca0c1a41f300fa131e614d2f8";
        const nockDone = await setupChainlinkPR(base, head);

        await testEntrypoint();
        nockDone();
      });

      it("should ignore tagged wsrpc deps", async () => {
        const base = "5bc558f2a38d8b673bb1ab48053d844ff67303f9";
        const head = "d64ba3dafedb21f77e335c056c9a830c5710dba0";
        const nockDone = await setupChainlinkPR(base, head);

        await testEntrypoint();
        nockDone();
      });
    });
  });

  describe("crib", () => {
    describe("non pull request mode", () => {
      it("should pass", async () => {
        const nockDone = await setupNonPR(
          "crib",
          "af4b8a5081fbed821c4742a218415cd3c73c0ebd",
        );

        await testEntrypoint();
        nockDone();
      });
    });
  });

  describe("chainlink-data-streams", () => {
    describe("non pull request mode", () => {
      it("should produce a diff on go-plugin", async () => {
        const nockDone = await setupNonPR(
          "chainlink-data-streams",
          "2dc0c8136bfa7472abbae24429078ee520c8b85b",
        );

        await testEntrypoint();
        nockDone();
      });
    });
  });
});
