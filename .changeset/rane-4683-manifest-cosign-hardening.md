---
"build-push-docker-manifest": minor
"reusable-docker-build-publish": patch
---

Harden manifest create and cosign sign for idempotent build-publish reruns (RANE-4683): skip imagetools create when the tag already points at the expected platform digests, skip cosign sign when a valid signature is already present, retry manifest tag propagation after create to absorb ECR lag, and move the cosign verify gate (with 5×10s retry for Sigstore propagation) to reusable-docker-build-publish
