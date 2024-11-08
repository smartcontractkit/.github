// buildTestBinaries.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExecaError } from "execa";
import { execa } from "execa";
import * as fs from "fs";
import * as core from "@actions/core";
import * as path from "path";

import { buildTestBinaries } from "../src/build-tests.js"; // Adjust the import path
import { Inputs } from "../src/main.js"; // Adjust the import path
import { FilteredPackages } from "../src/types.js"; // Adjust the import path

// Mock the execa module
vi.mock("execa", async (importOriginal) => {
  const { ExecaError } = await importOriginal<typeof import("execa")>();

  return {
    ExecaError,
    execa: vi.fn(),
  };
});

// Mock the fs module functions
vi.mock("fs", () => {
  return {
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    createWriteStream: vi.fn(() => {
      return {
        on: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        close: vi.fn(),
      };
    }),
  };
});

// Mock the @actions/core module
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  debug: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  setFailed: vi.fn(),
  isDebug: vi.fn(() => false),
  getInput: vi.fn(() => "4"), // Default build concurrency
}));

describe("buildTestBinaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should compile test binaries successfully", async () => {
    // Arrange
    const inputs: Inputs = {
      moduleDirectory: "/path/to/module",
      buildDirectory: "/path/to/build",
    } as Inputs; // Adjust as per your Inputs type

    const packages: FilteredPackages = {
      "example.com/package1": {
        importPath: "example.com/package1",
        directory: "/path/to/module/package1",
      },
      "example.com/package2": {
        importPath: "example.com/package2",
        directory: "/path/to/module/package2",
      },
    };

    const binaryPaths = {
      "example.com/package1": "/path/to/build/example.com-package1-test",
      "example.com/package2": "/path/to/build/example.com-package2-test",
    };

    // Mock execa for compiling binaries
    (execa as any).mockImplementation(
      (cmd: string, flags: string[], options: any) => {
        const importPath = flags[flags.length - 1];
        const pkgName = importPath.split("/").pop();
        return {
          stdout: `Compiled ${importPath}`,
          stderr: "",
          all: {
            pipe: vi.fn(),
          },
          command: `${cmd} ${flags.join(" ")}`,
          exitCode: 0,
          durationMs: 100,
          cwd: options.cwd,
          stdoutStream: {
            on: vi.fn(),
          },
        };
      },
    );

    // Mock fs functions
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readdirSync as any).mockReturnValue([
      "example.com-package1-test",
      "example.com-package2-test",
    ]);

    // Act
    const compiledPackages = await buildTestBinaries(inputs, packages);

    // Assert
    expect(execa).toHaveBeenCalledTimes(2);

    const [package1, package2] = Object.values(packages);

    expect(execa).toHaveBeenNthCalledWith(
      1,
      "go",
      [
        "test",
        "-c",
        "-o",
        binaryPaths[package1.importPath],
        "-vet=off",
        package1.importPath,
      ],
      expect.objectContaining({
        cwd: inputs.moduleDirectory,
        stdout: "pipe",
        stderr: "pipe",
        all: true,
      }),
    );

    expect(execa).toHaveBeenNthCalledWith(
      2,
      "go",
      [
        "test",
        "-c",
        "-o",
        binaryPaths[package2.importPath],
        "-vet=off",
        package2.importPath,
      ],
      expect.objectContaining({
        cwd: inputs.moduleDirectory,
        stdout: "pipe",
        stderr: "pipe",
        all: true,
      }),
    );

    expect(compiledPackages).toEqual({
      "example.com/package1": expect.any(Object),
      "example.com/package2": expect.any(Object),
    });

    expect(fs.existsSync).toHaveBeenCalledTimes(2);
    expect(fs.readdirSync).toHaveBeenCalledWith(inputs.buildDirectory);
  });

  it("should handle compilation failures", async () => {
    // Arrange
    const inputs: Inputs = {
      moduleDirectory: "/path/to/module",
      buildDirectory: "/path/to/build",
    } as Inputs;

    const packages: FilteredPackages = {
      "example.com/package1": {
        importPath: "example.com/package1",
        directory: "/path/to/module/package1",
      },
    };

    // Mock execa to simulate a compilation error
    (execa as any).mockRejectedValueOnce({
      message: "Compilation failed",
      exitCode: 1,
      stdout: "",
      stderr: "error: failed to compile",
      all: {
        pipe: vi.fn(),
      },
      command: "go test -c -o /path/to/binary -vet=off example.com/package1",
      cwd: "/path/to/module",
    });

    // Act & Assert
    await expect(buildTestBinaries(inputs, packages)).rejects.toThrow(
      "Compilation failed",
    );

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining("Failed to compile test for package"),
    );
  });

  it("should handle missing binaries after compilation", async () => {
    // Arrange
    const inputs: Inputs = {
      moduleDirectory: "/path/to/module",
      buildDirectory: "/path/to/build",
    } as Inputs;

    const packages: FilteredPackages = {
      "example.com/package1": {
        importPath: "example.com/package1",
        directory: "/path/to/module/package1",
      },
    };

    // Mock execa for successful compilation
    (execa as any).mockResolvedValueOnce({
      stdout: "Compiled example.com/package1",
      stderr: "",
      all: {
        pipe: vi.fn(),
      },
      command: "go test -c -o /path/to/binary -vet=off example.com/package1",
      exitCode: 0,
      durationMs: 100,
      cwd: "/path/to/module",
      stdoutStream: {
        on: vi.fn(),
      },
    });

    // Mock fs.existsSync to return false (binary not found)
    (fs.existsSync as any).mockReturnValue(false);
    (fs.readdirSync as any).mockReturnValue([]);

    // Act & Assert
    await expect(buildTestBinaries(inputs, packages)).resolves.toEqual({});

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining("Binary not found when expected"),
    );
  });

  it("should handle packages with no test files", async () => {
    // Arrange
    const inputs: Inputs = {
      moduleDirectory: "/path/to/module",
      buildDirectory: "/path/to/build",
    } as Inputs;

    const packages: FilteredPackages = {
      "example.com/package1": {
        importPath: "example.com/package1",
        directory: "/path/to/module/package1",
      },
    };

    // Mock execa for successful compilation with [no test files] output
    (execa as any).mockResolvedValueOnce({
      stdout: "?   example.com/package1 [no test files]",
      stderr: "",
      all: {
        pipe: vi.fn(),
      },
      command: "go test -c -o /path/to/binary -vet=off example.com/package1",
      exitCode: 0,
      durationMs: 100,
      cwd: "/path/to/module",
      stdoutStream: {
        on: vi.fn(),
      },
    });

    // Mock fs.existsSync to return false (binary not found)
    (fs.existsSync as any).mockReturnValue(false);
    (fs.readdirSync as any).mockReturnValue([]);

    // Act
    const compiledPackages = await buildTestBinaries(inputs, packages);

    // Assert
    expect(compiledPackages).toEqual({});
    expect(core.debug).toHaveBeenCalledWith(
      "No tests for package example.com/package1",
    );
  });

  it("should respect the max build concurrency", async () => {
    // Arrange
    const inputs: Inputs = {
      moduleDirectory: "/path/to/module",
      buildDirectory: "/path/to/build",
    } as Inputs;

    (core.getInput as any).mockReturnValue("2"); // Set build concurrency to 2

    const packages: FilteredPackages = {
      "example.com/package1": {
        importPath: "example.com/package1",
        directory: "/path/to/module/package1",
      },
      "example.com/package2": {
        importPath: "example.com/package2",
        directory: "/path/to/module/package2",
      },
      "example.com/package3": {
        importPath: "example.com/package3",
        directory: "/path/to/module/package3",
      },
    };

    const executionOrder: string[] = [];

    // Mock execa to track execution order
    (execa as any).mockImplementation(
      async (cmd: string, flags: string[], options: any) => {
        const importPath = flags[flags.length - 1];
        executionOrder.push(importPath);

        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 50));

        return {
          stdout: `Compiled ${importPath}`,
          stderr: "",
          all: {
            pipe: vi.fn(),
          },
          command: `${cmd} ${flags.join(" ")}`,
          exitCode: 0,
          durationMs: 100,
          cwd: options.cwd,
          stdoutStream: {
            on: vi.fn(),
          },
        };
      },
    );

    // Mock fs functions
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readdirSync as any).mockReturnValue([
      "example.com-package1-test",
      "example.com-package2-test",
      "example.com-package3-test",
    ]);

    // Act
    await buildTestBinaries(inputs, packages);

    // Assert
    expect(execa).toHaveBeenCalledTimes(3);
    // Since concurrency is 2, the first two should start before the third
    expect(executionOrder.slice(0, 2)).toContain("example.com/package1");
    expect(executionOrder.slice(0, 2)).toContain("example.com/package2");
    expect(executionOrder[2]).toBe("example.com/package3");
  });

  it("should handle errors thrown by execa", async () => {
    // Arrange
    const inputs: Inputs = {
      moduleDirectory: "/path/to/module",
      buildDirectory: "/path/to/build",
    } as Inputs;

    const packages: FilteredPackages = {
      "example.com/package1": {
        importPath: "example.com/package1",
        directory: "/path/to/module/package1",
      },
    };

    // Mock execa to throw a non-ExecaError
    (execa as any).mockRejectedValueOnce(new ExecaError());

    // Act & Assert
    await expect(buildTestBinaries(inputs, packages)).rejects.toThrow(
      "Failed to compile test binaries",
    );

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining("Failed to compile test for package"),
    );
  });

  it("should proceed when there are no packages to compile", async () => {
    // Arrange
    const inputs: Inputs = {
      moduleDirectory: "/path/to/module",
      buildDirectory: "/path/to/build",
    } as Inputs;

    const packages: FilteredPackages = {};

    // Act
    const compiledPackages = await buildTestBinaries(inputs, packages);

    // Assert
    expect(compiledPackages).toEqual({});
    expect(execa).not.toHaveBeenCalled();
  });
});
