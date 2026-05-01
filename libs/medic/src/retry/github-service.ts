/**
 * GitHub API helpers for workflow run metadata and annotations.
 */

import * as core from "@actions/core";
import type { OctokitClient } from "../types";
import type { Annotation, FailedJob, FailureSummary } from "./analysis-types";

export async function getFailedJobs(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  runId: number,
): Promise<FailedJob[]> {
  const {
    data: { jobs },
  } = await octokit.rest.actions.listJobsForWorkflowRun({
    owner,
    repo,
    run_id: runId,
    filter: "latest",
  });

  const failedJobs: FailedJob[] = [];

  for (const job of jobs) {
    if (job.conclusion !== "failure") continue;

    const failedStep = job.steps?.find((s) => s.conclusion === "failure");
    const annotations = await getJobAnnotations(octokit, owner, repo, job.id);

    failedJobs.push({
      id: job.id,
      name: job.name,
      conclusion: job.conclusion,
      failed_step: failedStep?.name,
      annotations,
    });
  }

  return failedJobs;
}

export async function getJobAnnotations(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  jobId: number,
): Promise<Annotation[]> {
  try {
    const { data } = await octokit.rest.checks.listAnnotations({
      owner,
      repo,
      check_run_id: jobId,
      per_page: 50,
    });

    return data.map(
      (a: {
        annotation_level: string | null;
        path: string;
        start_line: number;
        message: string | null;
      }) => ({
        level:
          a.annotation_level === "failure"
            ? ("failure" as const)
            : ("warning" as const),
        path: a.path ?? "",
        line: a.start_line ?? 0,
        message: a.message ?? "",
      }),
    );
  } catch (error) {
    core.warning(
      `Failed to fetch annotations for job ${jobId}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

export async function getWorkflowSummary(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  runId: number,
): Promise<FailureSummary> {
  const { data: run } = await octokit.rest.actions.getWorkflowRun({
    owner,
    repo,
    run_id: runId,
  });

  const failedJobs = await getFailedJobs(octokit, owner, repo, runId);

  return {
    workflow: run.name ?? "unknown",
    run_id: runId,
    run_attempt: run.run_attempt ?? 1,
    failed_jobs: failedJobs,
  };
}
