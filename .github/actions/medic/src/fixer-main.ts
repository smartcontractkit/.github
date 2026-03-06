/**
 * Medic Fixer – main action entrypoint.
 *
 * Consolidates the previous fixer-setup → shell-Claude → fixer-post pipeline
 * into a single Node action lifecycle step.
 *
 * Lock release and git cleanup are handled by the companion post step
 * (fixer-cleanup.ts) so they run even when this step fails.
 */

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import { upsertComment } from './comments.js';
import { acquireLock, incrementAttempts, removeAllAttemptLabels } from './labels.js';
import { extractConflictMetadata } from './lib/conflict.js';
import { loadPrompt } from './lib/prompts.js';
import type { ClaudeResult, FixerInputs, MergeConflictConfig, TokenUsage } from './types.js';
import { loadMedicConfigFromFile } from './workflow-config.js';

// ── helpers ─────────────────────────────────────────────────────────────────

const CLAUDE_TIMEOUT_MS = 5.5 * 60 * 1000;

export function parseClaudeTokens(output: string): TokenUsage {
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheCreationTokens = 0;
  let cacheReadTokens = 0;

  for (const line of output.split('\n')) {
    if (line.includes('"type":"result"') || line.includes('"type": "result"')) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.input_tokens) inputTokens = parsed.input_tokens;
        if (parsed.output_tokens) outputTokens = parsed.output_tokens;
        if (parsed.cache_creation_input_tokens) cacheCreationTokens = parsed.cache_creation_input_tokens;
        if (parsed.cache_read_input_tokens) cacheReadTokens = parsed.cache_read_input_tokens;
      } catch { /* continue */ }
    }
  }

  return { inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens };
}

