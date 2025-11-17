import * as core from "@actions/core";
import * as github from "@actions/github";

export const CL_LOCAL_DEBUG = process.env.CL_LOCAL_DEBUG === "true";

export interface RunInputs {
  postComment: boolean;
  membersReadGitHubToken: string;

  minimumCodeOwners: number;
  minimumCodeOwnersEntries: number;
}

export function getInputs(): RunInputs {
  core.info("Getting inputs for run.");

  const inputs: RunInputs = {
    postComment: getRunInputBoolean("postComment"),
    membersReadGitHubToken: getRunInputString("membersReadGitHubToken"),
    minimumCodeOwners: getRunInputNumber("minimumCodeOwners"),
    minimumCodeOwnersEntries: getRunInputNumber("minimumCodeOwnersEntries"),
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

  let prNumber: number | undefined = -1;
  switch (context.eventName) {
    case "pull_request":
    case "pull_request_target":
    case "pull_request_review":
    case "pull_request_review_comment":
      prNumber = context.payload.pull_request?.number;
      break;
    case "issue_comment":
      // Only present if the comment is on a PR (not a plain issue)
      const { issue } = context.payload;
      if (issue?.pull_request) {
        prNumber = issue.pull_request?.number || issue.number;
        break;
      }
    default:
      // Generic fallback: some events still populate context.issue.number for PRs
      prNumber = github.context?.issue?.number;
      break;
  }

  if (!prNumber || prNumber <= 0) {
    core.setFailed(
      `Could not determine PR number from context for event: ${context.eventName}`,
    );
    return process.exit(1);
  }

  const { actor } = context;
  core.info(`Event name: ${context.eventName}`);
  core.info(`Owner: ${owner}, Repo: ${repo}, PR: ${prNumber} Actor: ${actor}`);

  return { token, owner, repo, prNumber, actor };
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
  membersReadGitHubToken: {
    parameter: "members-read-github-token",
    localParameter: "MEMBERS_READ_GITHUB_TOKEN",
  },
  minimumCodeOwners: {
    parameter: "minimum-codeowners",
    localParameter: "MINIMUM_CODE_OWNERS",
  },
  minimumCodeOwnersEntries: {
    parameter: "minimum-codeowners-entries",
    localParameter: "MINIMUM_CODE_OWNERS_ENTRIES",
  },
};

function getRunInputBoolean(input: keyof RunInputs) {
  const inputKey = getInputKey(input);
  return core.getBooleanInput(inputKey, {
    required: true,
  });
}

function getRunInputString(input: keyof RunInputs) {
  const inputKey = getInputKey(input);
  return core.getInput(inputKey, {
    required: true,
  });
}

function getRunInputNumber(input: keyof RunInputs) {
  const inputKey = getInputKey(input);
  const inputValue = core.getInput(inputKey, {
    required: true,
  });
  const parsed = Number(inputValue);
  if (isNaN(parsed)) {
    throw new Error(`Input ${inputKey} is not a valid number: ${inputValue}`);
  }
  return parsed;
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
