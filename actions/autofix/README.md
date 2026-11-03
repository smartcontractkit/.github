# autofix

Runs fixer commands (code generators, `go mod tidy`, formatters, ...) and
commits any changes they make back to the pull request branch as a signed
commit. It's two actions, for two jobs:

- `autofix` runs the fixers. They run code from the pull request (`setup`,
  `run`, `go generate`), so its job holds no token beyond read access. It
  uploads the changes as an artifact.
- `autofix/commit` pushes them. Its job holds the token to push, so it runs
  nothing from the pull request and checks out nothing. It refuses changes
  outside `paths`, under `.github`, or to anything but regular files.

Most repositories should use the
[`reusable-autofix`](../../workflows/reusable-autofix) workflow, which wires the
two jobs together, and documents how `paths`, the Go fixers, and commits behave.
Use these actions directly when you need your own setup (other actions to
install tools, a different runner image, ...).

## Usage

```yaml
jobs:
  autofix:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    outputs:
      commit: ${{ steps.autofix.outputs.commit }}
      artifact: ${{ steps.autofix.outputs.artifact }}
    steps:
      - uses: actions/checkout@v7
        with:
          ref: ${{ github.event.pull_request.head.sha || github.sha }}
          persist-credentials: false

      - uses: bufbuild/buf-action@85aebf73123b5c15fd5528aaecbf9129cddf7fa7 # v1.6.0
        with:
          setup_only: true

      - uses: smartcontractkit/.github/actions/autofix@autofix/v1
        id: autofix
        with:
          working-directory: cre
          setup: buf format -w
          go: true
          setup-go: true

  autofix-commit:
    needs: autofix
    if: needs.autofix.outputs.commit == 'true'
    runs-on: ubuntu-latest
    permissions:
      id-token: write
    steps:
      - uses: smartcontractkit/.github/actions/setup-github-token@setup-github-token/v1
        id: token
        with:
          profile: <your-profile>

      - uses: smartcontractkit/.github/actions/autofix/commit@autofix/v1
        with:
          artifact: ${{ needs.autofix.outputs.artifact }}
          paths: cre # the same paths as autofix
          github-token: ${{ steps.token.outputs.access-token }}
```

The checkout must be the commit the workflow runs for, the pull request head
rather than `actions/checkout`'s default merge commit, otherwise autofix refuses
to commit. Files in `paths` must be unchanged when autofix starts, since it'd
commit any changes there as its fixes.

Pass `autofix/commit` the same `paths` as `autofix`, from the workflow rather
than from the `autofix` job's outputs, so the pull request can't widen them.

Commits pushed with the default `GITHUB_TOKEN` don't trigger workflow runs, so
`autofix/commit` needs a GitHub App token: checks would never run on the autofix
commit otherwise.

## autofix

### Inputs

| Name                | Description                                                                    | Default             |
| ------------------- | ------------------------------------------------------------------------------ | ------------------- |
| `working-directory` | Directory `setup`, `run`, and the Go fixers run in.                            | `.`                 |
| `paths`             | Files this autofix owns, git pathspecs one per line.                           | `working-directory` |
| `setup`             | Shell commands to run before the Go fixers.                                    |                     |
| `run`               | Shell commands to run after the Go fixers.                                     |                     |
| `go`                | Run the Go fixers.                                                             | `false`             |
| `go-recursive`      | Fix every module in `paths` below `working-directory`, not only the one at it. | `true`              |
| `setup-go`          | Install Go first.                                                              | `false`             |
| `go-version-file`   | go.mod used to determine the Go version.                                       | first module's      |
| `always`            | Run on pull requests that change no file in `paths` too.                       | `false`             |
| `commit`            | Upload changes for `autofix/commit`. When `false`, changes fail the step.      | `true`              |

### Outputs

| Name       | Description                                          |
| ---------- | ---------------------------------------------------- |
| `skipped`  | Whether the pull request changed no file in `paths`. |
| `changed`  | Whether the commands changed any files.              |
| `commit`   | Whether there are changes for `autofix/commit`.      |
| `artifact` | Name of the artifact holding them.                   |

## autofix/commit

### Inputs

| Name             | Description                                             | Default          |
| ---------------- | ------------------------------------------------------- | ---------------- |
| `artifact`       | The `artifact` output of `autofix`.                     |                  |
| `paths`          | The same `paths` as `autofix`, from the workflow.       |                  |
| `github-token`   | GitHub App token used to push. Needs `contents: write`. |                  |
| `commit-message` | Message of the autofix commit.                          | `chore: autofix` |

### Outputs

| Name         | Description                           |
| ------------ | ------------------------------------- |
| `committed`  | Whether an autofix commit was pushed. |
| `commit-sha` | SHA of the pushed autofix commit.     |
