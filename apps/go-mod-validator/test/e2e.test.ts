import { describe, vi, it, expect, afterEach } from "vitest";
import { run } from "../src/go-mod-validator";
import { join } from "path";
import * as core from "@actions/core";
const testDataDir = "./test/data";

function setup(repoName: string) {
  process.env["INPUT_GO-MOD-DIR"] = join(testDataDir, repoName);
  process.env["INPUT_GITHUB-TOKEN"] = process.env.GITHUB_TOKEN;
  process.env["INPUT_DEP-PREFIX"] = "github.com/smartcontractkit";
  process.env["GITHUB_STEP_SUMMARY"] = "/dev/null";
}

describe("e2e tests", () => {
  const annotationSpy = vi.spyOn(core, "error");

  afterEach(() => {
    annotationSpy.mockClear();
  });

  it("chainlink - should match snapshot", { timeout: 100_000 }, async () => {
    setup("chainlink");
    const summary = await run();
    expect(annotationSpy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "err: dependency not on default branch",
          {
            "file": "./test/data/chainlink/go.mod",
            "startLine": 73,
          },
        ],
        [
          "err: dependency not on default branch",
          {
            "file": "./test/data/chainlink/core/scripts/go.mod",
            "startLine": 272,
          },
        ],
        [
          "err: dependency not on default branch",
          {
            "file": "./test/data/chainlink/integration-tests/go.mod",
            "startLine": 378,
          },
        ],
        [
          "err: dependency not on default branch",
          {
            "file": "./test/data/chainlink/integration-tests/load/go.mod",
            "startLine": 371,
          },
        ],
        [
          "err: dependency not on default branch",
          {
            "file": "./test/data/chainlink/go.mod",
            "startLine": 80,
          },
        ],
        [
          "err: dependency not on default branch",
          {
            "file": "./test/data/chainlink/core/scripts/go.mod",
            "startLine": 277,
          },
        ],
        [
          "err: dependency not on default branch",
          {
            "file": "./test/data/chainlink/integration-tests/go.mod",
            "startLine": 383,
          },
        ],
        [
          "err: dependency not on default branch",
          {
            "file": "./test/data/chainlink/integration-tests/load/go.mod",
            "startLine": 375,
          },
        ],
        [
          "err: dependency not on default branch",
          {
            "file": "./test/data/chainlink/core/scripts/go.mod",
            "startLine": 369,
          },
        ],
        [
          "err: dependency not on default branch",
          {
            "file": "./test/data/chainlink/go.mod",
            "startLine": 348,
          },
        ],
        [
          "err: dependency not on default branch",
          {
            "file": "./test/data/chainlink/integration-tests/go.mod",
            "startLine": 497,
          },
        ],
        [
          "err: dependency not on default branch",
          {
            "file": "./test/data/chainlink/integration-tests/load/go.mod",
            "startLine": 497,
          },
        ],
        [
          "err: dependency not on default branch",
          {
            "file": "./test/data/chainlink/go.mod",
            "startLine": 84,
          },
        ],
        [
          "err: dependency not on default branch",
          {
            "file": "./test/data/chainlink/core/scripts/go.mod",
            "startLine": 280,
          },
        ],
        [
          "err: dependency not on default branch",
          {
            "file": "./test/data/chainlink/integration-tests/go.mod",
            "startLine": 386,
          },
        ],
        [
          "err: dependency not on default branch",
          {
            "file": "./test/data/chainlink/integration-tests/load/go.mod",
            "startLine": 379,
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

      1. Dependency not on default branch - Check for the dependency's commit on the upstream repository and use one of the commits from the default branch of the upstream repository.

      e.g., 
      - For dependency github.com/smartcontractkit/grpc-proxy@v0.1.0, upstream repository is \`github.com/smartcontractkit/grpc-proxy\` and \`v0.1.0\` is the tag that produced the dependency, which isn't created from the default branch.
        Update it to use one of the tags from the default repository using \`go mod tidy\`.
      - For dependency github.com/smartcontractkit/go-plugin@v0.0.0-20240208201424-b3b91517de16, upstream repository is \`github.com/smartcontractkit/go-plugin\` and \`b3b91517de16\` is the commit that produced the dependency, which isn't on the default branch.
        Update it to use one of the commits from the default repository using \`go mod tidy\`. Ideally we should update it to use a tag like the example above.

      </details>

      "
    `);
  });

  it("crib - should match snapshot", { timeout: 100_000 }, async () => {
    setup("crib");
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
      const summary = await run();

      expect(annotationSpy.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "err: dependency not on default branch",
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

        1. Dependency not on default branch - Check for the dependency's commit on the upstream repository and use one of the commits from the default branch of the upstream repository.

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