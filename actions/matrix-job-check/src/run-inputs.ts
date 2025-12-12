import * as core from "@actions/core";
import * as github from "@actions/github";

export const CL_LOCAL_DEBUG = process.env.CL_LOCAL_DEBUG === "true";
export type InvokeContext = ReturnType<typeof getInvokeContext>;
export interface RunInputs {
  workflowRunId: string;

  jobNamePrefix: string;

  assertJobsExist: boolean;

  assertSuccessful: boolean;

  assertNoFailures: boolean;
}

export function getInputs(): RunInputs {
  core.info("Getting inputs for run.");

  const inputs: RunInputs = {
    workflowRunId: getRunInputString("workflowRunId"),
    jobNamePrefix: getRunInputString("jobNamePrefix"),
    assertJobsExist: getRunInputBoolean("assertJobsExist"),
    assertSuccessful: getRunInputBoolean("assertSuccessful"),
    assertNoFailures: getRunInputBoolean("assertNoFailures"),
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
}

const runInputsConfiguration: {
  [K in keyof RunInputs]: RunInputConfiguration;
} = {
  workflowRunId: {
    parameter: "workflow-run-id",
    localParameter: "WORKFLOW_RUN_ID",
  },
  jobNamePrefix: {
    parameter: "job-name-prefix",
    localParameter: "JOB_NAME_PREFIX",
  },
  assertJobsExist: {
    parameter: "assert-jobs-exist",
    localParameter: "ASSERT_JOBS_EXIST",
  },
  assertSuccessful: {
    parameter: "assert-successful",
    localParameter: "ASSERT_SUCCESSFUL",
  },
  assertNoFailures: {
    parameter: "assert-no-failures",
    localParameter: "ASSERT_NO_FAILURES",
  },
};

function getRunInputString(input: keyof RunInputs, required: boolean = true) {
  const inputKey = getInputKey(input);
  return core.getInput(inputKey, {
    required,
  });
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
