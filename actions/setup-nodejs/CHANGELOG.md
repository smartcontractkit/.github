# setup-nodejs

## 1.2.0

### Minor Changes

- [#1113](https://github.com/smartcontractkit/.github/pull/1113)
  [`12c73e8`](https://github.com/smartcontractkit/.github/commit/12c73e87249a6c9cd83b4cd4c51a88b53bfeeeb3)
  Thanks [@erikburt](https://github.com/erikburt)! - Removed default value from
  `pnpm-version` input (was originally ^10.0.0), this is now a fallback default.

  The action will determine what version to use through the following means:

  1. If `pnpm-version` was explicitly passed, it will use that
  2. If not passed, it will attempt to pull the version from the
     `.tool-versions` file
  3. If this file doesn't exist, or doesn't declare `pnpm` then it will default
     to `^10.0.0`.

- [#1113](https://github.com/smartcontractkit/.github/pull/1113)
  [`12c73e8`](https://github.com/smartcontractkit/.github/commit/12c73e87249a6c9cd83b4cd4c51a88b53bfeeeb3)
  Thanks [@erikburt](https://github.com/erikburt)! - feat: restore-cache-only
  input to skip saving caches when unnecessary (like merge queues)

- [#1113](https://github.com/smartcontractkit/.github/pull/1113)
  [`12c73e8`](https://github.com/smartcontractkit/.github/commit/12c73e87249a6c9cd83b4cd4c51a88b53bfeeeb3)
  Thanks [@erikburt](https://github.com/erikburt)! - feat: add install-command
  input, useful for when overriding the default install command of "pnpm
  install"

- [#1113](https://github.com/smartcontractkit/.github/pull/1113)
  [`12c73e8`](https://github.com/smartcontractkit/.github/commit/12c73e87249a6c9cd83b4cd4c51a88b53bfeeeb3)
  Thanks [@erikburt](https://github.com/erikburt)! - feat: registry-url input
  for @actions/setup-node

## 1.1.0

### Minor Changes

- [#1022](https://github.com/smartcontractkit/.github/pull/1022)
  [`e663727`](https://github.com/smartcontractkit/.github/commit/e6637277f985dc4e37a7dd4edcc7e4519d96afcb)
  Thanks [@chainchad](https://github.com/chainchad)! - Bump default version of
  pnpm to 10

## 1.0.0

### Major Changes

- [#966](https://github.com/smartcontractkit/.github/pull/966)
  [`eeb76b5`](https://github.com/smartcontractkit/.github/commit/eeb76b5870e3c17856d5a60fd064a053c023b5f5)
  Thanks [@erikburt](https://github.com/erikburt)! - - Bumping major version to
  create 1.0.0 release. This release in itself is non-breaking major version
  bump.
  - Note: previous 0.x minor version bumps may have included breaking changes.
    If you were already fully up-to-date before this version bump, then it's ok
    to upgrade.

## 0.2.3

### Patch Changes

- [#754](https://github.com/smartcontractkit/.github/pull/754)
  [`f1d7e9d`](https://github.com/smartcontractkit/.github/commit/f1d7e9d889b3205980a906ef4a89ba42577a69eb)
  Thanks [@erikburt](https://github.com/erikburt)! - chore: upgrade
  actions/cache to v4

## 0.2.2

### Patch Changes

- [#664](https://github.com/smartcontractkit/.github/pull/664)
  [`c4705bf`](https://github.com/smartcontractkit/.github/commit/c4705bfdbf6c8e57c080d82a3c4f013aa96a2dfb)
  Thanks [@erikburt](https://github.com/erikburt)! - chore: bump actions/\*
  references to latest version

## 0.2.1

### Patch Changes

- [#202](https://github.com/smartcontractkit/.github/pull/202)
  [`af463e3`](https://github.com/smartcontractkit/.github/commit/af463e3a584be3b85ae85e7a48f288a2098275cd)
  Thanks [@erikburt](https://github.com/erikburt)! - Update dependencies

## 0.2.0

### Minor Changes

- [#62](https://github.com/smartcontractkit/.github/pull/62)
  [`8a863fa`](https://github.com/smartcontractkit/.github/commit/8a863fa4717fbab59f76ab8278ee288c7265da88)
  Thanks [@erikburt](https://github.com/erikburt)! - Add sub-directory input for
  package.json files located outside of root directory
