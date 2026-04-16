/**
 * Auto workflow retry — triggered by workflow_run after a failed run.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import {
  evaluateAndRetryRun,
  isAuthorAllowed,
  loadMedicConfigFromFile,
  upsertRetryComment,
  type OctokitClient,
  type RetryResult,
} from '@chainlink/medic';

interface WorkflowRunPayload {
  id: number;
  name: string;
  path: string;
  conclusion: string | null;
  run_attempt: number;
  head_sha: string;
  head_branch: string;
  pull_requests: Array<{ number: number }>;
}

async function isPREligible(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  prNumber: number,
  allowedAuthors: string[],
): Promise<{ eligible: boolean; reason?: string; author?: string; headSha?: string }> {
  const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });

  if (pr.draft) {
    return { eligible: false, reason: 'PR is draft' };
  }

  const author = pr.user?.login || 'unknown';
  if (!isAuthorAllowed(author, allowedAuthors)) {
    return { eligible: false, reason: `author ${author} not on allowlist` };
  }

  return { eligible: true, author, headSha: pr.head.sha };
}

export async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: true });
    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;

    const workflowRun = github.context.payload.workflow_run as WorkflowRunPayload | undefined;
    if (!workflowRun) {
      core.setFailed('No workflow_run in event payload — this action must be triggered by workflow_run');
      return;
    }

    core.info(
      `Auto-retry evaluating: ${workflowRun.name} (run ${workflowRun.id}, conclusion: ${workflowRun.conclusion})`,
    );

    if (workflowRun.conclusion !== 'failure') {
      core.info(`Workflow concluded with "${workflowRun.conclusion}", nothing to retry`);
      return;
    }

    const config = loadMedicConfigFromFile();
    const retryConfig = config.workflow_retry;
    const allowedAuthors = config.merge_conflict.allowed_authors;

    const workflowFile = workflowRun.path.split('/').pop() || '';
    if (!retryConfig.retryable.includes(workflowFile)) {
      core.info(`Workflow "${workflowFile}" is not in the retryable list, skipping`);
      return;
    }

    const runAttempt = workflowRun.run_attempt ?? 1;
    if (runAttempt >= retryConfig.max_attempts) {
      core.info(`Max attempts reached (${runAttempt}/${retryConfig.max_attempts}), skipping`);
      return;
    }

    const pullRequests = workflowRun.pull_requests ?? [];
    if (pullRequests.length === 0) {
      core.info('No associated pull requests found, skipping');
      return;
    }

    for (const prRef of pullRequests) {
      core.info(`Checking PR #${prRef.number} for eligibility`);

      const eligibility = await isPREligible(octokit, owner, repo, prRef.number, allowedAuthors);
      if (!eligibility.eligible) {
        core.info(`  PR #${prRef.number} not eligible: ${eligibility.reason}`);
        continue;
      }

      core.info(`  PR #${prRef.number} eligible (author: ${eligibility.author})`);

      const result = await evaluateAndRetryRun(
        octokit,
        owner,
        repo,
        {
          id: workflowRun.id,
          name: workflowRun.name,
          workflowFile,
          attempt: runAttempt,
          conclusion: workflowRun.conclusion,
        },
        retryConfig.max_attempts,
      );

      const results: RetryResult[] = [result];

      await upsertRetryComment(octokit, owner, repo, prRef.number, {
        results,
        maxAttempts: retryConfig.max_attempts,
        author: eligibility.author!,
        headSha: eligibility.headSha!,
      });

      const status = result.status === 'retrying' ? 'triggered retry' : result.status;
      core.info(`  PR #${prRef.number}: ${status}`);
    }
  } catch (error) {
    core.setFailed(`Auto workflow retry failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

void run();
