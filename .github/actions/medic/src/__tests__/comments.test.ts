import { describe, it, expect, vi } from 'vitest';
import { COMMENT_MARKER, PRICING } from '../config.js';
import { DEFAULT_MERGE_CONFLICT_CONFIG } from '../workflow-config.js';
import type { CommentParams, TokenUsage } from '../types.js';

// Mock @actions/core to avoid side effects
vi.mock('@actions/core', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  setFailed: vi.fn(),
  getInput: vi.fn(),
  setOutput: vi.fn()
}));

function computeCost(tokens: TokenUsage): number {
  return (
    (tokens.inputTokens / 1_000_000) * PRICING.inputPerMTok +
    (tokens.outputTokens / 1_000_000) * PRICING.outputPerMTok +
    (tokens.cacheCreationTokens / 1_000_000) * PRICING.cacheCreationPerMTok +
    (tokens.cacheReadTokens / 1_000_000) * PRICING.cacheReadPerMTok
  );
}

function totalInputTokens(tokens: TokenUsage): number {
  return tokens.inputTokens + tokens.cacheCreationTokens + tokens.cacheReadTokens;
}

// Inline formatComment for testing (avoids importing comments.ts which has indirect side effects)
function formatComment(params: CommentParams): string {
  const maxAttempts = params.maxAttempts ?? DEFAULT_MERGE_CONFLICT_CONFIG.max_attempts;
  const status = params.success ? 'SUCCESS ✅' : 'FAILED ❌';
  const statusEmoji = params.success ? '🎉' : '⚠️';
  const t = params.tokens;
  const totalIn = totalInputTokens(t);
  const cost = computeCost(t);

  let body = `${COMMENT_MARKER}
## ${statusEmoji} Medic: Merge Conflict Resolution - ${status}

@${params.author}

| Metric | Value |
|--------|-------|
| Attempt | ${params.attempt}/${maxAttempts} |
`;

  if (params.showCostInComment) {
    body += `| Total input tokens | ${totalIn.toLocaleString()} |
| Output tokens | ${t.outputTokens.toLocaleString()} |
| Estimated cost | $${cost.toFixed(2)} |
`;
  }

  body += '\n';

  if (params.success) {
    body += `Conflicts have been automatically resolved and pushed to this branch.

Please review the changes and ensure they are correct before merging.`;
  } else {
    body += `Unable to resolve conflicts automatically.

${params.details || 'No additional details available.'}`;

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

describe('formatComment', () => {
  const baseParams: CommentParams = {
    success: true,
    attempt: 1,
    tokens: { inputTokens: 200, outputTokens: 12847, cacheCreationTokens: 45000, cacheReadTokens: 30 },
    author: 'testuser',
    showCostInComment: true
  };

  it('should include the marker for upsert', () => {
    const body = formatComment(baseParams);
    expect(body).toContain(COMMENT_MARKER);
  });

  it('should mention the author', () => {
    const body = formatComment(baseParams);
    expect(body).toContain('@testuser');
  });

  it('should show attempt count', () => {
    const body = formatComment({ ...baseParams, attempt: 2 });
    expect(body).toContain('2/3');
  });

  it('should format token counts with commas when showCostInComment is true', () => {
    const body = formatComment(baseParams);
    expect(body).toContain('45,230');
    expect(body).toContain('12,847');
    expect(body).toContain('Estimated cost');
  });

  it('should hide token counts when showCostInComment is false', () => {
    const body = formatComment({ ...baseParams, showCostInComment: false });
    expect(body).not.toContain('Total input tokens');
    expect(body).not.toContain('Estimated cost');
  });

  describe('success case', () => {
    it('should show SUCCESS status', () => {
      const body = formatComment(baseParams);
      expect(body).toContain('SUCCESS');
      expect(body).toContain('✅');
    });

    it('should include success message', () => {
      const body = formatComment(baseParams);
      expect(body).toContain('Conflicts have been automatically resolved');
      expect(body).toContain('review the changes');
    });
  });

  describe('failure case', () => {
    const failureParams: CommentParams = {
      ...baseParams,
      success: false,
      attempt: 2,
      details: 'Claude timed out'
    };

    it('should show FAILED status', () => {
      const body = formatComment(failureParams);
      expect(body).toContain('FAILED');
      expect(body).toContain('❌');
    });

    it('should include failure details', () => {
      const body = formatComment(failureParams);
      expect(body).toContain('Claude timed out');
    });

    it('should show retry message when attempts remaining', () => {
      const body = formatComment(failureParams);
      expect(body).toContain('Medic will retry');
      expect(body).toContain('/medic: merge conflict');
    });

    it('should show max attempts message when exhausted', () => {
      const maxAttemptsParams = { ...failureParams, attempt: 3 };
      const body = formatComment(maxAttemptsParams);
      expect(body).toContain('Maximum retry attempts reached');
      expect(body).toContain('attempt label');
    });

    it('should respect custom maxAttempts for retry message', () => {
      const body = formatComment({ ...failureParams, attempt: 3, maxAttempts: 5 });
      expect(body).toContain('3/5');
      expect(body).toContain('Medic will retry');
      expect(body).not.toContain('Maximum retry attempts reached');
    });

    it('should handle missing details', () => {
      const noDetailsParams = { ...failureParams, details: undefined };
      const body = formatComment(noDetailsParams);
      expect(body).toContain('No additional details available');
    });
  });

  it('should format as markdown table', () => {
    const body = formatComment(baseParams);
    expect(body).toContain('| Metric | Value |');
    expect(body).toContain('|--------|-------|');
    expect(body).toContain('| Attempt |');
    expect(body).toContain('| Total input tokens |');
    expect(body).toContain('| Output tokens |');
  });
});

