---
"ci-grafana-alert-test": minor
---

feat: support datasource-managed (Prometheus-flavored) alert rules from
grafana-alertcheck v0.1.10, pin the action to that release, show each rule's
`source` (`grafana` or `datasource`) in the summary and in the `outcomes`
output, and strip the CLI's redundant `rule "<title>": ` prefix from summary
details.

BREAKING: remove the `poll-interval` input — the CLI no longer accepts
`watch --poll-interval` (v0.1.9), because every rule now polls at half its own
evaluation interval.
