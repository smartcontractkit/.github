# changed-modules-go

## 1.1.1

### Patch Changes

- [#1664](https://github.com/smartcontractkit/.github/pull/1664)
  [`bd812a3`](https://github.com/smartcontractkit/.github/commit/bd812a3b3eb489716cc5bb27cd3146e65b410421)
  Thanks [@nolag](https://github.com/nolag)! - fix: only strip a literal "./"
  prefix when normalizing paths

  The prefix-stripping regex had an unescaped dot, so it matched any single
  character followed by a slash. A module under a single-character top-level
  directory, such as `x/config`, was reported as `config`, and consumers
  received a module directory no directory holds.

## 1.1.0

### Minor Changes

- [#1505](https://github.com/smartcontractkit/.github/pull/1505)
  [`866a6d3`](https://github.com/smartcontractkit/.github/commit/866a6d398c776fd4b30fb57d5b08804f4c7cb350)
  Thanks [@erikburt](https://github.com/erikburt)! - chore: node24 and
  dependency updates

## 1.0.2

### Patch Changes

- [#1425](https://github.com/smartcontractkit/.github/pull/1425)
  [`82a65b6`](https://github.com/smartcontractkit/.github/commit/82a65b6a6f4f82214d5b6470097bc3a9ca711446)
  Thanks [@erikburt](https://github.com/erikburt)! - fix: context logging

## 1.0.1

### Patch Changes

- [#1367](https://github.com/smartcontractkit/.github/pull/1367)
  [`d8e63b5`](https://github.com/smartcontractkit/.github/commit/d8e63b56c4214dab558c7ec6af6e589d8c00a701)
  Thanks [@erikburt](https://github.com/erikburt)! - chore: rebuild dist

## 1.0.0

### Major Changes

- [#1350](https://github.com/smartcontractkit/.github/pull/1350)
  [`b495a00`](https://github.com/smartcontractkit/.github/commit/b495a005fb003db32d68ffe5c1f872e46d0c5f87)
  Thanks [@erikburt](https://github.com/erikburt)! - initial release
