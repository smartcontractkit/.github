---
"reusable-docker-build-publish": minor
---

Add opt-in `docker-image-tag-branch-timestamp` input to embed a UTC build timestamp
(YYYYMMDDHHMMSS) in branch-build Docker tags: `<branch>-<timestamp>-<shortsha>`.
Off by default; other build types (pr, tag, nightly, manual) are unaffected.
