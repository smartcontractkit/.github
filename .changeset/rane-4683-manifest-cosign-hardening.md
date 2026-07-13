---
"build-push-docker-manifest": minor
"reusable-docker-build-publish": patch
---

Harden manifest create and cosign sign for idempotent build-publish reruns (RANE-4683):

- Skip `imagetools create` when the tag already points at the expected platform digests, and fail explicitly if it points at different digests (prevents index digest drift on rerun).
- Retry manifest tag propagation after create to absorb ECR lag.
- Move cosign signature **verification** out of the `build-push-docker-manifest` action and into its own `verify-manifest-signature` job in `reusable-docker-build-publish` (per review). Verification retries the Sigstore propagation lag (5×10s) in isolation, so a "no signatures found" flake can be retried **without** re-running manifest create/sign — the sequence that previously drifted the index digest onto an unsigned wrapper.
- Simplify the action's sign step to always `cosign sign` (safe to repeat now that verify is decoupled and create is idempotent); drop the sign-skip verification shell.
