import { describe, it, expect, vi } from 'vitest';
import type { GraphQLPullRequest, MergeConflictConfig, PRMatrixEntry } from '../types.js';
import {
  isAuthorAllowed,
  hasExceededMaxAttempts,
  hasSkipLabel,
  hasLockLabel,
  getAttemptCount,
  isRecentlyActive
} from '../config.js';
import { DEFAULT_MERGE_CONFLICT_CONFIG } from '../workflow-config.js';

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

// Inline the filter logic for testing (avoids importing checker.ts which has side effects)
function filterConflictingPRs(prs: GraphQLPullRequest[], config: MergeConflictConfig = DEFAULT_MERGE_CONFLICT_CONFIG): PRMatrixEntry[] {
  return prs.filter(pr => {
    const labels = pr.labels.nodes.map(l => l.name);
    const authorLogin = pr.author?.login || '';
    const lastCommit = pr.commits.nodes[0] as unknown as { commit?: { pushedDate?: string; committedDate?: string } } | undefined;
    const activityDate = lastCommit?.commit?.pushedDate || lastCommit?.commit?.committedDate;

    return (
      !pr.isDraft &&
      !pr.headRepository?.isFork &&
      isAuthorAllowed(authorLogin, config.allowed_authors) &&
      pr.mergeable === 'CONFLICTING' &&
      isRecentlyActive(activityDate, config.activity_threshold_hours) &&
      !hasExceededMaxAttempts(labels, config.max_attempts) &&
      !hasSkipLabel(labels, config.skip_labels) &&
      !hasLockLabel(labels)
    );
  }).map(pr => ({
    number: pr.number,
    headRefName: pr.headRefName,
    baseRefName: pr.baseRefName,
    author: pr.author?.login || 'unknown',
    currentAttempts: getAttemptCount(pr.labels.nodes.map(l => l.name))
  }));
}

function createMockPR(overrides: Partial<GraphQLPullRequest> = {}): GraphQLPullRequest {
  const recentDate = new Date(Date.now() - 1000 * 60 * 60).toISOString();

  return {
    number: 123,
    headRefName: 'feature-branch',
    baseRefName: 'main',
    isDraft: false,
    mergeable: 'CONFLICTING',
    reviewDecision: null,
    author: { login: 'patrickhuie19' },
    labels: { nodes: [] },
    commits: { nodes: [{ commit: { pushedDate: recentDate, committedDate: recentDate } }] },
    headRepository: { isFork: false },
    ...overrides,
  };
}

function createCommits(pushedDate: string | null, committedDate?: string) {
  const actualCommittedDate = committedDate || pushedDate || new Date().toISOString();
  return { nodes: [{ commit: { pushedDate, committedDate: actualCommittedDate } }] };
}

