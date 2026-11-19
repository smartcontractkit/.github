import * as core from "@actions/core";
import * as exec from "@actions/exec";

import { installBinary } from "./download";

// Pinned pr-triage release. Bump this single line when a new release ships;
// callers override it with the `version` input.
export const RELEASE_VERSION = "v0.1.0";

export interface ActionInputs {
  version: string;
  githubToken: string;
  releaseToken: string;
  orgToken: string;
  dryRun: boolean;
  skipReviewerRequests: boolean;
  allowNonOrgReviewers: boolean;
  verbose: boolean;
  noAi: boolean;
  aiApiKey: string;
  aiBaseUrl: string;
  logLevel: string;
}

function boolInput(name: string): boolean {
  return core.getInput(name) === "true";
}

export function readInputs(): ActionInputs {
  return {
    version: core.getInput("version").trim() || RELEASE_VERSION,
    githubToken: core.getInput("github-token"),
    releaseToken: core.getInput("release-token"),
    orgToken: core.getInput("org-token"),
    dryRun: boolInput("dry-run"),
    skipReviewerRequests: boolInput("skip-reviewer-requests"),
    allowNonOrgReviewers: boolInput("allow-non-org-reviewers"),
    verbose: boolInput("verbose"),
    noAi: boolInput("no-ai"),
    aiApiKey: core.getInput("ai-api-key"),
    aiBaseUrl: core.getInput("ai-base-url"),
    logLevel: core.getInput("log-level").trim(),
  };
}

export function maskSecrets(inputs: ActionInputs): void {
  for (const secret of [
    inputs.githubToken,
    inputs.releaseToken,
    inputs.orgToken,
    inputs.aiApiKey,
  ]) {
    if (secret !== "") {
      core.setSecret(secret);
    }
  }
}

export function buildArgs(inputs: ActionInputs): string[] {
  const args = ["analyze"];

  if (inputs.dryRun) {
    args.push("--dry-run");
  }
  if (inputs.skipReviewerRequests) {
    args.push("--skip-reviewer-requests");
  }
  if (inputs.allowNonOrgReviewers) {
    args.push("--allow-non-org-reviewers");
  }
  if (inputs.verbose) {
    args.push("--verbose");
  }
  if (inputs.noAi) {
    args.push("--no-ai");
  }
  if (inputs.logLevel !== "") {
    args.push("--log-level", inputs.logLevel);
  }

  return args;
}

function setOrDelete(
  env: { [key: string]: string },
  name: string,
  value: string,
): void {
  if (value === "") {
    delete env[name];
  } else {
    env[name] = value;
  }
}

// The child environment is the runner's environment minus the release token,
// plus the tokens pr-triage itself reads. The release token stays out of the
// analyzed repository's reach: for JavaScript actions the runner exports every
// input as INPUT_<NAME>, so the input copy is removed alongside the explicit
// variable.
export function buildChildEnv(
  inputs: ActionInputs,
  base: NodeJS.ProcessEnv = process.env,
): { [key: string]: string } {
  const env: { [key: string]: string } = {};
  for (const [name, value] of Object.entries(base)) {
    if (value !== undefined) {
      env[name] = value;
    }
  }

  delete env["INPUT_RELEASE-TOKEN"];

  env.GITHUB_TOKEN = inputs.githubToken;
  setOrDelete(env, "PR_TRIAGE_ORG_TOKEN", inputs.orgToken);
  setOrDelete(env, "PR_TRIAGE_AI_API_KEY", inputs.aiApiKey);
  setOrDelete(env, "PR_TRIAGE_AI_BASE_URL", inputs.aiBaseUrl);

  return env;
}

export async function run(): Promise<void> {
  try {
    const inputs = readInputs();
    maskSecrets(inputs);

    const binPath = await installBinary({
      version: inputs.version,
      releaseToken: inputs.releaseToken,
    });

    await exec.exec(binPath, buildArgs(inputs), {
      env: buildChildEnv(inputs),
    });
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}
