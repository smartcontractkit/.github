# reusable-pr-triage

## 0.3.0

### Minor Changes

- [#1796](https://github.com/smartcontractkit/.github/pull/1796)
  [`3b2bfb6`](https://github.com/smartcontractkit/.github/commit/3b2bfb65997b2776923791c11385a3f77f0f2c29)
  Thanks [@kalverra](https://github.com/kalverra)! - Default
  `release-token-profile` and `org-token-profile` to `presets/pr-triage`, so a
  caller only opts in with `presets = ["pr-triage"]` and sets neither input.

## 0.2.0

### Minor Changes

- [#1787](https://github.com/smartcontractkit/.github/pull/1787)
  [`c8c26e2`](https://github.com/smartcontractkit/.github/commit/c8c26e217fcd3e7bafc324d4357e13c922f91853)
  Thanks [@kalverra](https://github.com/kalverra)! - feat: add a
  `reusable-pr-triage` workflow that runs the `pr-triage` action with a
  full-history checkout, minimal permissions, GATI v2 token minting for private
  release downloads and organization membership reads, and clean skips for fork
  pull requests.
