/**
 * Medic Fixer – post (cleanup) action entrypoint.
 *
 * Runs after the main fixer step completes (success or failure).
 * Releases the PR lock label and aborts any in-progress merge.
 */

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import { releaseLock } from './labels.js';

export async function run(): Promise<void> {
  const prNumber = parseInt(core.getState('pr-number') || '0', 10);
  const dryRun = core.getState('dry-run') === 'true';
  const locked = core.getState('locked') === 'true';
  const githubToken = core.getState('github-token');

  if (dryRun) {
    core.info('[DRY-RUN] Would release lock');
    return;
  }

  if (locked && githubToken && prNumber > 0) {
    try {
      const octokit = github.getOctokit(githubToken);
      const { owner, repo } = github.context.repo;
      await releaseLock(octokit, owner, repo, prNumber);
    } catch (error) {
      core.warning(`Failed to release lock: ${error}`);
    }
  }

  try {
    await exec.exec('git', ['merge', '--abort'], { ignoreReturnCode: true });
  } catch { /* ignore cleanup errors */ }
}

const isMainModule = import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '');
if (isMainModule || process.env.GITHUB_ACTIONS) {
  run();
}
