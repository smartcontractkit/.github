import { describe, expect, it, vi } from "vitest";

import * as core from "@actions/core";
import { buildCheckArgs, missingCheckCommentBody } from "../run";

vi.mock("@actions/core", () => ({ getInput: vi.fn() }));

const mockedGetInput = vi.mocked(core.getInput);

function setInputs(values: Record<string, string> = {}) {
  mockedGetInput.mockImplementation((name: string) => values[name] ?? "");
}

describe("buildCheckArgs", () => {
  it("builds recorder-mode args with the recorded log and from", () => {
    setInputs();

    expect(
      buildCheckArgs({ from: "F", to: "T" }, false, {
        logPath: "/tmp/log.jsonl",
      }),
    ).toEqual([
      "check",
      "--from",
      "F",
      "--in",
      "/tmp/log.jsonl",
      "--to",
      "T",
      "--output",
      "json",
      "--fail-fast",
    ]);
  });

  it("builds live-mode args with alerts and no recorded log", () => {
    setInputs();

    const args = buildCheckArgs(
      { to: "T" },
      true,
      {},
      {
        alertsPath: "/tmp/alerts.txt",
      },
    );

    expect(args).toEqual([
      "check",
      "--alerts",
      "/tmp/alerts.txt",
      "--to",
      "T",
      "--output",
      "json",
      "--fail-fast",
    ]);
    expect(args).not.toContain("--in");
  });

  it("builds live-mode args with label selection", () => {
    setInputs();

    const args = buildCheckArgs(
      { to: "T" },
      true,
      {},
      {
        includeLabels: "team=bcm,env=stage",
        excludeLabels: "severity=info",
      },
    );

    expect(args).toEqual([
      "check",
      "--include-labels",
      "team=bcm,env=stage",
      "--exclude-labels",
      "severity=info",
      "--to",
      "T",
      "--output",
      "json",
      "--fail-fast",
    ]);
    expect(args).not.toContain("--alerts");
  });

  it("omits --exclude-labels when only inclusions are given", () => {
    setInputs();

    const args = buildCheckArgs(
      { to: "T" },
      true,
      {},
      {
        includeLabels: "team=bcm",
      },
    );

    expect(args).toContain("--include-labels");
    expect(args).not.toContain("--exclude-labels");
  });

  it("passes an explicit from in live mode", () => {
    setInputs();

    expect(
      buildCheckArgs(
        { from: "F", to: "T" },
        true,
        {},
        {
          alertsPath: "/tmp/alerts.txt",
        },
      ),
    ).toContain("F");
  });

  it("requires a recorded log in recorder mode", () => {
    setInputs();

    expect(() => buildCheckArgs({ from: "F", to: "T" }, false, {})).toThrow(
      "needs a recorded log",
    );
  });

  it("adds no selection flags when nothing was selected", () => {
    setInputs();

    expect(buildCheckArgs({ to: "T" }, true, {})).toEqual([
      "check",
      "--to",
      "T",
      "--output",
      "json",
      "--fail-fast",
    ]);
  });

  it("forwards alerts and labels together for the CLI to refuse", () => {
    setInputs();

    const args = buildCheckArgs(
      { to: "T" },
      true,
      {},
      {
        alertsPath: "/tmp/alerts.txt",
        includeLabels: "team=bcm",
      },
    );

    expect(args).toContain("--alerts");
    expect(args).toContain("--include-labels");
  });

  it("forwards a selection in recorder mode for the CLI to refuse", () => {
    setInputs();

    const args = buildCheckArgs(
      { from: "F", to: "T" },
      false,
      { logPath: "/tmp/log.jsonl" },
      { alertsPath: "/tmp/alerts.txt" },
    );

    expect(args).toContain("--alerts");
    expect(args).toContain("--in");
  });

  it("forwards optional knobs and flags", () => {
    setInputs({
      states: "firing,pending",
      preexisting: "ignore",
      "min-observed": "2",
      "allow-paused": "true",
      "nodata-is-unobservable": "true",
      "fail-fast": "false",
      folder: "Platform",
      concurrency: "4",
    });

    expect(
      buildCheckArgs({ to: "T" }, true, {}, { alertsPath: "/tmp/alerts.txt" }),
    ).toEqual([
      "check",
      "--alerts",
      "/tmp/alerts.txt",
      "--to",
      "T",
      "--output",
      "json",
      "--states",
      "firing,pending",
      "--preexisting",
      "ignore",
      "--min-observed",
      "2",
      "--allow-paused",
      "--nodata-is-unobservable",
      "--fail-fast=false",
      "--folder",
      "Platform",
      "--concurrency",
      "4",
    ]);
  });

  it("enables fail-fast by default", () => {
    setInputs();

    expect(
      buildCheckArgs({ to: "T" }, true, {}, { alertsPath: "/tmp/alerts.txt" }),
    ).toContain("--fail-fast");
  });

  it("passes --fail-fast=false when disabled", () => {
    setInputs({ "fail-fast": "false" });

    const args = buildCheckArgs(
      { to: "T" },
      true,
      {},
      { alertsPath: "/tmp/alerts.txt" },
    );

    expect(args).toContain("--fail-fast=false");
    expect(args).not.toContain("--fail-fast");
  });
});

describe("missingCheckCommentBody", () => {
  it("spells out the missing gate and links the run", () => {
    const body = missingCheckCommentBody(
      "https://github.com/org/repo/actions/runs/42",
    );

    expect(body).toContain("The gate did not run");
    expect(body).toContain("https://github.com/org/repo/actions/runs/42");
  });
});
