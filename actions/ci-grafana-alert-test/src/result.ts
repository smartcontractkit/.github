export interface Violation {
  Alert?: string;
  RuleUID?: string;
  Outcome?: string;
  State?: string;
  Health?: string;
  LastError?: string;
  InstanceLabels?: Record<string, string>;
  Note?: string;
}

export interface Verdict {
  Alert: string;
  RuleUID: string;
  Outcome: string;
  BadFor: number;
  Note?: string;
}

// Termination carries explicit JSON tags in the CLI, unlike the other
// result types, so its wire shape is snake_case.
export interface Termination {
  kind?: string;
  alert?: string;
  outcome?: string;
  reason?: string;
  at?: string;
}

export interface GrafanaAlertCheckResult {
  Violations?: Violation[];
  Verdicts?: Verdict[];
  terminated_early?: Termination;
}

export function parseResult(json: string): GrafanaAlertCheckResult {
  return JSON.parse(json) as GrafanaAlertCheckResult;
}
