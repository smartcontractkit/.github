---
"reusable-docker-build-publish": minor
---

Add `docker-cache-map` input, passed through to build-push-docker's `cache-map`.
Set it to restrict buildkit-cache-dance to specific cache mounts (e.g.
`'{"cache-mount/go-build-cache": {"id": "go-build-cache", "target": "/var/cache-target"}}'`)
instead of auto-discovering all cache mounts in the Dockerfile. Omit to keep
auto-discovery.
