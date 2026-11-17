# autofix

## 1.2.0

### Minor Changes

- [#1781](https://github.com/smartcontractkit/.github/pull/1781)
  [`68efcd9`](https://github.com/smartcontractkit/.github/commit/68efcd9a2bbd091f31a0de6863bc569382a759ba)
  Thanks [@chainchad](https://github.com/chainchad)! - add
  `golangci-lint-new-only`, on by default, to lint only the issues a pull
  request added, by fetching its merge base and passing `--new-from-rev`; set it
  to `false` to lint every issue

## 1.1.0

### Minor Changes

- [#1753](https://github.com/smartcontractkit/.github/pull/1753)
  [`1b8bf6b`](https://github.com/smartcontractkit/.github/commit/1b8bf6bcb8194b8afdeb76a7ed082ef60f0f9bba)
  Thanks [@nolag](https://github.com/nolag)! - add `go-changed-only` to run the
  Go fixers only in modules a pull request changed (every module when it changes
  `.github`, `go.work`, a golangci-lint config, or `go-all-paths`), and
  `golangci-lint` to run `golangci-lint run --fix`, committing its fixes and
  failing on the issues it can't fix, listed in the job summary

## 1.0.0

### Major Changes

- [#1736](https://github.com/smartcontractkit/.github/pull/1736)
  [`9fba12a`](https://github.com/smartcontractkit/.github/commit/9fba12abbaf38fb077681709408295c2bd0a47fb)
  Thanks [@nolag](https://github.com/nolag)! - initial release - run fixer
  commands and commit the changes back to the pull request
