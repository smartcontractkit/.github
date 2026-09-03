---
"build-push-docker": patch
---

Fix cache-map input description: recommend the object form with an explicit id
matching the Dockerfile cache mount id. The simple string form omits id, so
BuildKit keys the cache on the target path and never matches mounts that
define an explicit id.
