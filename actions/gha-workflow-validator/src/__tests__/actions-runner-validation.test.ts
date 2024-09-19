import {
  ActionsRunnerValidation,
  extractActionRunnerFromLine,
} from "../validations/actions-runner-validations.js";
import { FileLine, ParsedFile } from "../utils.js";
import { getNock } from "./__helpers__/test-utils.js";

import { vi, describe, it, expect } from "vitest";

const nockBack = getNock();

vi.mock("@actions/core", async () => {
  return (await import("./__helpers__/test-utils.js")).coreLoggingStubs();
});

const jobLine: FileLine = {
  lineNumber: 1,
  content: "      new-job:",
  operation: "add",
  ignored: false,
};

const actionsRunnerLineDefault: FileLine = {
  lineNumber: 2,
  content: "      runs-on: ubuntu-latest",
  operation: "add",
  ignored: false,
};

const actionsRunnerLineUbuntuUpgraded: FileLine = {
  lineNumber: 2,
  content: "      runs-on: ubuntu-latest-16cores-64gb",
  operation: "add",
  ignored: false,
};

const actionsRunnerLineUbuntuMaxSize: FileLine = {
  lineNumber: 2,
  content: "      runs-on: ubuntu-latest-64cores-256gb",
  operation: "add",
  ignored: false,
};

const actionsRunnerLineMacOs: FileLine = {
  lineNumber: 2,
  content: "      runs-on: macos-latest",
  operation: "add",
  ignored: false,
};

const actionsRunnerLineMacOsUpgraded: FileLine = {
  lineNumber: 2,
  content: "      runs-on: macos-12-xlarge",
  operation: "add",
  ignored: false,
};

describe(ActionsRunnerValidation.name, () => {
  it("should validate no changes", async () => {
    const subject = new ActionsRunnerValidation();
    const result = await subject.validate({
      filename: "foo.yml",
      lines: [],
    });
    expect(result).toEqual({ filename: "foo.yml", lineValidations: [] });
  });

  it("should validate no runner changes", async () => {
    const subject = new ActionsRunnerValidation();
    const noWorkflowChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [
        { lineNumber: 1, content: "line 1", operation: "add", ignored: false },
        { lineNumber: 2, content: "line 2", operation: "add", ignored: false },
      ],
    };
    const result = await subject.validate(noWorkflowChanges);
    expect(result).toEqual({
      filename: ".github/workflows/test.yml",
      lineValidations: [],
    });
  });

  it("should validate allowed runner", async () => {
    const subject = new ActionsRunnerValidation();

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [jobLine, actionsRunnerLineDefault],
    };

    const result = await subject.validate(simpleChanges);
    expect(result).toEqual({
      filename: ".github/workflows/test.yml",
      lineValidations: [],
    });
  });

  it("should error on upgraded runner", async () => {
    const subject = new ActionsRunnerValidation();

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [jobLine, actionsRunnerLineUbuntuUpgraded],
    };

    const result = await subject.validate(simpleChanges);
    const lineValidationsWithErrors = result.lineValidations.filter(
      (lv) => lv.messages.length > 0,
    );
    expect(lineValidationsWithErrors.length).toEqual(1);

    const lineValidation = lineValidationsWithErrors[0];
    expect(lineValidation.line.lineNumber).toEqual(
      simpleChanges.lines[1].lineNumber,
    );
    expect(lineValidation.messages.length).toEqual(1);
    expect(
      lineValidation.messages[0].message.startsWith("This Ubuntu runner is"),
    ).toBeTruthy();
    expect(lineValidation.messages[0].severity).toEqual("error");
  });

  it("should error on x-large runner", async () => {
    const subject = new ActionsRunnerValidation();

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [jobLine, actionsRunnerLineUbuntuMaxSize],
    };

    const result = await subject.validate(simpleChanges);
    const lineValidationsWithErrors = result.lineValidations.filter(
      (lv) => lv.messages.length > 0,
    );
    expect(lineValidationsWithErrors.length).toEqual(1);

    const lineValidation = lineValidationsWithErrors[0];
    expect(lineValidation.line.lineNumber).toEqual(
      simpleChanges.lines[1].lineNumber,
    );
    expect(lineValidation.messages.length).toEqual(1);
    expect(
      lineValidation.messages[0].message.startsWith("This Ubuntu runner is"),
    ).toBeTruthy();
    expect(lineValidation.messages[0].severity).toEqual("error");
  });

  it("should not error on base macos runner", async () => {
    const subject = new ActionsRunnerValidation();

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [jobLine, actionsRunnerLineMacOs],
    };

    const result = await subject.validate(simpleChanges);
    const lineValidationsWithErrors = result.lineValidations.filter(
      (lv) => lv.messages.length > 0,
    );
    expect(lineValidationsWithErrors.length).toEqual(0);
  });

  it("should error on upgraded macos runner", async () => {
    const subject = new ActionsRunnerValidation();

    const simpleChanges: ParsedFile = {
      filename: ".github/workflows/test.yml",
      lines: [jobLine, actionsRunnerLineMacOsUpgraded],
    };

    const result = await subject.validate(simpleChanges);
    const lineValidationsWithErrors = result.lineValidations.filter(
      (lv) => lv.messages.length > 0,
    );
    expect(lineValidationsWithErrors.length).toEqual(1);

    const lineValidation = lineValidationsWithErrors[0];
    expect(lineValidation.line.lineNumber).toEqual(
      simpleChanges.lines[1].lineNumber,
    );
    expect(lineValidation.messages.length).toEqual(1);
    expect(lineValidation.messages[0].message).toEqual(
      `MacOS actions runner can be up to 10x more expensive than Ubuntu runners. Consider using an Ubuntu runner or the base macOS runner.`,
    );
    expect(lineValidation.messages[0].severity).toEqual("error");
  });
});

