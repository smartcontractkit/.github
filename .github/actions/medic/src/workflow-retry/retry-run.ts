/**
 * Shared retry evaluation logic.
 *
 * Encapsulates the "decide whether to retry a single workflow run" flow:
 * Claude analysis -> skip/retry decision -> re-run API call.
 *
 * Used by both the manual `/medic retry` path and the automatic
 * `workflow_run`-triggered path.
 */

import * as core from '@actions/core';
import { analyzeFailure } from './claude-client.js';
import type { OctokitClient, RetryResult } from '../types.js';

export interface WorkflowRunInfo {
  id: number;
  name: string;
  workflowFile: string;
  attempt: number;
  conclusion: string | null;
}

/**
 * Evaluate a single workflow run and retry it if appropriate.
 *
 * Returns a RetryResult describing what happened:
 *  - 'passing'      – run already succeeded
 *  - 'max_attempts' – retry budget exhausted
 *  - 'skipped'      – Claude recommended skip (build/test/lint failure)
 *  - 'retrying'     – re-run triggered
 *  - 'no_runs'      – run is still in progress or has a non-actionable status
 */
export async function evaluateAndRetryRun(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  run: WorkflowRunInfo,
  maxAttempts: number
): Promise<RetryResult> {
  if (run.conclusion === 'success') {
    core.info(`  Already passing`);
    return {
      workflow: run.name,
      workflowFile: run.workflowFile,
      run_id: run.id,
      attempt: run.attempt,
      status: 'passing'
    };
  }

  if (run.attempt >= maxAttempts) {
    core.info(`  Max attempts reached (${run.attempt}/${maxAttempts})`);
    return {
      workflow: run.name,
      workflowFile: run.workflowFile,
      run_id: run.id,
      attempt: run.attempt,
      status: 'max_attempts'
    };
  }

  if (run.conclusion !== 'failure') {
    core.info(`  Status: ${run.conclusion || 'pending'}`);
    return {
      workflow: run.name,
      workflowFile: run.workflowFile,
      run_id: run.id,
      attempt: run.attempt,
      status: 'no_runs'
    };
  }

  const analysis = await analyzeFailure(octokit, owner, repo, run.id);

  if (analysis?.decision === 'skip') {
    core.info(`  Claude recommends SKIP (${analysis.category}): ${analysis.reasoning}`);
    return {
      workflow: run.name,
      workflowFile: run.workflowFile,
      run_id: run.id,
      attempt: run.attempt,
      status: 'skipped',
      analysis
    };
  }

  if (analysis) {
    core.info(`  Claude recommends RETRY (${analysis.category}): ${analysis.reasoning}`);
  }
  core.info(`  Triggering retry (attempt ${run.attempt + 1}/${maxAttempts})`);

  await octokit.rest.actions.reRunWorkflowFailedJobs({
    owner,
    repo,
    run_id: run.id
  });

  return {
    workflow: run.name,
    workflowFile: run.workflowFile,
    run_id: run.id,
    attempt: run.attempt + 1,
    status: 'retrying',
    analysis: analysis ?? undefined
  };
}
