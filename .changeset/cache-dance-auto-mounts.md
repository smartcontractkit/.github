---
"build-push-docker": minor
"ctf-build-image": minor
---

Persist BuildKit `RUN --mount=type=cache` dirs across runs by default. Automatically discovers cache mounts from the Dockerfile (matching on mount `id`) unless custom `cache-map` JSON is provided, and wraps buildkit-cache-dance in `actions/cache`. Previously the dance had no cache backend and hand-written cache-maps targeted the wrong cache volumes, so mounts were never persisted.
Also raises the layer cache export timeout to 30m and stops ignoring export errors.
