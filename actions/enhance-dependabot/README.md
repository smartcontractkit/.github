# enhance-dependabot

Makes Dependabot pull requests actionable. Your workflow checks out the PR head
and runs any setup steps it needs (toolchains, dependencies, logins); this
action then runs your `enhance-command` (e.g. `go mod tidy`, code generation,
formatting), commits the result, and pushes it back to the **same Dependabot
branch** using `push-token`. Pushed with a GitHub App token, the push triggers a
`synchronize` event, so your repository's usual PR checks re-run automatically
against the enhanced code — leaving developers with a PR they only need to
review, approve, and merge.

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
    # A Dependabot rebase cancels the in-progress run for the old head.
    concurrency:
      group: enhance-dependabot-${{ github.event.pull_request.number }}
      cancel-in-progress: true
    permissions:
      contents: read # push-token pushes; use write if push-token is GITHUB_TOKEN
      pull-requests: write # comment on the PR
    steps:
      # Check out the Dependabot PR head, NOT the default merge/base ref.
      # The action refuses to run if HEAD is not the PR head SHA.
      # persist-credentials: false keeps the write credential off disk while
      # the enhance-command runs; the action pushes with push-token itself.
      - uses: actions/checkout@v7
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          persist-credentials: false

      # Any setup steps your enhance command needs — you have full control:
      - uses: actions/setup-go@v7
        with:
          go-version-file: go.mod
      # - uses: actions/setup-node@v6
      #   with:
      #     node-version-file: .tool-versions
      # - run: pnpm install --frozen-lockfile
      # - uses: ...anything else...

      # A GitHub App installation token (contents: write) makes the push trigger
      # your usual PR checks; GITHUB_TOKEN pushes do not create workflow runs.
      - uses: actions/create-github-app-token@v2
        id: app-token
        with:
          app-id: ${{ secrets.ENHANCE_DEPENDABOT_APP_ID }}
          private-key: ${{ secrets.ENHANCE_DEPENDABOT_APP_PRIVATE_KEY }}

      - uses: smartcontractkit/.github/actions/enhance-dependabot@enhance-dependabot/v1
        with:
          enhance-command: go mod tidy && make generate
          push-token: ${{ steps.app-token.outputs.token }}
          # Optional failure notifications:
          # slack-token: ${{ secrets.SLACK_BOT_TOKEN }}
          # slack-channel-id: ${{ secrets.SLACK_CHANNEL_ID }}
        # Credentials the enhance command needs (e.g. private packages for
        # codegen). Keep them read-only: the command runs dependency code.
        # env:
        #   NODE_AUTH_TOKEN: ${{ secrets.NPM_READ_TOKEN }}
```

**Important:**

- Use `pull_request_target`, not `pull_request`. Workflows triggered by
  Dependabot's `pull_request` events run with a read-only `GITHUB_TOKEN` and no
  Actions secrets (they are treated like fork PRs), so they cannot push.
  `pull_request_target` does not have this limitation, and it runs the workflow
  file from your default branch, which is what the `actor` check above gates on.
- Check out `github.event.pull_request.head.sha` with
  `persist-credentials: false`. The action refuses to run if HEAD is not the PR
  head SHA, since pushing a merge/base ref would carry a merge commit onto the
  Dependabot branch. It also refuses persisted checkout credentials: they would
  put a write token on disk while the enhance command runs, and they override
  `push-token` on push.
- Pushes made with `GITHUB_TOKEN` do not create new workflow runs, so with the
  default `push-token` your usual PR checks will **not** re-run after
  enhancement. Pass a GitHub App installation token or PAT as `push-token` to
  trigger them; the token is passed only to the push step.
- Keep the job's `concurrency` group: a Dependabot rebase supersedes the run for
  the old head.
- The `enhance-command` must be idempotent: it is re-run whenever Dependabot
  rebases the PR.
- The action commits every change and untracked file left in the working tree,
  so make sure tool caches and build artifacts from your setup steps and the
  enhance command are gitignored.

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

| Input              | Required | Default                                                       | Description                                                                                                                                                                                               |
| ------------------ | -------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enhance-command`  | yes      | -                                                             | Idempotent shell command(s), run from the repository root, that produce the final post-update state.                                                                                                      |
| `commit-message`   | no       | `chore(dependabot): apply post-update generation and cleanup` | Commit message for the enhancement commit.                                                                                                                                                                |
| `comment`          | no       | `true`                                                        | Comment on the PR when changes are pushed or a step fails. Quiet no-op otherwise.                                                                                                                         |
| `github-token`     | no       | `github.token`                                                | GitHub token used to comment on the pull request.                                                                                                                                                         |
| `push-token`       | no       | `github.token`                                                | Token used to push the enhancement commit, passed only to the push step. Pass a GitHub App token so the push triggers the repository's usual PR checks (GITHUB_TOKEN pushes do not create workflow runs). |
| `slack-token`      | no       | `''`                                                          | Slack bot token used to notify on enhancement failures. Notifications are skipped when unset.                                                                                                             |
| `slack-channel-id` | no       | `''`                                                          | Slack channel ID to notify on enhancement failures.                                                                                                                                                       |

