---
slug: pr-triage-action
run: 20261119-210057-pr-triage-action
outcome: done
generated: 2026-11-19T21:24:52Z
---

# Run summary: pr-triage-action

## Outcome

- Status: done
- Branch: pr-triage-action
- Close-out: written
- Final verdict: claude@claude-sonnet-5-5 approved (issues: 0)

## Totals

- Tasks: 4 of 4
- Phases: 2
- Checkpoints: 4
- Duration: 22m37s
- Cost: $0.20
- Fresh input tokens: 221817
- Cache read tokens: 7130522
- Cache write tokens: 0
- Output tokens: 74202

| Model                                                           |  Tokens |  Cost |
| --------------------------------------------------------------- | ------: | ----: |
| fireworks-ai/accounts/fireworks/models/deepseek-v4p1-flash-1017 | 7426541 | $0.20 |

## Phases

### Phase 1: Add `actions/pr-triage` TypeScript action

Tasks:

- [x] Scaffold `actions/pr-triage` (`action.yml`, `package.json`,
      `project.json`, `tsconfig.json`, `tsconfig.spec.json`, `CHANGELOG.md`,
      `README.md`) and implement `src/release.ts`, `src/download.ts`,
      `src/run.ts`, and `src/index.ts` with unit tests in
      `src/__tests__/release.test.ts` and `src/__tests__/run.test.ts`.
- [x] Build committed `actions/pr-triage/dist/index.js` via
      `pnpm build:affected`, add a minor changeset in `.changeset/`, and verify
      with `pnpm lint:affected`, `pnpm test:affected`, and
      `pnpm prettier:check`.

Phase totals: 2 checkpoints, 18m23s, $0.13, 5469206 input / 47776 output /
5342674 cache read / 0 cache write tokens

Checkpoints: task-1, task-2 Review fixes: 0 Integration checks: 0

#### Done

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

- Rebuilt the committed bundle with `pnpm build:affected` (nx rebuilt all
  affected projects; `actions/pr-triage/dist/index.js` is 1,179,182 bytes and
  contains `release.ts`/`download.ts`/`run.ts` code: `getReleaseByTag`,
  `RELEASE_VERSION`, `checksums.txt`, `PR_TRIAGE_ORG_TOKEN`, `setFailed`). No
  build output changed outside `actions/pr-triage/dist/`.
- Added `.changeset/pr-triage-initial.md` with a `minor` bump for `pr-triage`
  (feat: add the action that installs and runs the pinned binary).
- `pnpm lint:affected`: passed. Only four projects have a `lint` target; the
  `pr-triage` project declares no `lint` target, so it is not linted by this
  run.
- `pnpm test:affected`: `pr-triage` passes 2 files / 44 tests; the run as a
  whole fails in two unrelated projects (`apidiff-go`, `signed-commits`), see
  Open issues.
- `pnpm prettier:check`: fails on `changes/pr-triage-action/proposal.md` only.
  `.changeset/` is in `.prettierignore`, so the new changeset is not checked.

### Phase 2: Add `workflows/reusable-pr-triage` reusable workflow

Tasks:

- [x] Add `workflows/reusable-pr-triage/` (`reusable-pr-triage.yml`,
      `package.json`, `CHANGELOG.md`, `README.md`) with SHA-pinned
      `actions/checkout` (`fetch-depth: 0`), minimal permissions,
      `invoke-gati-v2` token minting, fork-PR handling, and `actions/pr-triage`
      invocation; sync `.github/workflows/reusable-pr-triage.yml` via
      `pnpm workflows:fix`.
- [x] Add a minor changeset in `.changeset/` for `reusable-pr-triage` and verify
      with `pnpm workflows:check`, `actionlint`, and `pnpm prettier:check`.

Phase totals: 2 checkpoints, 3m35s, $0.06, 1726565 input / 22959 output /
1652994 cache read / 0 cache write tokens

Checkpoints: task-3, task-4 Review fixes: 0 Integration checks: 0

#### Done

### Task 3: Add `workflows/reusable-pr-triage/` (`reusable-pr-triage.yml`, `package.json`, `CHANGELOG.md`, `README.md`) with SHA-pinned `actions/checkout` (`fetch-depth: 0`), minimal permissions, `invoke-gati-v2` token minting, fork-PR handling, and `actions/pr-triage` invocation; sync `.github/workflows/reusable-pr-triage.yml` via `pnpm workflows:fix`.

- Added `workflows/reusable-pr-triage/` with `reusable-pr-triage.yml`,
  `package.json` (0.1.0), `CHANGELOG.md`, and `README.md`. The workflow is a
  `workflow_call` with `permissions: {}` at the top and a `triage` job that
  requests `contents: read`, `pull-requests: write`, `issues: write`, and
  `id-token: write`.
- The `triage` job checks out with `actions/checkout` pinned to
  `3d3c42e5aac5ba805825da76410c181273ba90b1` (v7.0.1) using `fetch-depth: 0` and
  `persist-credentials: false`, mints a release-read token and an org-read token
  from `invoke-gati-v2@invoke-gati-v2/v1`, then calls
  `smartcontractkit/.github/actions/pr-triage@pr-triage/v0` with the workflow
  token, both minted tokens, the flag inputs, and the optional AI secret.
- Fork handling: when `release-token-profile` is set, a fork PR runs a separate
  `fork-skip` job that emits a `::notice::` plus a step summary, and the
  `triage` job is skipped. Once the profile is empty, fork PRs run the analysis
  with the workflow token, skip org-token minting, and pass
  `allow-non-org-reviewers: true`.
- Workflow-level outputs mirror the action outputs (`risk-level`,
  `complexity-level`, `approvals`, `reviewers`, `dependency-bump`,
  `report-path`).
- Added `.changeset/reusable-pr-triage-initial.md` (`minor`), regenerated
  `.github/workflows/reusable-pr-triage.yml` with `pnpm workflows:fix`, and
  added the new workspace package to `pnpm-lock.yaml`.

### Task 4: Add a minor changeset in `.changeset/` for `reusable-pr-triage` and verify with `pnpm workflows:check`, `actionlint`, and `pnpm prettier:check`.

- Confirmed `.changeset/reusable-pr-triage-initial.md` names
  `reusable-pr-triage` at `minor` and describes the workflow that landed in Task
  3 (full-history checkout, GATI v2 token minting, fork skips).
- `mise exec -- pnpm workflows:check` passes (`[workflow-sync] OK`), so
  `workflows/reusable-pr-triage/reusable-pr-triage.yml` and
  `.github/workflows/reusable-pr-triage.yml` match.
- `actionlint` passes on both workflow copies with no findings.
- `mise exec -- pnpm prettier:check` passes across the repo, including the new
  workflow files, changesets, and the change notes.
- `pnpm-lock.yaml` lists `workflows/reusable-pr-triage` as a workspace package,
  so a frozen-lockfile install resolves it.

## Final gate

- Rounds used: 0; verify failures: 0
- Final verify: no commands configured
- Open issues: none
