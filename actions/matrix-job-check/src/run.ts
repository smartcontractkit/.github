import * as core from "@actions/core";
import * as github from "@actions/github";

import { getWorkflowJobs } from "./github";

import { getInputs, getInvokeContext } from "./run-inputs";

export async function run(): Promise<void> {
  try {
    // 1. Get inputs and context
    core.startGroup("Inputs and Context");
    const inputs = getInputs();
    const context = getInvokeContext();
    const octokit = github.getOctokit(context.token);
    core.endGroup();

    // 2. Get workflow jobs
    core.startGroup("Fetching Workflow Jobs");
    const jobs = await getWorkflowJobs(
      octokit,
      context.owner,
      context.repo,
      inputs.workflowRunId,
    );
    core.info(
      `Fetched ${jobs.length} jobs for workflow run ID ${inputs.workflowRunId}`,
    );
    const debugData = jobs.map(
      (job) =>
        `${job.name} (ID: ${job.id}, Status: ${job.status}, Conclusion: ${job.conclusion})`,
    );
    core.info(`Jobs data:\n${debugData.join("\n")}`);
    core.endGroup();

    // 3. Filter jobs based on prefix
    core.startGroup("Filtering Jobs");
    const filteredJobs = jobs.filter((job) =>
      job.name.startsWith(inputs.jobNamePrefix),
    );
    core.info(
      `Found ${filteredJobs.length} jobs with prefix "${inputs.jobNamePrefix}"`,
    );
    core.debug(
      `Filtered jobs:\n${filteredJobs.map((job) => job.name).join("\n")}`,
    );
    core.endGroup();

    // 4. Assertions
    core.startGroup("Asserting Job Conditions");

    if (inputs.assertJobsExist) {
      core.info("Asserting that jobs exist...");
      if (filteredJobs.length === 0) {
        throw new Error(`No jobs found with prefix "${inputs.jobNamePrefix}"`);
      }
      core.info("Assertion passed: Jobs exist.");
    }

    if (inputs.assertSuccessful) {
      core.info("Asserting that all filtered jobs are successful...");
      const unsuccessfulJobs = filteredJobs.filter(
        (job) => job.conclusion !== "success",
      );
      if (unsuccessfulJobs.length > 0) {
        const failedJobNames = unsuccessfulJobs
          .map((job) => `${job.name} (${job.conclusion})`)
          .join(", ");
        throw new Error(
          `The following jobs are not successful: ${failedJobNames}`,
        );
      }
      core.info("Assertion passed: All filtered jobs are successful.");
    }

    if (inputs.assertNoFailures) {
      core.info("Asserting that no filtered jobs have failed...");
      const failedJobs = filteredJobs.filter(
        (job) => job.conclusion === "failure",
      );
      if (failedJobs.length > 0) {
        const failedJobNames = failedJobs.map((job) => job.name).join(", ");
        throw new Error(`The following jobs have failed: ${failedJobNames}`);
      }
      core.info("Assertion passed: No filtered jobs have failed.");
    }

    if (inputs.assertNoCancellations) {
      core.info("Asserting that no filtered jobs were cancelled...");
      const cancelledJobs = filteredJobs.filter(
        (job) => job.conclusion === "cancelled",
      );
      if (cancelledJobs.length > 0) {
        const cancelledJobNames = cancelledJobs
          .map((job) => job.name)
          .join(", ");
        throw new Error(
          `The following jobs were cancelled: ${cancelledJobNames}`,
        );
      }
      core.info("Assertion passed: No filtered jobs were cancelled.");
    }

    core.endGroup();
  } catch (error) {
    core.endGroup();
    core.setFailed(`Action failed: ${error}`);
  }
}
