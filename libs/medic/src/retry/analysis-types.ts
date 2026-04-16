export interface FailureSummary {
  workflow: string;
  run_id: number;
  run_attempt: number;
  failed_jobs: FailedJob[];
}

export interface FailedJob {
  id: number;
  name: string;
  conclusion: string;
  failed_step?: string;
  annotations: Annotation[];
}

export interface Annotation {
  level: 'failure' | 'warning';
  path: string;
  line: number;
  message: string;
}

export interface AnalysisResult {
  decision: 'retry' | 'skip';
  category: 'flaky' | 'infra' | 'build' | 'test' | 'lint';
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  inputTokens: number;
  outputTokens: number;
}
