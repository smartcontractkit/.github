/**
 * Medic Comment Parser - Parses /medic: commands from PR comments
 * 
 * This action is triggered on issue_comment events to process manual
 * medic invocations. It validates:
 * - The commenter is on the allowlist
 * - The comment is on a PR (not an issue)
 * - The PR author is on the allowlist
 * - The PR has merge conflicts (handles UNKNOWN status with retry message)
 * - The PR is not from a fork
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { isAuthorAllowed } from './config.js';
import { removeAllAttemptLabels } from './labels.js';
import type { PRMatrix } from './types.js';

/**
 * Main function - entry point for the action
 */
export async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: true });
    const commentBody = core.getInput('comment-body', { required: true });
    const issueNumber = parseInt(core.getInput('issue-number', { required: true }), 10);
    const commenterLogin = core.getInput('commenter-login', { required: true });
    
    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;

    core.info(`Processing comment on issue #${issueNumber} by ${commenterLogin}`);

    // Parse command from comment - only "merge conflict" supported
    const match = commentBody.match(/\/medic:\s*merge conflict/i);
    if (!match) {
      core.setOutput('should_run', 'false');
      core.info('No valid /medic: command found');
      return;
    }

    core.info('Found /medic: merge conflict command');

    // Check if COMMENTER is authorized (not just PR author)
    if (!isAuthorAllowed(commenterLogin)) {
      await octokit.rest.issues.createComment({
        owner, 
        repo, 
        issue_number: issueNumber,
        body: `**Medic:** Sorry @${commenterLogin}, you are not authorized to invoke medic. Only allowlisted users can trigger automatic merge conflict resolution.`
      });
      core.setOutput('should_run', 'false');
      core.info(`Commenter ${commenterLogin} is not on the allowlist`);
      return;
    }

    // Verify this is a PR (not an issue)
    let pr;
    try {
      const response = await octokit.rest.pulls.get({
        owner, 
        repo, 
        pull_number: issueNumber
      });
      pr = response.data;
    } catch {
      core.setOutput('should_run', 'false');
      core.info('Comment is not on a pull request');
      return;
    }

    // Check if PR author is also on allowlist
    const authorLogin = pr.user?.login || '';
    if (!isAuthorAllowed(authorLogin)) {
      await octokit.rest.issues.createComment({
        owner, 
        repo, 
        issue_number: issueNumber,
        body: `**Medic:** Sorry, the PR author @${pr.user?.login} is not on the allowlist. Medic can only resolve conflicts for allowlisted authors' PRs.`
      });
      core.setOutput('should_run', 'false');
      core.info(`PR author ${authorLogin} is not on the allowlist`);
      return;
    }

    // Check if this is a fork PR (not supported)
    if (pr.head.repo?.fork) {
      await octokit.rest.issues.createComment({
        owner, 
        repo, 
        issue_number: issueNumber,
        body: `**Medic:** Sorry, fork PRs are not currently supported. Please resolve conflicts manually.`
      });
      core.setOutput('should_run', 'false');
      core.info('Fork PRs not supported');
      return;
    }

    // Check mergeable status - handle UNKNOWN specially for comment triggers
    // Note: GitHub's REST API returns mergeable as boolean | null
    // null means GitHub is still computing, which maps to UNKNOWN in GraphQL
    if (pr.mergeable === null) {
      // GitHub returns null when status is being computed
      await octokit.rest.issues.createComment({
        owner, 
        repo, 
        issue_number: issueNumber,
        body: `**Medic:** GitHub is still computing the merge status for this PR. Please try again in a minute with \`/medic: merge conflict\`.`
      });
      core.setOutput('should_run', 'false');
      core.info('Mergeable status is UNKNOWN, asking user to retry');
      return;
    }

    if (pr.mergeable) {
      // PR is mergeable - no conflicts
      await octokit.rest.issues.createComment({
        owner, 
        repo, 
        issue_number: issueNumber,
        body: `**Medic:** This PR doesn't have merge conflicts. Nothing to fix!`
      });
      core.setOutput('should_run', 'false');
      core.info('PR has no merge conflicts');
      return;
    }

    // PR has conflicts (mergeable === false means conflicts)
    core.info(`PR #${issueNumber} has merge conflicts, preparing to fix`);

    // Manual invocation always resets attempt labels (fresh 3 attempts)
    await removeAllAttemptLabels(octokit, owner, repo, issueNumber);
    core.info('Reset attempt counter for manual invocation');

    // Output PR data for fixer (currentAttempts = 0 since we just reset)
    const matrix: PRMatrix = {
      include: [{
        number: pr.number,
        headRefName: pr.head.ref,
        baseRefName: pr.base.ref,
        author: pr.user?.login || 'unknown',
        currentAttempts: 0  // Always 0 for manual invocation
      }]
    };

    core.setOutput('should_run', 'true');
    core.setOutput('pr_number', pr.number.toString());
    core.setOutput('pr_data', JSON.stringify(matrix));
    
    core.info(`Output PR data for fixer: PR #${pr.number}`);
  } catch (error) {
    core.setFailed(`Comment parser failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run when executed directly (not when imported as a module)
const isMainModule = import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '');
if (isMainModule || process.env.GITHUB_ACTIONS) {
  run();
}

