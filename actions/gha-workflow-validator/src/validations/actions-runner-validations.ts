import { ParsedFile, FileLine } from "../parse-files.js";
import * as core from "@actions/core";
import {
  ValidationCheck,
  ValidationMessage,
  FileValidationResult,
  LineValidationResult,
  ValidationType,
} from "./validation-check.js";

interface FileLineActionsRunner extends FileLine {
  actionsRunner?: ActionsRunner;
}

interface ActionsRunner {
  os: "ubuntu" | "macos" | "windows";
  osVersion: string;
  cores: number;
  memoryGb: number;
  identifier: string;
}

interface ActionsRunnerValidationOptions {}

export class ActionsRunnerValidation implements ValidationCheck {
  private options: ActionsRunnerValidationOptions;

  constructor(options?: ActionsRunnerValidationOptions) {
    this.options = options ?? {};
  }

  async validateLine(line: FileLine): Promise<ValidationMessage[]> {
    if (line.operation === "unchanged") {
      return [];
    }

    const fileLineActionsRunner = extractActionsRunner(line);
    return validateActionsRunner(fileLineActionsRunner.actionsRunner);
  }
}

async function validateActionsRunner(
  actionsRunner: ActionsRunner | undefined,
): Promise<ValidationMessage[]> {
  if (!actionsRunner) {
    return [];
  }

  if (actionsRunner.os === "macos" && actionsRunner.cores >= 8) {
    return [
      {
        type: ValidationType.RUNNER_MACOS,
        severity: "error",
        message: `MacOS actions runner can be up to 10x more expensive than Ubuntu runners. Consider using an Ubuntu runner or the base macOS runner.`,
      },
    ];
  }

  if (actionsRunner.os === "ubuntu" && actionsRunner.cores >= 16) {
    const costFactorMax = actionsRunner.cores / 2;
    const costFactorMin = actionsRunner.cores / 4;

    return [
      {
        type: ValidationType.RUNNER_UBUNTU,
        severity: "error",
        message: `This Ubuntu runner is ${costFactorMin}-${costFactorMax} more expensive than a base Ubuntu runner. Consider using a smaller Ubuntu runner.`,
      },
    ];
  }

  return [];
}

function extractActionsRunner(
  fileLine: FileLine,
): FileLineActionsRunner {
  const actionsRunner = extractActionRunnerFromLine(fileLine.content);
  if (!actionsRunner) {
    return fileLine;
  }

  core.debug(
    `Extracted actions runner: ${actionsRunner.os}-${actionsRunner.osVersion}-${actionsRunner.cores}cores-${actionsRunner.memoryGb}GB (${fileLine.content})`,
  );

  return {
    ...fileLine,
    actionsRunner,
  };
}

const RUNNER_PREFIXES = [
  "ubuntu-latest-", // upgraded ubuntu runners
  "ubuntu24.04-",
  "ubuntu22.04-",
  "ubuntu20.04-",
  "ubuntu18.04-",
  "ubuntu-latest", // base ubuntu runners
  "ubuntu-24.04",
  "ubuntu-22.04",
  "ubuntu-20.04",
  "ubuntu-18.04",
  "macos-", // macos runners
  "macos-latest",
  "macos-12",
  "macos-11",
  "windows-latest",
];

export function extractActionRunnerFromLine(
  line: string,
): ActionsRunner | undefined {
  const trimmedLine = line.trim();

  if (trimmedLine.startsWith("#")) {
    core.debug(`Skipping commented line.`);
    // commented line
    return;
  }

  let runnerIdentifierIndex: [string, number] = ["", -1];
  for (const prefix of RUNNER_PREFIXES) {
    const index = trimmedLine.indexOf(prefix);
    if (index !== -1) {
      runnerIdentifierIndex = [prefix, index];
      break;
    }
  }

  if (runnerIdentifierIndex[1] === -1) {
    return;
  }

  core.debug(`Found runner identifier: ${runnerIdentifierIndex[0]}`);

  const restOfLine = trimmedLine
    .substring(runnerIdentifierIndex[1])
    .trim()
    .toLocaleLowerCase();
  const [runnerString] = restOfLine.split(" ");
  if (runnerString.startsWith("ubuntu")) {
    core.debug(`Parsing ubuntu runner: ${runnerString}`);
    // matches: ubuntu-latest, ubuntu20.04-2cores-8gb
    const regex =
      /^ubuntu-?(latest|\d{2}.\d{2})-?((\d{1,2})cores)?-?((\d{1,3})gb)?$/;

    const match = runnerString.match(regex);
    if (!match) {
      return;
    }
    const [, osVersion, , numCores, , memoryGb] = match;

    return {
      os: "ubuntu",
      osVersion: osVersion,
      cores: numCores ? parseInt(numCores) : 0,
      memoryGb: memoryGb ? parseInt(memoryGb) : 0,
      identifier: runnerString,
    };
  } else if (runnerString.startsWith("macos")) {
    core.debug(`Parsing macos runner: ${runnerString}`);
    const regex = /^macos-(latest|\d{2}|\d{2}.\d{2})-?(large|xl|xlarge)?$/;

    const match = runnerString.match(regex);
    if (!match) {
      return;
    }

    const [, osVersion, size] = match;

    let cores = 4;
    let memoryGb = 0;
    if (size === "large") {
      cores = 12;
      memoryGb = 30;
    } else if (size === "xl" || size === "xlarge") {
      cores = 8;
      memoryGb = 14;
    }

    return {
      os: "macos",
      osVersion: osVersion,
      cores,
      memoryGb,
      identifier: runnerString,
    };
  } else if (runnerString.startsWith("windows")) {
    // TODO: Add support for windows runners?
    return {
      os: "windows",
      osVersion: "latest",
      cores: 0,
      memoryGb: 0,
      identifier: runnerString,
    };
  }

  core.warning(`Failed to parse runner from line: ${line}`);
}
