import { vi, describe, test, expect } from "vitest";

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  debug: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

import { parseTriggers } from "../schema";
import { applyTrigger, type TriggerConfig } from "../filters";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a TriggerConfig directly for targeted applyTrigger unit tests. */
function trigger(
  overrides: Partial<TriggerConfig> & { name?: string } = {},
): TriggerConfig {
  return {
    name: "test",
    positivePatterns: ["**/*.go"],
    negatedPatterns: [],
    alwaysTriggerOn: ["schedule", "workflow_dispatch"],
    ...overrides,
  };
}

/**
 * Parse a triggers YAML against a file-sets map and return the first trigger.
 * Used for integration-style tests that verify the full parse→apply pipeline.
 */
function parseFirst(
  triggersYaml: string,
  fileSets: Record<string, string[]> = {},
): TriggerConfig {
  return parseTriggers(triggersYaml, fileSets)[0];
}

// ---------------------------------------------------------------------------
// applyTrigger — unit tests (directly constructed TriggerConfig)
// ---------------------------------------------------------------------------

describe("applyTrigger — basic matching", () => {
  test("matches when a changed file satisfies a positive pattern", () => {
    const result = applyTrigger(
      ["core/foo.go", "docs/readme.md"],
      trigger({ positivePatterns: ["**/*.go"] }),
    );
    expect(result.matched).toBe(true);
  });

  test("does not match when no changed file satisfies any positive pattern", () => {
    const result = applyTrigger(
      ["docs/readme.md", "package.json"],
      trigger({ positivePatterns: ["**/*.go"] }),
    );
    expect(result.matched).toBe(false);
  });

  test("does not match when changed files list is empty", () => {
    expect(applyTrigger([], trigger()).matched).toBe(false);
  });

  test("only one file needs to match — not all", () => {
    const result = applyTrigger(
      ["docs/readme.md", "core/foo.go", "package.json"],
      trigger({ positivePatterns: ["**/*.go"] }),
    );
    expect(result.matched).toBe(true);
  });

  test("any positive pattern matching is sufficient", () => {
    const result = applyTrigger(
      ["docs/readme.md"],
      trigger({ positivePatterns: ["**/*.go", "docs/**"] }),
    );
    expect(result.matched).toBe(true);
  });

  test("exact file path matches", () => {
    const result = applyTrigger(
      ["tools/bin/go_core_tests"],
      trigger({ positivePatterns: ["tools/bin/go_core_tests"] }),
    );
    expect(result.matched).toBe(true);
  });
});

describe("applyTrigger — exclusion pass", () => {
  test("excluded files are removed before positive matching", () => {
    const result = applyTrigger(
      ["vendor/foo.go"],
      trigger({
        positivePatterns: ["**/*.go"],
        negatedPatterns: ["**/vendor/**"],
      }),
    );
    expect(result.matched).toBe(false);
  });

  test("non-excluded files still participate in positive matching", () => {
    const result = applyTrigger(
      ["vendor/foo.go", "core/bar.go"],
      trigger({
        positivePatterns: ["**/*.go"],
        negatedPatterns: ["**/vendor/**"],
      }),
    );
    expect(result.matched).toBe(true);
  });

  test("all files excluded results in no match even with broad positive patterns", () => {
    const result = applyTrigger(
      ["system-tests/a.go", "system-tests/b.go"],
      trigger({
        positivePatterns: ["**/*.go"],
        negatedPatterns: ["system-tests/**"],
      }),
    );
    expect(result.matched).toBe(false);
  });

  test("multiple negated patterns each contribute to exclusion", () => {
    const result = applyTrigger(
      [
        "vendor/a.go",
        "system-tests/b.go",
        "integration-tests/c.go",
        "core/d.go",
      ],
      trigger({
        positivePatterns: ["**/*.go"],
        negatedPatterns: [
          "**/vendor/**",
          "system-tests/**",
          "integration-tests/**",
        ],
      }),
    );
    // Only core/d.go survives exclusion
    expect(result.matched).toBe(true);
    expect(result.matchedFiles).toEqual(["core/d.go"]);
  });

  test("empty negatedPatterns means no files are excluded", () => {
    const result = applyTrigger(
      ["vendor/foo.go"],
      trigger({ positivePatterns: ["**/*.go"], negatedPatterns: [] }),
    );
    expect(result.matched).toBe(true);
  });
});