describe('filterConflictingPRs', () => {
  it('should include PRs with conflicts from allowed authors', () => {
    const prs = [createMockPR()];
    const result = filterConflictingPRs(prs);
    
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(123);
    expect(result[0].author).toBe('patrickhuie19');
  });

  it('should filter out PRs from non-allowed authors', () => {
    const prs = [createMockPR({ author: { login: 'randomuser' } })];
    const result = filterConflictingPRs(prs);
    
    expect(result).toHaveLength(0);
  });

  it('should filter out draft PRs', () => {
    const prs = [createMockPR({ isDraft: true })];
    const result = filterConflictingPRs(prs);
    
    expect(result).toHaveLength(0);
  });

  it('should filter out fork PRs', () => {
    const prs = [createMockPR({ headRepository: { isFork: true } })];
    const result = filterConflictingPRs(prs);
    
    expect(result).toHaveLength(0);
  });

  it('should filter out PRs without conflicts', () => {
    const mergeable = [createMockPR({ mergeable: 'MERGEABLE' })];
    const unknown = [createMockPR({ mergeable: 'UNKNOWN' })];
    
    expect(filterConflictingPRs(mergeable)).toHaveLength(0);
    expect(filterConflictingPRs(unknown)).toHaveLength(0);
  });

  it('should filter out inactive PRs (older than 48h)', () => {
    const oldDate = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(); // 72 hours ago
    const prs = [createMockPR({ commits: createCommits(oldDate, oldDate) })];
    
    expect(filterConflictingPRs(prs)).toHaveLength(0);
  });

  it('should use committedDate when pushedDate is null', () => {
    const recentDate = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago
    const prs = [createMockPR({ commits: createCommits(null, recentDate) })];
    
    expect(filterConflictingPRs(prs)).toHaveLength(1);
  });

  it('should filter out inactive PRs when both pushedDate is null and committedDate is old', () => {
    const oldDate = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(); // 72 hours ago
    const prs = [createMockPR({ commits: createCommits(null, oldDate) })];
    
    expect(filterConflictingPRs(prs)).toHaveLength(0);
  });

  it('should filter out PRs that have reached max attempts (default 3)', () => {
    const prs = [createMockPR({ labels: { nodes: [{ name: 'medic-attempts:3' }] } })];
    expect(filterConflictingPRs(prs)).toHaveLength(0);
  });

  it('should respect custom max_attempts from config', () => {
    const prs = [createMockPR({ labels: { nodes: [{ name: 'medic-attempts:3' }] } })];
    const config: MergeConflictConfig = { ...DEFAULT_MERGE_CONFLICT_CONFIG, max_attempts: 5 };
    expect(filterConflictingPRs(prs, config)).toHaveLength(1);
    expect(filterConflictingPRs(prs, config)[0].currentAttempts).toBe(3);
  });

  it('should filter out PRs with medic-in-progress label', () => {
    const prs = [createMockPR({ labels: { nodes: [{ name: 'medic-in-progress' }] } })];
    
    expect(filterConflictingPRs(prs)).toHaveLength(0);
  });

  it('should filter out PRs with skip labels', () => {
    const skipLabels = ['medic-skip', 'do not merge', 'do-not-merge', 'wip'];
    
    for (const label of skipLabels) {
      const prs = [createMockPR({ labels: { nodes: [{ name: label }] } })];
      expect(filterConflictingPRs(prs)).toHaveLength(0);
    }
  });

  it('should include PRs with non-skip labels', () => {
    const prs = [createMockPR({ labels: { nodes: [{ name: 'bug' }, { name: 'enhancement' }] } })];
    
    expect(filterConflictingPRs(prs)).toHaveLength(1);
  });

  it('should extract current attempt count from labels', () => {
    const prs = [createMockPR({ labels: { nodes: [{ name: 'medic-attempts:2' }] } })];
    const result = filterConflictingPRs(prs);
    
    expect(result).toHaveLength(1);
    expect(result[0].currentAttempts).toBe(2);
  });

  it('should return 0 attempts when no attempt label', () => {
    const prs = [createMockPR()];
    const result = filterConflictingPRs(prs);
    
    expect(result[0].currentAttempts).toBe(0);
  });

  it('should handle multiple PRs correctly', () => {
    const prs = [
      createMockPR({ number: 1, author: { login: 'patrickhuie19' } }),
      createMockPR({ number: 2, author: { login: 'randomuser' } }), // filtered
      createMockPR({ number: 3, author: { login: 'bolekk' } }),
      createMockPR({ number: 4, isDraft: true }), // filtered
      createMockPR({ number: 5, author: { login: 'tofel' } })
    ];
    
    const result = filterConflictingPRs(prs);
    
    expect(result).toHaveLength(3);
    expect(result.map(pr => pr.number)).toEqual([1, 3, 5]);
  });

  it('should include correct PR data in output', () => {
    const prs = [createMockPR({
      number: 42,
      headRefName: 'feature-x',
      baseRefName: 'develop',
      author: { login: 'bolekk' }
    })];
    
    const result = filterConflictingPRs(prs);
    
    expect(result[0]).toEqual({
      number: 42,
      headRefName: 'feature-x',
      baseRefName: 'develop',
      author: 'bolekk',
      currentAttempts: 0
    });
  });
});