describe(extractActionRunnerFromLine.name, () => {
  it("extracts nothing from commented line (ubuntu latest)", () => {
    const line = "#        runs-on: ubuntu-latest\n";
    const actionsRunner = extractActionRunnerFromLine(line);
    expect(actionsRunner).toBeUndefined();
  });

  it("extracts nothing from commented line 2 (ubuntu latest)", () => {
    const line = "       # runs-on: ubuntu-latest\n";
    const actionsRunner = extractActionRunnerFromLine(line);
    expect(actionsRunner).toBeUndefined();
  });

  it("extracts actions runner (ubuntu latest)", () => {
    const line = "        runs-on: ubuntu-latest\n";
    const actionsRunner = extractActionRunnerFromLine(line);
    expect(actionsRunner).toEqual({
      os: "ubuntu",
      osVersion: "latest",
      cores: 0,
      memoryGb: 0,
      identifier: "ubuntu-latest",
    });
  });

  it("extracts actions runner (ubuntu latest 16/64)", () => {
    const line = "        runs-on: ubuntu-latest-16cores-64GB\n";
    const actionsRunner = extractActionRunnerFromLine(line);
    expect(actionsRunner).toEqual({
      os: "ubuntu",
      osVersion: "latest",
      cores: 16,
      memoryGb: 64,
      identifier: "ubuntu-latest-16cores-64gb",
    });
  });

  it("extracts actions runner (ubuntu 22.04 32/128)", () => {
    const line = "        runs-on: ubuntu22.04-32cores-128GB\n";
    const actionsRunner = extractActionRunnerFromLine(line);
    expect(actionsRunner).toEqual({
      os: "ubuntu",
      osVersion: "22.04",
      cores: 32,
      memoryGb: 128,
      identifier: "ubuntu22.04-32cores-128gb",
    });
  });

  it("extracts actions runner (macos latest)", () => {
    const line = "        runs-on: macos-latest\n";
    const actionsRunner = extractActionRunnerFromLine(line);
    expect(actionsRunner).toEqual({
      os: "macos",
      osVersion: "latest",
      cores: 4,
      memoryGb: 0,
      identifier: "macos-latest",
    });
  });

  it("extracts actions runner (macos 12)", () => {
    const line = "        runs-on: macos-12\n";
    const actionsRunner = extractActionRunnerFromLine(line);
    expect(actionsRunner).toEqual({
      os: "macos",
      osVersion: "12",
      cores: 4,
      memoryGb: 0,
      identifier: "macos-12",
    });
  });

  it("extracts actions runner (macos 12 xlarge)", () => {
    const line = "        runs-on: macos-12-xlarge\n";
    const actionsRunner = extractActionRunnerFromLine(line);
    expect(actionsRunner).toEqual({
      os: "macos",
      osVersion: "12",
      cores: 8,
      memoryGb: 14,
      identifier: "macos-12-xlarge",
    });
  });

  it("extracts actions runner from matrix (ubuntu latest 16/64)", () => {
    const line = "         os: ubuntu-latest-16cores-64GB\n";
    const actionsRunner = extractActionRunnerFromLine(line);
    expect(actionsRunner).toEqual({
      os: "ubuntu",
      osVersion: "latest",
      cores: 16,
      memoryGb: 64,
      identifier: "ubuntu-latest-16cores-64gb",
    });
  });
});
