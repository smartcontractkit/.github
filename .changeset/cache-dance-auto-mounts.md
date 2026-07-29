---
"build-push-docker": minor
"ctf-build-image": minor
---

Persist BuildKit `RUN --mount=type=cache` dirs across runs by default. Automatically discovers cache mounts from the Dockerfile (matching on mount `id`) unless custom `cache-map` JSON is provided, and wraps buildkit-cache-dance in `actions/cache`.