async function runClaude(prompt: string, dryRun: boolean, mockClaude: boolean): Promise<ClaudeResult> {
  const zeroTokens: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 };

  if (mockClaude) {
    core.info('[MOCK] Skipping Claude invocation');
    return { success: true, tokens: { inputTokens: 1000, outputTokens: 500, cacheCreationTokens: 0, cacheReadTokens: 0 } };
  }
  if (dryRun) {
    core.info('[DRY-RUN] Would run Claude with prompt');
    return { success: true, tokens: zeroTokens };
  }

  let output = '';
  let errorOutput = '';
  core.info(`Running Claude with ${CLAUDE_TIMEOUT_MS / 1000}s timeout…`);

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Claude timed out after ${CLAUDE_TIMEOUT_MS / 1000}s`)), CLAUDE_TIMEOUT_MS);
  });

  const execPromise = exec.exec(
    'claude',
    ['--dangerously-skip-permissions', '-p', prompt, '--output-format', 'stream-json', '--verbose'],
    {
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => { const t = data.toString(); output += t; process.stdout.write(t); },
        stderr: (data: Buffer) => { const t = data.toString(); errorOutput += t; process.stderr.write(t); },
      },
    },
  );

  try {
    const exitCode = await Promise.race([execPromise, timeoutPromise]);
    const tokens = parseClaudeTokens(output);
    if (exitCode !== 0) return { success: false, tokens, error: errorOutput || `Claude exited with code ${exitCode}` };
    return { success: true, tokens };
  } catch (error) {
    return { success: false, tokens: parseClaudeTokens(output), error: error instanceof Error ? error.message : String(error) };
  }
}

async function runGitleaks(): Promise<{ success: boolean; error?: string }> {
  try {
    const exitCode = await exec.exec('gitleaks', ['protect', '--staged', '--verbose'], { ignoreReturnCode: true });
    if (exitCode !== 0) return { success: false, error: 'Gitleaks detected potential secrets in the changes' };
    return { success: true };
  } catch (error) {
    core.warning(`Gitleaks not available: ${error instanceof Error ? error.message : String(error)}`);
    return { success: true };
  }
}

async function hasChanges(): Promise<boolean> {
  let output = '';
  await exec.exec('git', ['diff', '--cached', '--name-only'], {
    listeners: { stdout: (data: Buffer) => { output += data.toString(); } },
  });
  return output.trim().length > 0;
}

function getInputs(): FixerInputs {
  return {
    githubToken: core.getInput('github-token', { required: true }),
    prNumber: parseInt(core.getInput('pr-number', { required: true }), 10),
    prBranch: core.getInput('pr-branch', { required: true }),
    baseBranch: core.getInput('base-branch', { required: true }),
    currentAttempts: parseInt(core.getInput('current-attempts') || '0', 10),
    dryRun: core.getInput('dry-run') === 'true',
    mockClaude: core.getInput('mock-claude') === 'true',
  };
}

// ── main ────────────────────────────────────────────────────────────────────

export async function run(): Promise<void> {
  const inputs = getInputs();
  const octokit = github.getOctokit(inputs.githubToken);
  const { owner, repo } = github.context.repo;
  const attempt = inputs.currentAttempts + 1;
  const showCostInComment = core.getInput('show-cost-in-comment') === 'true';

  const mcConfig: MergeConflictConfig = loadMedicConfigFromFile().merge_conflict;
  const maxAttempts = mcConfig.max_attempts;

  core.info(`Starting fixer for PR #${inputs.prNumber} (attempt ${attempt}/${maxAttempts})`);
  core.info(`Branch: ${inputs.prBranch} → ${inputs.baseBranch}`);

  // Persist values the post (cleanup) step needs.
  core.saveState('pr-number', String(inputs.prNumber));
  core.saveState('dry-run', String(inputs.dryRun));
  core.saveState('github-token', inputs.githubToken);

  let claudeResult: ClaudeResult = {
    success: false,
    tokens: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
  };

  try {
    // 1. Acquire lock
    if (!inputs.dryRun) {
      const acquired = await acquireLock(octokit, owner, repo, inputs.prNumber);
      if (!acquired) {
        core.info('Another run already holds the lock – skipping.');
        return;
      }
      core.saveState('locked', 'true');
    } else {
      core.info('[DRY-RUN] Would acquire lock');
    }

    // 2. Configure git
    await exec.exec('git', ['config', 'user.name', 'github-actions[bot]']);
    await exec.exec('git', ['config', 'user.email', 'github-actions[bot]@users.noreply.github.com']);

    // 3. Fetch and merge base into PR branch to surface conflicts
    await exec.exec('git', ['fetch', 'origin', inputs.prBranch]);
    await exec.exec('git', ['checkout', inputs.prBranch]);
    await exec.exec('git', ['fetch', 'origin', inputs.baseBranch]);

    let _mergeOutput = '';
    const mergeResult = await exec.exec('git', ['merge', `origin/${inputs.baseBranch}`, '--no-commit'], {
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => { _mergeOutput += data.toString(); },
        stderr: (data: Buffer) => { _mergeOutput += data.toString(); },
      },
    });

    if (mergeResult === 0) {
      core.info('Merge succeeded without conflicts – nothing to fix');
      await exec.exec('git', ['merge', '--abort'], { ignoreReturnCode: true });
      if (!inputs.dryRun) {
        await upsertComment(octokit, owner, repo, inputs.prNumber, {
          success: true,
          attempt,
          tokens: claudeResult.tokens,
          author: 'unknown',
          details: 'No conflicts detected – the branch may have been updated.',
          showCostInComment: false,
        });
      }
      return;
    }

    core.info('Merge conflicts detected – extracting conflict metadata…');

    // 4. Build prompt and run Claude
    const conflictBrief = await extractConflictMetadata();
    core.info(`Conflict brief: ${conflictBrief.split('\n').length} lines`);

    const prompt = loadPrompt({ baseBranch: inputs.baseBranch, prBranch: inputs.prBranch, conflictBrief });
    claudeResult = await runClaude(prompt, inputs.dryRun, inputs.mockClaude);

    if (!claudeResult.success) {
      throw new Error(`Claude failed: ${claudeResult.error || 'Unknown error'}`);
    }

    const t = claudeResult.tokens;
    const totalIn = t.inputTokens + t.cacheCreationTokens + t.cacheReadTokens;
    core.info(`Claude completed: ${totalIn} total input tokens (${t.inputTokens} uncached, ${t.cacheCreationTokens} cache-write, ${t.cacheReadTokens} cache-read), ${t.outputTokens} output tokens`);

    // 5. Validate staged changes
    if (!await hasChanges()) {
      throw new Error('Claude did not resolve the conflicts – no staged changes found');
    }

    // 6. Secrets scan
    if (!inputs.dryRun && !inputs.mockClaude) {
      const gitleaksResult = await runGitleaks();
      if (!gitleaksResult.success) throw new Error(`Security scan failed: ${gitleaksResult.error}`);
    }

    // 7. Commit and push
    if (inputs.dryRun) {
      core.info('[DRY-RUN] Would commit and push changes');
    } else {
      await exec.exec('git', ['commit', '-m', `Medic: Resolve merge conflicts (attempt ${attempt})`]);
      await exec.exec('git', ['push', 'origin', inputs.prBranch]);
      core.info('Successfully pushed resolved conflicts');
    }

    // 8. Success bookkeeping
    if (!inputs.dryRun) {
      await removeAllAttemptLabels(octokit, owner, repo, inputs.prNumber, maxAttempts);
      const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: inputs.prNumber });
      await upsertComment(octokit, owner, repo, inputs.prNumber, {
        success: true,
        attempt,
        tokens: claudeResult.tokens,
        author: pr.user?.login || 'unknown',
        showCostInComment,
        maxAttempts,
      });
    }

    core.info(`Successfully resolved conflicts for PR #${inputs.prNumber}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.error(`Fixer failed: ${errorMessage}`);

    if (!inputs.dryRun) {
      await incrementAttempts(octokit, owner, repo, inputs.prNumber, inputs.currentAttempts, maxAttempts);
      try {
        const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: inputs.prNumber });
        await upsertComment(octokit, owner, repo, inputs.prNumber, {
          success: false,
          attempt,
          tokens: claudeResult.tokens,
          author: pr.user?.login || 'unknown',
          details: errorMessage,
          showCostInComment,
          maxAttempts,
        });
      } catch (commentError) {
        core.warning(`Failed to post failure comment: ${commentError}`);
      }
    }

    core.setFailed(errorMessage);
  }
}

const isMainModule = import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '');
if (isMainModule || process.env.GITHUB_ACTIONS) {
  run();
}
