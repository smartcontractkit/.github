---
"cicd-changesets": minor
---

Make GATI optional. The action now uses the automatic `GITHUB_TOKEN` by default
(configurable via the new `github-token` input) and only issues a token via GATI
when `aws-role-arn` is provided. Existing callers that pass the AWS/GATI inputs
are unaffected.
