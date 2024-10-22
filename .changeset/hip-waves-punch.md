---
"ci-lint-go": minor
---

Added `only-new-issues` flag to be set to `true` in golangci-lint (ci-lint-go).
This setting is critical. Without it, we cannot enable new rules without first
resolving outstanding debt.  

