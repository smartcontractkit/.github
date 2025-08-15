import * as core from "@actions/core";

export interface RunInputs {
  subDirectory: string;
  baseRef?: string;
  headRef?: string;
}

export function getInputs(): RunInputs {
  core.info("Getting inputs for run.");

  const inputs: RunInputs = {
    subDirectory: getRunInputString("subDirectory", true),
    baseRef: getRunInputString("baseRef", false),
    headRef: getRunInputString("headRef", false),
  };

  core.info(`Inputs: ${JSON.stringify(inputs)}`);
  return inputs;
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
}

const runInputsConfiguration: {
  [K in keyof RunInputs]: RunInputConfiguration;
} = {
  subDirectory: {
    parameter: "sub-directory",
    localParameter: "SUB_DIRECTORY",
  },
  baseRef: {
    parameter: "baseRef",
    localParameter: "BASE_REF",
  },
  headRef: {
    parameter: "headRef",
    localParameter: "HEAD_REF",
  },
};

function getRunInputString(input: keyof RunInputs, required: boolean = true) {
  const inputKey = getInputKey(input);
  return core.getInput(inputKey, {
    required,
  });
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
