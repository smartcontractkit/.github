import { describe, it, expect, vi, beforeEach } from "vitest";

import { execa } from "execa";

import { listPackages } from "../../src/pipeline/filter.js";

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
