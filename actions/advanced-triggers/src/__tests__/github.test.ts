import { vi, describe, test, expect } from "vitest";

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  debug: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

import { getChangedFilesForMergeGroup, type OctokitType } from "../github";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOctokit(
  paginateImpl: OctokitType["paginate"] = vi.fn(),
): OctokitType {
  return {
    paginate: paginateImpl,
    rest: {
      repos: {
        compareCommits: vi.fn(),
      },
    },
  } as unknown as OctokitType;
}

// ---------------------------------------------------------------------------
// getChangedFilesForMergeGroup
// ---------------------------------------------------------------------------

describe("getChangedFilesForMergeGroup", () => {
  test("returns filenames from compareCommits", async () => {
    const octokit = makeOctokit(
      vi.fn().mockResolvedValue(["src/foo.ts", "src/bar.ts"]),
    );

    const files = await getChangedFilesForMergeGroup(
      octokit,
      "smartcontractkit",
      ".github",
      "base-sha",
      "head-sha",
    );

    expect(octokit.paginate).toHaveBeenCalledWith(
      octokit.rest.repos.compareCommits,
      {
        owner: "smartcontractkit",
        repo: ".github",
        base: "base-sha",
        head: "head-sha",
        per_page: 100,
      },
      expect.any(Function),
    );
    expect(files).toEqual(["src/foo.ts", "src/bar.ts"]);
  });

  test("returns all files from octokit.paginate", async () => {
    const octokit = makeOctokit(
      vi
        .fn()
        .mockResolvedValue([
          "src/foo.ts",
          "src/bar.ts",
          "src/baz.ts",
          "src/qux.ts",
        ]),
    );

    const files = await getChangedFilesForMergeGroup(
      octokit,
      "smartcontractkit",
      ".github",
      "base-sha",
      "head-sha",
    );

    expect(files).toEqual([
      "src/foo.ts",
      "src/bar.ts",
      "src/baz.ts",
      "src/qux.ts",
    ]);
  });

  test("returns empty array when no files changed", async () => {
    const octokit = makeOctokit(vi.fn().mockResolvedValue([]));

    const files = await getChangedFilesForMergeGroup(
      octokit,
      "smartcontractkit",
      ".github",
      "base-sha",
      "head-sha",
    );

    expect(files).toEqual([]);
  });

  test("extracts filenames from response data", async () => {
    const paginate = vi.fn().mockImplementation((endpoint, params, mapFn) => {
      const mapped = mapFn({
        data: { files: [{ filename: "mapped/file.ts" }] },
      });
      return Promise.resolve(mapped);
    });
    const octokit = makeOctokit(paginate);

    const files = await getChangedFilesForMergeGroup(
      octokit,
      "smartcontractkit",
      ".github",
      "base-sha",
      "head-sha",
    );

    expect(files).toEqual(["mapped/file.ts"]);
  });
});
