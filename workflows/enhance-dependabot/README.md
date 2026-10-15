# enhance-dependabot

Makes Dependabot pull requests actionable by running repository-specific setup,
generation, and cleanup steps (e.g. `go mod tidy`, code generation, formatting)
on the PR's head branch and committing the result back to the same branch. Your
repository's usual CI checks then re-run automatically against the enhanced
head, so the only thing left for a developer to do is review, approve, and
merge.

## Recommended usage

Add this workflow to your repository (e.g.
`.github/workflows/enhance-dependabot.yml`):

```yaml
name: enhance-dependabot

on:
  pull_request_target:
    types: [opened, synchronize, reopened]

permissions: {}

jobs:
  enhance:
    if: github.actor == 'dependabot[bot]'
    permissions:
      contents: write # push the enhancement commit to the dependabot branch
      pull-requests: write # comment on the PR
    uses: smartcontractkit/.github/.github/workflows/enhance-dependabot.yml@enhance-dependabot/v1
    with:
      setup-command: make setup # toolchain, dependencies, caches, logins
      enhance-command: make enhance-dependabot # tidy, generate, format, etc.
    secrets: inherit
```

**Important:** use `pull_request_target`, not `pull_request`. Workflows
triggered by Dependabot's `pull_request` events run with a read-only
`GITHUB_TOKEN` and no Actions secrets (they are treated like fork PRs), so they
cannot push. `pull_request_target` does not have this limitation, and it runs
the workflow file from your default branch, which is what the `actor` check
above gates on.

### Recommended repository setup

Expose a single idempotent target, e.g. `make enhance-dependabot`, that
transforms the repository into its final post-dependency-update state. This
keeps the trigger workflow identical across repositories, and gives developers
the exact same command to run when doing manual bumps. The `enhance-command`
must be idempotent: it is re-run whenever Dependabot rebases the PR.

### Grouping updates (fewer PRs, fewer runs)

Dependabot can group updates so you get one PR per ecosystem per interval (e.g.
all Go updates in a single weekly PR) instead of one PR per dependency. This
also means one enhancement run and one CI rerun per PR instead of N:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: gomod
    directory: /
    schedule:
      interval: weekly
    groups:
      weekly-go-deps:
        applies-to: version-updates
        patterns:
          - "*"
```

### Secrets

If your setup or enhance commands need credentials (e.g. private module access),
pass them with `secrets: inherit`. They reach the reusable workflow because of
the `pull_request_target` trigger; they would not be available with a
`pull_request` trigger.

Optionally pass `SLACK_TOKEN` and `SLACK_CHANNEL_ID` (see inputs below) to get
Slack notifications when enhancement fails. Without them, failures are still
reported as a red check and a PR comment.

## Inputs

| Input             | Required | Default                                                       | Description                                                                                                  |
| ----------------- | -------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `setup-command`   | no       | `''`                                                          | Shell command(s) run before `enhance-command` to prepare the environment (toolchains, dependencies, logins). |
| `enhance-command` | yes      | -                                                             | Idempotent shell command(s), run from the repository root, that produce the final post-update state.         |
| `commit-message`  | no       | `chore(dependabot): apply post-update generation and cleanup` | Commit message for the enhancement commit.                                                                   |
| `comment`         | no       | `true`                                                        | Comment on the PR when changes are pushed or a step fails. Quiet no-op otherwise.                            |
| `timeout-minutes` | no       | `30`                                                          | Job timeout.                                                                                                 |

## Secrets

| Secret             | Required | Description                                             |
| ------------------ | -------- | ------------------------------------------------------- |
| `SLACK_TOKEN`      | no       | Slack bot token used to notify on enhancement failures. |
| `SLACK_CHANNEL_ID` | no       | Slack channel ID to notify on enhancement failures.     |

## Behavior

- Checks out the PR head (only `dependabot/*` branches of the same repository,
  otherwise it refuses to run) and runs your commands.
- If the commands produce changes: commits them as `github-actions[bot]` and
  pushes to the same Dependabot branch. The push triggers a `synchronize` event,
  so your usual PR checks re-run against the enhanced head.
- If the branch moved while the commands were running (Dependabot rebase),
  replays the enhancement commit on top of the new head and retries the push
  once.
- If the commands produce no changes: succeeds quietly (green check, no
  comment).
- If a command or the push fails: fails the job (red check), comments on the PR
  with the run link, and optionally notifies Slack.

Re-runs are loop-safe: the trigger is gated on `actor == 'dependabot[bot]'`, and
the enhancement push fires `synchronize` as `github-actions[bot]`, so the
workflow does not re-trigger itself. A Dependabot rebase re-triggers enhancement
automatically, keeping the PR enhanced after rebases.

## Known tradeoffs

- Once the enhancement commit is pushed, `@dependabot rebase` will refuse to
  rebase the PR (the branch contains non-Dependabot commits). Use
  `@dependabot recreate` instead: it recreates the PR from scratch and the
  enhancement workflow re-runs on the new head.
- `secrets: inherit` hands all repository secrets to the pinned reusable
  workflow version, the same trust model as other reusable workflows in this
  repository.
