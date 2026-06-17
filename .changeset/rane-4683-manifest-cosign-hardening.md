---
"build-push-docker-manifest": minor
---

Harden manifest create and cosign sign/verify for idempotent build-publish reruns (RANE-4683): skip imagetools create when the tag already points at the expected platform digests, skip cosign sign when a valid signature is already present, and retry cosign verify after signing to absorb Sigstore propagation lag
