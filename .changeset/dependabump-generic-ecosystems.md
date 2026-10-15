---
"reusable-dependabump": minor
---

Support ecosystems besides Go: add an `ecosystem` input (default `go`) to select Dependabot alert ecosystems, and a `bump-command` input that applies the fixes using the alerts written to `DEPENDABUMP_ALERTS_FILE`. Go setup now only runs for the built-in Go bump, and the workflow now skips the bump entirely (including `gomods tidy`) when there are no fixable alerts
