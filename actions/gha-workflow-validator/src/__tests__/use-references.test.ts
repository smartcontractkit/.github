import { describe, it, expect, vi } from "vitest";

import { FileLine, ParsedFile } from "../parse-files.js";
import {
  buildUseReferenceIndex,
  classifyUse,
  extractUseReferences,
  UseReference,
} from "../use-references.js";
import {
  ActionRefValidation,
  toActionReference,
} from "../validations/action-reference-validations.js";
import { ActionsCacheVersionValidation } from "../validations/actions-cache-validation.js";
import { ValidationType } from "../validations/validation-check.js";

vi.mock("@actions/core", async () => {
  return (await import("./__helpers__/test-utils.js")).coreLoggingStubs();
});

const WORKFLOW = `name: test
on: push
jobs:
  call:
    uses: octo/repo/.github/workflows/build.yml@v1
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4 # pin comment
      - uses: "actions/cache/save@de90cc6fb38fc0963ad72b210f1f284cd68cea36"   # v4
      - uses: dorny/paths-filter@v3.0.2
      - uses: docker://alpine:3.19
      - uses: ./.github/actions/local
      - uses: $/.github/actions/self
      - uses: owner/repo
      - run: echo hi
`;

const COMPOSITE_ACTION = `name: composite
description: test
runs:
  using: composite
  steps:
    - uses: actions/checkout@v4
    - run: echo hi
      shell: bash
`;

const NODE_ACTION = `name: node
description: test
runs:
  using: node20
  main: index.js
`;

async function referencesFor(
  filename: string,
  content: string,
): Promise<UseReference[]> {
  const references = await extractUseReferences(filename, content);
  expect(references).toBeDefined();
  return references!;
}

async function indexedReferences(
  filename: string,
  content: string,
  lineNumber: number,
): Promise<UseReference[]> {
  const index = await buildUseReferenceIndex([
    { filename, lines: [], content } satisfies ParsedFile,
  ]);
  const references = index.get(filename, lineNumber);
  expect(references).not.toBe("fallback");
  return references as UseReference[];
}

describe(extractUseReferences.name, () => {
  it("extracts and classifies workflow references", async () => {
    const references = await referencesFor("test.yml", WORKFLOW);

    expect(references).toEqual([
      {
        filename: "test.yml",
        value: "octo/repo/.github/workflows/build.yml@v1",
        kind: "reusable-workflow",
        line: 5,
        endLine: 5,
        column: 11,
        comment: undefined,
      },
      {
        filename: "test.yml",
        value: "actions/checkout@v4",
        kind: "action",
        line: 9,
        endLine: 9,
        column: 15,
        comment: "pin comment",
      },
      {
        filename: "test.yml",
        value: "actions/cache/save@de90cc6fb38fc0963ad72b210f1f284cd68cea36",
        kind: "action",
        line: 10,
        endLine: 10,
        column: 15,
        comment: "v4",
      },
      {
        filename: "test.yml",
        value: "dorny/paths-filter@v3.0.2",
        kind: "action",
        line: 11,
        endLine: 11,
        column: 15,
        comment: undefined,
      },
      {
        filename: "test.yml",
        value: "docker://alpine:3.19",
        kind: "docker",
        line: 12,
        endLine: 12,
        column: 15,
        comment: undefined,
      },
      {
        filename: "test.yml",
        value: "./.github/actions/local",
        kind: "local",
        line: 13,
        endLine: 13,
        column: 15,
        comment: undefined,
      },
      {
        filename: "test.yml",
        value: "$/.github/actions/self",
        kind: "local",
        line: 14,
        endLine: 14,
        column: 15,
        comment: undefined,
      },
      {
        filename: "test.yml",
        value: "owner/repo",
        kind: "action",
        line: 15,
        endLine: 15,
        column: 15,
        comment: undefined,
      },
    ]);
  });

  it("extracts multiple references on one line", async () => {
    const references = await referencesFor(
      "test.yml",
      `on: push
jobs: {b: {runs-on: ubuntu-latest, steps: [{uses: actions/checkout@v4}, {uses: dorny/paths-filter@v3.0.2}]}}
`,
    );

    expect(references.map((reference) => reference.line)).toEqual([2, 2]);
    expect(references.map((reference) => reference.value)).toEqual([
      "actions/checkout@v4",
      "dorny/paths-filter@v3.0.2",
    ]);
  });

  it("keeps references when the workflow has schema errors", async () => {
    const references = await referencesFor(
      "test.yml",
      `on: push
future-key: 1
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
`,
    );

    expect(references.map((reference) => reference.value)).toEqual([
      "actions/checkout@v4",
    ]);
  });

  it("returns undefined for invalid YAML", async () => {
    const references = await extractUseReferences(
      "test.yml",
      `on: push
jobs:
  build:
    runs-on: [
`,
    );

    expect(references).toBeUndefined();
  });

  it("extracts composite action references", async () => {
    const references = await referencesFor("action.yml", COMPOSITE_ACTION);

    expect(references.map((reference) => reference.value)).toEqual([
      "actions/checkout@v4",
    ]);
  });

  it("returns no references for node actions", async () => {
    const references = await extractUseReferences("action.yml", NODE_ACTION);
    expect(references).toEqual([]);
  });
});

