import * as path from "path";
import * as fs from "fs";

import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { execa } from "execa";

import * as core from "@actions/core";

import { ExecaErrorMockRun } from "../helper/execa-error-mock.js";
import {
  trimOutputLogs,
  runConcurrent,
  runTestBinary,
  validateRunResultsOrThrow,
  RunResult,
} from "../../src/pipeline/run.js";
import { DiffedHashedCompiledPackages, GoPackage } from "../../src/pipeline.js";

// Mock execa
vi.mock("execa", async (importOriginal) => {
  const actualExeca = await importOriginal<typeof import("execa")>();
  return {
    ...actualExeca,
    execa: vi.fn(),
  };
});

// Mock filesystem operations
vi.mock("fs", () => ({
  mkdirSync: vi.fn(),
  createWriteStream: vi.fn(() => ({
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
  })),
}));

// Mock @actions/core
vi.mock("@actions/core", () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  setFailed: vi.fn(),
  isDebug: vi.fn(() => false),
}));

// Import the mocked modules
const execaMock = execa as unknown as Mock;
const mkdirSyncMock = fs.mkdirSync as unknown as Mock;

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
    const results = await runConcurrent("./", packages, [], "", 1);

    expect(results).toEqual([]);
  });
});

describe("runTestBinary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should execute test binary successfully wo/ coverage", async () => {
    // Arrange
    const outputDir = "/output";
    const pkg: GoPackage = {
      importPath: "github.com/example/pkg",
      directory: "/path/to/pkg",
    };
    const binaryPath = "/path/to/binary";
    const runFlags = ["-foo", "-bar"];

    const executionResult = {
      command: "test command",
      exitCode: 0,
      stdout: "test output",
      stderr: "",
      all: "test output",
      failed: false,
      timedOut: false,
      isCanceled: false,
      killed: false,
      durationMs: 100,
      pipe: vi.fn(),
    };
    execaMock.mockResolvedValue(executionResult);

    // Act
    const result = await runTestBinary(
      outputDir,
      pkg,
      binaryPath,
      runFlags,
      "",
    );

    // Assert
    expect(mkdirSyncMock).not.toHaveBeenCalled();
    expect(execaMock).toHaveBeenCalledWith(
      binaryPath,
      ["-foo", "-bar"],
      expect.objectContaining({
        cwd: pkg.directory,
      }),
    );
    expect(result).toEqual({
      pkg,
      execution: executionResult,
      output: {
        log: expect.stringContaining("binary.run.log"),
      },
    });
  });

  it("should execute test binary successfully w/ coverage", async () => {
    // Arrange
    const outputDir = "/output";
    const pkg: GoPackage = {
      importPath: "github.com/example/pkg",
      directory: "/path/to/pkg",
    };
    const binaryPath = "/path/to/binary";
    const runFlags = [];
    const coverageDir = "/coverage";

    const executionResult = {
      command: "test command",
      exitCode: 0,
      stdout: "test output",
      stderr: "",
      all: "test output",
      failed: false,
      timedOut: false,
      isCanceled: false,
      killed: false,
      durationMs: 100,
      pipe: vi.fn(),
    };
    execaMock.mockResolvedValue(executionResult);

    // Act
    const result = await runTestBinary(
      outputDir,
      pkg,
      binaryPath,
      runFlags,
      coverageDir,
    );

    // Assert
    expect(mkdirSyncMock).toHaveBeenCalled();
    expect(execaMock).toHaveBeenCalledWith(
      binaryPath,
      ["-test.coverprofile=/coverage/binary.cover.out"],
      expect.objectContaining({
        cwd: pkg.directory,
        env: expect.objectContaining({
          GOCOVERDIR: expect.stringContaining("go-cover-binary"),
        }),
      }),
    );
    expect(result).toEqual({
      pkg,
      execution: executionResult,
      output: {
        log: expect.stringContaining("binary.run.log"),
        coverage: expect.stringContaining("binary.cover.out"),
      },
    });
  });

  it("should handle ExecaError correctly", async () => {
    // Arrange
    const outputDir = "/output";
    const pkg: GoPackage = {
      importPath: "github.com/example/pkg",
      directory: "/path/to/pkg",
    };
    const binaryPath = "/path/to/binary";
    const execaErrorMock = new ExecaErrorMockRun(
      "error stdout",
      "error stderr",
    );
    execaMock.mockRejectedValue(execaErrorMock);

    // Act
    const result = await runTestBinary(outputDir, pkg, binaryPath, [], "");

    // Assert
    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining(
        "Failed to run test for package github.com/example/pkg",
      ),
    );
    expect(result).toMatchObject({
      output: {
        log: expect.stringContaining("binary.run.log"),
      },
      pkg,
      error: execaErrorMock,
    });
  });

  it("should rethrow unexpected errors", async () => {
    // Arrange
    const outputDir = "/output";
    const pkg: GoPackage = {
      importPath: "github.com/example/pkg",
      directory: "/path/to/pkg",
    };
    const binaryPath = "/path/to/binary";
    const testError = new Error("Unexpected error");
    execaMock.mockRejectedValue(testError);

    // Act & Assert
    await expect(
      runTestBinary(outputDir, pkg, binaryPath, [], ""),
    ).rejects.toThrow("Unexpected error");
  });
});

