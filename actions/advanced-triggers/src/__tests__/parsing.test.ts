import { vi, describe, test, expect } from "vitest";

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  debug: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

import { parseFileSets, parseTriggers } from "../schema";

// ---------------------------------------------------------------------------
// parseFileSets
// ---------------------------------------------------------------------------

describe("parseFileSets", () => {
  describe("empty / blank input", () => {
    test("empty string returns empty map", () => {
      expect(parseFileSets("")).toEqual({});
    });

    test("whitespace-only string returns empty map", () => {
      expect(parseFileSets("   \n  ")).toEqual({});
    });
  });

  describe("valid input", () => {
    test("parses a single file-set", () => {
      expect(
        parseFileSets(`
go-files:
  - "**/*.go"
  - "**/go.mod"
`),
      ).toEqual({ "go-files": ["**/*.go", "**/go.mod"] });
    });

    test("parses multiple file-sets", () => {
      expect(
        parseFileSets(`
go-files:
  - "**/*.go"
vendor:
  - "**/vendor/**"
`),
      ).toEqual({
        "go-files": ["**/*.go"],
        vendor: ["**/vendor/**"],
      });
    });

    test("filters out blank pattern lines", () => {
      const result = parseFileSets(`
go-files:
  - "**/*.go"
  - ""
  - "   "
  - "**/go.mod"
`);
      expect(result["go-files"]).toEqual(["**/*.go", "**/go.mod"]);
    });

    test("trims whitespace from patterns", () => {
      const result = parseFileSets(`
go-files:
  - "  **/*.go  "
`);
      expect(result["go-files"]).toEqual(["**/*.go"]);
    });
  });

  describe("negation is forbidden in file-set definitions", () => {
    test("throws when a pattern is negated", () => {
      expect(() =>
        parseFileSets(`
vendor:
  - "!**/vendor/**"
`),
      ).toThrow(`Pattern must not be negated`);
    });

    test("error message tells the user to use exclusion-sets instead", () => {
      // File-sets define what files ARE in a set — negation belongs at the
      // trigger level via exclusion-sets, not inside the set definition.
      expect(() =>
        parseFileSets(`
vendor:
  - "!**/vendor/**"
`),
      ).toThrow("exclusion-sets");
    });

    test("throws even when mixed with valid positive patterns", () => {
      expect(() =>
        parseFileSets(`
mixed:
  - "**/*.go"
  - "!**/vendor/**"
`),
      ).toThrow("must not be negated");
    });
  });

  describe("invalid input", () => {
    test("throws on invalid YAML", () => {
      expect(() => parseFileSets("{ bad: yaml: here")).toThrow(
        "Failed to parse file-sets YAML",
      );
    });

    test("throws when top-level is an array", () => {
      expect(() => parseFileSets("- foo\n- bar")).toThrow(
        "file-sets input must be a YAML mapping",
      );
    });

    test("throws when top-level is a scalar string", () => {
      expect(() => parseFileSets('"just a string"')).toThrow(
        "file-sets input must be a YAML mapping",
      );
    });

    test("throws when a file-set value is not an array", () => {
      expect(() =>
        parseFileSets(`
go-files: "**/*.go"
`),
      ).toThrow(`[go-files]`);
    });

    test("throws when a pattern entry is not a string", () => {
      expect(() =>
        parseFileSets(`
go-files:
  - 42
`),
      ).toThrow(`[go-files → 0]`);
    });
  });
});

// ---------------------------------------------------------------------------
// parseTriggers
// ---------------------------------------------------------------------------

