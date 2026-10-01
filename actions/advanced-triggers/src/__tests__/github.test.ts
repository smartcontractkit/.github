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

function makeOctokit(compareCommitsImpl = vi.fn()): OctokitType {
  return {
    paginate: vi.fn(),
    rest: {
      repos: {
        compareCommits: compareCommitsImpl,
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
      vi.fn().mockResolvedValue({
        data: {
          files: [{ filename: "src/foo.ts" }, { filename: "src/bar.ts" }],
        },
      }),
    );

    const files = await getChangedFilesForMergeGroup(
      octokit,
      "smartcontractkit",
      ".github",
      "base-sha",
      "head-sha",
    );

    expect(octokit.rest.repos.compareCommits).toHaveBeenCalledWith({
      owner: "smartcontractkit",
      repo: ".github",
      base: "base-sha",
      head: "head-sha",
      per_page: 100,
    });
    expect(files).toEqual(["src/foo.ts", "src/bar.ts"]);
  });

  test("throws when files property is undefined", async () => {
    const octokit = makeOctokit(
      vi.fn().mockResolvedValue({
        data: {},
      }),
    );

    await expect(
      getChangedFilesForMergeGroup(
        octokit,
        "smartcontractkit",
        ".github",
        "base-sha",
        "head-sha",
      ),
    ).rejects.toThrow(
      "GitHub compareCommits API did not return a files list for base-sha...head-sha",
    );
  });

  test("throws when files count reaches or exceeds 300 limit", async () => {
    const fakeFiles = Array.from({ length: 300 }, (_, i) => ({
      filename: `file_${i}.ts`,
    }));
    const octokit = makeOctokit(
      vi.fn().mockResolvedValue({
        data: { files: fakeFiles },
      }),
    );

    await expect(
      getChangedFilesForMergeGroup(
        octokit,
        "smartcontractkit",
        ".github",
        "base-sha",
        "head-sha",
      ),
    ).rejects.toThrow(
      "GitHub compareCommits returned 300 files (hit 300 limit)",
    );
  });
});
