---
"reusable-stale-prs-issues": major
---

add `gati-profile` to act with a GATI token instead of `GH_TOKEN`, so PRs and
issues the workflow closes trigger workflow events. `GH_TOKEN` is now optional
and defaults to the workflow's `GITHUB_TOKEN`.

BREAKING: callers must grant `id-token: write`, even without `gati-profile`.
