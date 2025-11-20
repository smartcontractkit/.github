import { describe, test, expect, vi, beforeEach } from "vitest";

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

  test("returns all files when no patterns are provided (defaults to include all)", () => {
    const files = ["src/index.ts", "src/utils/helper.ts"];
    const filePatterns: string[] = [];

    const result = filterPaths(files, filePatterns);

    expect(result).toEqual(files);
  });

  test("excludes files via negations", () => {
    const files = [
      "src/index.ts",
      "src/utils/helper.ts",
      "test/index.test.ts",
      "README.md",
    ];
    // Negate test files and README, include all else by default (no positive includes provided)
    const filePatterns = ["!**/*.test.ts", "!README.md"];

    const result = filterPaths(files, filePatterns);

    expect(result).toEqual(["src/index.ts", "src/utils/helper.ts"]);
  });

  test("includes only specific extensions when only positive patterns are provided", () => {
    const files = ["src/main.ts", "src/other.ts", "src/ignore.js", "README.md"];
    const filePatterns = ["**/*.ts"];

    const result = filterPaths(files, filePatterns);

    expect(result).toEqual(["src/main.ts", "src/other.ts"]);
  });

  test("negations override includes (order-independent)", () => {
    const files = [
      "src/main.ts",
      "src/main.test.ts",
      "src/aux.ts",
      "docs/README.md",
    ];

    // Case A: include-then-negate
    const a = filterPaths(files, ["**/*.ts", "!**/*.test.ts"]);
    // Case B: negate-then-include (should be identical because negations always win)
    const b = filterPaths(files, ["!**/*.test.ts", "**/*.ts"]);

    expect(a).toEqual(["src/main.ts", "src/aux.ts"]);
    expect(b).toEqual(["src/main.ts", "src/aux.ts"]);
  });

  test("handles multiple negations", () => {
    const files = [
      "src/main.ts",
      "docs/README.md",
      "scripts/deploy.sh",
      "scripts/cleanup.sh",
    ];
    const filePatterns = ["!**/*.md", "!scripts/*.sh"];

    const result = filterPaths(files, filePatterns);

    expect(result).toEqual(["src/main.ts"]);
  });

  test("returns empty array when everything is negated", () => {
    const files = ["a.ts", "b.ts", "c.ts"];
    const filePatterns = ["!**/*.ts"];

    const result = filterPaths(files, filePatterns);

    expect(result).toEqual([]);
  });

  test("nested directory negation excludes descendants", () => {
    const files = [
      "src/app/main.ts",
      "src/app/config/settings.ts",
      "src/app/config/.env",
    ];
    const filePatterns = ["!src/app/config/**"];

    const result = filterPaths(files, filePatterns);

    expect(result).toEqual(["src/app/main.ts"]);
  });
});

describe("filterPaths (directories/modules)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns all paths when no patterns are provided (defaults to include all)", () => {
    const paths = [
      "services/payment",
      "services/payment/submodule",
      "services/billing",
      "tools",
    ];
    const filePatterns: string[] = [];

    const result = filterPaths(paths, filePatterns);
    expect(result).toEqual(paths);
  });

  test("negates an exact module only (keeps submodules)", () => {
    const paths = [
      "services/payment",
      "services/payment/submodule",
      "services/payment/submodule/nested",
      "services/billing",
      "services/payments", // sibling-like but different
      "tools",
    ];

    const filePatterns = ["!services/payment"];

    const result = filterPaths(paths, filePatterns);

    expect(result).toEqual([
      "services/payment/submodule",
      "services/payment/submodule/nested",
      "services/billing",
      "services/payments",
      "tools",
    ]);
  });

  test("negates a module and all of its submodules", () => {
    const paths = [
      "services/payment",
      "services/payment/submodule",
      "services/payment/submodule/nested",
      "services/billing",
      "services/payments", // sibling-like but different
      "tools",
    ];

    const filePatterns = ["!services/payment/**"];

    const result = filterPaths(paths, filePatterns);

    expect(result).toEqual(["services/billing", "services/payments", "tools"]);
  });

  test("negates only submodules when using `dir/**/*` (root remains)", () => {
    const paths = [
      "services/payment",
      "services/payment/submodule",
      "services/payment/another",
      "services/billing",
    ];

    const filePatterns = ["!services/payment/**/*"];

    const result = filterPaths(paths, filePatterns);

    expect(result).toEqual(["services/payment", "services/billing"]);
  });

  test("does not accidentally match similar prefixes", () => {
    const paths = [
      "services/pay",
      "services/payment",
      "services/payroll",
      "services/pay/sub",
    ];

    const filePatterns = ["!services/pay/**"];

    const result = filterPaths(paths, filePatterns);

    expect(result).toEqual(["services/payment", "services/payroll"]);
  });

  test("handles prefixed wildcards for internal folders across the tree", () => {
    const paths = [
      "services/payments",
      "services/payments/internal/crypto",
      "services/billing",
      "services/billing/internal/logs",
    ];

    const filePatterns = ["!**/internal/**"];

    const result = filterPaths(paths, filePatterns);

    expect(result).toEqual(["services/payments", "services/billing"]);
  });

  test("handles dot-directories with negations (dot: true behavior)", () => {
    const paths = [".internal", ".internal/crypto", "services/api", ".github"];

    const filePatterns = ["!.internal", "!.internal/**"];

    const result = filterPaths(paths, filePatterns);

    expect(result).toEqual(["services/api", ".github"]);
  });

  test("includes only a subtree when positive include is given, still allowing negations to exclude inside it", () => {
    const paths = [
      "services/payment",
      "services/payment/internal/crypto",
      "services/payment/api",
      "services/billing",
    ];

    const filePatterns = ["services/payment/**", "!**/internal/**"];

    const result = filterPaths(paths, filePatterns);

    expect(result).toEqual(["services/payment", "services/payment/api"]);
  });
});
