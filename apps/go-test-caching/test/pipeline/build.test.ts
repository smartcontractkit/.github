// test/pipeline/build.test.ts
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { LocalPackages, GoPackage } from "../../src/pipeline/index.js";
import {
  CompilationSuccess,
  compileTestBinary,
  compileConcurrent,
  validateCompilationResultsOrThrow,
  verifyBinaryExistsOrThrow,
} from "../../src/pipeline/build.js";
import * as buildModule from "../../src/pipeline/build.js";
import { execa } from "execa";
import { ExecaErrorMock } from "../helper/execa-error-mock.js";
import * as fs from "fs";
import * as core from "@actions/core";

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
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
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
const existsSyncMock = fs.existsSync as unknown as Mock;
const readdirSyncMock = fs.readdirSync as unknown as Mock;
// No need to assign createWriteStreamMock as we don't use it directly
// const createWriteStreamMock = fs.createWriteStream as unknown as vi.Mock;
const coreMock = core as any as Mock;

describe("compileTestBinary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call execa with correct parameters", async () => {
    // Arrange
    const pkg: GoPackage = {
      importPath: "github.com/example/pkg",
      directory: "/path/to/pkg",
    };
    const workingDir = "/working/dir";
    const outputDir = "/output/dir";
    const executionResult = {
      command: "go test -c -o binary -vet=off github.com/example/pkg",
      exitCode: 0,
      stdout: "some stdout",
      stderr: "",
      all: "some stdout",
      failed: false,
      timedOut: false,
      isCanceled: false,
      killed: false,
      durationMs: 100,
      pid: 1234,
    };
    execaMock.mockResolvedValue(executionResult);

    // Act
    const result = await compileTestBinary(workingDir, outputDir, pkg);

    // Assert
    expect(execaMock).toHaveBeenCalledWith(
      "go",
      ["test", "-c", "-o", expect.any(String), "-vet=off", pkg.importPath],
      {
        cwd: workingDir,
        stdout: "pipe",
        stderr: "pipe",
        all: true,
      },
    );
    expect(result).toHaveProperty("execution", executionResult);
    expect(result).toHaveProperty("pkg", pkg);
  });

  it("should handle ExecaError correctly", async () => {
    // Arrange
    const pkg: GoPackage = {
      importPath: "github.com/example/pkg",
      directory: "/path/to/pkg",
    };
    const workingDir = "/working/dir";
    const outputDir = "/output/dir";
    const execaErrorMock = new ExecaErrorMock("error stdout", "error stderr");
    execaMock.mockRejectedValue(execaErrorMock);

    // Act
    const result = await compileTestBinary(workingDir, outputDir, pkg);

    // Assert
    expect(core.setFailed).toHaveBeenCalledWith(
      `Failed to compile test for package ${pkg.importPath}`,
    );
    expect(result).toHaveProperty("error", execaErrorMock);
    expect(result).toHaveProperty("pkg", pkg);
  });

  it("should rethrow unexpected errors", async () => {
    // Arrange
    const pkg: GoPackage = {
      importPath: "github.com/example/pkg",
      directory: "/path/to/pkg",
    };
    const workingDir = "/working/dir";
    const outputDir = "/output/dir";
    const testError = new Error("Unexpected error");
    execaMock.mockRejectedValue(testError);

    // Act & Assert
    await expect(compileTestBinary(workingDir, outputDir, pkg)).rejects.toThrow(
      "Unexpected error",
    );
  });
});

describe("validateCompilationResultsOrThrow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw error when there are compilation failures", () => {
    // Arrange
    const buildDir = "/build/dir";
    const failures = [
      {
        output: {
          binary: "/path/to/binary",
          log: "/path/to/log",
        },
        pkg: {
          importPath: "github.com/example/pkg",
          directory: "/path/to/pkg",
        },
        error: new ExecaErrorMock("error stdout", "error stderr"),
      },
    ];

    // Act & Assert
    expect(() => validateCompilationResultsOrThrow(buildDir, failures)).toThrow(
      "Failed to compile test binaries",
    );
    expect(core.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to compile test for package"),
    );
  });

  it("should return compiled packages when there are no failures", () => {
    // Arrange
    const buildDir = "/build/dir";
    const success: CompilationSuccess = {
      output: {
        binary: "/build/dir/github.com-example-pkg-test",
        log: "/path/to/log",
      },
      pkg: {
        importPath: "github.com/example/pkg",
        directory: "/path/to/pkg",
      },
      execution: {
        command:
          "go test -c -o /path/to/binary -vet=off github.com/example/pkg",
        exitCode: 0,
        durationMs: 123,
        cwd: "/working/dir",
        stdout: "",
        stderr: "",
        all: "",
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
        pid: 1234,
      } as any,
    };

    readdirSyncMock.mockReturnValue(["github.com-example-pkg-test"]);
    existsSyncMock.mockReturnValue(true);

    // Act
    const compiledPackages = validateCompilationResultsOrThrow(buildDir, [
      success,
    ]);

    // Assert
    expect(Object.keys(compiledPackages)).toHaveLength(1);
    expect(compiledPackages).toHaveProperty("github.com/example/pkg");
  });
});

describe("verifyBinaryExistsOrThrow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when binary exists", () => {
    // Arrange
    existsSyncMock.mockReturnValue(true);
    const binaryPath = "/path/to/binary";
    const importPath = "github.com/example/pkg";
    const stdout = "";

    // Act
    const result = verifyBinaryExistsOrThrow(binaryPath, importPath, stdout);

    // Assert
    expect(result).toBe(true);
  });

  it("should return false when binary does not exist but stdout indicates no test files", () => {
    // Arrange
    existsSyncMock.mockReturnValue(false);
    const binaryPath = "/path/to/binary";
    const importPath = "github.com/example/pkg";
    const stdout = "?       github.com/example/pkg   [no test files]";

    // Act
    const result = verifyBinaryExistsOrThrow(binaryPath, importPath, stdout);

    // Assert
    expect(result).toBe(false);
  });

  it("should throw error when binary does not exist and stdout does not indicate no test files", () => {
    // Arrange
    existsSyncMock.mockReturnValue(false);
    const binaryPath = "/path/to/binary";
    const importPath = "github.com/example/pkg";
    const stdout = "";

    // Act & Assert
    expect(() =>
      verifyBinaryExistsOrThrow(binaryPath, importPath, stdout),
    ).toThrow(
      `Binary not found when expected. Package: ${importPath} , Binary: ${binaryPath}`,
    );
  });
});
