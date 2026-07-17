import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@actions/core", () => ({
  startGroup: vi.fn(),
  endGroup: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  debug: vi.fn(),
  setFailed: vi.fn(),
  setOutput: vi.fn(),
  getInput: vi.fn(),
}));

vi.mock("@actions/github", () => {
  const context = {
    eventName: "pull_request",
    repo: { owner: "smartcontractkit", repo: "chainlink-common" },
    payload: { pull_request: { number: 42 } },
  };
  return {
    context,
    getOctokit: vi.fn(() => ({ rest: {} })),
  };
});

vi.mock("../github", () => ({
  getPullRequestBody: vi.fn(),
  resolveRefToSha: vi.fn(),
}));

vi.mock("../sigscanner", () => ({
  verifyCommit: vi.fn(),
}));

import * as core from "@actions/core";
import * as gh from "@actions/github";

import { run } from "../run";
import { getPullRequestBody, resolveRefToSha } from "../github";
import { verifyCommit } from "../sigscanner";

const setInput = (map: Record<string, string>) => {
  vi.mocked(core.getInput).mockImplementation(
    (name: string) => map[name] ?? "",
  );
};

const CORE_SHA = "a".repeat(40);
const SOLANA_SHA = "b".repeat(40);
const STARKNET_SHA = "c".repeat(40);

beforeEach(() => {
  vi.clearAllMocks();
  // Reset event context to pull_request for each test (individual tests may override).
  (gh.context as unknown as { eventName: string }).eventName = "pull_request";
  setInput({
    "github-token": "ghs_test",
    "sigscanner-url": "https://sigscanner.example.com/verify",
    "sigscanner-api-key": "secret",
  });
});

