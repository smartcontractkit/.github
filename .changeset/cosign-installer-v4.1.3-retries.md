---
"build-push-docker-manifest": patch
"promote-image-ecr": patch
---

Bump `sigstore/cosign-installer` from v4.1.1/v4.0.0 to v4.1.3 and raise
`curl-retries` to 10, so cosign downloads ride out the transient GitHub release
CDN 504s that were failing `docker-manifest` jobs (and blocking reruns).
