import * as core from "@actions/core";
import * as github from "@actions/github";

export interface RunInputs {
  postComment: boolean;
}

export function getInputs(): RunInputs {
  core.info("Getting inputs for run.");

  const inputs: RunInputs = {
    postComment: getRunInputBoolean("postComment"),
  };

  core.info(`Inputs: ${JSON.stringify(inputs)}`);
  return inputs;
}

/**
 * Parses the invoke context from Github Actions' context.
 * @returns The invoke context
 */
export function getInvokeContext() {
  const { context } = github;
  const { owner, repo } = github.context.repo;

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.setFailed("GitHub token is not set.");
    return process.exit(1);
  }

  const { pull_request } = context.payload;
  if (!pull_request) {
    throw new Error(
      `No pull request found in the context payload. Event name: ${context.eventName}`,
    );
  }

  const { number: prNumber } = pull_request;
  const { sha: base } = pull_request.base;
  const { sha: head } = pull_request.head;

  if (!base || !head || !prNumber) {
    throw new Error(
      `Missing required pull request information. Base: ${base}, Head: ${head}, PR: ${prNumber}`,
    );
  }

  core.info(`Event name: ${context.eventName}`);
  core.info(
    `Owner: ${owner}, Repo: ${repo}, Base: ${base}, Head: ${head}, PR: ${
      prNumber ?? "N/A"
    } Actor: ${context.actor}`,
  );

  return { token, owner, repo, base, head, prNumber, actor: context.actor };
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
  postComment: {
    parameter: "post-comment",
    localParameter: "POST_COMMENT",
  },
};

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
