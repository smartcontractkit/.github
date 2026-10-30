# Reusable Autofix

Runs fixer commands on a pull request (code generators, `go mod tidy`,
formatters, ...) and commits any changes they make back to the pull request
branch. Contributors don't need to remember to run them locally.

Wraps the [`autofix`](../../actions/autofix) action with checkout, Go setup, and
a GATI token.

## Usage

Go fixers in every module in the repository:

```yaml
name: autofix

on:
  pull_request:

permissions: {}

jobs:
  autofix:
    permissions:
      contents: write
      id-token: write
    uses: smartcontractkit/.github/.github/workflows/reusable-autofix.yml@reusable-autofix/v1
    with:
      gati-profile: <your-profile>
      go: true
```

Tools that `go generate` needs, installed by `setup` first (e.g.
chainlink-common):

```yaml
with:
  gati-profile: <your-profile>
  setup: make mockery install-protoc cre-protoc
  go: true
```

Different rules for different parts of the repository, one job each (e.g.
chainlink-protos, where `cre` has its own tooling):

```yaml
jobs:
  autofix-cre:
    permissions:
      contents: write
      id-token: write
    uses: smartcontractkit/.github/.github/workflows/reusable-autofix.yml@reusable-autofix/v1
    with:
      gati-profile: <your-profile>
      working-directory: cre
      setup: |
        go install github.com/bufbuild/buf/cmd/buf@v1.45.0
        buf format -w
      go: true

  autofix:
    permissions:
      contents: write
      id-token: write
    uses: smartcontractkit/.github/.github/workflows/reusable-autofix.yml@reusable-autofix/v1
    with:
      gati-profile: <your-profile>
      paths: |
        .
        :!cre
      setup: |
        # install protoc, task, protoc-gen-go, ...
        task proto:all
      go: true
```

## How it works

Each job owns the files in `paths` (git pathspecs, defaulting to
`working-directory`):

1. On a pull request that changed none of them, the job does nothing (unless
   `always: true`).
2. `setup` runs in `working-directory`.
3. With `go: true`, the [Go fixers](#go) run.
4. `run` runs in `working-directory`.
5. Changes to files in `paths` are committed. Changes elsewhere are left alone
   with a warning, they belong to another job (or are build artifacts).

The order is what lets one pass fix everything: `setup` installs tools and
formats or generates what Go is generated from, the Go fixers generate from
that, and `run` derives what depends on the fixed modules (e.g. a module graph
from the tidied `go.mod` files).

### Go

`go: true` runs, in each Go module:

1. `go mod tidy`
2. `go fix ./...`
3. `go fmt ./...`
4. `go generate ./...`, after formatting, so generated code needs no second fix
5. `go mod tidy` (fix and generate can change imports)

By default (`go-recursive: true`) that's every module in `paths` in or below
`working-directory`. Modules are found the way the `go` tool would: every
`go.mod` that is tracked or not ignored by git, skipping `vendor`, `testdata`,
and directories starting with `.` or `_`. With `go-recursive: false`, only the
module at `working-directory` is fixed.

Modules requiring a newer Go than the one installed download it
(`GOTOOLCHAIN=auto`).

### Commits

- No changes: the job passes.
- Changes on a pull request branch: they're pushed as a signed commit, and the
  job passes. Checks run again on the new commit, which is now the pull
  request's head.
- A command fails: the job fails, and nothing is committed.
- Changes that can't be pushed (fork pull requests, the default branch, merge
  queue branches): the job fails and the diff is in the logs. Run the same
  commands locally.
- Another autofix job pushed first: the commit goes on top of theirs if they
  changed different files, otherwise the job fails.
- Someone else pushed since checkout: the fixes are stale, so the job fails, and
  runs again on the new push.
- If the commands change files that the autofix commit at HEAD already changed,
  the job fails instead of committing again, so commands that never converge
  can't loop.

Autofix commits carry an `Autofix: true` trailer, which is how jobs recognize
each other's commits.

### Tokens

Commits pushed with the default `GITHUB_TOKEN`
[don't trigger workflow runs](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication#using-the-github_token-in-a-workflow),
so checks would never run on the autofix commit. There's no fallback to it: on
pull requests from the repository, pass a `gati-profile` (GATI v2) or the
`AWS_ROLE_ARN` and `AWS_LAMBDA_URL` secrets (GATI v1), or the job fails. The
token needs `contents: write` on the repository. Other events never commit, so
need no token.

## Inputs

| Name                | Description                                                                         | Default             |
| ------------------- | ----------------------------------------------------------------------------------- | ------------------- |
| `working-directory` | Directory `setup`, `run`, and the Go fixers run in.                                 | `.`                 |
| `paths`             | Files this job owns, git pathspecs one per line. See [How it works](#how-it-works). | `working-directory` |
| `setup`             | Shell commands to run before the Go fixers.                                         |                     |
| `run`               | Shell commands to run after the Go fixers.                                          |                     |
| `go`                | Run the Go fixers. See [Go](#go).                                                   | `false`             |
| `go-recursive`      | Fix every module in `paths` below `working-directory`, not only the one at it.      | `true`              |
| `always`            | Run on pull requests that change no file in `paths` too.                            | `false`             |
| `setup-go`          | Install Go even when `go` isn't true, for commands that need it.                    | `false`             |
| `go-version-file`   | go.mod used to determine the Go version.                                            | first module's      |
| `commit-message`    | Message of the autofix commit.                                                      | `chore: autofix`    |
| `gati-profile`      | GATI v2 profile for the token that pushes the commit. See [Tokens](#tokens).        |                     |
| `runs-on`           | Runner to use.                                                                      | `ubuntu-latest`     |

## Outputs

| Name        | Description                                          |
| ----------- | ---------------------------------------------------- |
| `skipped`   | Whether the pull request changed no file in `paths`. |
| `changed`   | Whether the commands changed any files.              |
| `committed` | Whether an autofix commit was pushed.                |
