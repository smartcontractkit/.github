# changed-roots

## 1.0.2

### Patch Changes

- [#1671](https://github.com/smartcontractkit/.github/pull/1671)
  [`18995c9`](https://github.com/smartcontractkit/.github/commit/18995c9052322600144199b39a7ec932ae8cf3eb)
  Thanks [@erikburt](https://github.com/erikburt)! - chore: update dependencies

## 1.0.1

### Patch Changes

- [#1664](https://github.com/smartcontractkit/.github/pull/1664)
  [`bd812a3`](https://github.com/smartcontractkit/.github/commit/bd812a3b3eb489716cc5bb27cd3146e65b410421)
  Thanks [@nolag](https://github.com/nolag)! - fix: only strip a literal "./"
  prefix when normalizing paths

  The prefix-stripping regex had an unescaped dot, so it matched any single
  character followed by a slash. A module under a single-character top-level
  directory, such as `x/config`, was reported as `config`, and consumers
  received a module directory no directory holds.
