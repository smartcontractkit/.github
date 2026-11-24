# pr-triage

## 0.3.1

### Patch Changes

- [#1799](https://github.com/smartcontractkit/.github/pull/1799)
  [`933a1a9`](https://github.com/smartcontractkit/.github/commit/933a1a99431879c4bbbe0ea3cbd8cb58cb887704)
  Thanks [@kalverra](https://github.com/kalverra)! - Keep the checkout's git
  credential so `pr-triage` can fetch the base and head refs. With
  `persist-credentials: false`, the CLI's own `git fetch` ran unauthenticated
  and every run failed before analysis.

## 0.3.0

### Minor Changes

- [#1791](https://github.com/smartcontractkit/.github/pull/1791)
  [`5220530`](https://github.com/smartcontractkit/.github/commit/5220530ba8a97b46acff91b4854e05e7b3255be1)
  Thanks [@kalverra](https://github.com/kalverra)! - Default the action to the
  latest `smartcontractkit/pr-triage` release instead of a pinned version. Set
  the `version` input to pin a specific release.

## 0.2.0

### Minor Changes

- [#1787](https://github.com/smartcontractkit/.github/pull/1787)
  [`c8c26e2`](https://github.com/smartcontractkit/.github/commit/c8c26e217fcd3e7bafc324d4357e13c922f91853)
  Thanks [@kalverra](https://github.com/kalverra)! - feat: add a `pr-triage`
  action that downloads a pinned pr-triage Linux release binary, verifies its
  SHA-256 checksum against the release checksums, and runs `pr-triage analyze`
  with the tokens and flags the caller passes in.
