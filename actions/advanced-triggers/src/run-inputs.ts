import * as core from "@actions/core";
import * as github from "@actions/github";

import { getEventData } from "./event";

export interface RunInputs {
  forceAll: string;
  fileSets: string;
  triggers: string;
  repositoryRoot: string;
}

export type InvokeContext = ReturnType<typeof getInvokeContext>;

export function getInputs(): RunInputs {
  core.info("Getting inputs for run.");

  const inputs: RunInputs = {
    forceAll: getRunInputString("forceAll", false),
    fileSets: getRunInputString("fileSets", false),
    triggers: getRunInputString("triggers", true),
    repositoryRoot: getRunInputString("repositoryRoot", true),
  };

  // Log inputs, but truncate long strings to keep logs readable.
  const loggable = {
    ...inputs,
    fileSets:
      inputs.fileSets.length > 200
        ? inputs.fileSets.slice(0, 200) + "..."
        : inputs.fileSets,
    triggers:
      inputs.triggers.length > 200
        ? inputs.triggers.slice(0, 200) + "..."
        : inputs.triggers,
  };
  core.info(`Inputs: ${JSON.stringify(loggable)}`);
  return inputs;
}

/**
 * Parses the invoke context from GitHub Actions' context.
 */
export function getInvokeContext() {
  const { owner, repo } = github.context.repo;

  const token =
    process.env.GITHUB_TOKEN ||
    core.getInput("github-token", {
      required: true,
    });
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
   * When CL_LOCAL_DEBUG is set, this name is used instead of `parameter`.
   * core.getInput reads from INPUT_<NAME> env vars, so set INPUT_TRIGGERS, etc.
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
  forceAll: {
    parameter: "force-all",
    localParameter: "FORCE_ALL",
    validator: (v) => v === "true" || v === "false",
  },
  fileSets: {
    parameter: "file-sets",
    localParameter: "FILE_SETS",
  },
  triggers: {
    parameter: "triggers",
    localParameter: "TRIGGERS",
  },
  repositoryRoot: {
    parameter: "repository-root",
    localParameter: "REPOSITORY_ROOT",
  },
};

function getRunInputString(input: keyof RunInputs, required: boolean = true) {
  const inputKey = getInputKey(input);
  const inputValue = core.getInput(inputKey, { required });
  const validator = runInputsConfiguration[input]?.validator;
  if (inputValue && validator && !validator(inputValue)) {
    throw new Error(`Invalid value for input ${inputKey}: ${inputValue}`);
  }
  return inputValue;
}

function getInputKey(input: keyof RunInputs) {
  const config = runInputsConfiguration[input];
  if (!config) {
    // this should never happen due to type safety
    throw new Error(`No configuration found for input: ${input}`);
  }

  // Use local debug input key if local debugging is enabled.
  const isLocalDebug = process.env.CL_LOCAL_DEBUG;
  const inputKey = isLocalDebug ? config.localParameter : config.parameter;
  return inputKey;
}
