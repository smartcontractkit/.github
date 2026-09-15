# changed-roots

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
