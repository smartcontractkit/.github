/**
 * GitHub service for fetching workflow run metadata and annotations.
 * Used by Claude analysis to understand why a workflow run failed.
 */

import * as core from '@actions/core';
import type { OctokitClient } from '../types.js';
import type { Annotation, FailedJob, FailureSummary } from './types.js';

/**
 * Get all jobs with conclusion: failure for a workflow run
 */
export async function getFailedJobs(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  runId: number
): Promise<FailedJob[]> {
  const { data: { jobs } } = await octokit.rest.actions.listJobsForWorkflowRun({
    owner,
    repo,
    run_id: runId,
    filter: 'latest'
  });

  const failedJobs: FailedJob[] = [];

  for (const job of jobs) {
    if (job.conclusion !== 'failure') continue;

    const failedStep = job.steps?.find(s => s.conclusion === 'failure');
    const annotations = await getJobAnnotations(octokit, owner, repo, job.id);

    failedJobs.push({
      id: job.id,
      name: job.name,
      conclusion: job.conclusion,
      failed_step: failedStep?.name,
      annotations
    });
  }

  return failedJobs;
}

/**
 * Fetch check run annotations for a specific job.
 * Annotations contain compiler errors, test failures, lint violations, etc.
 */
export async function getJobAnnotations(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  jobId: number
): Promise<Annotation[]> {
  try {
    const { data } = await octokit.rest.checks.listAnnotations({
      owner,
      repo,
      check_run_id: jobId,
      per_page: 50
    });

    return data.map((a: { annotation_level: string | null; path: string; start_line: number; message: string | null }) => ({
      level: a.annotation_level === 'failure' ? 'failure' as const : 'warning' as const,
      path: a.path ?? '',
      line: a.start_line ?? 0,
      message: a.message ?? ''
    }));
  } catch (error) {
    core.warning(`Failed to fetch annotations for job ${jobId}: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Build a complete failure summary for a workflow run.
 * Combines job metadata with annotations for each failed job.
 */
export async function getWorkflowSummary(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  runId: number
): Promise<FailureSummary> {
  const { data: run } = await octokit.rest.actions.getWorkflowRun({
    owner,
    repo,
    run_id: runId
  });

  const failedJobs = await getFailedJobs(octokit, owner, repo, runId);

  return {
    workflow: run.name ?? 'unknown',
    run_id: runId,
    run_attempt: run.run_attempt ?? 1,
    failed_jobs: failedJobs
  };
}
