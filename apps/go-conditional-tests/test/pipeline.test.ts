import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import * as core from "@actions/core";
import * as github from "@actions/github";

import { Inputs } from "../src/main.js";
import { commitTestHashIndex } from "../src/github.js";
import {
  MaybeExecutedPackages,
  runTestBinaries,
  buildTestBinaries,
  maybeUpdateHashIndex,
} from "../src/pipeline.js";
import {
  compileConcurrent,
  validateCompilationResultsOrThrow,
} from "../src/pipeline/build.js";

import {
  runConcurrent,
  validateRunResultsOrThrow,
} from "../src/pipeline/run.js";

// Mock @actions/core
vi.mock("@actions/core", () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  setFailed: vi.fn(),
  getInput: vi.fn(),
  isDebug: vi.fn(() => false), // Set default return value to false
}));

// Change the github mock to use a getter/setter
vi.mock("@actions/github", () => ({
  context: {
    get ref() {
      return this._ref || "refs/heads/main";
    },
    set ref(value) {
      this._ref = value;
    },
    payload: {
      repository: {
        get default_branch() {
          return this._default_branch || "main";
        },
        set default_branch(value) {
          this._default_branch = value;
        },
      },
    },
    repo: {
      owner: "example-owner",
      repo: "example-repo",
    },
  },
}));

// Mock commitTestHashIndex
vi.mock("../src/github.js", () => ({
  commitTestHashIndex: vi.fn(),
}));

// Add new mocks at the top with other mocks
vi.mock("../src/pipeline/build.js", () => ({
  compileConcurrent: vi.fn(),
  validateCompilationResultsOrThrow: vi.fn(),
}));

vi.mock("../src/pipeline/run.js", () => ({
  runConcurrent: vi.fn(),
  validateRunResultsOrThrow: vi.fn(),
}));

describe("maybeUpdateHashIndex", () => {
  const mockInputs = {
    collectCoverage: false,
    forceUpdateIndex: false,
    hashesBranch: "test-hashes",
    hashesFile: "test-suite.json",
  } as Inputs;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip update when coverage is enabled in inputs", async () => {
    // Arrange
    const packages = {} as MaybeExecutedPackages;
    const inputs = { ...mockInputs, collectCoverage: true };

    // Act
    await maybeUpdateHashIndex(inputs, packages);

    // Assert
    expect(core.warning).toHaveBeenCalledWith(
      "Coverage collection was enabled. Skipping hash index update.",
    );
    expect(commitTestHashIndex).not.toHaveBeenCalled();
  });

  it("should skip update when packages have coverage results", async () => {
    // Arrange
    const packages: MaybeExecutedPackages = {
      "github.com/example/pkg": {
        importPath: "github.com/example/pkg",
        directory: "/path/to/pkg",
        hash: "hash1",
        compile: {
          binary: "binary1",
          log: "log1",
          execution: {
            command: "cmd1",
            exitCode: 0,
            cwd: "/path/to/pkg",
            durationMs: 100,
          },
        },
        run: {
          log: "run1",
          coverage: "coverage1", // This indicates coverage was collected
          execution: {
            command: "cmd1",
            exitCode: 0,
            cwd: "/path/to/pkg",
            durationMs: 100,
          },
        },
      },
    };

    // Act
    await maybeUpdateHashIndex(mockInputs, packages);
    expect(commitTestHashIndex).not.toHaveBeenCalled();
  });

  it("should skip update when not on default branch", async () => {
    // Arrange
    github.context.ref = "refs/heads/feature";

    const packages: MaybeExecutedPackages = {
      "github.com/example/pkg": {
        importPath: "github.com/example/pkg",
        directory: "/path/to/pkg",
        hash: "hash1",
        compile: {
          binary: "binary1",
          log: "log1",
          execution: {
            command: "cmd1",
            exitCode: 0,
            cwd: "/path/to/pkg",
            durationMs: 100,
          },
        },
      },
    };

    // Act
    await maybeUpdateHashIndex(mockInputs, packages);

    expect(commitTestHashIndex).not.toHaveBeenCalled();
  });

  it("should update index when force update is enabled, and on feature branch", async () => {
    github.context.ref = "refs/heads/feature";

    // Arrange
    const packages: MaybeExecutedPackages = {
      "github.com/example/pkg": {
        importPath: "github.com/example/pkg",
        directory: "/path/to/pkg",
        hash: "hash1",
        compile: {
          binary: "binary1",
          log: "log1",
          execution: {
            command: "cmd1",
            exitCode: 0,
            cwd: "/path/to/pkg",
            durationMs: 100,
          },
        },
      },
    };
    const inputs = { ...mockInputs, forceUpdateIndex: true };

    // Act
    await maybeUpdateHashIndex(inputs, packages);

    // Assert
    expect(core.warning).toHaveBeenCalledWith(
      "Force update index is enabled. Skipping branch check.",
    );
    expect(commitTestHashIndex).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      inputs.hashesBranch,
      inputs.hashesFile,
      { "github.com/example/pkg": "hash1" },
    );
  });

  it("should update hash index when on default branch", async () => {
    // Arrange
    github.context.ref = "refs/heads/main";

    const packages: MaybeExecutedPackages = {
      "github.com/example/pkg": {
        importPath: "github.com/example/pkg",
        directory: "/path/to/pkg",
        hash: "hash1",
        run: {
          log: "run1",
          coverage: "",
          execution: {
            command: "cmd1",
            exitCode: 0,
            cwd: "/path/to/pkg",
            durationMs: 100,
          },
        },
        compile: {
          binary: "binary1",
          log: "log1",
          execution: {
            command: "cmd1",
            exitCode: 0,
            cwd: "/path/to/pkg",
            durationMs: 100,
          },
        },
      },
      "github.com/example/pkg/duplicate": {
        importPath: "github.com/example/pkg", // Duplicate importPath
        directory: "/path/to/pkg/duplicate",
        hash: "hash2",
        compile: {
          binary: "binary2",
          log: "log2",
          execution: {
            command: "cmd2",
            exitCode: 0,
            cwd: "/path/to/pkg/duplicate",
            durationMs: 100,
          },
        },
      },
    };
    const inputs = { ...mockInputs };

    // Act
    await maybeUpdateHashIndex(inputs, packages);

    // Assert
    expect(commitTestHashIndex).toHaveBeenCalledWith(
      "example-owner",
      "example-repo",
      inputs.hashesBranch,
      inputs.hashesFile,
      {
        "github.com/example/pkg": "hash1",
        "github.com/example/pkg/duplicate": "hash2",
      },
    );
  });
});