describe(buildUseReferenceIndex.name, () => {
  it("indexes references by line", async () => {
    const references = await indexedReferences("test.yml", WORKFLOW, 10);

    expect(references.map((reference) => reference.value)).toEqual([
      "actions/cache/save@de90cc6fb38fc0963ad72b210f1f284cd68cea36",
    ]);
  });

  it("returns an empty list for a parsed line with no references", async () => {
    const references = await indexedReferences("test.yml", WORKFLOW, 1);
    expect(references).toEqual([]);
  });

  it("falls back when content is missing", async () => {
    const index = await buildUseReferenceIndex([
      { filename: "test.yml", lines: [] },
    ]);

    expect(index.get("test.yml", 1)).toBe("fallback");
  });

  it("falls back for unknown files", async () => {
    const index = await buildUseReferenceIndex([]);
    expect(index.get("test.yml", 1)).toBe("fallback");
  });
});

describe(toActionReference.name, () => {
  const reference = (value: string, comment?: string): UseReference => ({
    filename: "test.yml",
    value,
    kind: "action",
    line: 1,
    endLine: 1,
    column: 1,
    comment,
  });

  it("parses a repo-scoped action with a sub-action path", () => {
    expect(toActionReference(reference("actions/cache/save@v4", "v4"))).toEqual(
      {
        owner: "actions",
        repo: "cache",
        repoPath: "/save",
        ref: "v4",
        comment: "v4",
        isWorkflowFile: false,
        trusted: true,
      },
    );
  });

  it("marks untrusted owners", () => {
    expect(toActionReference(reference("dorny/paths-filter@v3.0.2"))).toEqual({
      owner: "dorny",
      repo: "paths-filter",
      repoPath: "",
      ref: "v3.0.2",
      comment: undefined,
      isWorkflowFile: false,
      trusted: false,
    });
  });

  it("rejects malformed references", () => {
    expect(toActionReference(reference("owner/repo"))).toBeUndefined();
    expect(toActionReference(reference("owner/repo@"))).toBeUndefined();
    expect(toActionReference(reference("owner"))).toBeUndefined();
    expect(
      toActionReference(reference("/actions/checkout@v4")),
    ).toBeUndefined();
    expect(
      toActionReference(reference("actions//checkout@v4")),
    ).toBeUndefined();
    expect(
      toActionReference(reference("actions/checkout@v4@extra")),
    ).toBeUndefined();
  });
});

describe(classifyUse.name, () => {
  it("classifies reference kinds", () => {
    expect(classifyUse("docker://alpine")).toBe("docker");
    expect(classifyUse("./local")).toBe("local");
    expect(classifyUse(".\\local")).toBe("local");
    expect(classifyUse("$/local")).toBe("local");
    expect(classifyUse("owner/repo@v1")).toBe("action");
  });
});

