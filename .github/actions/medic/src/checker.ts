/**
 * Medic Checker - Checks for PRs with merge conflicts
 * 
 * This action is run on cron/dispatch to find eligible PRs with conflicts.
 * It uses GraphQL to efficiently fetch PR data and filters based on:
 * - Author is on allowlist
 * - Not a draft PR
 * - Not a fork PR
 * - Has merge conflicts (CONFLICTING status)
 * - Recently active (pushed < 48h)
 * - No skip labels (medic-attempts:3, medic-skip, etc.)
 * - Not currently being processed (medic-in-progress)
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import {
  getAttemptCount,
  hasExceededMaxAttempts,
  hasLockLabel,
  hasSkipLabel,
  isAuthorAllowed,
  isRecentlyActive
} from './config.js';
import type { GraphQLPullRequest, MergeConflictConfig, PRMatrix, PRMatrixEntry } from './types.js';
import { loadMedicConfigFromFile, DEFAULT_MERGE_CONFLICT_CONFIG } from './workflow-config.js';

/**
 * GraphQL query for fetching open PRs with all required fields
 */
const QUERY = `
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      pullRequests(states: OPEN, first: 100) {
        nodes {
          number
          headRefName
          baseRefName
          isDraft
          mergeable
          reviewDecision
          author { login }
          labels(first: 50) { nodes { name } }
          commits(last: 1) { nodes { commit { pushedDate committedDate } } }
          headRepository { isFork }
        }
      }
    }
  }
`;

/**
 * Response shape from GraphQL query
 */
interface GraphQLResponse {
  repository: {
    pullRequests: {
      nodes: GraphQLPullRequest[];
    };
  };
}

/**
 * Filter PRs to find those eligible for medic conflict resolution.
 * Uses values from medic.yml (or hardcoded defaults) for all thresholds.
 */
export function filterConflictingPRs(prs: GraphQLPullRequest[], config: MergeConflictConfig = DEFAULT_MERGE_CONFLICT_CONFIG): PRMatrixEntry[] {
  return prs.filter(pr => {
    const labels = pr.labels.nodes.map(l => l.name);
    const authorLogin = pr.author?.login || '';
    const lastCommit = pr.commits.nodes[0];
    const activityDate = lastCommit?.commit.pushedDate || lastCommit?.commit.committedDate;

    const shouldInclude = (
      !pr.isDraft &&
      !pr.headRepository?.isFork &&
      isAuthorAllowed(authorLogin, config.allowed_authors) &&
      pr.mergeable === 'CONFLICTING' &&
      isRecentlyActive(activityDate, config.activity_threshold_hours) &&
      !hasExceededMaxAttempts(labels, config.max_attempts) &&
      !hasSkipLabel(labels, config.skip_labels) &&
      !hasLockLabel(labels)
    );

    if (!shouldInclude) {
      core.debug(`Skipping PR #${pr.number}: isDraft=${pr.isDraft}, isFork=${pr.headRepository?.isFork}, author=${authorLogin}, mergeable=${pr.mergeable}, active=${isRecentlyActive(activityDate, config.activity_threshold_hours)}, maxAttempts=${hasExceededMaxAttempts(labels, config.max_attempts)}, hasSkipLabel=${hasSkipLabel(labels, config.skip_labels)}, hasLockLabel=${hasLockLabel(labels)}`);
    }

    return shouldInclude;
  }).map(pr => ({
    number: pr.number,
    headRefName: pr.headRefName,
    baseRefName: pr.baseRefName,
    author: pr.author?.login || 'unknown',
    currentAttempts: getAttemptCount(pr.labels.nodes.map(l => l.name))
  }));
}

/**
 * Main function - entry point for the action
 */
export async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: true });
    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;

    core.info(`Checking for conflicting PRs in ${owner}/${repo}`);

    const mcConfig = loadMedicConfigFromFile().merge_conflict;
    core.info(`Config: allowed_authors=[${mcConfig.allowed_authors.join(', ')}], max_attempts=${mcConfig.max_attempts}, activity_threshold_hours=${mcConfig.activity_threshold_hours}, skip_labels=[${mcConfig.skip_labels.join(', ')}]`);

    const response = await octokit.graphql<GraphQLResponse>(QUERY, { owner, repo });
    const prs = response.repository.pullRequests.nodes;

    core.info(`Found ${prs.length} open PRs`);

    const conflicting = filterConflictingPRs(prs, mcConfig);

    const matrix: PRMatrix = { include: conflicting };

    core.setOutput('matrix', JSON.stringify(matrix));
    core.setOutput('has_conflicts', conflicting.length > 0);

    core.info(`Found ${conflicting.length} eligible PRs with conflicts`);

    for (const pr of conflicting) {
      core.info(`  - PR #${pr.number} by ${pr.author} (attempts: ${pr.currentAttempts})`);
    }
  } catch (error) {
    core.setFailed(`Checker failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run when executed directly (not when imported as a module)
// Using dynamic import check for ESM compatibility
const isMainModule = import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '');
if (isMainModule || process.env.GITHUB_ACTIONS) {
  run();
}

