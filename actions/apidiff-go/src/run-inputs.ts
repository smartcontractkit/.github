import * as core from "@actions/core";
import * as github from "@actions/github";

import { getEventData } from "./event";

export const CL_LOCAL_DEBUG = process.env.CL_LOCAL_DEBUG === "true";
export type InvokeContext = ReturnType<typeof getInvokeContext>;
export interface RunInputs {
  repositoryRoot: string;
  moduleDirectory: string;
  baseRefOverride: string;
  headRefOverride: string;
  enforceCompatible: boolean;
  postComment: boolean;
  apidiffVersion: string;
  summaryUrl: string;
}

export function getInputs(): RunInputs {
  core.info("Getting inputs for run.");

  const inputs: RunInputs = {
    repositoryRoot: getRunInputString("repositoryRoot"),
    moduleDirectory: getRunInputString("moduleDirectory"),
    baseRefOverride: getRunInputString("baseRefOverride", false),
    headRefOverride: getRunInputString("headRefOverride", false),
    enforceCompatible: getRunInputBoolean("enforceCompatible"),
    postComment: getRunInputBoolean("postComment"),
    apidiffVersion: getRunInputString("apidiffVersion"),
    summaryUrl: getRunInputString("summaryUrl"),
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

  const event = getEventData();
  core.info(
    `Invoke context: ${JSON.stringify({ token: "<redacted>", owner, repo, event }, null, 2)}`,
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
}

const runInputsConfiguration: {
  [K in keyof RunInputs]: RunInputConfiguration;
} = {
  repositoryRoot: {
    parameter: "repository-root",
    localParameter: "REPOSITORY_ROOT",
  },
  moduleDirectory: {
    parameter: "module-directory",
    localParameter: "MODULE_DIRECTORY",
  },
  baseRefOverride: {
    parameter: "base-ref-override",
    localParameter: "BASE_REF_OVERRIDE",
  },
  headRefOverride: {
    parameter: "head-ref-override",
    localParameter: "HEAD_REF_OVERRIDE",
  },
  enforceCompatible: {
    parameter: "enforce-compatible",
    localParameter: "ENFORCE_COMPATIBLE",
  },
  postComment: {
    parameter: "post-comment",
    localParameter: "POST_COMMENT",
  },
  apidiffVersion: {
    parameter: "apidiff-version",
    localParameter: "APIDIFF_VERSION",
  },
  summaryUrl: {
    parameter: "summary-url",
    localParameter: "SUMMARY_URL",
  },
};

function getRunInputString(input: keyof RunInputs, required: boolean = true) {
  const inputKey = getInputKey(input);
  return core.getInput(inputKey, {
    required,
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
