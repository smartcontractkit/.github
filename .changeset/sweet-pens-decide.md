---
"gha-workflow-validator": patch
---

fix: action reference validation bug producing false positives for lines which
contain "uses:" substring, but is not an action reference
