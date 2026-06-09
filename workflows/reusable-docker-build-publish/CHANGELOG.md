# reusable-docker-build-publish

## 1.5.0

### Minor Changes

- [#1573](https://github.com/smartcontractkit/.github/pull/1573)
  [`7e79bd3`](https://github.com/smartcontractkit/.github/commit/7e79bd3b4dcfa35ce16a944bc2cfa8a0700d3b30)
  Thanks [@chainchad](https://github.com/chainchad)! - feat: optional GitHub
  build-provenance attestation for the manifest index

  Adds `docker-manifest-attestation` (default `"disabled"`) to generate a GitHub
  build-provenance attestation for the multi-arch manifest index. Set to
  `"github-only"` to record it in the GitHub attestations API, or
  `"github-and-registry"` to additionally attach it to the index in the registry
  as an OCI referrer (which also records it on the org linked artifacts page).
  This is independent of `docker-manifest-sign` (cosign). Any non-`"disabled"`
  value requires the calling job to grant `attestations: write` and
  `id-token: write`; `"github-and-registry"` additionally requires
  `artifact-metadata: write`.

## 1.4.0

### Minor Changes

- [#1567](https://github.com/smartcontractkit/.github/pull/1567)
  [`a8bc5b6`](https://github.com/smartcontractkit/.github/commit/a8bc5b67df4af0bd76e0b39727d672669370c9b1)
  Thanks [@erikburt](https://github.com/erikburt)! - revert: previous change,
  removing manifest-debug input

## 1.3.0

### Minor Changes

- [#1566](https://github.com/smartcontractkit/.github/pull/1566)
  [`8fc19e0`](https://github.com/smartcontractkit/.github/commit/8fc19e023c51e174aa5886b9578486e05c1918fc)
  Thanks [@erikburt](https://github.com/erikburt)! - feat: manifest-debug input

## 1.2.0

### Minor Changes

- [#1533](https://github.com/smartcontractkit/.github/pull/1533)
  [`de6468a`](https://github.com/smartcontractkit/.github/commit/de6468a3dc03e8f05ad5e74635f7fdaf759b1529)
  Thanks [@erikburt](https://github.com/erikburt)! - feat: add
  "allow-overwrites" input. See `build-push-docker` action for more details

## 1.1.0

### Minor Changes

- [#1488](https://github.com/smartcontractkit/.github/pull/1488)
  [`77e30f3`](https://github.com/smartcontractkit/.github/commit/77e30f3aa3694a512e83f7901e61f20b714ce27d)
  Thanks [@erikburt](https://github.com/erikburt)! - feat: allow for amd64
  builds to be optional

## 1.0.0

### Major Changes

- [#1448](https://github.com/smartcontractkit/.github/pull/1448)
  [`f923f5f`](https://github.com/smartcontractkit/.github/commit/f923f5f503278e0d2e2a551ca2c98852e444542a)
  Thanks [@erikburt](https://github.com/erikburt)! - initial versioned release -
  no changes from latest
