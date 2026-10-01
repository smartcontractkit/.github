---
"reusable-docker-build-publish": major
---

feat: use GATI v2 via the new `gati-profile` input

BREAKING: remove the `AWS_ROLE_GATI_ARN` and `AWS_LAMBDA_GATI_URL` secrets and
the `aws-region-gati` input. Set `gati-profile` to a GATI v2 profile instead.
