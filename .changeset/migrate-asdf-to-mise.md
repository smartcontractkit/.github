---
"setup-nodejs": major
"ci-lint-ts": minor
"ci-test-ts": minor
"ci-test-sol": minor
"ci-prettier": minor
"cicd-build-publish-artifacts-ts": minor
"cicd-changesets": minor
"reusable-docusaurus": minor
"changesets-signed-commits": patch
---

Migrate version management from asdf/`.tool-versions` to
[mise](https://mise.jdx.dev/): versions are pinned in the repo root
`mise.toml`. `setup-nodejs` is released as a major (v2): its input contract
changed — `node-version` (new) takes precedence over `node-version-file`,
which now defaults to auto-detect instead of `.tool-versions`, and repos with
no version file fall back to setup-node's default node and pnpm `^12.0.0`
instead of erroring. Consumers pinned to `setup-nodejs/v1` keep the old
behavior until they opt in to v2.

- `setup-nodejs` reads node and pnpm versions from a mise file (`mise.toml`,
  `.mise.toml`, `.config/mise/config.toml`) first, falling back to
  `.tool-versions`/`.nvmrc`, so downstream repos can migrate independently.
  Consumer repos are not required to use either: repos with no version file
  now get setup-node's default node and pnpm `^12.0.0` instead of failing (the
  old action always passed `.tool-versions` to setup-node, which errors when
  the file is missing). A new `node-version` input takes precedence over
  `node-version-file`, which now defaults to auto-detect instead of
  `.tool-versions`. When a mise config is present, `mise install` also
  provisions every pinned tool (e.g. `shellcheck`) for later steps; opt out
  with the new `mise-install` input.
- `ci-lint-ts`, `ci-test-ts`, `ci-test-sol`, `ci-prettier`,
  `cicd-build-publish-artifacts-ts`, `cicd-changesets`, and
  `reusable-docusaurus` default `node-version-file` to auto-detect and
  `pnpm-version` to the version pinned in the repo's `mise.toml` or
  `.tool-versions` (fallback `^12.0.0`). `ci-prettier`'s fallback node version
  bumped from `^20.16.0` to `^26.0.0` and its default pnpm moved from `^9.0.0`
  to the file-driven version.
- `signed-commits` README examples now pass `node-version-file: mise.toml`.

NOTE for consumers: repos pinning versions via `.tool-versions` keep working
unchanged. Pin versions in a `mise.toml` to pick up the new behavior.

NOTE for this repo: the root `.tool-versions` is retained temporarily as a
duplicate of `mise.toml` (mise reads `mise.toml` first, so it is inert for mise
users) because this repo's own composite actions reference the released
`setup-nodejs/v1`, which still reads `.tool-versions`. It will be removed once
setup-nodejs v2 is released and the internal refs are bumped.
