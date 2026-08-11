import { vi, describe, test, expect, beforeEach } from "vitest";

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  debug: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../git", () => ({
  getChangedFilesGit: vi.fn(),
}));

import { getChangedFilesGit } from "../git";
import { getChangedFiles } from "../run";
import type { OctokitType } from "../github";
import type { MergeGroupEventData, PushEventData } from "../event";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeOctokit(
  paginateImpl: OctokitType["paginate"] = vi.fn(),
): OctokitType {
  return {
    paginate: paginateImpl,
    rest: {
      repos: {
        compareCommits: vi.fn(),
      },
      pulls: {
        listFiles: vi.fn(),
      },
    },
  } as unknown as OctokitType;
}

// ---------------------------------------------------------------------------
// getChangedFiles routing
// ---------------------------------------------------------------------------

describe("getChangedFiles routing", () => {
  test("merge_group uses compareCommits API and returns filenames", async () => {
    const octokit = makeOctokit(vi.fn().mockResolvedValue(["src/foo.ts"]));

    const event: MergeGroupEventData = {
      kind: "file-change",
      eventName: "merge_group",
      base: "base-sha",
      head: "head-sha",
    };

    const files = await getChangedFiles(
      octokit,
      { owner: "smartcontractkit", repo: ".github" },
      event,
      "/repo",
      "token",
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
    expect(files).toEqual(["src/foo.ts"]);
    expect(getChangedFilesGit).not.toHaveBeenCalled();
  });

  test("merge_group falls back to git when API fails", async () => {
    const octokit = makeOctokit(
      vi.fn().mockRejectedValue(new Error("API error")),
    );
    vi.mocked(getChangedFilesGit).mockResolvedValue(["src/fallback.ts"]);

    const event: MergeGroupEventData = {
      kind: "file-change",
      eventName: "merge_group",
      base: "base-sha",
      head: "head-sha",
    };

    const files = await getChangedFiles(
      octokit,
      { owner: "smartcontractkit", repo: ".github" },
      event,
      "/repo",
      "token",
    );

    expect(getChangedFilesGit).toHaveBeenCalledWith(
      "base-sha",
      "head-sha",
      "/repo",
      "token",
    );
    expect(files).toEqual(["src/fallback.ts"]);
  });

  test("push still uses git diff", async () => {
    const octokit = makeOctokit();
    vi.mocked(getChangedFilesGit).mockResolvedValue(["src/push.ts"]);

    const event: PushEventData = {
      kind: "file-change",
      eventName: "push",
      base: "before-sha",
      head: "after-sha",
    };

    const files = await getChangedFiles(
      octokit,
      { owner: "smartcontractkit", repo: ".github" },
      event,
      "/repo",
      "token",
    );

    expect(getChangedFilesGit).toHaveBeenCalledWith(
      "before-sha",
      "after-sha",
      "/repo",
      "token",
    );
    expect(files).toEqual(["src/push.ts"]);
  });
});
