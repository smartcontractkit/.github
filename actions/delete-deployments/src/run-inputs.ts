import * as core from "@actions/core";
import * as github from "@actions/github";

export interface RunInputs {
  ref: string;
  dryRun: boolean;
  repository: string;
  environment: string;
  numOfPages: number | "all";
  startingPage?: number;
}

export type InvokeContext = ReturnType<typeof getInvokeContext>;

export function getInputs(): RunInputs {
  core.info("Getting inputs for run.");

  const inputs: RunInputs = {
    ref: getRunInputString("ref", true),
    dryRun: getRunInputBool("dryRun", false),
    repository: getRunInputStringOrEnv("repository", true),
    environment: getRunInputStringOrEnv("environment", true),
    numOfPages: getNumOfPagesInput("numOfPages", false),
    startingPage: getRunInputNumber("startingPage", false),
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

  const token =
    process.env.GITHUB_TOKEN ||
    core.getInput("github-token", {
      required: true,
    });
  if (!token) {
    core.setFailed("GitHub token is not set.");
    return process.exit(1);
  }

  core.info(
    `Invoke context: ${JSON.stringify({ token: "****", owner, repo }, null, 2)}`,
  );

  return { token, owner, repo };
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
   * Optional validation function.
   */
  validator?: (value: any) => boolean;
}

const runInputsConfiguration: {
  [K in keyof RunInputs]: RunInputConfiguration;
} = {
  ref: {
    parameter: "ref",
    localParameter: "REF",
  },
  dryRun: {
    parameter: "dry-run",
    localParameter: "DRY_RUN",
  },
  repository: {
    parameter: "repository",
    localParameter: "REPOSITORY",
  },
  environment: {
    parameter: "environment",
    localParameter: "ENVIRONMENT",
  },
  numOfPages: {
    parameter: "num-of-pages",
    localParameter: "NUM_OF_PAGES",
    validator: (value) => validateNumberGreaterThanOrEqual(value, 1),
  },
  startingPage: {
    parameter: "starting-page",
    localParameter: "STARTING_PAGE",
    validator: (value) => validateNumberGreaterThanOrEqual(value, 1),
  },
};

function getRunInputString(input: keyof RunInputs, required: boolean = true) {
  const inputKey = getInputKey(input);
  const inputValue = core.getInput(inputKey, {
    required,
  });

  return inputValue;
}

/**
 * Usage of this function is for backwards compatibility.
 */
function getRunInputStringOrEnv(
  input: keyof RunInputs,
  required: boolean = true,
) {
  const inputKey = getInputKey(input);
  const inputValue = core.getInput(inputKey, {
    required: false,
  });

  if (inputValue) {
    return inputValue;
  }
  const localParameter = runInputsConfiguration[input]?.localParameter;

  if (localParameter && process.env[localParameter]) {
    return process.env[localParameter] as string;
  }

  if (required) {
    throw new Error(`Input ${inputKey} is required but not set.`);
  }

  return "";
}

function getRunInputBool(input: keyof RunInputs, required: boolean = true) {
  const inputKey = getInputKey(input);
  const inputValue = core.getBooleanInput(inputKey, {
    required,
  });

  return inputValue;
}

function getRunInputNumber(input: keyof RunInputs, required: boolean = true) {
  const inputKey = getInputKey(input);
  const inputValue = core.getInput(inputKey, {
    required,
  });

  if (!inputValue && !required) {
    return undefined;
  }

  const parsedValue = parseInt(inputValue);
  if (isNaN(parsedValue)) {
    throw new Error(`Input ${inputKey} is not a valid number: ${inputValue}`);
  }

  const validator = runInputsConfiguration[input]?.validator;
  if (validator && !validator(parsedValue)) {
    throw new Error(`Invalid value for input ${inputKey}: ${parsedValue}`);
  }

  return parsedValue;
}

function getNumOfPagesInput(
  input: keyof RunInputs,
  required: boolean = true,
): number | "all" {
  const inputKey = getInputKey(input);
  const inputValue = core.getInput(inputKey, {
    required,
  });

  if (inputValue.toLowerCase() === "all") {
    return "all";
  }

  const parsedValue = parseInt(inputValue);
  if (isNaN(parsedValue)) {
    throw new Error(
      `Input ${inputKey} is not a valid number or 'all': ${inputValue}`,
    );
  }

  const validator = runInputsConfiguration[input]?.validator;
  if (validator && !validator(parsedValue)) {
    throw new Error(`Invalid value for input ${inputKey}: ${parsedValue}`);
  }

  return parsedValue;
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

function validateNumberGreaterThanOrEqual(
  value: number,
  threshold: number,
): boolean {
  return value >= threshold;
}
