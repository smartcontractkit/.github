import { describe, it, expect, vi, beforeEach } from "vitest";

import { execa } from "execa";

import {
  listPackages,
  findTaggedTestPackages,
} from "../../src/pipeline/filter.js";

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

describe("listPackages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list all packages in the given path", async () => {
    const mockedStdout = [
      "example.com/package1:/path/to/module/package1",
      "example.com/package2:/path/to/module/package2",
    ];

    // Mock execa for 'go list' command
    (execa as any).mockResolvedValueOnce({
      stdout: mockedStdout,
    });

    const filteredPackages = await listPackages("/path/to/module");

    expect(execa).toHaveBeenCalledWith(
      "go",
      ["list", "-f", "{{.ImportPath}}:{{.Dir}}", "./..."],
      expect.objectContaining({
        cwd: "/path/to/module",
      }),
    );

    expect(filteredPackages).toEqual({
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
});

describe("findTaggedTestPackages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should find tagged test packages", async () => {
    const findMockedStdout = [
      "./package1/file_test.go",
      "./package2/file_test.go",
    ];

    const goListMockedStdouts = [
      [
        "example.com/package1:/path/to/module/package1",
        "example.com/package1/sub:/path/to/module/package1/sub",
      ],
      [
        "example.com/package2:/path/to/module/package2",
        "example.com/package2/sub:/path/to/module/package2/sub",
      ],
    ];

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

    const filteredPackages = await findTaggedTestPackages(
      "/path/to/module",
      "foo",
    );

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
        `//go:build foo`,
        "{}",
        "+",
      ],
      expect.objectContaining({
        cwd: "/path/to/module",
      }),
    );

    expect(execa).toHaveBeenNthCalledWith(
      2,
      "go",
      ["list", "-f", "{{.ImportPath}}:{{.Dir}}", "./..."],
      expect.objectContaining({
        cwd: "./package1",
      }),
    );

    expect(execa).toHaveBeenNthCalledWith(
      3,
      "go",
      ["list", "-f", "{{.ImportPath}}:{{.Dir}}", "./..."],
      expect.objectContaining({
        cwd: "./package2",
      }),
    );

    expect(filteredPackages).toEqual({
      "example.com/package1": {
        importPath: "example.com/package1",
        directory: "/path/to/module/package1",
      },
      "example.com/package1/sub": {
        importPath: "example.com/package1/sub",
        directory: "/path/to/module/package1/sub",
      },
      "example.com/package2": {
        importPath: "example.com/package2",
        directory: "/path/to/module/package2",
      },
      "example.com/package2/sub": {
        importPath: "example.com/package2/sub",
        directory: "/path/to/module/package2/sub",
      },
    });
  });

  it("should return empty object when no packages are found with the tag", async () => {
    // Mock execa to simulate 'find' command returning no output
    (execa as any).mockResolvedValueOnce({
      stdout: [],
    });

    // Act
    const packages = await findTaggedTestPackages(
      "/path/to/module",
      "nonexistenttag",
    );

    // Assert
    expect(execa).toHaveBeenCalledTimes(1);
    expect(packages).toEqual({});
  });
});
