/**
 * Medic Workflow Retry
 * 
 * Core logic for retrying failed workflow runs on a PR.
 * Queries each retryable workflow individually to find failed runs,
 * then triggers re-runs for eligible failures.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { loadMedicConfigFromFile } from './workflow-config.js';
import { upsertRetryComment } from './comments.js';
import { isAuthorAllowed } from './config.js';
import { evaluateAndRetryRun } from './workflow-retry/retry-run.js';
import type { OctokitClient, RetryResult, WorkflowRetryConfig, WorkflowRetryInputs } from './types.js';

/**
 * Retry failed workflows for a PR
 */
export async function retryFailedWorkflows(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  prNumber: number,
  config: WorkflowRetryConfig
): Promise<RetryResult[]> {
  // 1. Get PR to find head SHA
  const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });
  const headSha = pr.head.sha;
  
  core.info(`Checking workflows for PR #${prNumber} (head SHA: ${headSha.substring(0, 7)})`);
  
  const results: RetryResult[] = [];
  
  // 2. Query each retryable workflow individually (avoids pagination issues)
  for (const workflowFile of config.retryable) {
    try {
      core.info(`Checking workflow: ${workflowFile}`);
      
      const { data: { workflow_runs } } = await octokit.rest.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: workflowFile,
        head_sha: headSha,
        per_page: 10
      });
      
      if (workflow_runs.length === 0) {
        core.info(`  No runs found for ${workflowFile}`);
        results.push({
          workflow: workflowFile,
          workflowFile,
          run_id: undefined,
          attempt: 0,
          status: 'no_runs'
        });
        continue;
      }
      
      const latestRun = workflow_runs[0];
      const runAttempt = latestRun.run_attempt ?? 1;
      core.info(`  Latest run: #${latestRun.run_number} (${latestRun.conclusion || latestRun.status}), attempt ${runAttempt}`);
      
      const result = await evaluateAndRetryRun(octokit, owner, repo, {
        id: latestRun.id,
        name: latestRun.name || workflowFile,
        workflowFile,
        attempt: runAttempt,
        conclusion: latestRun.conclusion
      }, config.max_attempts);
      
      results.push(result);
    } catch (error) {
      core.warning(`  Error checking ${workflowFile}: ${error instanceof Error ? error.message : String(error)}`);
      results.push({
        workflow: workflowFile,
        workflowFile,
        run_id: undefined,
        attempt: 0,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return results;
}

/**
 * Parse inputs from environment/core
 */
function getInputs(): WorkflowRetryInputs {
  return {
    githubToken: core.getInput('github-token', { required: true }),
    prNumber: parseInt(core.getInput('pr-number', { required: true }), 10)
  };
}

/**
 * Main function - entry point for the action
 */
export async function run(): Promise<void> {
  try {
    const inputs = getInputs();
    const octokit = github.getOctokit(inputs.githubToken);
    const { owner, repo } = github.context.repo;
    
    core.info(`Starting workflow retry for PR #${inputs.prNumber}`);
    
    // Load configuration from repository
    const config = loadMedicConfigFromFile().workflow_retry;
    
    if (config.retryable.length === 0) {
      core.warning('No retryable workflows configured in .github/medic.yml');
      return;
    }
    
    // Get PR details for the comment
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: inputs.prNumber
    });
    
    // Check if the commenter is allowed (reuse existing allowlist)
    const commenterLogin = core.getInput('commenter-login') || pr.user?.login || 'unknown';
    if (!isAuthorAllowed(commenterLogin)) {
      core.warning(`User ${commenterLogin} is not on the allowlist`);
      return;
    }
    
    // Run the retry logic
    const results = await retryFailedWorkflows(octokit, owner, repo, inputs.prNumber, config);
    
    // Post summary comment
    const retriedCount = results.filter(r => r.status === 'retrying').length;
    core.info(`Retry complete: ${retriedCount} workflow(s) triggered for retry`);
    
    await upsertRetryComment(octokit, owner, repo, inputs.prNumber, {
      results,
      maxAttempts: config.max_attempts,
      author: pr.user?.login || 'unknown',
      headSha: pr.head.sha
    });
    
    // Set outputs
    core.setOutput('retried_count', retriedCount);
    core.setOutput('results', JSON.stringify(results));
    
  } catch (error) {
    core.setFailed(`Workflow retry failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run when executed directly
const isMainModule = import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '');
if (isMainModule || process.env.GITHUB_ACTIONS) {
  run();
}

