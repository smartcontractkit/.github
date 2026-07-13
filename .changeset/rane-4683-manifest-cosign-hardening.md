---
"build-push-docker-manifest": minor
"reusable-docker-build-publish": patch
"verify-docker-signature": minor
---

Harden manifest create and cosign sign for idempotent build-publish reruns (RANE-4683):

- Skip `imagetools create` when the tag already points at the expected platform digests, and fail explicitly if it points at different digests (prevents index digest drift on rerun).
- Retry manifest tag propagation after create to absorb ECR lag.
- Add a new **`verify-docker-signature`** composite action that runs `cosign verify` with retry for Sigstore propagation lag, and use it from a standalone `verify-manifest-signature` job in `reusable-docker-build-publish` (per review). Verification is decoupled from create/sign, so a "no signatures found" flake can be retried **without** re-running create/sign — the sequence that previously drifted the index digest onto an unsigned wrapper. The retry logic lives in `scripts/verify-with-retry.sh` rather than inline workflow YAML.
- Simplify the manifest action's sign step to always `cosign sign` (safe now that verify is decoupled and create is idempotent); drop the sign-skip verification shell.
