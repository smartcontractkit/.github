/**
 * PR comment utilities for Medic (merge conflict + workflow retry).
 */

import * as core from "@actions/core";
import {
  COMMENT_MARKER,
  MEDIC_LOGO_SIZE,
  MEDIC_LOGO_URL,
  PRICING,
  RETRY_COMMENT_MARKER,
} from "./config";
import { DEFAULT_MERGE_CONFLICT_CONFIG } from "./workflow-config";
import type {
  CommentParams,
  OctokitClient,
  RetryCommentParams,
  RetryStatus,
  TokenUsage,
} from "./types";

function computeCost(tokens: TokenUsage): number {
  return (
    (tokens.inputTokens / 1_000_000) * PRICING.inputPerMTok +
    (tokens.outputTokens / 1_000_000) * PRICING.outputPerMTok +
    (tokens.cacheCreationTokens / 1_000_000) * PRICING.cacheCreationPerMTok +
    (tokens.cacheReadTokens / 1_000_000) * PRICING.cacheReadPerMTok
  );
}

function totalInputTokens(tokens: TokenUsage): number {
  return (
    tokens.inputTokens + tokens.cacheCreationTokens + tokens.cacheReadTokens
  );
}

export function formatComment(params: CommentParams): string {
  const maxAttempts =
    params.maxAttempts ?? DEFAULT_MERGE_CONFLICT_CONFIG.max_attempts;
  const status = params.success ? "SUCCESS ✅" : "FAILED ❌";
  const statusEmoji = params.success ? "🎉" : "⚠️";

  const t = params.tokens;
  const totalIn = totalInputTokens(t);
  const cost = computeCost(t);

  let body = `${COMMENT_MARKER}
<p align="center">
  <img src="${MEDIC_LOGO_URL}" alt="Medic" width="${MEDIC_LOGO_SIZE}" height="${MEDIC_LOGO_SIZE}" />
</p>

<h2 align="center">${statusEmoji} Medic: Merge Conflict Resolution - ${status}</h2>

@${params.author}

| Metric | Value |
|--------|-------|
| Attempt | ${params.attempt}/${maxAttempts} |
`;

  if (params.showCostInComment) {
    body += `| Total input tokens | ${totalIn.toLocaleString()} |
| ↳ Uncached | ${t.inputTokens.toLocaleString()} |
| ↳ Cache write | ${t.cacheCreationTokens.toLocaleString()} |
| ↳ Cache read | ${t.cacheReadTokens.toLocaleString()} |
| Output tokens | ${t.outputTokens.toLocaleString()} |
| Estimated cost | $${cost.toFixed(2)} |
`;
  }

  body += "\n";

  if (params.success) {
    body += `Conflicts have been automatically resolved and pushed to this branch.

Please review the changes and ensure they are correct before merging.`;
  } else {
    body += `Unable to resolve conflicts automatically.

${params.details || "No additional details available."}`;

    if (params.attempt < maxAttempts) {
      body += `

Medic will retry on the next cron run, or you can trigger manually with \`/medic: merge conflict\`.`;
    } else {
      body += `

Maximum retry attempts reached. Please resolve conflicts manually or remove the attempt label to allow medic to try again.`;
    }
  }

  return body;
}

