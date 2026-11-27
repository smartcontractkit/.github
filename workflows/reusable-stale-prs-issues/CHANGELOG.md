# reusable-stale-prs-issues

## 2.0.0

### Major Changes

- [#1806](https://github.com/smartcontractkit/.github/pull/1806)
  [`3252e47`](https://github.com/smartcontractkit/.github/commit/3252e478bdf594ca0055a2e1edb60c94fdc31bf1)
  Thanks [@erikburt](https://github.com/erikburt)! - add `gati-profile` to act
  with a GATI token instead of `GH_TOKEN`, so PRs and issues the workflow closes
  trigger workflow events. `GH_TOKEN` is now optional and defaults to the
  workflow's `GITHUB_TOKEN`.

  BREAKING: callers must grant `id-token: write`, even without `gati-profile`.

## 1.0.0

### Major Changes

- [#1517](https://github.com/smartcontractkit/.github/pull/1517)
  [`c731830`](https://github.com/smartcontractkit/.github/commit/c731830d362452f9ce8fc744a1ed89c7129778b8)
  Thanks [@erikburt](https://github.com/erikburt)! - Initial versioned release,
  no changes from latest