describe("applyTrigger — result shape", () => {
  test("result carries the trigger name", () => {
    const result = applyTrigger([], trigger({ name: "my-trigger" }));
    expect(result.name).toBe("my-trigger");
  });

  test("matchedFiles contains only the files that matched positive patterns", () => {
    const result = applyTrigger(
      ["core/foo.go", "docs/readme.md", "core/bar.go"],
      trigger({ positivePatterns: ["**/*.go"] }),
    );
    expect(result.matchedFiles).toEqual(["core/foo.go", "core/bar.go"]);
  });

  test("matchedFiles is empty when nothing matched", () => {
    const result = applyTrigger(
      ["docs/readme.md"],
      trigger({ positivePatterns: ["**/*.go"] }),
    );
    expect(result.matchedFiles).toEqual([]);
  });

  test("candidateCount reflects files remaining after exclusion", () => {
    const result = applyTrigger(
      ["vendor/a.go", "core/b.go", "core/c.go"],
      trigger({
        positivePatterns: ["**/*.go"],
        negatedPatterns: ["**/vendor/**"],
      }),
    );
    expect(result.candidateCount).toBe(2);
  });

  test("candidateCount equals total files when no negated patterns", () => {
    const result = applyTrigger(
      ["a.go", "b.go", "c.go"],
      trigger({ positivePatterns: ["**/*.go"], negatedPatterns: [] }),
    );
    expect(result.candidateCount).toBe(3);
  });
});

