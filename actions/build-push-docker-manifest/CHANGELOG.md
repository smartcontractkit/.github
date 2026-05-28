# build-push-docker-manifest

## 1.4.0

### Minor Changes

- [#1567](https://github.com/smartcontractkit/.github/pull/1567)
  [`a8bc5b6`](https://github.com/smartcontractkit/.github/commit/a8bc5b67df4af0bd76e0b39727d672669370c9b1)
  Thanks [@erikburt](https://github.com/erikburt)! - feat: poll for manifest
  existence before attempting to get digest

### Patch Changes

- [#1567](https://github.com/smartcontractkit/.github/pull/1567)
  [`a8bc5b6`](https://github.com/smartcontractkit/.github/commit/a8bc5b67df4af0bd76e0b39727d672669370c9b1)
  Thanks [@erikburt](https://github.com/erikburt)! - revert: previous change,
  ignore debug env vars for buildx logging

## 1.3.0

### Minor Changes

- [#1564](https://github.com/smartcontractkit/.github/pull/1564)
  [`321b3dc`](https://github.com/smartcontractkit/.github/commit/321b3dcd8ec358fb2df44257048ec3c92d904770)
  Thanks [@erikburt](https://github.com/erikburt)! - feat: conditionally enable
  docker buildx debug logs

## 1.2.1

### Patch Changes

- [#1547](https://github.com/smartcontractkit/.github/pull/1547)
  [`20874e7`](https://github.com/smartcontractkit/.github/commit/20874e716e51e8d01d048c18979b828ccfdd8f55)
  Thanks [@erikburt](https://github.com/erikburt)! - chore: bump gha deps

## 1.2.0

### Minor Changes

- [#1510](https://github.com/smartcontractkit/.github/pull/1510)
  [`8431395`](https://github.com/smartcontractkit/.github/commit/84313959070d021e5545d443021c136d1ce409bf)
  Thanks [@erikburt](https://github.com/erikburt)! - chore: bump some action
  dependencies to node24 version

## 1.1.0

### Minor Changes

- [#1458](https://github.com/smartcontractkit/.github/pull/1458)
  [`5218eb3`](https://github.com/smartcontractkit/.github/commit/5218eb3fed5efee731fb8c7ad8fe1ca62114b836)
  Thanks [@erikburt](https://github.com/erikburt)! - chore: bump many reusable
  action dependencies for node24 support/migration

## 1.0.0

### Major Changes

- [#1285](https://github.com/smartcontractkit/.github/pull/1285)
  [`a252481`](https://github.com/smartcontractkit/.github/commit/a252481a6d1743617c076e6d9a4d8170b2074df1)
  Thanks [@chainchad](https://github.com/chainchad)! - Support additional Docker
  tags for the manifest index.

  Bump to major version due to signify stability.

## 0.3.1

### Patch Changes

- [#1177](https://github.com/smartcontractkit/.github/pull/1177)
  [`12132d1`](https://github.com/smartcontractkit/.github/commit/12132d1e575dd0b8a76c83e4fee38903e66201b4)
  Thanks [@chainchad](https://github.com/chainchad)! - Fix annotation to use
  index prefix

## 0.3.0

### Minor Changes

- [#1173](https://github.com/smartcontractkit/.github/pull/1173)
  [`47d7768`](https://github.com/smartcontractkit/.github/commit/47d776864cc950df618148146d58724bb5f9d135)
  Thanks [@chainchad](https://github.com/chainchad)! - Add sleep to reduce
  intermittent failures and support annotations

### Patch Changes

- [#1176](https://github.com/smartcontractkit/.github/pull/1176)
  [`5c4c236`](https://github.com/smartcontractkit/.github/commit/5c4c236c4f421508a53e9be59f6a85ed826c9139)
  Thanks [@chainchad](https://github.com/chainchad)! - Add retry logic for
  images attached to manifest list

## 0.2.0

### Minor Changes

- [#920](https://github.com/smartcontractkit/.github/pull/920)
  [`6ee7843`](https://github.com/smartcontractkit/.github/commit/6ee784331036c440786e6bf0125af875f2f17ac1)
  Thanks [@chainchad](https://github.com/chainchad)! - Support workflow
  repository verification with cosign

## 0.1.0

### Minor Changes

- [#880](https://github.com/smartcontractkit/.github/pull/880)
  [`898ccb1`](https://github.com/smartcontractkit/.github/commit/898ccb10ecd5a70cd2140dd72d3f08098edca5aa)
  Thanks [@chainchad](https://github.com/chainchad)! - Create
  build-push-docker-manifest composite workflow
