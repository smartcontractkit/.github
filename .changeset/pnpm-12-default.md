---
"setup-nodejs": minor
"ci-lint-ts": minor
"ci-test-ts": minor
"ci-test-sol": minor
"cicd-build-publish-artifacts-ts": minor
"cicd-changesets": minor
"reusable-docusaurus": minor
---

Default pnpm version bumped from `^10.0.0` to `^12.0.0`, following the pnpm 10 bump in #1022.

NOTE for consumers: repos that don't pass `pnpm-version` explicitly will now install pnpm 12. If your repo pins `engines.pnpm` to 10 or has a pnpm 10-format lockfile, pass `pnpm-version: ^10.0.0` explicitly or upgrade your repo.
