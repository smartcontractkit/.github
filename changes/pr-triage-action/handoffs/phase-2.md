# Phase 2: Phase 2: Add `workflows/reusable-pr-triage` reusable workflow

## Done

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

## Deviations

### Task 3

- Added a changeset. The task did not name one, but `AGENTS.md` requires a
  changeset for user-facing workflow changes and `changesets-check` fails PRs
  that touch `workflows/**` without one. The `minor` bump takes the package from
  0.1.0 to 0.2.0 on release, matching the `pr-triage` action changeset.
- The fork skip is a second job (`fork-skip`) that posts the notice and step
  summary, because a skipped job cannot run steps. The design asked for a clean
  skip "with a notice" and did not say where the notice lives.
- `actions/checkout` is pinned to a full commit SHA as the task required, while
  most existing workflows in the repo use `@v7`; the SHA is v7.0.1.
- Input surface is the two GATI profiles plus `dry-run`,
  `skip-reviewer-requests`, `verbose`, `no-ai`, `ai-base-url`, and `log-level`,
  with one secret `PR_TRIAGE_AI_API_KEY`. The design's sequence diagram said
  "profiles, flags, optional AI secret" without naming them.
- Ran repo scripts as `mise exec -- pnpm …` for the same pnpm-version reason as
  tasks 1 and 2 (shell default pnpm 12 rejects the pinned workspace).
- `pnpm install --lockfile-only` was needed so the new workspace package appears
  in `pnpm-lock.yaml`; without the entry a frozen-lockfile install would fail.

### Task 4

- The changeset already landed in Task 3
  (`.changeset/reusable-pr-triage-initial.md`), so this task added no second
  changeset. Duplicating it would double the release notes and the version bump.
  Verification was the remaining work.
- `actionlint` is not on `PATH` in this environment. Ran it through
  `mise x actionlint@latest -- actionlint …` (1.17.1, the mise registry build).
  Lefthook's `actionlint {staged_files}` hook will use the same tool when it is
  installed.

## Open issues

### Task 3

- `smartcontractkit/.github/actions/pr-triage@pr-triage/v0` does not exist yet.
  It appears only after Phase 1 merges and changesets publishes the action, so
  the workflow cannot run until then.
- GATI v2 profiles are provisioned outside this repo. Callers must have a
  profile with `contents: read` on `smartcontractkit/pr-triage` and one with
  organization `members: read`; the workflow only takes their names.
- Fork detection uses
  `github.event.pull_request.head.repo.full_name != github.repository` as the
  design specifies, so the workflow is only correct for `pull_request` events. A
  non-PR event (e.g. `workflow_dispatch`) has no `pull_request` payload and is
  treated as a fork: with `release-token-profile` set the analysis is skipped,
  and org-token minting is always skipped. The README states the `pull_request`
  requirement.
- There is no automated test for workflow YAML in this repo. Verification is
  `actionlint` plus `pnpm workflows:check`.
- Pre-existing: `pnpm prettier:check` over the whole repo still fails on
  `changes/pr-triage-action/proposal.md`. Not touched here.

### Task 4

- `smartcontractkit/.github/actions/pr-triage@pr-triage/v0` still does not
  exist; it appears after Phase 1 merges and changesets creates the tags.
- `actionlint` is a local-only prerequisite here; CI coverage for workflow YAML
  is still actionlint plus `pnpm workflows:check`, with no unit test.
- The pre-existing `pnpm prettier:check` failure on
  `changes/pr-triage-action/proposal.md` reported in Task 2 is gone; the file
  now passes.

## Next-phase notes

### Task 3

- Before adoption, land and release Phase 1 so `pr-triage/v0` exists, then
  verify a real run in a repo whose GATI profiles are configured.
- After `smartcontractkit/pr-triage` becomes public, clear
  `release-token-profile` in caller workflows (or the workflow default) to let
  fork PRs run and to drop the release token entirely. No other change is
  needed: the mint step is already conditional and the action falls back to
  public release URLs.
- Authored lines: 170 workflow YAML + 105 README + 11 `package.json` + 1
  changelog + 8 changeset = 295, under the 400-line PR limit; the
  `.github/workflows/` copy is tool-generated by `pnpm workflows:fix`.
- If the workflow YAML changes, rerun `pnpm workflows:fix` and commit
  `.github/workflows/reusable-pr-triage.yml` with it; `pnpm workflows:check`
  enforces this.
- Verified locally: `pnpm workflows:fix`, `pnpm workflows:check`, `actionlint`
  on both copies, `prettier --check` on the new files, `pnpm lint:affected`
  (unchanged projects, cached pass). No test target applies to this task.

### Task 4

- Phase 1 must merge and release before any caller uses `reusable-pr-triage@…`;
  the workflow references `pr-triage/v0`.
- Re-run `pnpm workflows:fix` and commit
  `.github/workflows/reusable-pr-triage.yml` whenever the source workflow
  changes; `pnpm workflows:check` enforces the pair.
- Clearing `release-token-profile` after `smartcontractkit/pr-triage` becomes
  public is the only change needed to let fork PRs run; no workflow edit is
  otherwise required.

## Files touched

- `.changeset/reusable-pr-triage-initial.md`
- `.github/workflows/reusable-pr-triage.yml`
- `pnpm-lock.yaml`
- `workflows/reusable-pr-triage/CHANGELOG.md`
- `workflows/reusable-pr-triage/README.md`
- `workflows/reusable-pr-triage/package.json`
- `workflows/reusable-pr-triage/reusable-pr-triage.yml`

## Run log

- Mode:
- Checkpoints: task-3, task-4
- Verify: verify passed: no checks configured
- Rounds used: 1 of 2; verify failures: 0
