import { describe, test, expect, vi, beforeEach } from "vitest";
import * as core from "@actions/core";

import { filterPaths } from "../path-ops";

vi.mock("@actions/core", () => ({
  startGroup: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  endGroup: vi.fn(),
}));

describe("filterPaths (files)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return all files when no ignore patterns are provided", () => {
    const files = ["src/index.ts", "src/utils/helper.ts"];
    const ignorePatterns: string[] = [];

    const result = filterPaths(files, ignorePatterns);

    expect(result).toEqual(files);
  });

  test("should filter out files matching ignore patterns", () => {
    const files = [
      "src/index.ts",
      "src/utils/helper.ts",
      "test/index.test.ts",
      "README.md",
    ];
    const ignorePatterns = ["**/*.test.ts", "README.md"];

    const result = filterPaths(files, ignorePatterns);

    expect(result).toEqual(["src/index.ts", "src/utils/helper.ts"]);
  });

  test("should handle nested directory ignore patterns", () => {
    const files = [
      "src/app/main.ts",
      "src/app/config/settings.ts",
      "src/app/config/.env",
    ];
    const ignorePatterns = ["src/app/config/**"];

    const result = filterPaths(files, ignorePatterns);

    expect(result).toEqual(["src/app/main.ts"]);
  });

  test("should ignore files matching multiple patterns", () => {
    const files = [
      "src/main.ts",
      "docs/README.md",
      "scripts/deploy.sh",
      "scripts/cleanup.sh",
    ];
    const ignorePatterns = ["**/*.md", "scripts/*.sh"];

    const result = filterPaths(files, ignorePatterns);

    expect(result).toEqual(["src/main.ts"]);
  });

  test("should return empty array when all files are ignored", () => {
    const files = ["a.ts", "b.ts", "c.ts"];
    const ignorePatterns = ["**/*.ts"];

    const result = filterPaths(files, ignorePatterns);

    expect(result).toEqual([]);
  });
});

describe("filterPaths (directories/modules)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns all paths when no ignore patterns are provided", () => {
    const paths = [
      "services/payment",
      "services/payment/submodule",
      "services/billing",
      "tools",
    ];
    const ignore: string[] = [];

    const result = filterPaths(paths, ignore);
    expect(result).toEqual(paths);
  });

  test("filters out an exact module", () => {
    const paths = [
      "services/payment",
      "services/payment/submodule",
      "services/payment/submodule/nested",
      "services/billing",
      "services/payments", // sibling-like but different
      "tools",
    ];

    const ignore = ["services/payment"];

    const result = filterPaths(paths, ignore);

    expect(result).toEqual([
      "services/payment/submodule",
      "services/payment/submodule/nested",
      "services/billing",
      "services/payments",
      "tools",
    ]);
  });

  test("filters out an exact module and all of its submodules", () => {
    const paths = [
      "services/payment",
      "services/payment/submodule",
      "services/payment/submodule/nested",
      "services/billing",
      "services/payments", // sibling-like but different
      "tools",
    ];

    const ignore = ["services/payment/**"];

    const result = filterPaths(paths, ignore);

    expect(result).toEqual(["services/billing", "services/payments", "tools"]);
  });

  test("filters only submodules when using `dir/**/*`", () => {
    const paths = [
      "services/payment",
      "services/payment/submodule",
      "services/payment/another",
      "services/billing",
    ];

    // Only ignore descendants; the root 'services/payment' remains.
    const ignore = ["services/payment/**/*"];

    const result = filterPaths(paths, ignore);

    expect(result).toEqual(["services/payment", "services/billing"]);
  });

  test("does not accidentally match similar prefixes", () => {
    const paths = [
      "services/pay",
      "services/payment", // similar prefix but different
      "services/payroll", // similar prefix but different
      "services/pay/sub", // child of services/pay
    ];

    // Ignore exactly "services/pay" and its children.
    const ignore = ["services/pay/**"];

    const result = filterPaths(paths, ignore);

    expect(result).toEqual(["services/payment", "services/payroll"]);
  });

  test("handles prefixed wildcards", () => {
    const paths = [
      "services/payments",
      "services/payments/internal/crypto",
      "services/billing",
      "services/billing/internal/logs",
    ];

    // Ignore a hidden module and all its descendants.
    const ignore = ["**/internal/**"];

    const result = filterPaths(paths, ignore);

    expect(result).toEqual(["services/payments", "services/billing"]);
  });

  test("handles dot-directories when ignored (dot: true behavior)", () => {
    const paths = [".internal", ".internal/crypto", "services/api", ".github"];

    // Ignore a hidden module and all its descendants.
    const ignore = [".internal", ".internal/**"];

    const result = filterPaths(paths, ignore);

    expect(result).toEqual(["services/api", ".github"]);
  });
});
