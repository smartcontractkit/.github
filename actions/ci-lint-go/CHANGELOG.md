# ci-lint-go

## 4.0.0

### Major Changes

- [#1387](https://github.com/smartcontractkit/.github/pull/1387) [`40efd29`](https://github.com/smartcontractkit/.github/commit/40efd295996e3f0b778a6fc31b7796a33ce4cc0e) Thanks [@chainchad](https://github.com/chainchad)! - Upgraded underlying golangci-lint action from v8 to v9.2.0

## 3.1.0

### Minor Changes

- [#1293](https://github.com/smartcontractkit/.github/pull/1293) [`31f7a92`](https://github.com/smartcontractkit/.github/commit/31f7a923a25f7672641b5099cbb85ce4a984fc05) Thanks [@chainchad](https://github.com/chainchad)! - Add golangci-lint output for stdout

## 3.0.1

### Patch Changes

- [#1202](https://github.com/smartcontractkit/.github/pull/1202) [`2b6a2fa`](https://github.com/smartcontractkit/.github/commit/2b6a2fa519ea0a54ec96ecf90f18f8c69366dcda) Thanks [@erikburt](https://github.com/erikburt)! - bump aws-actions/configure-aws-credentials to v5.0.0

## 3.0.0

### Major Changes

- [#1194](https://github.com/smartcontractkit/.github/pull/1194) [`837367d`](https://github.com/smartcontractkit/.github/commit/837367d07e99983161fddb2d4b112725d819561d) Thanks [@chainchad](https://github.com/chainchad)! - Support default config file for golangci-lint

## 2.0.0

### Major Changes

- [#1064](https://github.com/smartcontractkit/.github/pull/1064)
  [`5ef875a`](https://github.com/smartcontractkit/.github/commit/5ef875a78da521085ad768ecf2ed5e25009496f7)
  Thanks [@chainchad](https://github.com/chainchad)! - Use latest version of
  golangci-lint action to fix GHA cache issue.
  - Note: requires golangci-lint version >= `v2.1.0`

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

## 0.3.1

### Patch Changes

- [#855](https://github.com/smartcontractkit/.github/pull/855)
  [`18a8a89`](https://github.com/smartcontractkit/.github/commit/18a8a89b23006355003b705d55acaf329c384d94)
  Thanks [@erikburt](https://github.com/erikburt)! - chore: pin actions/\*
  dependencies to major version tag

## 0.3.0

### Minor Changes

- [#677](https://github.com/smartcontractkit/.github/pull/677)
  [`2ac9d97`](https://github.com/smartcontractkit/.github/commit/2ac9d97a83a5edded09af7fcf4ea5bce7a4473a4)
  Thanks [@chudilka1](https://github.com/chudilka1)! - Added `only-new-issues`
  flag to be set to `true` in golangci-lint (ci-lint-go). This setting is
  critical. Without it, we cannot enable new rules without first resolving
  outstanding debt.

## 0.2.5

### Patch Changes

- [#663](https://github.com/smartcontractkit/.github/pull/663)
  [`dca9ab8`](https://github.com/smartcontractkit/.github/commit/dca9ab89d734e82738b8aa52bd25d09b205ec6ee)
  Thanks [@erikburt](https://github.com/erikburt)! - chore: remove metrics
  inputs and step (push-gha-metrics-action)

- [#664](https://github.com/smartcontractkit/.github/pull/664)
  [`c4705bf`](https://github.com/smartcontractkit/.github/commit/c4705bfdbf6c8e57c080d82a3c4f013aa96a2dfb)
  Thanks [@erikburt](https://github.com/erikburt)! - chore: bump actions/\*
  references to latest version

## 0.2.4

### Patch Changes

- [#429](https://github.com/smartcontractkit/.github/pull/429)
  [`fc3cf71`](https://github.com/smartcontractkit/.github/commit/fc3cf71f41e6bcdedf28f9d04058343bb66206d5)
  Thanks [@erikburt](https://github.com/erikburt)! - Bump push-gha metrics
  action to v3.0.1, make Grafana inputs optional

## 0.2.3

### Patch Changes

- [#390](https://github.com/smartcontractkit/.github/pull/390)
  [`209275f`](https://github.com/smartcontractkit/.github/commit/209275fd2e35335a386254fae9a8a8f3ad413206)
  Thanks
  [@app-token-issuer-releng-renovate](https://github.com/apps/app-token-issuer-releng-renovate)! -
  Bump golangci/golangci-lint-action to v6.0.1 and remove `skip-pkg-cache` and
  `skip-build-cache` as inputs from the action.

## 0.2.2

### Patch Changes

- [#247](https://github.com/smartcontractkit/.github/pull/247)
  [`d463b0f`](https://github.com/smartcontractkit/.github/commit/d463b0fec6024b2a0eb7502e2fa5917bd1c6c15e)
  Thanks [@erikburt](https://github.com/erikburt)! - chore: mask aws account id
  when calling aws-actions/configure-aws-credentials

## 0.2.1

### Patch Changes

- [#202](https://github.com/smartcontractkit/.github/pull/202)
  [`af463e3`](https://github.com/smartcontractkit/.github/commit/af463e3a584be3b85ae85e7a48f288a2098275cd)
  Thanks [@erikburt](https://github.com/erikburt)! - Update dependencies

## 0.2.0

### Minor Changes

- [#169](https://github.com/smartcontractkit/.github/pull/169)
  [`f94f14f`](https://github.com/smartcontractkit/.github/commit/f94f14f46f7b3c51c49bffbea420edd2f01134dc)
  Thanks [@momentmaker](https://github.com/momentmaker)! - Add working-directory
  flag for golangci-lint

## 0.1.1

### Patch Changes

- [#153](https://github.com/smartcontractkit/.github/pull/153)
  [`df8e6ca`](https://github.com/smartcontractkit/.github/commit/df8e6cab6b0aa2f152575d5f7aade5e712a53b86)
  Thanks [@erikburt](https://github.com/erikburt)! - Support grafana org/tenant
  id input for push-gha-metrics-action v2.1.0

## 0.1.1

### Patch Changes

- [#108](https://github.com/smartcontractkit/.github/pull/108)
  [`1b4b59c`](https://github.com/smartcontractkit/.github/commit/1b4b59c72d776ba2917d0e8987af28a938bcbda7)
  Thanks [@ajgrande924](https://github.com/ajgrande924)! - test