describe("validator integration with the reference index", () => {
  const line = (lineNumber: number, content: string): FileLine => ({
    lineNumber,
    content,
    operation: "add",
    ignored: false,
  });

  it("does not treat docker or reusable workflow references as actions", async () => {
    const subject = new ActionRefValidation({} as any, {
      validateNodeVersion: false,
      references: await buildUseReferenceIndex([
        { filename: "test.yml", lines: [], content: WORKFLOW },
      ]),
    });

    expect(
      await subject.validateLine(
        line(5, "uses: octo/repo/x.yml@v1"),
        "test.yml",
      ),
    ).toEqual([]);
    expect(
      await subject.validateLine(
        line(12, "uses: docker://alpine:3.19"),
        "test.yml",
      ),
    ).toEqual([]);
  });

  it("applies the action rules through the index", async () => {
    const subject = new ActionRefValidation({} as any, {
      validateNodeVersion: false,
      references: await buildUseReferenceIndex([
        { filename: "test.yml", lines: [], content: WORKFLOW },
      ]),
    });

    const messages = await subject.validateLine(
      line(11, "uses: dorny/paths-filter@v3.0.2"),
      "test.yml",
    );
    expect(messages.map((message) => message.type)).toContain(
      ValidationType.SHA_REF,
    );
  });

  it("reports malformed remote references", async () => {
    const subject = new ActionRefValidation({} as any, {
      validateNodeVersion: false,
      references: await buildUseReferenceIndex([
        { filename: "test.yml", lines: [], content: WORKFLOW },
      ]),
    });

    expect(
      await subject.validateLine(line(15, "uses: owner/repo"), "test.yml"),
    ).toEqual([
      {
        type: ValidationType.USES_FORMAT,
        severity: "error",
        message:
          "Expected format {owner}/{repo}[/path]@{ref}. Actual 'owner/repo'",
      },
    ]);
  });

  it("reads actions/cache versions from the index", async () => {
    const content = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/cache@v2
      - uses: actions/cache/save@v5
`;
    const subject = new ActionsCacheVersionValidation({
      references: await buildUseReferenceIndex([
        { filename: "test.yml", lines: [], content },
      ]),
    });

    const messages = await subject.validateLine(
      line(6, "uses: actions/cache@v2"),
      "test.yml",
    );
    expect(messages).toEqual([
      {
        type: ValidationType.ACTIONS_CACHE,
        severity: "error",
        message:
          "This version (v2) of actions/cache is being deprecated. Please update to v5",
      },
    ]);
    expect(
      await subject.validateLine(
        line(7, "uses: actions/cache/save@v5"),
        "test.yml",
      ),
    ).toEqual([]);
  });
});

describe("parser edge cases", () => {
  const wrap = (steps: string) =>
    `name: t\non: push\njobs:\n  b:\n    runs-on: ubuntu-latest\n    steps:\n${steps}\n`;

  it("indexes a multiline scalar on every line and reports it once", async () => {
    const content = wrap("      - uses: >-\n          dorny/paths-filter@v3\n");
    const index = await buildUseReferenceIndex([
      { filename: "w.yml", lines: [], content },
    ]);
    const header = index.get("w.yml", 7);
    const value = index.get("w.yml", 8);
    expect(header).not.toBe("fallback");
    expect(value).toEqual(header);

    const subject = new ActionRefValidation({} as any, {
      validateNodeVersion: false,
      references: index,
    });
    const add = (lineNumber: number): FileLine => ({
      lineNumber,
      content: "",
      operation: "add",
      ignored: false,
    });
    const first = await subject.validateLine(add(7), "w.yml");
    const second = await subject.validateLine(add(8), "w.yml");
    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual([]);
  });

  it("parses workflows named action.yml", async () => {
    const references = await extractUseReferences(
      ".github/workflows/action.yml",
      wrap("      - { uses: actions/checkout@v4 }"),
    );
    expect(references?.map((r) => r.value)).toEqual(["actions/checkout@v4"]);
  });

  it("falls back when the converter drops a job", async () => {
    const content =
      "name: t\non: push\njobs:\n  b:\n    runs-on: ubuntu-latest\n    container: []\n    steps:\n      - uses: dorny/paths-filter@v3\n";
    expect(await extractUseReferences("w.yml", content)).toBeUndefined();
  });

  it("falls back when a uses value comes from a YAML alias", async () => {
    const content =
      "name: t\non: push\nenv:\n  REF: &ref vendor/action@v1\njobs:\n  b:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: *ref\n";
    expect(await extractUseReferences("w.yml", content)).toBeUndefined();
  });

  it("keeps the version comment on flow-style steps", async () => {
    const references = await referencesFor(
      "w.yml",
      wrap("      - { uses: owner/repo@abc } # v1"),
    );
    expect(references[0].comment).toBe("v1");
  });
});
