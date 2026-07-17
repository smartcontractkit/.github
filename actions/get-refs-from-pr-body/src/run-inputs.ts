import * as core from "@actions/core";
import * as github from "@actions/github";

export interface RunInputs {
  sigscannerUrl: string;
  sigscannerApiKey: string;
}

export type InvokeContext = ReturnType<typeof getInvokeContext>;

export function getInputs(): RunInputs {
  core.info("Getting inputs for run.");

  const inputs: RunInputs = {
    sigscannerUrl: getRunInputString("sigscannerUrl", true),
    sigscannerApiKey: getRunInputString("sigscannerApiKey", true),
  };

  const redacted = {
    sigscannerUrl: inputs.sigscannerUrl,
    sigscannerApiKey: "<redacted>",
  };
  core.info(`Inputs: ${JSON.stringify(redacted)}`);
  return inputs;
}

export function getInvokeContext() {
  const { owner, repo } = github.context.repo;
  const eventName = github.context.eventName;
  const prNumber = github.context.payload.pull_request?.number;

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
    `Invoke context: ${JSON.stringify(
      { token: "<redacted>", owner, repo, eventName, prNumber },
      null,
      2,
    )}`,
  );

  return { token, owner, repo, eventName, prNumber };
}

interface RunInputConfiguration {
  parameter: string;
  localParameter: string;
}

const runInputsConfiguration: {
  [K in keyof RunInputs]: RunInputConfiguration;
} = {
  sigscannerUrl: {
    parameter: "sigscanner-url",
    localParameter: "SIGSCANNER_URL",
  },
  sigscannerApiKey: {
    parameter: "sigscanner-api-key",
    localParameter: "SIGSCANNER_API_KEY",
  },
};

function getRunInputString(input: keyof RunInputs, required: boolean = true) {
  const inputKey = getInputKey(input);
  return core.getInput(inputKey, { required });
}

function getInputKey(input: keyof RunInputs) {
  const config = runInputsConfiguration[input];
  if (!config) {
    throw new Error(`No configuration found for input: ${input}`);
  }

  const isLocalDebug = process.env.CL_LOCAL_DEBUG;
  return isLocalDebug ? config.localParameter : config.parameter;
}
