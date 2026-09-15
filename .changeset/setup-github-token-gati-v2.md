---
"setup-github-token": minor
---

Support GATI v2 behind a staged rollout. Adds a `profile` input that selects
GATI v2, a `gati-version` input to force either flow, and a `gati-version`
output. `aws-role-arn` and `aws-lambda-url` are now optional, and required only
when `profile` is not set.
