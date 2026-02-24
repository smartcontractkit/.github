import * as core from "@actions/core";
import * as github from "@actions/github";

export type Octokit = ReturnType<typeof github.getOctokit>;

import {
  getOctokit,
  listDeployments,
  createDeploymentStatus,
  deleteDeployment,
} from "./github";
import { getInputs, getInvokeContext } from "./run-inputs";

export async function run(): Promise<void> {
  try {
    // 1. Get inputs and context
    core.startGroup("Inputs and Context");
    const context = getInvokeContext();
    core.info(
      `Extracted Context: ${JSON.stringify({ ...context, token: "<redacted>" }, null, 2)}`,
    );

    const inputs = getInputs();
    if (inputs.numOfPages === "all" && inputs.startingPage != null) {
      throw new Error(`Cannot use  starting-page when num-of-pages=all`);
    }
    core.info(`Extracted Inputs: ${JSON.stringify(inputs, null, 2)}`);

    const octokit = getOctokit(context.token);
    core.endGroup();

    // 2. Get deployments
    core.startGroup("Getting deployments");

    const parts = inputs.repository.split("/");
    if (parts.length !== 2) {
      throw new Error(
        `Invalid repository format: ${inputs.repository}. Expected format is 'owner/repo'.`,
      );
    }

    const [owner, repo] = parts;
    const deployments = await listDeployments(
      octokit,
      owner,
      repo,
      inputs.environment,
      {
        numOfPages: inputs.numOfPages,
        startingPage: inputs.startingPage,
      },
      inputs.ref,
    );

    const deploymentIds = deployments.map((d) => d.id);
    core.info(`Found ${deploymentIds.length} deployments to delete.`);
    core.endGroup();

    // 3. Delete deployments
    core.startGroup("Deleting deployments");
    await deleteDeployments(octokit, owner, repo, deploymentIds, inputs.dryRun);
    core.endGroup();
  } catch (error) {
    core.endGroup();
    core.setFailed(`Action failed: ${error}`);
  }
}

async function deleteDeployments(
  octokit: Octokit,
  owner: string,
  repo: string,
  deploymentIds: number[],
  dryRun: boolean,
) {
  core.info(`Deleting deployments (${deploymentIds.length})`);

  const deletionResults = deploymentIds.map(async (id) => {
    if (dryRun) {
      core.info(`[Dry Run] Would delete deployment with id ${id}`);
      return;
    }

    const status = await createDeploymentStatus(octokit, owner, repo, id);
    if (status) {
      core.info(
        `Set deployment status to 'inactive' for deployment with id ${id}`,
      );
    } else {
      return false;
    }

    const deletion = await deleteDeployment(octokit, owner, repo, id);
    if (deletion) {
      core.info(`Deleted deployment with id ${id}`);
      return true;
    }

    return false;
  });

  const processed = await Promise.all(deletionResults);
  const succeeded = processed.filter((p) => !!p);
  core.info(
    `Successfully deleted ${succeeded.length}/${processed.length} deployments`,
  );
}
