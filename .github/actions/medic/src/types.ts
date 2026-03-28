/**
 * Shared TypeScript types for Medic action
 */

import type { GitHub } from '@actions/github/lib/utils';

/**
 * Octokit client type from @actions/github
 */
export type OctokitClient = InstanceType<typeof GitHub>;

/**
 * PR data from GraphQL query
 */
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

/**
 * Processed PR data for fixer matrix
 */
export interface PRMatrixEntry {
  number: number;
  headRefName: string;
  baseRefName: string;
  author: string;
  currentAttempts: number;
}

/**
 * Matrix format for GitHub Actions
 */
export interface PRMatrix {
  include: PRMatrixEntry[];
}

/**
 * Full token usage breakdown from Claude API
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

/**
 * Result from Claude execution
 */
export interface ClaudeResult {
  success: boolean;
  tokens: TokenUsage;
  error?: string;
}

/**
 * Parameters for comment upsert
 */
export interface CommentParams {
  success: boolean;
  attempt: number;
  tokens: TokenUsage;
  author: string;
  details?: string;
  showCostInComment: boolean;
  maxAttempts?: number;
}

/**
 * GitHub repository context
 */
export interface RepoContext {
  owner: string;
  repo: string;
}

/**
 * Fixer action inputs
 */
export interface FixerInputs {
  githubToken: string;
  prNumber: number;
  prBranch: string;
  baseBranch: string;
  currentAttempts: number;
  dryRun: boolean;
  mockClaude: boolean;
}

/**
 * Checker action inputs
 */
export interface CheckerInputs {
  githubToken: string;
}

/**
 * Comment parser action inputs
 */
export interface CommentParserInputs {
  githubToken: string;
  commentBody: string;
  issueNumber: number;
  commenterLogin: string;
}

/**
 * Merge conflict checker/fixer configuration from .github/medic.yml
 */
export interface MergeConflictConfig {
  allowed_authors: string[];
  max_attempts: number;
  activity_threshold_hours: number;
  skip_labels: string[];
}

/**
 * Workflow retry configuration from .github/medic.yml
 */
export interface WorkflowRetryConfig {
  max_attempts: number;
  retryable: string[];
}

/**
 * Full medic configuration from .github/medic.yml
 */
export interface MedicConfig {
  merge_conflict: MergeConflictConfig;
  workflow_retry: WorkflowRetryConfig;
}

/**
 * Status of a workflow retry attempt
 */
export type RetryStatus = 'retrying' | 'passing' | 'max_attempts' | 'no_runs' | 'error' | 'skipped';

/**
 * Result of a single workflow retry attempt
 */
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

/**
 * Parameters for retry comment
 */
export interface RetryCommentParams {
  results: RetryResult[];
  maxAttempts: number;
  author: string;
  headSha: string;
}

/**
 * Workflow retry action inputs
 */
export interface WorkflowRetryInputs {
  githubToken: string;
  prNumber: number;
}