describe("parseTriggers", () => {
  describe("invalid YAML / top-level structure", () => {
    test("throws on invalid YAML", () => {
      expect(() => parseTriggers("{ bad: yaml: here")).toThrow(
        "Failed to parse triggers YAML",
      );
    });

    test("throws when top-level is an array", () => {
      expect(() => parseTriggers("- foo")).toThrow(
        "triggers input must be a YAML mapping",
      );
    });

    test("throws when top-level is a scalar", () => {
      expect(() => parseTriggers('"just a string"')).toThrow(
        "triggers input must be a YAML mapping",
      );
    });

    test("throws when no triggers are defined", () => {
      expect(() => parseTriggers("{}", {})).toThrow(
        "No triggers defined in the triggers input",
      );
    });
  });

  describe("invalid trigger config", () => {
    test("throws when trigger config is not a mapping", () => {
      expect(() =>
        parseTriggers(`
my-trigger: "not a mapping"
`),
      ).toThrow(`[my-trigger]`);
    });

    test("throws when trigger config is an array", () => {
      expect(() =>
        parseTriggers(`
my-trigger:
  - "foo"
`),
      ).toThrow(`[my-trigger]`);
    });

    test("throws on unknown key in trigger config", () => {
      expect(() =>
        parseTriggers(`
my-trigger:
  paths:
    - "**/*.go"
  unknown-key: foo
`),
      ).toThrow(`Unknown key "unknown-key"`);
    });

    test("unknown key error message lists all allowed keys", () => {
      expect(() =>
        parseTriggers(`
my-trigger:
  paths:
    - "**/*.go"
  filters: [foo]
`),
      ).toThrow("inclusion-sets");
    });
  });

  describe("pattern resolution", () => {
    test("inline paths become positive patterns", () => {
      const [t] = parseTriggers(`
my-trigger:
  paths:
    - "**/*.go"
    - "docs/**"
`);
      expect(t.positivePatterns).toEqual(["**/*.go", "docs/**"]);
      expect(t.negatedPatterns).toEqual([]);
    });

    test("inline paths prefixed with ! become negated patterns", () => {
      const [t] = parseTriggers(`
my-trigger:
  paths:
    - "**/*.go"
    - "!**/vendor/**"
`);
      expect(t.positivePatterns).toEqual(["**/*.go"]);
      expect(t.negatedPatterns).toEqual(["**/vendor/**"]);
    });

    test("inclusion-sets patterns become positive patterns", () => {
      const fileSets = { "go-files": ["**/*.go", "**/go.mod"] };
      const [t] = parseTriggers(
        `
my-trigger:
  inclusion-sets: [go-files]
`,
        fileSets,
      );
      expect(t.positivePatterns).toEqual(["**/*.go", "**/go.mod"]);
      expect(t.negatedPatterns).toEqual([]);
    });

    test("exclusion-sets patterns become negated patterns", () => {
      const fileSets = {
        "go-files": ["**/*.go"],
        vendor: ["**/vendor/**"],
      };
      const [t] = parseTriggers(
        `
my-trigger:
  inclusion-sets: [go-files]
  exclusion-sets: [vendor]
`,
        fileSets,
      );
      expect(t.positivePatterns).toEqual(["**/*.go"]);
      expect(t.negatedPatterns).toEqual(["**/vendor/**"]);
    });

    test("multiple inclusion-sets are merged in declaration order", () => {
      const fileSets = {
        "go-files": ["**/*.go"],
        "ts-files": ["**/*.ts"],
        "workflow-files": [".github/workflows/**"],
      };
      const [t] = parseTriggers(
        `
my-trigger:
  inclusion-sets: [go-files, ts-files, workflow-files]
`,
        fileSets,
      );
      expect(t.positivePatterns).toEqual([
        "**/*.go",
        "**/*.ts",
        ".github/workflows/**",
      ]);
    });

    test("multiple exclusion-sets are merged in declaration order", () => {
      const fileSets = {
        "go-files": ["**/*.go"],
        vendor: ["**/vendor/**"],
        "e2e-tests": ["system-tests/**", "integration-tests/**"],
      };
      const [t] = parseTriggers(
        `
my-trigger:
  inclusion-sets: [go-files]
  exclusion-sets: [vendor, e2e-tests]
`,
        fileSets,
      );
      expect(t.negatedPatterns).toEqual([
        "**/vendor/**",
        "system-tests/**",
        "integration-tests/**",
      ]);
    });

    test("all three sources combine: inclusion-sets, exclusion-sets, and paths", () => {
      const fileSets = {
        "go-files": ["**/*.go"],
        vendor: ["**/vendor/**"],
      };
      const [t] = parseTriggers(
        `
my-trigger:
  inclusion-sets: [go-files]
  exclusion-sets: [vendor]
  paths:
    - "tools/bin/runner"
    - "!docs/**"
`,
        fileSets,
      );
      expect(t.positivePatterns).toEqual(["**/*.go", "tools/bin/runner"]);
      expect(t.negatedPatterns).toEqual(["**/vendor/**", "docs/**"]);
    });

    test("blank and whitespace paths are ignored", () => {
      const [t] = parseTriggers(`
my-trigger:
  paths:
    - "**/*.go"
    - ""
    - "   "
`);
      expect(t.positivePatterns).toEqual(["**/*.go"]);
    });
  });

  describe("always-trigger-on", () => {
    test("defaults to [schedule, workflow_dispatch] when not specified", () => {
      const [t] = parseTriggers(`
my-trigger:
  paths:
    - "**/*.go"
`);
      expect(t.alwaysTriggerOn).toEqual(["schedule", "workflow_dispatch"]);
    });

    test("can be overridden with custom event list", () => {
      const [t] = parseTriggers(`
my-trigger:
  paths:
    - "**/*.go"
  always-trigger-on:
    - schedule
    - workflow_call
`);
      expect(t.alwaysTriggerOn).toEqual(["schedule", "workflow_call"]);
    });

    test("can be set to empty list when trigger has positive patterns", () => {
      const [t] = parseTriggers(`
my-trigger:
  paths:
    - "**/*.go"
  always-trigger-on: []
`);
      expect(t.alwaysTriggerOn).toEqual([]);
    });

    test("trigger with no file patterns but non-empty always-trigger-on is valid", () => {
      const [t] = parseTriggers(`
nightly-only:
  always-trigger-on:
    - schedule
    - workflow_dispatch
`);
      expect(t.positivePatterns).toEqual([]);
      expect(t.negatedPatterns).toEqual([]);
      expect(t.alwaysTriggerOn).toEqual(["schedule", "workflow_dispatch"]);
    });

    test("trigger with empty config body uses default always-trigger-on", () => {
      const [t] = parseTriggers(`
my-trigger: {}
`);
      expect(t.alwaysTriggerOn).toEqual(["schedule", "workflow_dispatch"]);
    });
  });

  describe("validation errors", () => {
    test("throws when inclusion-sets references unknown file-set", () => {
      expect(() =>
        parseTriggers(`
my-trigger:
  inclusion-sets: [does-not-exist]
`),
      ).toThrow(`unknown file-set "does-not-exist" in "inclusion-sets"`);
    });

    test("throws when exclusion-sets references unknown file-set", () => {
      expect(() =>
        parseTriggers(`
my-trigger:
  paths:
    - "**/*.go"
  exclusion-sets: [does-not-exist]
`),
      ).toThrow(`unknown file-set "does-not-exist" in "exclusion-sets"`);
    });

    test("throws when inclusion-sets is not an array", () => {
      expect(() =>
        parseTriggers(`
my-trigger:
  inclusion-sets: go-files
`),
      ).toThrow(`[my-trigger → inclusion-sets]`);
    });

    test("throws when exclusion-sets is not an array", () => {
      expect(() =>
        parseTriggers(`
my-trigger:
  paths:
    - "**/*.go"
  exclusion-sets: vendor
`),
      ).toThrow(`[my-trigger → exclusion-sets]`);
    });

    test("throws when paths is not an array", () => {
      expect(() =>
        parseTriggers(`
my-trigger:
  paths: "**/*.go"
`),
      ).toThrow(`[my-trigger → paths]`);
    });

    test("throws when always-trigger-on is not an array", () => {
      expect(() =>
        parseTriggers(`
my-trigger:
  paths:
    - "**/*.go"
  always-trigger-on: schedule
`),
      ).toThrow(`[my-trigger → always-trigger-on]`);
    });

    test("throws when inclusion-sets entry is not a string", () => {
      expect(() =>
        parseTriggers(`
my-trigger:
  inclusion-sets:
    - 42
`),
      ).toThrow(`[my-trigger → inclusion-sets → 0]`);
    });

    test("throws when exclusion-sets entry is not a string", () => {
      expect(() =>
        parseTriggers(`
my-trigger:
  paths:
    - "**/*.go"
  exclusion-sets:
    - 42
`),
      ).toThrow(`[my-trigger → exclusion-sets → 0]`);
    });

    test("throws when paths entry is not a string", () => {
      expect(() =>
        parseTriggers(`
my-trigger:
  paths:
    - 99
`),
      ).toThrow(`[my-trigger → paths → 0]`);
    });

    test("throws when always-trigger-on entry is not a string", () => {
      expect(() =>
        parseTriggers(`
my-trigger:
  paths:
    - "**/*.go"
  always-trigger-on:
    - 123
`),
      ).toThrow(`[my-trigger → always-trigger-on → 0]`);
    });

    test("throws when only exclusion-sets are provided — no positive patterns", () => {
      const fileSets = { vendor: ["**/vendor/**"] };
      expect(() =>
        parseTriggers(
          `
my-trigger:
  exclusion-sets: [vendor]
`,
          fileSets,
        ),
      ).toThrow("only negated patterns");
    });

    test("throws when no patterns and always-trigger-on is explicitly empty", () => {
      expect(() =>
        parseTriggers(`
my-trigger:
  always-trigger-on: []
`),
      ).toThrow("can never output true");
    });
  });

  describe("multiple triggers", () => {
    test("parses multiple triggers preserving declaration order", () => {
      const triggers = parseTriggers(`
alpha:
  paths:
    - "alpha/**"
beta:
  paths:
    - "beta/**"
gamma:
  paths:
    - "gamma/**"
`);
      expect(triggers.map((t) => t.name)).toEqual(["alpha", "beta", "gamma"]);
    });

    test("each trigger resolves its own file-sets independently", () => {
      const fileSets = {
        "go-files": ["**/*.go"],
        "ts-files": ["**/*.ts"],
      };
      const [a, b] = parseTriggers(
        `
trigger-a:
  inclusion-sets: [go-files]
trigger-b:
  inclusion-sets: [ts-files]
`,
        fileSets,
      );
      expect(a.positivePatterns).toEqual(["**/*.go"]);
      expect(b.positivePatterns).toEqual(["**/*.ts"]);
    });

    test("triggers can reference overlapping file-sets without interfering", () => {
      const fileSets = {
        "go-files": ["**/*.go"],
        vendor: ["**/vendor/**"],
        "e2e-tests": ["system-tests/**"],
      };
      const [core, deployment] = parseTriggers(
        `
core-tests:
  inclusion-sets: [go-files]
  exclusion-sets: [vendor, e2e-tests]
deployment-tests:
  inclusion-sets: [go-files]
  exclusion-sets: [vendor]
  paths:
    - "deployment/**"
`,
        fileSets,
      );

      // core-tests excludes both vendor and e2e-tests
      expect(core.negatedPatterns).toEqual(["**/vendor/**", "system-tests/**"]);
      // deployment-tests only excludes vendor, and adds deployment/** as positive
      expect(deployment.negatedPatterns).toEqual(["**/vendor/**"]);
      expect(deployment.positivePatterns).toContain("deployment/**");
    });
  });
});
