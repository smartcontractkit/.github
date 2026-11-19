# Task 1 — scaffold `actions/pr-triage`

## Done

- Added the `node24` TypeScript action scaffold: `action.yml`, `package.json`,
  `project.json` (nx esbuild build + vitest test), `tsconfig.json`,
  `tsconfig.spec.json`, `CHANGELOG.md`, and `README.md`.
- `src/release.ts`: semver tag validation, Linux-only/X64/ARM64 asset resolution
  with public URLs, `checksums.txt` parsing (missing vs. malformed), and SHA-256
  verification via `node:crypto`.
- `src/download.ts`: public-URL download when `release-token` is empty,
  `getOctokit` + `getReleaseByTag` + bearer/`application/octet-stream` asset
  download otherwise, checksum verification before extraction, binary presence
  check and `chmod 0755`.
- `src/run.ts` + `src/index.ts`: input parsing, secret masking, CLI flag
  forwarding, child environment construction, and `@actions/exec` invocation
  with `core.setFailed` on failure.
- 44 vitest cases in `src/__tests__/release.test.ts` and
  `src/__tests__/run.test.ts`; built `dist/index.js` with
  `nx run pr-triage:build` and formatted with prettier. The lockfile records the
  new workspace package.

## Deviations

- The child environment additionally drops the runner's `INPUT_RELEASE-TOKEN`
  copy. For JavaScript actions GitHub exports every input as `INPUT_<NAME>`, so
  removing only an explicit `release-token` variable would still leak the token
  into the analyzed repository's reach. The design's child-isolation bullet was
  updated to say so.
- Download-mode behavior (authenticated vs. public) is tested from `run.test.ts`
  by driving `run()` end to end, because the task named only the two test files;
  there is no separate `download.test.ts`.

## Open issues

- `smartcontractkit/pr-triage` has no published releases yet
  (`GET /repos/.../releases` is empty) and the repository is `INTERNAL`. The
  pinned `RELEASE_VERSION` is therefore `v0.1.0`; if the first release ships
  under a different tag, change that one constant in `src/run.ts` and rebuild
  `dist/`. Until a release exists, a real run fails during download.
- No changeset was added: the task did not list one, and the version/tag
  pipeline is outside this task. One is still required before the action can be
  released and referenced by the Phase 2 workflow.
- Because the repository is internal, callers must pass `release-token` (with
  `contents: read` on `smartcontractkit/pr-triage`) for every real run; an empty
  token only works once the repository is public.
- PR size: the package is ~713 authored non-test, non-`dist/` lines, over the
  400-line limit in `AGENTS.md`. It needs to land as a stack (scaffold plus
  `release.ts`/`download.ts` first, then `run.ts`/`index.ts`/metadata/README);
  the design's verification section now records this.

## Next-phase notes

- Phase 2 should reference
  `smartcontractkit/.github/actions/pr-triage@pr-triage/v0`, which does not
  exist until this phase is released. Land and tag Phase 1 first.
- Pass `release-token` from GATI v2, `org-token` from GATI v2 on non-fork PRs,
  and set `allow-non-org-reviewers: true` whenever `org-token` is unavailable.
- `pnpm test:affected`, `pnpm build:affected`, and `prettier --check` pass
  locally for this package. `tsc --noEmit` reports the same pre-existing
  vitest/vite `.d.ts` resolution errors as `actions/ci-grafana-alert-test`.
