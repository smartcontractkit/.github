import * as core from "@actions/core";
import * as github from "@actions/github";

import { getEventData } from "./event";

export interface RunInputs {
  filePatterns: string[];
  modulePatterns: string[];
  noChangeBehaviour: "all" | "none" | "root" | "latest-commit";
}

export type InvokeContext = ReturnType<typeof getInvokeContext>;

export function getInputs(): RunInputs {
  core.info("Getting inputs for run.");

  const inputs: RunInputs = {
    filePatterns: getRunInputStringArray("filePatterns", true),
    modulePatterns: getRunInputStringArray("modulePatterns", true),
    noChangeBehaviour: getRunInputString(
      "noChangeBehaviour",
      true,
    ) as RunInputs["noChangeBehaviour"],
  };

  core.info(`Inputs: ${JSON.stringify(inputs)}`);
  return inputs;
}

/**
 * Parses the invoke context from Github Actions' context.
 * @returns The invoke context
 */
export function getInvokeContext() {
  const { owner, repo } = github.context.repo;

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.setFailed("GitHub token is not set.");
    return process.exit(1);
  }

  const event = getEventData();
  core.info(
    `Invoke context: ${JSON.stringify({ token: "****", owner, repo, event }, null, 2)}`,
  );

  return { token, owner, repo, event };
}

interface RunInputConfiguration {
  /**
   * The parameter name as defined in the action.yml file.
   */
  parameter: string;
  /**
   * The local environment variable name to use when debugging locally.
   * This is typically the parameter name with dashes replaced by underscores.
   * For example, "directory" becomes "DIRECTORY". foo-bar becomes FOO_BAR.
   */
  localParameter: string;

  /**
   * An optional function to validate the input value.
   */
  validator?: (value: string) => boolean;
}

const runInputsConfiguration: {
  [K in keyof RunInputs]: RunInputConfiguration;
} = {
  filePatterns: {
    parameter: "file-patterns",
    localParameter: "FILE_PATTERNS",
  },
  modulePatterns: {
    parameter: "module-patterns",
    localParameter: "MODULE_PATTERNS",
  },
  noChangeBehaviour: {
    parameter: "no-change-behaviour",
    localParameter: "NO_CHANGE_BEHAVIOUR",
    validator: validateNoChangeBehaviourInput,
  },
};

function getRunInputString(input: keyof RunInputs, required: boolean = true) {
  const inputKey = getInputKey(input);
  const inputValue = core.getInput(inputKey, {
    required,
  });
  const validator = runInputsConfiguration[input]?.validator;
  if (inputValue && validator && !validator(inputValue)) {
    throw new Error(`Invalid value for input ${inputKey}: ${inputValue}`);
  }
  return inputValue;
}

/**
 * Note: Exported for testing purposes.
 */
export function getRunInputStringArray(
  input: keyof RunInputs,
  required: boolean = false,
): string[] {
  const inputKey = getInputKey(input);
  const inputValue = core.getInput(inputKey, {
    required,
  });
  if (!inputValue) {
    return [];
  }
  const seperator = inputValue.includes(",") ? "," : "\n";
  core.info(
    `Parsing input ${inputKey} as string array using separator '${seperator}'`,
  );
  return inputValue
    .split(seperator)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function getInputKey(input: keyof RunInputs) {
  const config = runInputsConfiguration[input];
  if (!config) {
    // this should never happen due to type safety
    throw new Error(`No configuration found for input: ${input}`);
  }

  // Use local debug input key if local debugging is enabled
  const isLocalDebug = process.env.CL_LOCAL_DEBUG;
  const inputKey = isLocalDebug ? config.localParameter : config.parameter;
  return inputKey;
}

function validateNoChangeBehaviourInput(
  value: string,
): value is RunInputs["noChangeBehaviour"] {
  return (
    value === "all" ||
    value === "none" ||
    value === "root" ||
    value === "latest-commit"
  );
}
