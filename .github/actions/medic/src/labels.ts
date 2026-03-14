/**
 * Medic Labels - Utility functions for managing PR labels
 * 
 * Handles:
 * - Attempt tracking labels (medic-attempts:1, :2, :3)
 * - Lock label (medic-in-progress) for concurrency control
 */

import * as core from '@actions/core';
import type { OctokitClient } from './types.js';
import { ATTEMPT_LABEL_PREFIX, LOCK_LABEL } from './config.js';
import { DEFAULT_MERGE_CONFLICT_CONFIG } from './workflow-config.js';

/**
 * Increment the attempt counter label.
 */
export async function incrementAttempts(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  prNumber: number,
  current: number,
  maxAttempts: number = DEFAULT_MERGE_CONFLICT_CONFIG.max_attempts,
): Promise<void> {
  if (current > 0 && current <= maxAttempts) {
    try {
      await octokit.rest.issues.removeLabel({
        owner,
        repo,
        issue_number: prNumber,
        name: `${ATTEMPT_LABEL_PREFIX}${current}`
      });
      core.info(`Removed label ${ATTEMPT_LABEL_PREFIX}${current}`);
    } catch {
      core.debug(`Label ${ATTEMPT_LABEL_PREFIX}${current} not present`);
    }
  }

  const nextAttempt = Math.min(current + 1, maxAttempts);
  await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: prNumber,
    labels: [`${ATTEMPT_LABEL_PREFIX}${nextAttempt}`]
  });
  core.info(`Added label ${ATTEMPT_LABEL_PREFIX}${nextAttempt}`);
}

/**
 * Remove all attempt labels from a PR (up to maxAttempts).
 */
export async function removeAllAttemptLabels(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  prNumber: number,
  maxAttempts: number = DEFAULT_MERGE_CONFLICT_CONFIG.max_attempts,
): Promise<void> {
  for (let i = 1; i <= maxAttempts; i++) {
    const label = `${ATTEMPT_LABEL_PREFIX}${i}`;
    try {
      await octokit.rest.issues.removeLabel({
        owner,
        repo,
        issue_number: prNumber,
        name: label
      });
      core.info(`Removed label ${label}`);
    } catch {
      core.debug(`Label ${label} not present`);
    }
  }
}

/**
 * Acquire the lock label to prevent concurrent processing.
 * Checks whether the label is already present first so that a second
 * caller can detect the lock is held and bail out.
 *
 * @returns true if the lock was acquired, false if already held.
 */
export async function acquireLock(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  prNumber: number
): Promise<boolean> {
  const { data: labels } = await octokit.rest.issues.listLabelsOnIssue({
    owner,
    repo,
    issue_number: prNumber,
  });

  if (labels.some(l => l.name === LOCK_LABEL)) {
    core.warning(`Lock already held: label ${LOCK_LABEL} is present on PR #${prNumber}`);
    return false;
  }

  await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: prNumber,
    labels: [LOCK_LABEL],
  });
  core.info(`Acquired lock: added label ${LOCK_LABEL}`);
  return true;
}

/**
 * Release the lock label to allow future processing
 * Should be called in the finally block of the fixer job
 */
export async function releaseLock(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  prNumber: number
): Promise<void> {
  try {
    await octokit.rest.issues.removeLabel({
      owner,
      repo,
      issue_number: prNumber,
      name: LOCK_LABEL
    });
    core.info(`Released lock: removed label ${LOCK_LABEL}`);
  } catch {
    // Label might not exist, ignore
    core.debug(`Lock label ${LOCK_LABEL} not present`);
  }
}

