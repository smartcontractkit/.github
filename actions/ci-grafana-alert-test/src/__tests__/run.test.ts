import { describe, expect, it, vi } from "vitest";

import * as core from "@actions/core";
import {
  buildCheckArgs,
  missingCheckCommentBody,
  validateAlertSelection,
} from "../run";

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
      "--in",
      "/tmp/log.jsonl",
      "--from",
      "F",
      "--to",
      "T",
      "--output",
      "json",
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

  it("requires an alert selection in live mode", () => {
    setInputs();

    expect(() => buildCheckArgs({ to: "T" }, true, {})).toThrow(
      "needs 'alerts' or 'include-labels'",
    );
  });

  it("requires from in recorder mode", () => {
    setInputs();

    expect(() =>
      buildCheckArgs({ to: "T" }, false, { logPath: "/tmp/log.jsonl" }),
    ).toThrow("requires 'from'");
  });

  it("requires a recorded log in recorder mode", () => {
    setInputs();

    expect(() => buildCheckArgs({ from: "F", to: "T" }, false, {})).toThrow(
      "needs a recorded log",
    );
  });

  it("forwards optional knobs and flags", () => {
    setInputs({
      states: "firing,pending",
      preexisting: "ignore",
      "min-observed": "2",
      "allow-paused": "true",
      "nodata-is-unobservable": "true",
      "no-fail-fast": "true",
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
      "--no-fail-fast",
      "--folder",
      "Platform",
      "--concurrency",
      "4",
    ]);
  });

  it("omits --no-fail-fast unless explicitly enabled", () => {
    setInputs();

    expect(
      buildCheckArgs({ to: "T" }, true, {}, { alertsPath: "/tmp/alerts.txt" }),
    ).not.toContain("--no-fail-fast");
  });
});

describe("validateAlertSelection", () => {
  it("accepts enumerated alerts with a folder", () => {
    expect(() =>
      validateAlertSelection("record", "A\nB", "", "", "Platform"),
    ).not.toThrow();
  });

  it("accepts include labels, with optional excludes", () => {
    expect(() =>
      validateAlertSelection("record", "", "team=bcm", "", ""),
    ).not.toThrow();
    expect(() =>
      validateAlertSelection("live", "", "team=bcm", "severity=info", ""),
    ).not.toThrow();
  });

  it("refuses alerts combined with labels", () => {
    expect(() =>
      validateAlertSelection("record", "A", "team=bcm", "", ""),
    ).toThrow("mutually exclusive");
  });

  it("requires alerts or include labels", () => {
    expect(() => validateAlertSelection("live", "", "", "", "")).toThrow(
      "'alerts' or 'include-labels' is required",
    );
  });

  it("requires include labels before exclude labels", () => {
    expect(() =>
      validateAlertSelection("record", "", "", "severity=info", ""),
    ).toThrow("'exclude-labels' requires 'include-labels'");
  });

  it("refuses labels combined with a folder", () => {
    expect(() =>
      validateAlertSelection("live", "", "team=bcm", "", "Platform"),
    ).toThrow("'folder' cannot be combined with label selection");
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
