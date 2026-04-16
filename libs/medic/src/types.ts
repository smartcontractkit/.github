/**
 * Shared TypeScript types for Medic
 */

import type { GitHub } from '@actions/github/lib/utils';

export type OctokitClient = InstanceType<typeof GitHub>;

export interface GraphQLPullRequest {
  number: number;
  headRefName: string;
  baseRefName: string;
  isDraft: boolean;
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  author: { login: string };
  labels: { nodes: { name: string }[] };
  commits: { nodes: { commit: { pushedDate: string | null; committedDate: string } }[] };
  headRepository: { isFork: boolean } | null;
}

export interface PRMatrixEntry {
  number: number;
  headRefName: string;
  baseRefName: string;
  author: string;
  currentAttempts: number;
}

export interface PRMatrix {
  include: PRMatrixEntry[];
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface ClaudeResult {
  success: boolean;
  tokens: TokenUsage;
  error?: string;
}

export interface CommentParams {
  success: boolean;
  attempt: number;
  tokens: TokenUsage;
  author: string;
  details?: string;
  showCostInComment: boolean;
  maxAttempts?: number;
}

export interface RepoContext {
  owner: string;
  repo: string;
}

export interface FixerInputs {
  githubToken: string;
  prNumber: number;
  prBranch: string;
  baseBranch: string;
  currentAttempts: number;
  dryRun: boolean;
  mockClaude: boolean;
}

export interface CheckerInputs {
  githubToken: string;
}

export interface CommentParserInputs {
  githubToken: string;
  commentBody: string;
  issueNumber: number;
  commenterLogin: string;
}

export interface MergeConflictConfig {
  allowed_authors: string[];
  max_attempts: number;
  activity_threshold_hours: number;
  skip_labels: string[];
}

export interface WorkflowRetryConfig {
  max_attempts: number;
  retryable: string[];
}

export interface MedicConfig {
  merge_conflict: MergeConflictConfig;
  workflow_retry: WorkflowRetryConfig;
}

export type RetryStatus = 'retrying' | 'passing' | 'max_attempts' | 'no_runs' | 'error' | 'skipped';

export interface RetryResult {
  workflow: string;
  workflowFile: string;
  run_id: number | undefined;
  attempt: number;
  status: RetryStatus;
  error?: string;
  analysis?: {
    decision: 'retry' | 'skip';
    category: string;
    reasoning: string;
    confidence: string;
    inputTokens: number;
    outputTokens: number;
  };
}

export interface RetryCommentParams {
  results: RetryResult[];
  maxAttempts: number;
  author: string;
  headSha: string;
}

export interface WorkflowRetryInputs {
  githubToken: string;
  prNumber: number;
}
