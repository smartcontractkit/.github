import * as core from "@actions/core";

export const CL_LOCAL_DEBUG = process.env.CL_LOCAL_DEBUG === "true";

export interface RunInputs {
  githubToken: string;
  goModDir: string;
  depPrefix: string;
}

export function getInputs(): RunInputs {
  core.info("Getting inputs for run.");

  const inputs: RunInputs = {
    githubToken: getRunInputString("githubToken"),
    goModDir: getRunInputString("goModDir"),
    depPrefix: getRunInputString("depPrefix"),
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
  githubToken: {
    parameter: "github-token",
    localParameter: "GITHUB_TOKEN",
  },
  goModDir: {
    parameter: "go-mod-dir",
    localParameter: "GO_MOD_DIR",
  },
  depPrefix: {
    parameter: "dep-prefix",
    localParameter: "DEP_PREFIX",
  },
};

function getRunInputString(input: keyof RunInputs) {
  const inputKey = getInputKey(input);
  return core.getInput(inputKey, {
    required: true,
  });
}

function getInputKey(input: keyof RunInputs) {
  const config = runInputsConfiguration[input];
  if (!config) {
    // this should never happen due to type safety
    throw new Error(`No configuration found for input: ${input}`);
  }

  // Use local debug input key if local debugging is enabled
  const inputKey = CL_LOCAL_DEBUG ? config.localParameter : config.parameter;
  return inputKey;
}
