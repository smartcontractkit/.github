import { describe, it, expect, vi, beforeEach } from "vitest";

import { execa } from "execa";
import * as core from "@actions/core";

import { Inputs } from "../src/main.js";
import { getTestPackages } from "../src/filter-tests.js";

// Mock the execa module
vi.mock("execa", () => {
  return {
    execa: vi.fn(),
  };
});

// Mock the @actions/core module
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  debug: vi.fn(),
}));

describe("getTestPackages", () => {
  const defaultInputs: Inputs = {
    moduleDirectory: "./",
    buildDirectory: "./build",
    updateIndex: false,
    forceUpdateIndex: false,
    runAllTests: false,
    tagFilter: "",
    hashesBranch: "",
    hashesFile: "",
    testSuite: "test-suite",
    buildFlags: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list all packages when tagFilter is not provided", async () => {
    const inputs = {
      ...defaultInputs,
      moduleDirectory: "/path/to/module",
    };

    const mockedStdout = [
      "example.com/package1:/path/to/module/package1",
      "example.com/package2:/path/to/module/package2",
    ];

    // Mock execa for 'go list' command
    (execa as any).mockResolvedValueOnce({
      stdout: mockedStdout,
    });

    // Act
    const packages = await getTestPackages(inputs);

    // Assert
    expect(execa).toHaveBeenCalledWith(
      "go",
      ["list", "-f", "{{.ImportPath}}:{{.Dir}}", "./..."],
      expect.objectContaining({
        stdout: "pipe",
        lines: true,
        cwd: "/path/to/module",
      }),
    );

    expect(packages).toEqual({
      "example.com/package1": {
        importPath: "example.com/package1",
        directory: "/path/to/module/package1",
      },
      "example.com/package2": {
        importPath: "example.com/package2",
        directory: "/path/to/module/package2",
      },
    });
  });

  it("should find tagged test packages when tagFilter is provided", async () => {
    // Arrange
    const inputs = {
      ...defaultInputs,
      tagFilter: "integration",
      moduleDirectory: "/path/to/module",
    };

    const findMockedStdout = [
      "./package1/file_test.go",
      "./package2/file_test.go",
    ];

    const goListMockedStdouts = [
      ["example.com/package1:/path/to/module/package1"],
      ["example.com/package2:/path/to/module/package2"],
    ];

    // Mock execa for 'find' command
    (execa as any)
      .mockResolvedValueOnce({
        stdout: findMockedStdout,
      })
      // Mock execa for 'go list' command in package1
      .mockResolvedValueOnce({
        stdout: goListMockedStdouts[0],
      })
      // Mock execa for 'go list' command in package2
      .mockResolvedValueOnce({
        stdout: goListMockedStdouts[1],
      });

    // Act
    const packages = await getTestPackages(inputs);

    // Assert
    expect(execa).toHaveBeenCalledTimes(3);

    expect(execa).toHaveBeenNthCalledWith(
      1,
      "find",
      [
        ".",
        "-name",
        "*_test.go",
        "-exec",
        "grep",
        "-l",
        `//go:build integration`,
        "{}",
        "+",
      ],
      expect.objectContaining({
        stdout: "pipe",
        lines: true,
        cwd: "/path/to/module",
      }),
    );

    expect(execa).toHaveBeenNthCalledWith(
      2,
      "go",
      ["list", "-f", "{{.ImportPath}}:{{.Dir}}", "./..."],
      expect.objectContaining({
        stdout: "pipe",
        lines: true,
        cwd: "./package1",
      }),
    );

    expect(execa).toHaveBeenNthCalledWith(
      3,
      "go",
      ["list", "-f", "{{.ImportPath}}:{{.Dir}}", "./..."],
      expect.objectContaining({
        stdout: "pipe",
        lines: true,
        cwd: "./package2",
      }),
    );

    expect(packages).toEqual({
      "example.com/package1": {
        importPath: "example.com/package1",
        directory: "/path/to/module/package1",
      },
      "example.com/package2": {
        importPath: "example.com/package2",
        directory: "/path/to/module/package2",
      },
    });
  });

  it("should return empty object when no packages are found with the tag", async () => {
    // Arrange
    const inputs = {
      ...defaultInputs,
      tagFilter: "nonexistenttag",
      moduleDirectory: "/path/to/module",
    };

    // Mock execa to simulate 'find' command returning no output
    (execa as any).mockResolvedValueOnce({
      stdout: [],
    });

    // Act
    const packages = await getTestPackages(inputs);

    // Assert
    expect(execa).toHaveBeenCalledTimes(1);
    expect(packages).toEqual({});
  });

  it("should handle duplicate packages correctly", async () => {
    // Arrange
    const inputs = {
      ...defaultInputs,
      tagFilter: "",
      moduleDirectory: "/path/to/module",
    };

    const mockedStdout = [
      "example.com/package1:/path/to/module/package1",
      "example.com/package1:/path/to/module/package1_duplicate",
    ];

    (execa as any).mockResolvedValueOnce({
      stdout: mockedStdout,
    });

    // Act
    const packages = await getTestPackages(inputs);

    // Assert
    expect(packages).toEqual({
      "example.com/package1": {
        importPath: "example.com/package1",
        directory: "/path/to/module/package1",
      },
    });

    expect(core.info).toHaveBeenCalledWith("Duplicate package found");
    expect(core.debug).toHaveBeenCalledWith(
      "Existing: example.com/package1 - /path/to/module/package1",
    );
    expect(core.debug).toHaveBeenCalledWith(
      "Duplicate: example.com/package1 - /path/to/module/package1_duplicate",
    );
  });

  it("should return empty object when no packages are found without tagFilter", async () => {
    // Arrange
    const inputs = {
      ...defaultInputs,
      tagFilter: "",
      moduleDirectory: "/path/to/module",
    };

    // Mock execa for 'go list' command returning empty output
    (execa as any).mockResolvedValueOnce({
      stdout: [],
    });

    // Act
    const packages = await getTestPackages(inputs);

    // Assert
    expect(packages).toEqual({});
  });

  it("should handle errors thrown by execa", async () => {
    // Arrange
    const inputs = {
      ...defaultInputs,
      tagFilter: "",
      moduleDirectory: "/path/to/module",
    };

    // Mock execa to throw an error
    (execa as any).mockRejectedValueOnce(new Error("Command failed"));

    // Act & Assert
    await expect(getTestPackages(inputs)).rejects.toThrow("Command failed");
  });
});
