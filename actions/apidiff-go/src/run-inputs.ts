import * as core from "@actions/core";
import * as github from "@actions/github";

export interface RunInputs {
  directory: string;
  goModPaths: string[];
  baseRef: string;
  headRef: string;
  enforceCompatible: boolean;
  apidiffVersion: string;
}

export function getInputs(): RunInputs {
  core.info("Getting inputs for run.");

  const inputs: RunInputs = {
    directory: getRunInputString("directory"),
    goModPaths: getRunInputStringArray("goModPaths"),
    baseRef: getRunInputString("baseRef"),
    headRef: getRunInputString("headRef"),
    enforceCompatible: getRunInputBoolean("enforceCompatible"),
    apidiffVersion: getRunInputString("apidiffVersion"),
  };

  core.info(`Inputs: ${JSON.stringify(inputs)}`);
  return inputs;
}

/**
 * Parses the invoke context from Github Actions' context.
 * @returns The invoke context
 */
export function getInvokeContext() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    core.setFailed("GitHub token is not set.");
    return process.exit(1);
  }

  const { context } = github;
  const { pull_request } = context.payload;
  const { owner, repo } = github.context.repo;

  const base: string | undefined = pull_request?.base.sha;
  const head: string | undefined = pull_request?.head.sha;
  const prNumber: number | undefined = pull_request?.number;

  core.info(`Event name: ${context.eventName}`);
  core.info(
    `Owner: ${owner}, Repo: ${repo}, Base: ${base}, Head: ${head}, PR: ${
      prNumber ?? "N/A"
    }`,
  );

  return { token, owner, repo, base, head, prNumber };
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
  directory: {
    parameter: "directory",
    localParameter: "DIRECTORY",
  },
  goModPaths: {
    parameter: "go-mod-paths",
    localParameter: "GO_MOD_PATHS",
  },
  baseRef: {
    parameter: "base-ref",
    localParameter: "BASE_REF",
  },
  headRef: {
    parameter: "head-ref",
    localParameter: "HEAD_REF",
  },
  enforceCompatible: {
    parameter: "enforce-compatible",
    localParameter: "ENFORCE_COMPATIBLE",
  },
  apidiffVersion: {
    parameter: "apidiff-version",
    localParameter: "APIDIFF_VERSION",
  },
};

function getRunInputString(input: keyof RunInputs) {
  const inputKey = getInputKey(input);
  return core.getInput(inputKey, {
    required: true,
  });
}

function getRunInputStringArray(input: keyof RunInputs) {
  const inputKey = getInputKey(input);
  const value = core
    .getInput(inputKey, {
      required: true,
    })
    .trim();

  if (value.includes(",")) {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [value];
}

function getRunInputBoolean(input: keyof RunInputs) {
  const inputKey = getInputKey(input);
  return core.getBooleanInput(inputKey, {
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
  const isLocalDebug = process.env.CL_LOCAL_DEBUG;
  const inputKey = isLocalDebug ? config.localParameter : config.parameter;
  return inputKey;
}
