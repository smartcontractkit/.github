/**
 * Shared retry evaluation logic.
 */

import * as core from '@actions/core';
import type { OctokitClient, RetryResult } from '../types';
import { analyzeFailure } from './claude-client';

export interface WorkflowRunInfo {
  id: number;
  name: string;
  workflowFile: string;
  attempt: number;
  conclusion: string | null;
}

export async function evaluateAndRetryRun(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  run: WorkflowRunInfo,
  maxAttempts: number,
): Promise<RetryResult> {
  if (run.conclusion === 'success') {
    core.info(`  Already passing`);
    return {
      workflow: run.name,
      workflowFile: run.workflowFile,
      run_id: run.id,
      attempt: run.attempt,
      status: 'passing',
    };
  }

  if (run.attempt >= maxAttempts) {
    core.info(`  Max attempts reached (${run.attempt}/${maxAttempts})`);
    return {
      workflow: run.name,
      workflowFile: run.workflowFile,
      run_id: run.id,
      attempt: run.attempt,
      status: 'max_attempts',
    };
  }

  if (run.conclusion !== 'failure') {
    core.info(`  Status: ${run.conclusion || 'pending'}`);
    return {
      workflow: run.name,
      workflowFile: run.workflowFile,
      run_id: run.id,
      attempt: run.attempt,
      status: 'no_runs',
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
      analysis: {
        decision: analysis.decision,
        category: analysis.category,
        reasoning: analysis.reasoning,
        confidence: analysis.confidence,
        inputTokens: analysis.inputTokens,
        outputTokens: analysis.outputTokens,
      },
    };
  }

  if (analysis) {
    core.info(`  Claude recommends RETRY (${analysis.category}): ${analysis.reasoning}`);
  }
  core.info(`  Triggering retry (attempt ${run.attempt + 1}/${maxAttempts})`);

  await octokit.rest.actions.reRunWorkflowFailedJobs({
    owner,
    repo,
    run_id: run.id,
  });

  return {
    workflow: run.name,
    workflowFile: run.workflowFile,
    run_id: run.id,
    attempt: run.attempt + 1,
    status: 'retrying',
    analysis: analysis
      ? {
          decision: analysis.decision,
          category: analysis.category,
          reasoning: analysis.reasoning,
          confidence: analysis.confidence,
          inputTokens: analysis.inputTokens,
          outputTokens: analysis.outputTokens,
        }
      : undefined,
  };
}
