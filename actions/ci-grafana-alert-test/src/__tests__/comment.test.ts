import * as core from "@actions/core";
import { describe, expect, it, vi } from "vitest";

import {
  SUMMARY_COMMENT_MARKER,
  upsertSummaryComment,
  type Octokit,
} from "../comment";

vi.mock("@actions/core", () => ({ warning: vi.fn() }));

function mockOctokit(comments: Array<{ id: number; body?: string }> = []) {
  const updateComment = vi.fn().mockResolvedValue({});
  const createComment = vi.fn().mockResolvedValue({});
  const paginate = vi.fn().mockResolvedValue(comments);
  const octokit = {
    paginate,
    rest: { issues: { listComments: vi.fn(), updateComment, createComment } },
  };
  return {
    octokit: octokit as unknown as Octokit,
    paginate,
    updateComment,
    createComment,
  };
}

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
