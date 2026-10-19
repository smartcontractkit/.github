export interface Violation {
  Alert?: string;
  RuleUID?: string;
  // rule_key is the identity across both source kinds; RuleUID is empty for a
  // datasource-managed rule. snake_case because the CLI tags this field.
  rule_key?: string;
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
  rule_key?: string;
  // source_kind is "grafana" or "datasource".
  source_kind?: string;
  Outcome: string;
  BadFor: number;
  Note?: string;
}

// Termination carries explicit JSON tags in the CLI, unlike the other
// result types, so its wire shape is snake_case.
export interface Termination {
  kind?: string;
  alert?: string;
  rule_key?: string;
  rule_uid?: string;
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