## Outputs

| Output       | Description                                                       |
| ------------ | ----------------------------------------------------------------- |
| `changed`    | Whether the enhance command produced changes (`true` or `false`). |
| `commit-sha` | The SHA of the enhancement commit (set when it was pushed).       |

## Behavior

- Guards: only runs when triggered by `dependabot[bot]`, on in-repository
  `dependabot/*` branches whose head SHA is checked out without persisted
  credentials, otherwise it fails without touching anything.
- Runs `enhance-command` in your workflow's environment (after your setup
  steps).
- If it produces changes: commits them as `github-actions[bot]` and pushes to
  the same Dependabot branch with `push-token`, ignoring git config and hooks
  the enhance command could have planted. Pushed with a GitHub App token, the
  push triggers a `synchronize` event and your usual PR checks re-run against
  the enhanced head; pushes made with `GITHUB_TOKEN` do not create new workflow
  runs.
- If the branch moved while the command was running (Dependabot rebase), the run
  is superseded: it pushes nothing and succeeds, since the new head gets its own
  enhancement run. Replaying output generated from the old head could land stale
  results.
- If it produces no changes: succeeds quietly (green check, no comment).
- If the command or the push fails: fails the job (red check), comments on the
  PR with the run link, and optionally notifies Slack.

Re-runs are loop-safe: the workflow trigger is gated on
`actor == 'dependabot[bot]'`, so the `synchronize` event fired by an App-token
enhancement push does not re-trigger the enhance workflow itself (and a
`GITHUB_TOKEN` push fires no event at all). A Dependabot rebase re-triggers
enhancement automatically, keeping the PR enhanced after rebases.

## Known tradeoffs

- Once the enhancement commit is pushed, `@dependabot rebase` will refuse to
  rebase the PR (the branch contains non-Dependabot commits). Use
  `@dependabot recreate` instead: it recreates the PR from scratch and the
  enhancement workflow re-runs on the new head.
- The enhance command runs code that a dependency update can influence
  (generators, postinstall scripts, Make targets). The action keeps credentials
  away from it where it can: no write credential is on disk
  (`persist-credentials: false`, enforced), `push-token` is passed only to the
  push step, and the push ignores planted git config and hooks. This is
  best-effort: code that runs earlier in a job can still reach later steps (e.g.
  via `$GITHUB_ENV` or a background process), so a malicious dependency version
  can still act with the job's credentials, including `push-token`. That is the
  same trust decision as running your CI on Dependabot PRs; review dependency
  diffs.

## Development

- Guard and push logic live in [`scripts/validate.sh`](scripts/validate.sh) and
  [`scripts/push.sh`](scripts/push.sh); unit tests
  (`pnpm --filter enhance-dependabot test` or `bash scripts/test.sh`) cover them
  against throwaway git fixtures.
