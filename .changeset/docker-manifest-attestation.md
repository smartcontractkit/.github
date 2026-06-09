---
"reusable-docker-build-publish": minor
---

feat: optional GitHub build-provenance attestation for the manifest index

Adds `docker-manifest-attestation` (default `"disabled"`) to generate a GitHub
build-provenance attestation for the multi-arch manifest index. Set to
`"github-only"` to record it in the GitHub attestations API, or
`"github-and-registry"` to additionally attach it to the index in the registry
as an OCI referrer (which also records it on the org linked artifacts page).
This is independent of `docker-manifest-sign` (cosign). Any non-`"disabled"`
value requires the calling job to grant `attestations: write` and
`id-token: write`; `"github-and-registry"` additionally requires
`artifact-metadata: write`.
