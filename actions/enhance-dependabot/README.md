# enhance-dependabot

Makes Dependabot pull requests actionable. Your workflow checks out the PR head
and runs any setup steps it needs (toolchains, dependencies, logins); this
action then runs your `enhance-command` (e.g. `go mod tidy`, code generation,
formatting), commits the result, and pushes it back to the **same Dependabot
branch**. The push triggers a `synchronize` event, so your repository's usual PR
checks re-run automatically against the enhanced code — leaving developers with
a PR they only need to review, approve, and merge.

## Usage

Add a workflow to your repository (e.g.
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
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      contents: write # push the enhancement commit to the dependabot branch
      pull-requests: write # comment on the PR
    steps:
      # Check out the Dependabot PR head, NOT the default merge/base ref.
      # The action refuses to run if HEAD is not the PR head SHA.
      - uses: actions/checkout@v7
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          persist-credentials: true

      # Any setup steps your enhance command needs — you have full control:
      - uses: actions/setup-go@v7
        with:
          go-version-file: go.mod
      # - uses: actions/setup-node@v6
      #   with:
      #     node-version-file: .tool-versions
      # - run: pnpm install --frozen-lockfile
      # - uses: ...anything else...

      - uses: smartcontractkit/.github/actions/enhance-dependabot@enhance-dependabot/v1
        with:
          enhance-command: go mod tidy && make generate
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }} # if codegen needs private packages
          # SLACK_TOKEN: ${{ secrets.SLACK_TOKEN }} # optional failure notifications
          # SLACK_CHANNEL_ID: ${{ secrets.SLACK_CHANNEL_ID }}
```

**Important:**

- Use `pull_request_target`, not `pull_request`. Workflows triggered by
  Dependabot's `pull_request` events run with a read-only `GITHUB_TOKEN` and no
  Actions secrets (they are treated like fork PRs), so they cannot push.
  `pull_request_target` does not have this limitation, and it runs the workflow
  file from your default branch, which is what the `actor` check above gates on.
- Check out `github.event.pull_request.head.sha` with
  `persist-credentials: true`. The action refuses to run if HEAD is not the PR
  head SHA, since pushing a merge/base ref would carry a merge commit onto the
  Dependabot branch.
- The `enhance-command` must be idempotent: it is re-run whenever Dependabot
  rebases the PR.

### Recommended repository setup

Expose a single idempotent target, e.g. `make enhance-dependabot`, that
transforms the repository into its final post-dependency-update state. This
gives developers the exact same command to run when doing manual bumps.

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

## Inputs

| Input              | Required | Default                                                       | Description                                                                                          |
| ------------------ | -------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `enhance-command`  | yes      | -                                                             | Idempotent shell command(s), run from the repository root, that produce the final post-update state. |
| `commit-message`   | no       | `chore(dependabot): apply post-update generation and cleanup` | Commit message for the enhancement commit.                                                           |
| `comment`          | no       | `true`                                                        | Comment on the PR when changes are pushed or a step fails. Quiet no-op otherwise.                    |
| `github-token`     | no       | `github.token`                                                | GitHub token used to comment on the pull request.                                                    |
| `slack-token`      | no       | `''`                                                          | Slack bot token used to notify on enhancement failures. Notifications are skipped when unset.        |
| `slack-channel-id` | no       | `''`                                                          | Slack channel ID to notify on enhancement failures.                                                  |

## Outputs

| Output       | Description                                                       |
| ------------ | ----------------------------------------------------------------- |
| `changed`    | Whether the enhance command produced changes (`true` or `false`). |
| `commit-sha` | The SHA of the enhancement commit (set when `changed` is `true`). |

## Behavior

- Guards: only runs when triggered by `dependabot[bot]`, on in-repository
  `dependabot/*` branches whose head SHA is checked out, otherwise it fails
  without touching anything.
- Runs `enhance-command` in your workflow's environment (after your setup
  steps).
- If it produces changes: commits them as `github-actions[bot]` and pushes to
  the same Dependabot branch. The push triggers a `synchronize` event, so your
  usual PR checks re-run against the enhanced head.
- If the branch moved while the command was running (Dependabot rebase), replays
  the enhancement commit on top of the new head and retries the push once.
- If it produces no changes: succeeds quietly (green check, no comment).
- If the command or the push fails: fails the job (red check), comments on the
  PR with the run link, and optionally notifies Slack.

Re-runs are loop-safe: the trigger is gated on `actor == 'dependabot[bot]'`, and
the enhancement push fires `synchronize` as `github-actions[bot]`, so the
workflow does not re-trigger itself. A Dependabot rebase re-triggers enhancement
automatically, keeping the PR enhanced after rebases.

## Known tradeoffs

- Once the enhancement commit is pushed, `@dependabot rebase` will refuse to
  rebase the PR (the branch contains non-Dependabot commits). Use
  `@dependabot recreate` instead: it recreates the PR from scratch and the
  enhancement workflow re-runs on the new head.

## Development

- Guard logic lives in [`scripts/validate.sh`](scripts/validate.sh); unit tests
  (`pnpm --filter enhance-dependabot test` or `bash scripts/test.sh`) cover all
  guard cases against a throwaway git fixture.
