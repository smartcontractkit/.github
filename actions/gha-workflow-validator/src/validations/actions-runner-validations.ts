import { mapAndFilterUndefined, ParsedFile, FileLine } from "../utils.js";
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

  async validate(parsedFile: ParsedFile): Promise<FileValidationResult> {
    core.debug(`Validating action references in ${parsedFile.filename}`);
    const { filename } = parsedFile;

    const lineActionsRunners = mapAndFilterUndefined(
      parsedFile.lines,
      extractActionsRunner,
    );

    const lineValidations: LineValidationResult[] =
      await validateActionsRunners(filename, lineActionsRunners);

    return {
      filename,
      lineValidations,
    };
  }
}

async function validateActionsRunners(
  filename: string,
  lines: FileLineActionsRunner[],
): Promise<LineValidationResult[]> {
  const lineValidationResults: LineValidationResult[] = [];

  for (const line of lines) {
    const validationErrors = await validateActionsRunner(line.actionsRunner);

    if (validationErrors.length > 0) {
      lineValidationResults.push({
        filename,
        line,
        messages: validationErrors,
      });
    }
  }

  return lineValidationResults;
}

async function validateActionsRunner(
  actionsRunner: ActionsRunner | undefined,
): Promise<ValidationMessage[]> {
  if (!actionsRunner) {
    return [];
  }

  if (actionsRunner.cores >= 16 || actionsRunner.os === "macos") {
    return [
      {
        type: ValidationType.RUNNER,
        severity: "error",
        message: `Actions runner is too expensive (${actionsRunner.identifier})`,
      },
    ];
  }

  return [];
}

function extractActionsRunner(
  fileLine: FileLine,
): FileLineActionsRunner | undefined {
  const actionsRunner = extractActionRunnerFromLine(fileLine.content);
  if (!actionsRunner) {
    return;
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

    let cores = 0;
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
