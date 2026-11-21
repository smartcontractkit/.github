---
"gha-workflow-validator": minor
---

feat: extract action references with GitHub's workflow parser. Docker images,
local actions, and reusable workflow calls are classified correctly, and
multiple references on one line are validated. Malformed remote references now
report a `uses-format` error.
