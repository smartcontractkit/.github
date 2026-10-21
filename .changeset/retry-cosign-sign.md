---
"build-push-docker-manifest": minor
---

feat: retry `cosign sign` on failure (5 attempts, 20s apart by default) to absorb
transient GitHub OIDC/Fulcio errors. Configurable via `cosign-sign-attempts` and
`cosign-sign-retry-interval-seconds`.
