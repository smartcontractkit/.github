import { describe, it, expect, vi, beforeEach } from "vitest";
import * as core from "@actions/core";
import * as github from "@actions/github";
import * as cache from "@actions/cache";
import * as fs from "fs";

import { getTestHashIndex, saveTestHashIndex } from "../src/github.js";

// Mock dependencies
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  debug: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("@actions/cache", () => ({
  restoreCache: vi.fn(),
  saveCache: vi.fn(),
  ReserveCacheError: class ReserveCacheError extends Error {},
}));

vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

// Setup github context mock
vi.mock("@actions/github", () => ({
  context: {
    ref: "refs/heads/feature",
    sha: "abcdef1234567890",
    payload: {
      pull_request: undefined,
      repository: {
        default_branch: "main",
      },
    },
  },
}));

describe("getTestHashIndex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty object when no cache hit", async () => {
    (cache.restoreCache as any).mockResolvedValue(null);

    const result = await getTestHashIndex("unit");

    expect(result).toEqual({});
    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining("No cache hit"),
    );
  });

  it("should handle PR context with target branch", async () => {
    // @ts-expect-error - mock partial payload
    vi.mocked(github.context.payload, { partial: true }).pull_request = {
      base: { ref: "main" },
    };
    (cache.restoreCache as any).mockResolvedValue("some-cache-key");
    (fs.promises.readFile as any).mockResolvedValue('{"pkg1": "hash1"}');

    await getTestHashIndex("unit");

    expect(cache.restoreCache).toHaveBeenCalledWith(
      ["unit.json"],
      expect.stringContaining("go-test-hashes-unit-feature"),
      expect.arrayContaining([
        "go-test-hashes-unit-feature",
        "go-test-hashes-unit-main",
        "go-test-hashes-unit-main",
      ]),
    );
  });

  it("should handle file read errors", async () => {
    (cache.restoreCache as any).mockResolvedValue("some-cache-key");
    (fs.promises.readFile as any).mockRejectedValue(new Error("read error"));

    const result = await getTestHashIndex("unit");

    expect(result).toEqual({});
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining("Error reading cache file"),
    );
  });
});

describe("saveTestHashIndex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should save cache with commit SHA", async () => {
    const hashes = { pkg1: "hash1" };

    await saveTestHashIndex("unit", hashes);

    // Check file was written
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      "unit.json",
      JSON.stringify(hashes, null, 2),
    );

    // Check cache was saved with correct key
    expect(cache.saveCache).toHaveBeenCalledWith(
      ["unit.json"],
      "go-test-hashes-unit-feature-abcdef1",
    );
  });

  it("should handle cache reservation errors", async () => {
    (cache.saveCache as any).mockRejectedValue(
      new cache.ReserveCacheError("already reserved"),
    );

    await saveTestHashIndex("unit", { pkg1: "hash1" });

    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining("Cache already reserved"),
    );
  });

  it("should throw non-reservation errors", async () => {
    (cache.saveCache as any).mockRejectedValue(new Error("network error"));

    await expect(saveTestHashIndex("unit", { pkg1: "hash1" })).rejects.toThrow(
      "network error",
    );
  });
});