export async function upsertComment(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  prNumber: number,
  params: CommentParams,
): Promise<void> {
  const body = formatComment(params);

  try {
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    });

    const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER));

    if (existing) {
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existing.id,
        body,
      });
      core.info(`Updated existing comment #${existing.id}`);
    } else {
      const { data: newComment } = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body,
      });
      core.info(`Created new comment #${newComment.id}`);
    }
  } catch (error) {
    core.warning(
      `Failed to upsert comment: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function postMessage(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  prNumber: number,
  message: string,
): Promise<void> {
  try {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: `<img src="${MEDIC_LOGO_URL}" alt="Medic" width="32" height="32" align="top" /> **Medic:** ${message}`,
    });
    core.info("Posted status message");
  } catch (error) {
    core.warning(
      `Failed to post message: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function formatRetryStatus(status: RetryStatus): string {
  switch (status) {
    case "retrying":
      return "🔄 Retrying";
    case "passing":
      return "✅ Passing";
    case "max_attempts":
      return "⛔ Max attempts";
    case "no_runs":
      return "⏭️ No runs";
    case "error":
      return "❌ Error";
    case "skipped":
      return "⏭️ Skipped";
    default:
      return "❓ Unknown";
  }
}

export function formatRetryComment(params: RetryCommentParams): string {
  const retried = params.results.filter((r) => r.status === "retrying");
  const skipped = params.results.filter((r) => r.status === "skipped");
  const hasRetries = retried.length > 0;
  const hasSkips = skipped.length > 0;

  let statusLabel: string;
  let statusEmoji: string;
  if (hasRetries && hasSkips) {
    statusLabel = "PARTIAL RETRY 🔄";
    statusEmoji = "🔄";
  } else if (hasRetries) {
    statusLabel = "RETRYING 🔄";
    statusEmoji = "🔄";
  } else if (hasSkips) {
    statusLabel = "SKIPPED ⏭️";
    statusEmoji = "⏭️";
  } else {
    statusLabel = "NO ACTION ⏭️";
    statusEmoji = "⏭️";
  }

  let body = `${RETRY_COMMENT_MARKER}
<p align="center">
  <img src="${MEDIC_LOGO_URL}" alt="Medic" width="${MEDIC_LOGO_SIZE}" height="${MEDIC_LOGO_SIZE}" />
</p>

<h2 align="center">${statusEmoji} Medic: Workflow Retry - ${statusLabel}</h2>

@${params.author}

| Workflow | Status | Attempt |
|----------|--------|---------|
${params.results
  .filter((r) => r.status !== "no_runs")
  .map(
    (r) =>
      `| ${r.workflow} | ${formatRetryStatus(r.status)} | ${r.attempt}/${params.maxAttempts} |`,
  )
  .join("\n")}

`;

  const analyzed = params.results.filter((r) => r.analysis);
  if (analyzed.length > 0) {
    body += `### Analysis\n\n`;
    for (const r of analyzed) {
      const a = r.analysis!;
      body += `- **${r.workflow}**: ${a.decision.toUpperCase()} (${a.category}) — ${a.reasoning}\n`;
    }

    const totalInput = analyzed.reduce(
      (sum, r) => sum + (r.analysis!.inputTokens ?? 0),
      0,
    );
    const totalOutput = analyzed.reduce(
      (sum, r) => sum + (r.analysis!.outputTokens ?? 0),
      0,
    );
    if (totalInput > 0 || totalOutput > 0) {
      body += `\n| Metric | Value |\n|--------|-------|\n`;
      body += `| Input tokens | ${totalInput.toLocaleString()} |\n`;
      body += `| Output tokens | ${totalOutput.toLocaleString()} |\n`;
    }

    body += "\n";
  }

  if (hasRetries) {
    body += `Triggered retry for ${retried.length} workflow(s). Check back shortly for results.\n\n`;
  }

  if (hasSkips) {
    body += `Skipped ${skipped.length} workflow(s) — failures are not transient and need code fixes.\n\n`;
  }

  if (!hasRetries && !hasSkips) {
    body += `No workflows eligible for retry.

Possible reasons:
- All workflows are passing
- Max retry attempts reached
- No workflow runs found for current commit

`;
  }

  body += `Commit: \`${params.headSha.substring(0, 7)}\``;

  return body;
}

export async function upsertRetryComment(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  prNumber: number,
  params: RetryCommentParams,
): Promise<void> {
  const body = formatRetryComment(params);

  try {
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    });

    const existing = comments.find((c) =>
      c.body?.includes(RETRY_COMMENT_MARKER),
    );

    if (existing) {
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existing.id,
        body,
      });
      core.info(`Updated existing retry comment #${existing.id}`);
    } else {
      const { data: newComment } = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body,
      });
      core.info(`Created new retry comment #${newComment.id}`);
    }
  } catch (error) {
    core.warning(
      `Failed to upsert retry comment: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
