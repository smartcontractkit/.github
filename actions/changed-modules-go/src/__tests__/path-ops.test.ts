import * as core from "@actions/core";
import * as glob from "@actions/glob";
import { vi, beforeEach, describe, test, expect } from "vitest";

import * as process from "process";
import * as path from "path";

import { getAllGoModuleRoots, matchModule, matchModules } from "../path-ops";

// Mock @actions/core
vi.mock("@actions/core", () => ({
  startGroup: vi.fn(),
  endGroup: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  addPath: vi.fn(),
  setFailed: vi.fn(),
}));

vi.mock("@actions/glob", () => ({
  create: vi.fn().mockResolvedValue({
    glob: vi.fn().mockResolvedValue([]),
  }),
}));

describe("matchModule", () => {
  describe("basic functionality", () => {
    test("should match file in module directory", () => {
      const moduleDirectories = ["src", "lib", "docs"];
      const result = matchModule("src/index.ts", moduleDirectories);
      expect(result).toBe("src");
    });

    test("should match file in nested module directory", () => {
      const moduleDirectories = ["apps/web", "packages/ui"];
      const result = matchModule("apps/web/pages/index.tsx", moduleDirectories);
      expect(result).toBe("apps/web");
    });

    test("should walk up directory hierarchy to find parent module", () => {
      const moduleDirectories = ["packages"];
      const result = matchModule(
        "packages/ui/src/components/Button.tsx",
        moduleDirectories,
      );
      expect(result).toBe("packages");
    });
  });

  describe("root directory handling", () => {
    test('should match root directory with "."', () => {
      const moduleDirectories = ["."];
      const result = matchModule("src/index.ts", moduleDirectories);
      expect(result).toBe(".");
    });

    test('should match root directory with "."', () => {
      const moduleDirectories = ["."];
      const result = matchModule("src/index.ts", moduleDirectories);
      expect(result).toBe(".");
    });

    test('should prefer "." over "." when both are present', () => {
      const moduleDirectories = [".", "."];
      const result = matchModule("src/index.ts", moduleDirectories);
      expect(result).toBe(".");
    });

    test("should handle file in root directory", () => {
      const moduleDirectories = ["."];
      const result = matchModule("go.mod", moduleDirectories);
      expect(result).toBe(".");
    });
  });

  describe("no match scenarios", () => {
    test("should return empty string when no module found", () => {
      const moduleDirectories = ["src", "lib"];
      const result = matchModule("docs/go.mod", moduleDirectories);
      expect(result).toBe("");
    });

    test("should return empty string for empty module directories", () => {
      const moduleDirectories: string[] = [];
      const result = matchModule("src/index.ts", moduleDirectories);
      expect(result).toBe("");
    });
  });

  describe("edge cases", () => {
    test('should handle files without leading "."', () => {
      const moduleDirectories = ["src", "lib"];
      const result = matchModule("src/index.ts", moduleDirectories);
      expect(result).toBe("src");
    });

    test("should handle deeply nested paths", () => {
      const moduleDirectories = ["packages/core"];
      const result = matchModule(
        "packages/core/src/utils/helpers/string.ts",
        moduleDirectories,
      );
      expect(result).toBe("packages/core");
    });

    test("should handle single file in directory", () => {
      const moduleDirectories = ["scripts"];
      const result = matchModule("scripts/build.js", moduleDirectories);
      expect(result).toBe("scripts");
    });
  });
});