describe("validateRunResultsOrThrow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw error when there are test failures", () => {
    // Arrange
    const packages: DiffedHashedCompiledPackages = {
      "github.com/example/pkg": {
        importPath: "github.com/example/pkg",
        directory: "/path/to/pkg",
        compile: {
          binary: "/path/to/binary",
          log: "/path/to/log",
          execution: {
            command: "test command",
            exitCode: 0,
            durationMs: 100,
            cwd: "/path/to/pkg",
          },
        },
        hash: "hash1",
        shouldRun: true,
      },
    };
    const results = [
      {
        output: {
          log: "/path/to/log",
          binary: "/path/to/binary",
        },
        pkg: {
          importPath: "github.com/example/pkg",
          directory: "/path/to/pkg",
        },
        error: new ExecaErrorMockRun("error stdout", "error stderr"),
      },
    ] satisfies RunResult[];

    // Act & Assert
    expect(() => validateRunResultsOrThrow(packages, results)).toThrow(
      "1 packages encountered errors.",
    );
  });

  it("should return executed packages when there are no failures", () => {
    // Arrange
    const packages: DiffedHashedCompiledPackages = {
      "github.com/example/pkg": {
        importPath: "github.com/example/pkg",
        directory: "/path/to/pkg",
        compile: {
          binary: "/path/to/binary",
          log: "/path/to/log",
          execution: {
            command: "test command",
            exitCode: 0,
            durationMs: 100,
            cwd: "/path/to/pkg",
          },
        },
        hash: "hash1",
        shouldRun: true,
      },
    };

    const executionResult = {
      command: "/path/to/binary",
      exitCode: 0,
      durationMs: 100,
      cwd: "/path/to/pkg",
      stdout: "",
      stderr: "",
      all: "",
      failed: false,
      timedOut: false,
      isCanceled: false,
      killed: false,
      pid: 1234,
    };

    const results = [
      {
        output: {
          log: "/path/to/log",
          coverage: "/path/to/coverage",
        },
        pkg: {
          importPath: "github.com/example/pkg",
          directory: "/path/to/pkg",
        },
        execution: executionResult as any,
      },
    ] satisfies RunResult[];

    // Act
    const executedPackages = validateRunResultsOrThrow(packages, results);

    // Assert
    expect(executedPackages).toHaveProperty("github.com/example/pkg");
    expect(executedPackages["github.com/example/pkg"]).toHaveProperty("run");
    expect(executedPackages["github.com/example/pkg"].run).toMatchObject({
      log: "/path/to/log",
      coverage: "/path/to/coverage",
      execution: {
        command: "/path/to/binary",
        exitCode: 0,
        durationMs: 100,
        cwd: "/path/to/pkg",
      },
    });
  });
});

describe("trimOutputLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not trim logs under 1000 lines", () => {
    const lines = Array.from({ length: 999 }, (_, i) => `Line ${i + 1}`);
    const input = lines.join("\n");
    const result = trimOutputLogs(input);
    expect(result).toBe(input);
  });

  it("should trim logs over 1000 lines", () => {
    const lines = Array.from({ length: 1500 }, (_, i) => `Line ${i + 1}`);
    const input = lines.join("\n");
    const result = trimOutputLogs(input);
    const resultLines = result.split("\n");

    // Check the structure of the trimmed output
    expect(resultLines.length).toBe(1001); // 300 + 1 + 700 lines
    expect(resultLines[0]).toBe("Line 1"); // First line
    expect(resultLines[299]).toBe("Line 300"); // Last line of first section
    expect(resultLines[300]).toBe("... 500 lines ..."); // Separator with count
    expect(resultLines[301]).toBe("Line 801"); // First line of last section
    expect(resultLines[1000]).toBe("Line 1500"); // Last line
  });
});
