import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import * as core from "@actions/core";
import * as github from "@actions/github";

import { Inputs } from "../src/main.js";
import { saveTestHashIndex } from "../src/github.js";
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
  saveTestHashIndex: vi.fn(),
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
    testSuite: "unit",
  } as Inputs;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip update when coverage is enabled in inputs", async () => {
    const packages = {} as MaybeExecutedPackages;
    const inputs = { ...mockInputs, collectCoverage: true };

    await maybeUpdateHashIndex(inputs, packages);

    expect(core.warning).toHaveBeenCalledWith(
      "Coverage collection was enabled. Skipping test hash index update.",
    );
    expect(saveTestHashIndex).not.toHaveBeenCalled();
  });

  it("should skip update when packages have coverage results", async () => {
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

    await maybeUpdateHashIndex(mockInputs, packages);
    expect(saveTestHashIndex).not.toHaveBeenCalled();
  });

  it("should update cache with hashes when no coverage was collected", async () => {
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
          execution: {
            command: "cmd1",
            exitCode: 0,
            cwd: "/path/to/pkg1",
            durationMs: 100,
          },
        },
      },
      "github.com/example/pkg-2": {
        importPath: "github.com/example/pkg-2",
        directory: "/path/to/pkg-2",
        hash: "hash2",
        compile: {
          binary: "binary2",
          log: "log2",
          execution: {
            command: "cmd2",
            exitCode: 0,
            cwd: "/path/to/pkg-2",
            durationMs: 100,
          },
        },
        run: {
          log: "run2",
          execution: {
            command: "cmd2",
            exitCode: 0,
            cwd: "/path/to/pkg-2",
            durationMs: 100,
          },
        },
      },
    };

    await maybeUpdateHashIndex(mockInputs, packages);

    expect(saveTestHashIndex).toHaveBeenCalledWith("unit", {
      "github.com/example/pkg": "hash1",
      "github.com/example/pkg-2": "hash2",
    });
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