describe("matchModules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic functionality", () => {
    test("should match multiple files to their modules", () => {
      const files = ["src/index.ts", "lib/utils.ts", "docs/go.mod"];
      const moduleDirectories = ["src", "lib", "docs"];

      const result = matchModules(files, moduleDirectories);

      expect(result).toEqual([
        ["src/index.ts", "src"],
        ["lib/utils.ts", "lib"],
        ["docs/go.mod", "docs"],
      ]);
    });

    test("should handle mixed matched and unmatched files", () => {
      const files = ["src/index.ts", "unknown/file.ts", "lib/utils.ts"];
      const moduleDirectories = ["src", "lib"];

      const result = matchModules(files, moduleDirectories);

      expect(result).toEqual([
        ["src/index.ts", "src"],
        ["lib/utils.ts", "lib"],
      ]);
      expect(core.info).toHaveBeenCalledWith(
        "No matching module directory found for file: unknown/file.ts",
      );
    });

    test("should handle files in nested module structures", () => {
      const files = [
        "packages/ui/src/Button.tsx",
        "packages/utils/src/helpers.ts",
        "apps/web/pages/index.tsx",
      ];
      const moduleDirectories = ["packages/ui", "packages/utils", "apps/web"];

      const result = matchModules(files, moduleDirectories);

      expect(result).toEqual([
        ["packages/ui/src/Button.tsx", "packages/ui"],
        ["packages/utils/src/helpers.ts", "packages/utils"],
        ["apps/web/pages/index.tsx", "apps/web"],
      ]);
    });
  });

  describe("edge cases", () => {
    test("should handle empty file list", () => {
      const files: string[] = [];
      const moduleDirectories = ["src", "lib"];

      const result = matchModules(files, moduleDirectories);

      expect(result).toEqual([]);
    });

    test("should handle empty module directories", () => {
      const files = ["src/index.ts", "lib/utils.ts"];
      const moduleDirectories: string[] = [];

      const result = matchModules(files, moduleDirectories);

      expect(result).toEqual([]);
      expect(core.info).toHaveBeenCalledWith(
        "No matching module directory found for file: src/index.ts",
      );
      expect(core.info).toHaveBeenCalledWith(
        "No matching module directory found for file: lib/utils.ts",
      );
    });

    test("should handle files that walk up to root", () => {
      const files = ["src/components/Button.tsx", "go.mod"];
      const moduleDirectories = ["."];

      const result = matchModules(files, moduleDirectories);

      expect(result).toEqual([
        ["src/components/Button.tsx", "."],
        ["go.mod", "."],
      ]);
    });

    test("should handle duplicate file entries", () => {
      const files = ["src/index.ts", "src/index.ts", "lib/utils.ts"];
      const moduleDirectories = ["src", "lib"];

      const result = matchModules(files, moduleDirectories);

      expect(result).toEqual([
        ["src/index.ts", "src"],
        ["src/index.ts", "src"],
        ["lib/utils.ts", "lib"],
      ]);
    });
  });

  describe("complex scenarios", () => {
    test("should handle monorepo structure with overlapping paths", () => {
      const files = [
        "packages/core/src/index.ts",
        "packages/ui/src/Button.tsx",
        "packages/utils/index.ts",
        "apps/web/src/App.tsx",
        "scripts/build.js",
      ];
      const moduleDirectories = [
        "packages/core",
        "packages/ui",
        "packages/utils",
        "apps/web",
      ];

      const result = matchModules(files, moduleDirectories);

      expect(result).toEqual([
        ["packages/core/src/index.ts", "packages/core"],
        ["packages/ui/src/Button.tsx", "packages/ui"],
        ["packages/utils/index.ts", "packages/utils"],
        ["apps/web/src/App.tsx", "apps/web"],
      ]);
      expect(core.info).toHaveBeenCalledWith(
        "No matching module directory found for file: scripts/build.js",
      );
    });

    test("should prioritize more specific module matches", () => {
      const files = [
        "packages/ui/components/Button.tsx",
        "packages/ui/utils/helpers.ts",
        "packages/core/index.ts",
      ];
      const moduleDirectories = [
        "packages",
        "packages/ui",
        "packages/ui/components",
        "packages/core",
      ];

      const result = matchModules(files, moduleDirectories);

      expect(result).toEqual([
        ["packages/ui/components/Button.tsx", "packages/ui/components"],
        ["packages/ui/utils/helpers.ts", "packages/ui"],
        ["packages/core/index.ts", "packages/core"],
      ]);
    });
  });
});

describe("getAllGoModuleRoots", () => {
  const globMock = vi.mocked(glob);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should find all go.mod files in a directory", async () => {
    const cwd = process.cwd();
    globMock.create = vi.fn().mockResolvedValue({
      glob: vi
        .fn()
        .mockResolvedValue([
          path.join(cwd, "/path/to/md/file/go.mod"),
          path.join(cwd, "/path/to/md/file/sub-dir/go.mod"),
          path.join(cwd, "/path/to/md/file/sub-dir-2/go.mod"),
          path.join(cwd, "/path/to/md/file/sub-dir/nested/go.mod"),
        ]),
    });

    const directory = "./";
    const result = await getAllGoModuleRoots(directory);
    expect(result).toEqual([
      "path/to/md/file",
      "path/to/md/file/sub-dir",
      "path/to/md/file/sub-dir-2",
      "path/to/md/file/sub-dir/nested",
    ]);
  });

  test("should return an empty array if no go.mod files are found", async () => {
    globMock.create = vi.fn().mockResolvedValue({
      glob: vi.fn().mockResolvedValue([]),
    });

    const directory = "./test/empty";
    const result = await getAllGoModuleRoots(directory);
    expect(result).toEqual([]);
  });
});


