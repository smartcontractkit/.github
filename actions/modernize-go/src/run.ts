import * as github from "@actions/github";
import * as core from "@actions/core";

import { CL_LOCAL_DEBUG, getInvokeContext, getInputs } from "./run-inputs";

export async function run(): Promise<void> {
  try {
    core.startGroup("Context");
    const context = getInvokeContext();
    const octokit = github.getOctokit(context.token);
    core.debug(`Context: ${JSON.stringify(context, null, 2)}`);
    const inputs = getInputs();
    core.debug(`Inputs: ${JSON.stringify(inputs)}`);
    core.endGroup();

    const { token, owner, repo, prNumber } = context;
  } catch (error) {
    core.endGroup();
    core.setFailed(`Action failed: ${error}`);
  }
}
