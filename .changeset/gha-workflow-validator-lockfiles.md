---
"gha-workflow-validator": minor
---

feat: read `.github/workflows/actions.lock` and accept tag references for
workflows onboarded to a workflow dependency lockfile. Every action used by an
onboarded workflow must be pinned in the lockfile.