describe("run", () => {
  test("emits default refs and does not fetch PR when event is not pull_request", async () => {
    (gh.context as unknown as { eventName: string }).eventName = "push";

    await run();

    expect(getPullRequestBody).not.toHaveBeenCalled();
    expect(core.setFailed).not.toHaveBeenCalled();
    expect(core.setOutput).toHaveBeenCalledWith("core-ref", "develop");
    expect(core.setOutput).toHaveBeenCalledWith("solana-ref", "develop");
    expect(core.setOutput).toHaveBeenCalledWith("starknet-ref", "develop");
  });

  test("emits default refs when PR body is empty", async () => {
    vi.mocked(getPullRequestBody).mockResolvedValueOnce("");

    await run();

    expect(resolveRefToSha).not.toHaveBeenCalled();
    expect(verifyCommit).not.toHaveBeenCalled();
    expect(core.setFailed).not.toHaveBeenCalled();
    expect(core.setOutput).toHaveBeenCalledWith("core-ref", "develop");
    expect(core.setOutput).toHaveBeenCalledWith("solana-ref", "develop");
    expect(core.setOutput).toHaveBeenCalledWith("starknet-ref", "develop");
  });

  test("emits default refs when body has content but no override refs", async () => {
    vi.mocked(getPullRequestBody).mockResolvedValueOnce(
      "just a regular PR description with no ref overrides",
    );

    await run();

    expect(resolveRefToSha).not.toHaveBeenCalled();
    expect(verifyCommit).not.toHaveBeenCalled();
    expect(core.setFailed).not.toHaveBeenCalled();
    expect(core.setOutput).toHaveBeenCalledWith("core-ref", "develop");
    expect(core.setOutput).toHaveBeenCalledWith("solana-ref", "develop");
    expect(core.setOutput).toHaveBeenCalledWith("starknet-ref", "develop");
  });

  test("resolves each ref to a SHA, verifies, and sets outputs", async () => {
    vi.mocked(getPullRequestBody).mockResolvedValueOnce(
      "core ref: my-core\nsolana ref: my-solana\nstarknet ref: my-starknet",
    );
    vi.mocked(resolveRefToSha)
      .mockResolvedValueOnce(CORE_SHA)
      .mockResolvedValueOnce(SOLANA_SHA)
      .mockResolvedValueOnce(STARKNET_SHA);
    vi.mocked(verifyCommit).mockResolvedValue({
      ok: true,
      status: 200,
      body: "verified",
    });

    await run();

    expect(resolveRefToSha).toHaveBeenCalledTimes(3);
    expect(verifyCommit).toHaveBeenCalledTimes(3);
    expect(core.setFailed).not.toHaveBeenCalled();
    expect(core.setOutput).toHaveBeenCalledWith("core-ref", CORE_SHA);
    expect(core.setOutput).toHaveBeenCalledWith("solana-ref", SOLANA_SHA);
    expect(core.setOutput).toHaveBeenCalledWith("starknet-ref", STARKNET_SHA);
  });

  test("skips resolution when the extracted ref is already a full SHA", async () => {
    vi.mocked(getPullRequestBody).mockResolvedValueOnce(
      `core ref: ${CORE_SHA}`,
    );
    vi.mocked(resolveRefToSha)
      .mockResolvedValueOnce(SOLANA_SHA)
      .mockResolvedValueOnce(STARKNET_SHA);
    vi.mocked(verifyCommit).mockResolvedValue({
      ok: true,
      status: 200,
      body: "ok",
    });

    await run();

    // core-ref already a full SHA → not resolved, but solana + starknet defaults still resolve
    expect(resolveRefToSha).toHaveBeenCalledTimes(2);
    expect(verifyCommit).toHaveBeenCalledTimes(3);
    expect(core.setOutput).toHaveBeenCalledWith("core-ref", CORE_SHA);
  });

  test("fails the action when a ref is syntactically invalid", async () => {
    vi.mocked(getPullRequestBody).mockResolvedValueOnce("core ref: foo..bar");
    vi.mocked(resolveRefToSha).mockResolvedValue(SOLANA_SHA);
    vi.mocked(verifyCommit).mockResolvedValue({
      ok: true,
      status: 200,
      body: "ok",
    });

    await run();

    expect(core.setFailed).toHaveBeenCalledTimes(1);
    const msg = vi.mocked(core.setFailed).mock.calls[0][0] as string;
    expect(msg).toMatch(/core: invalid ref/i);
    // outputs should NOT be set when action fails
    expect(core.setOutput).not.toHaveBeenCalledWith(
      "core-ref",
      expect.anything(),
    );
  });

  test("fails when SigScanner rejects a commit and lists every failure", async () => {
    vi.mocked(getPullRequestBody).mockResolvedValueOnce(
      "core ref: my-core\nsolana ref: my-solana",
    );
    vi.mocked(resolveRefToSha)
      .mockResolvedValueOnce(CORE_SHA)
      .mockResolvedValueOnce(SOLANA_SHA)
      .mockResolvedValueOnce(STARKNET_SHA);
    vi.mocked(verifyCommit)
      .mockResolvedValueOnce({ ok: true, status: 200, body: "ok" })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        body: "not verified",
      })
      .mockResolvedValueOnce({ ok: true, status: 200, body: "ok" });

    await run();

    expect(core.setFailed).toHaveBeenCalledTimes(1);
    const msg = vi.mocked(core.setFailed).mock.calls[0][0] as string;
    expect(msg).toMatch(/solana: SigScanner rejected/);
    expect(msg).toMatch(/status 403/);
  });

  test("aggregates failures across multiple repos", async () => {
    vi.mocked(getPullRequestBody).mockResolvedValueOnce(
      "core ref: my-core\nsolana ref: foo..bar",
    );
    vi.mocked(resolveRefToSha)
      .mockResolvedValueOnce(CORE_SHA)
      .mockResolvedValueOnce(STARKNET_SHA);
    vi.mocked(verifyCommit)
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        body: "not verified",
      })
      .mockResolvedValueOnce({ ok: true, status: 200, body: "ok" });

    await run();

    expect(core.setFailed).toHaveBeenCalledTimes(1);
    const msg = vi.mocked(core.setFailed).mock.calls[0][0] as string;
    expect(msg).toMatch(/2 repo\(s\)/);
    expect(msg).toMatch(/core: SigScanner rejected/);
    expect(msg).toMatch(/solana: invalid ref/);
  });

  test("fails the action if resolving a ref throws", async () => {
    vi.mocked(getPullRequestBody).mockResolvedValueOnce(
      "core ref: nonexistent-branch",
    );
    vi.mocked(resolveRefToSha)
      .mockRejectedValueOnce(new Error("404 not found"))
      .mockResolvedValueOnce(SOLANA_SHA)
      .mockResolvedValueOnce(STARKNET_SHA);
    vi.mocked(verifyCommit).mockResolvedValue({
      ok: true,
      status: 200,
      body: "ok",
    });

    await run();

    expect(core.setFailed).toHaveBeenCalledTimes(1);
    const msg = vi.mocked(core.setFailed).mock.calls[0][0] as string;
    expect(msg).toMatch(/core: could not resolve/);
    expect(msg).toMatch(/404 not found/);
  });
});
