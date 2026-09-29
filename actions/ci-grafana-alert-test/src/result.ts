export interface Violation {
  Alert?: string;
  RuleUID?: string;
  Outcome?: string;
  State?: string;
  Health?: string;
  LastError?: string;
  FirstSeen?: string;
  ClearedAt?: string;
  InstanceLabels?: Record<string, string>;
  Note?: string;
}

export interface Verdict {
  Alert: string;
  RuleUID: string;
  Outcome: string;
  BadFor: number;
  PollEvery?: number;
  Note?: string;
}

export interface Termination {
  Kind?: string;
  Alert?: string;
  RuleUID?: string;
  Outcome?: string;
  Reason?: string;
  At?: string;
}

export interface GrafanaAlertCheckResult {
  Violations?: Violation[];
  Verdicts?: Verdict[];
  TerminatedEarly?: Termination;
}

export function parseResult(json: string): GrafanaAlertCheckResult {
  return JSON.parse(json) as GrafanaAlertCheckResult;
}
