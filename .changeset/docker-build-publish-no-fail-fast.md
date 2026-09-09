---
"reusable-docker-build-publish": patch
---

Set `fail-fast: false` on the `build-publish` arch matrix.

Each arch pushes its own per-arch tag before the manifest is assembled. With
fail-fast enabled, a transient failure in one arch cancels the other *after* it
has already pushed, leaving the image half-published: the surviving arch's tag
exists, the manifest does not, and every retry then fails the "tags already
exist in ECR" pre-check. That state cannot be recovered by re-running, only by
deleting the orphaned tag or bumping the version.

Letting both arches run to completion means a flake in one can be re-run on its
own and the manifest step can finish.
