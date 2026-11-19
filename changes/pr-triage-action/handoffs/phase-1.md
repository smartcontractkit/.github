# Phase 1: Phase 1: Add `actions/pr-triage` TypeScript action

## Done

### Task 1: Scaffold `actions/pr-triage` (`action.yml`, `package.json`, `project.json`, `tsconfig.json`, `tsconfig.spec.json`, `CHANGELOG.md`, `README.md`) and implement `src/release.ts`, `src/download.ts`, `src/run.ts`, and `src/index.ts` with unit tests in `src/__tests__/release.test.ts` and `src/__tests__/run.test.ts`.

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

### Task 2: Build committed `actions/pr-triage/dist/index.js` via `pnpm build:affected`, add a minor changeset in `.changeset/`, and verify with `pnpm lint:affected`, `pnpm test:affected`, and `pnpm prettier:check`.

- Rebuilt the committed bundle with `pnpm build:affected` (nx rebuilt all affected
  projects; `actions/pr-triage/dist/index.js` is 1,179,182 bytes and contains
  `release.ts`/`download.ts`/`run.ts` code: `getReleaseByTag`, `RELEASE_VERSION`,
  `checksums.txt`, `PR_TRIAGE_ORG_TOKEN`, `setFailed`). No build output changed
  outside `actions/pr-triage/dist/`.
- Added `.changeset/pr-triage-initial.md` with a `minor` bump for `pr-triage`
  (feat: add the action that installs and runs the pinned binary).
- `pnpm lint:affected`: passed. Only four projects have a `lint` target; the
  `pr-triage` project declares no `lint` target, so it is not linted by this run.
- `pnpm test:affected`: `pr-triage` passes 2 files / 44 tests; the run as a whole
  fails in two unrelated projects (`apidiff-go`, `signed-commits`), see Open
  issues.
- `pnpm prettier:check`: fails on `changes/pr-triage-action/proposal.md` only.
  `.changeset/` is in `.prettierignore`, so the new changeset is not checked.

## Deviations

### Task 1

- The child environment additionally drops the runner's `INPUT_RELEASE-TOKEN`
  copy. For JavaScript actions GitHub exports every input as `INPUT_<NAME>`, so
  removing only an explicit `release-token` variable would still leak the token
  into the analyzed repository's reach. The design's child-isolation bullet was
  updated to say so.
- Download-mode behavior (authenticated vs. public) is tested from `run.test.ts`
  by driving `run()` end to end, because the task named only the two test files;
  there is no separate `download.test.ts`.

### Task 2

- The repo pins `pnpm 10.6.5` (`.tool-versions`, `engines.pnpm: "10"`) but the
  shell's default `pnpm` is 12.21.0, which aborts every script with
  `ERR_PNPM_VERIFY_DEPS_BEFORE_RUN` (the `pnpm` field in root `package.json` is no
  longer read by pnpm 12). All commands were run as `mise exec -- pnpm …`, which
  resolves 10.6.5. The task's commands and their intent are unchanged.
- `nx affected` reports every project in the repo, so `build:affected`,
  `lint:affected`, and `test:affected` run far more than `pr-triage`. The build
  was verified to leave the tree unchanged apart from `actions/pr-triage/dist/`.

## Open issues

### Task 1

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

### Task 2

- `pnpm prettier:check` fails on `changes/pr-triage-action/proposal.md`, a
  change artifact edited before this task. It needs `prettier --write` (or a
  hand-format) before phase verification can be green. Left untouched here
  because this turn was note-only.
- `pnpm test:affected` cannot pass in this environment: `apidiff-go` git tests
  time out in `beforeEach` (10s hook timeout) and `signed-commits` git-tag tests
  fail with `fatal: no tag message?`. Both test suites are untouched by this
  change. `signed-commits` tests launch commit editor windows (Zed) on the
  machine — do not run that suite interactively.
- No release of `smartcontractkit/pr-triage` exists yet, so the pinned
  `RELEASE_VERSION = v0.1.0` in `src/run.ts` is unverified against a real
  artifact; a real run fails at download until the first release ships under that
  tag (change the constant and rebuild `dist/` if it differs).
- `pr-triage` declares no `lint` target, so `lint:affected` gives no coverage of
  the new TypeScript; add one if the repo's convention requires it.
- PR size: still ~713 authored non-test, non-`dist/` lines for the package,
  above the 400-line limit in `AGENTS.md`. Land Phase 1 as a stack.

## Next-phase notes

### Task 1

- Phase 2 should reference
  `smartcontractkit/.github/actions/pr-triage@pr-triage/v0`, which does not
  exist until this phase is released. Land and tag Phase 1 first.
- Pass `release-token` from GATI v2, `org-token` from GATI v2 on non-fork PRs,
  and set `allow-non-org-reviewers: true` whenever `org-token` is unavailable.
- `pnpm test:affected`, `pnpm build:affected`, and `prettier --check` pass
  locally for this package. `tsc --noEmit` reports the same pre-existing
  vitest/vite `.d.ts` resolution errors as `actions/ci-grafana-alert-test`.

### Task 2

- The changeset is `minor`, so the release bumps `pr-triage` 0.1.0 -> 0.2.0 and
  creates tags `pr-triage/v0.2.0` plus the mutable `pr-triage/v0` that Phase 2
  references. Land and release Phase 1 before the reusable workflow points at
  `smartcontractkit/.github/actions/pr-triage@pr-triage/v0`.
- Any edit to `actions/pr-triage/src/**` requires re-running
  `mise exec -- pnpm build:affected` and committing the regenerated
  `dist/index.js`; `prettier` ignores `dist/`.
- Phase 2 can start from the verified `pr-triage` test suite (44 passing) and
  does not need to re-verify `apidiff-go`/`signed-commits`.

## Files touched

- `.changeset/pr-triage-initial.md`
- `actions/pr-triage/CHANGELOG.md`
- `actions/pr-triage/README.md`
- `actions/pr-triage/action.yml`
- `actions/pr-triage/dist/index.js`
- `actions/pr-triage/package.json`
- `actions/pr-triage/project.json`
- `actions/pr-triage/src/__tests__/release.test.ts`
- `actions/pr-triage/src/__tests__/run.test.ts`
- `actions/pr-triage/src/download.ts`
- `actions/pr-triage/src/index.ts`
- `actions/pr-triage/src/release.ts`
- `actions/pr-triage/src/run.ts`
- `actions/pr-triage/tsconfig.json`
- `actions/pr-triage/tsconfig.spec.json`
- `pnpm-lock.yaml`

## Run log

- Mode: 
- Checkpoints: task-1, task-2
- Verify: verify passed: no checks configured
- Rounds used: 1 of 2; verify failures: 0
