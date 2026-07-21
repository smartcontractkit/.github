---
"build-push-docker-manifest": minor
---

Make manifest create idempotent for build-publish reruns (RANE-4683):

- Skip `imagetools create` when the manifest tag already exists, so a rerun doesn't mint a new index digest and move the tag onto an unsigned wrapper. Fail if the existing tag doesn't reference the digests being published.
- Retry `cosign verify` to absorb Sigstore propagation lag ("no signatures found" right after a good sign). Because create is idempotent, retrying verify never re-runs create/sign.
