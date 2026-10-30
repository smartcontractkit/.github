# autofix

Runs fixer commands (code generators, `go mod tidy`, formatters, ...) and
commits any changes they make back to the pull request branch as a signed
commit.

Most repositories should use the
[`reusable-autofix`](../../workflows/reusable-autofix) workflow, which also
handles checkout and the GitHub token, and documents how `paths`, the Go fixers,
and commits behave. Use this action directly when you need your own setup (other
actions to install tools, a different runner image, ...).

## Usage

```yaml
jobs:
  autofix:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: smartcontractkit/.github/actions/setup-github-token@setup-github-token/v1
        id: token
        with:
          profile: <your-profile>

      - uses: actions/checkout@v7
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          persist-credentials: false

      - uses: bufbuild/buf-action@v1
        with:
          setup_only: true

      - uses: smartcontractkit/.github/actions/autofix@autofix/v1
        with:
          github-token: ${{ steps.token.outputs.access-token }}
          working-directory: cre
          setup: buf format -w
          go: true
          setup-go: true
```

The checkout must be the pull request head commit (`actions/checkout` defaults
to a merge commit on `pull_request` events), otherwise the action refuses to
commit. Setup steps before the action run even when the pull request changed no
file in `paths`.

Committing needs `github-token`, a GitHub App token. Commits pushed with the
default `GITHUB_TOKEN` don't trigger workflow runs, so checks would never run on
the autofix commit; without a token the action fails instead of committing.

## Inputs

| Name                | Description                                                                    | Default                                |
| ------------------- | ------------------------------------------------------------------------------ | -------------------------------------- |
| `working-directory` | Directory `setup`, `run`, and the Go fixers run in.                            | `.`                                    |
| `paths`             | Files this autofix owns, git pathspecs one per line.                           | `working-directory`                    |
| `setup`             | Shell commands to run before the Go fixers.                                    |                                        |
| `run`               | Shell commands to run after the Go fixers.                                     |                                        |
| `go`                | Run the Go fixers.                                                             | `false`                                |
| `go-recursive`      | Fix every module in `paths` below `working-directory`, not only the one at it. | `true`                                 |
| `setup-go`          | Install Go first.                                                              | `false`                                |
| `go-version-file`   | go.mod used to determine the Go version.                                       | first module's                         |
| `always`            | Run on pull requests that change no file in `paths` too.                       | `false`                                |
| `commit`            | Commit changes. When `false`, changes fail the step.                           | `true`                                 |
| `commit-message`    | Message of the autofix commit.                                                 | `chore: autofix`                       |
| `branch`            | Branch to commit to.                                                           | `github.head_ref \|\| github.ref_name` |
| `fail-on-commit`    | Fail the step after pushing a commit too.                                      | `false`                                |
| `github-token`      | GitHub App token used to push the commit. Required to commit.                  |                                        |

## Outputs

| Name         | Description                                          |
| ------------ | ---------------------------------------------------- |
| `skipped`    | Whether the pull request changed no file in `paths`. |
| `changed`    | Whether the commands changed any files.              |
| `committed`  | Whether an autofix commit was pushed.                |
| `commit-sha` | SHA of the pushed autofix commit.                    |