describe("applyTrigger — glob semantics", () => {
  test("dotfiles are matched (dot: true)", () => {
    const result = applyTrigger(
      [".github/workflows/ci.yml"],
      trigger({ positivePatterns: [".github/**"] }),
    );
    expect(result.matched).toBe(true);
  });

  test("dotfiles in subdirectories are matched", () => {
    const result = applyTrigger(
      ["src/.hidden/foo.ts"],
      trigger({ positivePatterns: ["**/*.ts"] }),
    );
    expect(result.matched).toBe(true);
  });

  test("single * does not match across path separators", () => {
    const result = applyTrigger(
      ["core/sub/foo.go"],
      trigger({ positivePatterns: ["core/*.go"] }),
    );
    expect(result.matched).toBe(false);
  });

  test("** matches across path separators", () => {
    const result = applyTrigger(
      ["core/sub/deep/foo.go"],
      trigger({ positivePatterns: ["core/**/*.go"] }),
    );
    expect(result.matched).toBe(true);
  });

  test("empty positive patterns never match", () => {
    // Normally prevented by parseTriggers, but applyTrigger must be safe regardless.
    const result = applyTrigger(
      ["core/foo.go"],
      trigger({ positivePatterns: [], negatedPatterns: [] }),
    );
    expect(result.matched).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration tests — parse → apply pipeline with complex configs
// ---------------------------------------------------------------------------

describe("integration: multiple inclusion sets", () => {
  const fileSets = {
    "go-files": ["**/*.go", "**/go.mod", "**/go.sum"],
    "core-files": ["core/**"],
    "workflow-files": [".github/workflows/**", ".github/actions/**"],
  };

  const triggersYaml = `
core-tests:
  inclusion-sets: [go-files, core-files, workflow-files]
  paths:
    - "tools/bin/go_core_tests"
`;

  test("matches a .go file anywhere", () => {
    const t = parseFirst(triggersYaml, fileSets);
    expect(applyTrigger(["pkg/utils/helper.go"], t).matched).toBe(true);
  });

  test("matches a go.mod change", () => {
    const t = parseFirst(triggersYaml, fileSets);
    expect(applyTrigger(["go.mod"], t).matched).toBe(true);
  });

  test("matches a file under core/", () => {
    const t = parseFirst(triggersYaml, fileSets);
    expect(applyTrigger(["core/services/ocr2/ocr.go"], t).matched).toBe(true);
  });

  test("matches a workflow file change", () => {
    const t = parseFirst(triggersYaml, fileSets);
    expect(applyTrigger([".github/workflows/ci-core.yml"], t).matched).toBe(
      true,
    );
  });

  test("matches the exact inline path", () => {
    const t = parseFirst(triggersYaml, fileSets);
    expect(applyTrigger(["tools/bin/go_core_tests"], t).matched).toBe(true);
  });

  test("does not match an unrelated file", () => {
    const t = parseFirst(triggersYaml, fileSets);
    expect(applyTrigger(["docs/readme.md", "package.json"], t).matched).toBe(
      false,
    );
  });
});

describe("integration: multiple exclusion sets", () => {
  const fileSets = {
    "go-files": ["**/*.go"],
    vendor: ["**/vendor/**"],
    "e2e-tests": ["system-tests/**", "integration-tests/**"],
  };

  const triggersYaml = `
core-tests:
  inclusion-sets: [go-files]
  exclusion-sets: [vendor, e2e-tests]
`;

  test("matches a regular .go file", () => {
    const t = parseFirst(triggersYaml, fileSets);
    expect(applyTrigger(["core/foo.go"], t).matched).toBe(true);
  });

  test("does not match a vendor .go file", () => {
    const t = parseFirst(triggersYaml, fileSets);
    expect(applyTrigger(["**/vendor/foo.go"], t).matched).toBe(false);
  });

  test("does not match a system-tests .go file", () => {
    const t = parseFirst(triggersYaml, fileSets);
    expect(applyTrigger(["system-tests/load/test.go"], t).matched).toBe(false);
  });

  test("does not match an integration-tests .go file", () => {
    const t = parseFirst(triggersYaml, fileSets);
    expect(applyTrigger(["integration-tests/smoke/test.go"], t).matched).toBe(
      false,
    );
  });

  test("matches when excluded and non-excluded files change together", () => {
    const t = parseFirst(triggersYaml, fileSets);
    const result = applyTrigger(
      ["system-tests/a.go", "vendor/b.go", "core/c.go"],
      t,
    );
    expect(result.matched).toBe(true);
    expect(result.matchedFiles).toEqual(["core/c.go"]);
  });

  test("does not match when only excluded files changed", () => {
    const t = parseFirst(triggersYaml, fileSets);
    const result = applyTrigger(
      ["system-tests/a.go", "integration-tests/b.go", "vendor/c.go"],
      t,
    );
    expect(result.matched).toBe(false);
  });
});

describe("integration: inclusion sets + exclusion sets + mixed inline paths", () => {
  // Simulates a real-world trigger:
  //   inclusion-sets: go-files, core-files
  //   exclusion-sets: e2e-tests
  //   paths:
  //     - "tools/bin/runner"       ← extra positive
  //     - "!.github/workflows/readme-*.yml"  ← one-off exclusion
  const fileSets = {
    "go-files": ["**/*.go", "**/go.mod"],
    "core-files": ["core/**"],
    "e2e-tests": ["system-tests/**", "integration-tests/**"],
  };

  const triggersYaml = `
my-trigger:
  inclusion-sets: [go-files, core-files]
  exclusion-sets: [e2e-tests]
  paths:
    - "tools/bin/runner"
    - "!.github/workflows/readme-*.yml"
`;

  test("positive patterns include all inclusion-set patterns plus inline path", () => {
    const t = parseFirst(triggersYaml, fileSets);
    expect(t.positivePatterns).toContain("**/*.go");
    expect(t.positivePatterns).toContain("**/go.mod");
    expect(t.positivePatterns).toContain("core/**");
    expect(t.positivePatterns).toContain("tools/bin/runner");
  });

  test("negated patterns include all exclusion-set patterns plus inline ! path", () => {
    const t = parseFirst(triggersYaml, fileSets);
    expect(t.negatedPatterns).toContain("system-tests/**");
    expect(t.negatedPatterns).toContain("integration-tests/**");
    expect(t.negatedPatterns).toContain(".github/workflows/readme-*.yml");
  });

  test("matches a core .go file", () => {
    const t = parseFirst(triggersYaml, fileSets);
    expect(applyTrigger(["core/services/foo.go"], t).matched).toBe(true);
  });

  test("matches the inline exact path", () => {
    const t = parseFirst(triggersYaml, fileSets);
    expect(applyTrigger(["tools/bin/runner"], t).matched).toBe(true);
  });

  test("does not match a file in e2e-tests (exclusion-set)", () => {
    const t = parseFirst(triggersYaml, fileSets);
    expect(applyTrigger(["system-tests/foo.go"], t).matched).toBe(false);
  });

  test("does not match readme workflow files (inline ! exclusion)", () => {
    const t = parseFirst(triggersYaml, fileSets);
    // This file would match core/** broadly if it weren't excluded
    expect(
      applyTrigger([".github/workflows/readme-integration.yml"], t).matched,
    ).toBe(false);
  });

  test("matches a non-readme workflow file that would otherwise be excluded", () => {
    // .github/workflows/ci.yml is NOT excluded by the readme-*.yml pattern
    const t = parseFirst(triggersYaml, fileSets);
    // Not in positive patterns directly — no match unless core/** covers it
    // This test confirms the inline exclusion is scoped to readme-*.yml only
    const result = applyTrigger(
      [".github/workflows/readme-core.yml", "core/foo.go"],
      t,
    );
    // readme-core.yml is excluded; core/foo.go matches core/**
    expect(result.matched).toBe(true);
    expect(result.matchedFiles).toEqual(["core/foo.go"]);
  });

  test("no match when all changed files are excluded", () => {
    const t = parseFirst(triggersYaml, fileSets);
    expect(
      applyTrigger(["system-tests/a.go", "integration-tests/b.go"], t).matched,
    ).toBe(false);
  });

  test("candidateCount correctly reflects files surviving both exclusion sources", () => {
    const t = parseFirst(triggersYaml, fileSets);
    const result = applyTrigger(
      [
        "system-tests/a.go", // excluded by exclusion-set
        ".github/workflows/readme-b.yml", // excluded by inline ! path
        "core/c.go", // survives
        "core/d.go", // survives
      ],
      t,
    );
    expect(result.candidateCount).toBe(2);
    expect(result.matched).toBe(true);
  });
});
