import { describe, it, expect, vi, beforeEach, Mock } from "vitest";

import * as path from "path";
import { readFileSync } from "fs";

import { filterOutputLogs, runConcurrent } from "../../src/pipeline/run.js";
import { DiffedHashedCompiledPackages } from "../../src/pipeline/index.js";

vi.mock("@actions/core", () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  setFailed: vi.fn(),
  isDebug: vi.fn(() => false),
}));

describe.skip("filterOutputLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should filter out logs", () => {
    // get mock data from reading file data/error.run.log
    const dataPath = path.join(__dirname, "data/error-2.run.log");
    const logData = readFileSync(dataPath, "utf-8");

    const output = filterOutputLogs(logData);
    console.log(output);
  });
});

describe("runConcurrent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should run nothing when all shouldRun is false", async () => {
    const packages: DiffedHashedCompiledPackages = {
      "package/1": {
        importPath: "package/1",
        directory: "package/1",
        compile: {
          binary: "package-1",
          log: "package-1.out",
          execution: {
            command: "package/1",
            exitCode: 0,
            durationMs: 0,
            cwd: "package/1",
          },
        },
        shouldRun: false,
        hash: "hash/1",
        indexHash: "hash/1",
      },
    };
    const results = await runConcurrent("./", packages, [], false, "", 1);

    expect(results).toEqual([]);
  });
});
