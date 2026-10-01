import * as core from "@actions/core";
import { describe, expect, it, vi } from "vitest";

import {
  findPullRequestNumber,
  SUMMARY_COMMENT_MARKER,
  upsertSummaryComment,
  type Octokit,
} from "../comment";

vi.mock("@actions/core", () => ({ warning: vi.fn() }));

function mockOctokit(paginateResult: unknown[] = []) {
  const updateComment = vi.fn().mockResolvedValue({});
  const createComment = vi.fn().mockResolvedValue({});
  const paginate = vi.fn().mockResolvedValue(paginateResult);
  const octokit = {
    paginate,
    rest: {
      issues: { listComments: vi.fn(), updateComment, createComment },
      repos: { listPullRequestsAssociatedWithCommit: vi.fn() },
    },
  };
  return {
    octokit: octokit as unknown as Octokit,
    paginate,
    updateComment,
    createComment,
  };
}

describe("findPullRequestNumber", () => {
  const sha = "abc123";
  const pullRequests = [
    { number: 1, state: "closed", head: { sha } },
    { number: 2, state: "open", head: { sha: "different" } },
    { number: 3, state: "open", head: { sha } },
  ];

  it("returns the open pull request whose head is the SHA", async () => {
    const { octokit } = mockOctokit(pullRequests);

    await expect(
      findPullRequestNumber(octokit, "org", "repo", sha),
    ).resolves.toBe(3);
  });

  it("ignores closed pull requests and heads with a different SHA", async () => {
    const { octokit } = mockOctokit([pullRequests[0], pullRequests[1]]);

    await expect(
      findPullRequestNumber(octokit, "org", "repo", sha),
    ).resolves.toBeUndefined();
  });

  it("returns undefined when no pull request matches", async () => {
    const { octokit } = mockOctokit([]);

    await expect(
      findPullRequestNumber(octokit, "org", "repo", sha),
    ).resolves.toBeUndefined();
  });

  it("paginates the associated pull requests with a full page size", async () => {
    const { octokit, paginate } = mockOctokit([]);

    await findPullRequestNumber(octokit, "org", "repo", sha);

    expect(paginate).toHaveBeenCalledWith(expect.anything(), {
      owner: "org",
      repo: "repo",
      commit_sha: sha,
      per_page: 100,
    });
  });
});

describe("upsertSummaryComment", () => {
  it("creates the comment when no marker comment exists", async () => {
    const { octokit, createComment, updateComment } = mockOctokit([
      { id: 1, body: "unrelated" },
    ]);

    await upsertSummaryComment(octokit, "org", "repo", 42, "summary body");

    expect(updateComment).not.toHaveBeenCalled();
    expect(createComment).toHaveBeenCalledWith({
      owner: "org",
      repo: "repo",
      issue_number: 42,
      body: `summary body\n\n${SUMMARY_COMMENT_MARKER}`,
    });
  });

  it("updates the existing marker comment instead of creating one", async () => {
    const { octokit, createComment, updateComment } = mockOctokit([
      { id: 7, body: `old\n${SUMMARY_COMMENT_MARKER}` },
    ]);

    await upsertSummaryComment(octokit, "org", "repo", 42, "new body");

    expect(createComment).not.toHaveBeenCalled();
    expect(updateComment).toHaveBeenCalledWith({
      owner: "org",
      repo: "repo",
      comment_id: 7,
      body: `new body\n\n${SUMMARY_COMMENT_MARKER}`,
    });
  });

  it("paginates comments with a full page size", async () => {
    const { octokit, paginate } = mockOctokit();

    await upsertSummaryComment(octokit, "org", "repo", 42, "body");

    expect(paginate).toHaveBeenCalledWith(expect.anything(), {
      owner: "org",
      repo: "repo",
      issue_number: 42,
      per_page: 100,
    });
  });

  it("truncates bodies above the comment size limit", async () => {
    const { octokit, createComment } = mockOctokit();

    await upsertSummaryComment(octokit, "org", "repo", 42, "a".repeat(70_000));

    const body = createComment.mock.calls[0][0].body as string;
    expect(body).toContain("summary truncated");
    expect(body.endsWith(SUMMARY_COMMENT_MARKER)).toBe(true);
  });

  it("warns instead of failing when the API call fails", async () => {
    const { octokit, paginate } = mockOctokit();
    paginate.mockRejectedValue(new Error("Resource not accessible"));

    await expect(
      upsertSummaryComment(octokit, "org", "repo", 42, "body"),
    ).resolves.toBeUndefined();
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining("Failed to upsert the PR summary comment"),
    );
  });
});
