export interface Violation {
  RuleUID: string;
  State?: string;
  Health?: string;
  LastError?: string;
  Note?: string;
}

export interface Verdict {
  Alert: string;
  RuleUID: string;
  Outcome: string;
  BadFor: number;
  Note?: string;
}

export interface GrafanaAlertCheckResult {
  Violations?: Violation[];
  Verdicts?: Verdict[];
}

export function parseResult(json: string): GrafanaAlertCheckResult {
  return JSON.parse(json) as GrafanaAlertCheckResult;
}
