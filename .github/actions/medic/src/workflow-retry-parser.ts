/**
 * Medic Workflow Retry Parser - Parses /medic retry commands from PR comments
 * 
 * This action is triggered on issue_comment events to process workflow retry
 * invocations. It validates:
 * - The comment contains /medic retry
 * - The commenter is on the allowlist
 * - The comment is on a PR (not an issue)
 * - The PR is not from a fork
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { isAuthorAllowed } from './config.js';

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

    core.info(`Processing retry command on issue #${issueNumber} by ${commenterLogin}`);

    // Parse command from comment - support both "/medic retry" and "/medic: retry"
    const match = commentBody.match(/\/medic:?\s*retry/i);
    if (!match) {
      core.setOutput('should_retry', 'false');
      core.info('No valid /medic retry command found');
      return;
    }

    core.info('Found /medic retry command');

    // Check if COMMENTER is authorized
    if (!isAuthorAllowed(commenterLogin)) {
      await octokit.rest.issues.createComment({
        owner, 
        repo, 
        issue_number: issueNumber,
        body: `**Medic:** Sorry @${commenterLogin}, you are not authorized to invoke medic retry. Only allowlisted users can trigger workflow retries.`
      });
      core.setOutput('should_retry', 'false');
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
      await octokit.rest.issues.createComment({
        owner, 
        repo, 
        issue_number: issueNumber,
        body: `**Medic:** This command can only be used on pull requests.`
      });
      core.setOutput('should_retry', 'false');
      core.info('Comment is not on a pull request');
      return;
    }

    // Check if this is a fork PR (not supported for retry due to permissions)
    if (pr.head.repo?.fork) {
      await octokit.rest.issues.createComment({
        owner, 
        repo, 
        issue_number: issueNumber,
        body: `**Medic:** Sorry, fork PRs are not currently supported for workflow retry. Please retry workflows manually.`
      });
      core.setOutput('should_retry', 'false');
      core.info('Fork PRs not supported');
      return;
    }

    // Validation passed - output PR info for retry job
    core.setOutput('should_retry', 'true');
    core.setOutput('pr_number', pr.number.toString());
    core.setOutput('commenter_login', commenterLogin);
    
    core.info(`Validated retry request for PR #${pr.number}`);
  } catch (error) {
    core.setFailed(`Retry parser failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run when executed directly (not when imported as a module)
const isMainModule = import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '');
if (isMainModule || process.env.GITHUB_ACTIONS) {
  run();
}