describe("buildTestBinaries", () => {
  const mockInputs = {
    moduleDirectory: "/path/to/module",
    buildDirectory: "/path/to/build",
    buildFlags: ["-foo"],
    collectCoverage: false,
    maxBuildConcurrency: 1,
  } as Inputs;

  const mockPackages = {
    pkg1: { importPath: "pkg1", directory: "/path/pkg1" },
    pkg2: { importPath: "pkg2", directory: "/path/pkg2" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (compileConcurrent as Mock).mockResolvedValue({});
    (validateCompilationResultsOrThrow as Mock).mockReturnValue({});
  });

  it("should call compile without coverage flags when coverage is disabled", async () => {
    await buildTestBinaries(mockInputs, mockPackages);

    expect(compileConcurrent).toHaveBeenCalledWith(
      mockInputs.moduleDirectory,
      mockInputs.buildDirectory,
      mockPackages,
      ["-foo"],
      mockInputs.maxBuildConcurrency,
    );
  });

  it("should add coverage flags when coverage is enabled", async () => {
    const inputs = {
      ...mockInputs,
      collectCoverage: true,
      maxBuildConcurrency: 1,
    };

    await buildTestBinaries(inputs, mockPackages);

    expect(compileConcurrent).toHaveBeenCalledWith(
      inputs.moduleDirectory,
      inputs.buildDirectory,
      mockPackages,
      ["-foo", "-cover", "-coverpkg=./...", "-covermode=atomic"],
      mockInputs.maxBuildConcurrency,
    );
  });
});

describe("runTestBinaries", () => {
  const mockInputs = {
    buildDirectory: "/path/to/build",
    collectCoverage: false,
    coverageDirectory: "",
    maxRunConcurrency: 1,
  } as Inputs;

  const mockPackages = {
    pkg1: {
      importPath: "pkg1",
      directory: "/path/pkg1",
      hash: "hash1",
      shouldRun: true,
      compile: { binary: "bin1", log: "log1", execution: {} as any },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (runConcurrent as Mock).mockResolvedValue({});
    (validateRunResultsOrThrow as Mock).mockReturnValue({});
    (core.isDebug as Mock).mockReturnValue(false); // Reset isDebug to false before each test
  });

  it("should call run without coverage directory when coverage is disabled", async () => {
    await runTestBinaries(mockInputs, mockPackages);

    expect(runConcurrent).toHaveBeenCalledWith(
      mockInputs.buildDirectory,
      mockPackages,
      expect.not.arrayContaining(["-test.v"]),
      "",
      mockInputs.maxRunConcurrency,
    );
  });

  it("should pass coverage directory when coverage is enabled", async () => {
    const inputs = {
      ...mockInputs,
      collectCoverage: true,
      coverageDirectory: "/path/to/coverage",
    };

    await runTestBinaries(inputs, mockPackages);

    expect(runConcurrent).toHaveBeenCalledWith(
      inputs.buildDirectory,
      mockPackages,
      expect.not.arrayContaining(["-test.v"]),
      "/path/to/coverage",
      mockInputs.maxRunConcurrency,
    );
  });

  it("should call run without -test.v flag when debug is disabled", async () => {
    (core.isDebug as Mock).mockReturnValue(false);

    await runTestBinaries(mockInputs, mockPackages);

    expect(runConcurrent).toHaveBeenCalledWith(
      mockInputs.buildDirectory,
      mockPackages,
      expect.not.arrayContaining(["-test.v"]),
      "",
      mockInputs.maxRunConcurrency,
    );
  });

  it("should add -test.v flag when debug is enabled", async () => {
    (core.isDebug as Mock).mockReturnValue(true);

    await runTestBinaries(mockInputs, mockPackages);

    expect(runConcurrent).toHaveBeenCalledWith(
      mockInputs.buildDirectory,
      mockPackages,
      expect.arrayContaining(["-test.v"]),
      "",
      mockInputs.maxRunConcurrency,
    );
  });
});
