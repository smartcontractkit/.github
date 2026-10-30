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

Each call owns the files in `paths` (git pathspecs, defaulting to
`working-directory`), and runs two jobs.

`fix` runs code from the pull request, so it only has `contents: read`:

1. If files in `paths` are already changed, it fails, since it'd commit them as
   fixes.
2. On a pull request that changed none of them, it does nothing (unless
   `always: true`).
3. `setup` runs in `working-directory`.
4. With `go: true`, the [Go fixers](#go) run.
5. `run` runs in `working-directory`.
6. Changes to files in `paths` are uploaded as an artifact. Changes elsewhere
   are left alone with a warning, they belong to another call (or are build
   artifacts).

`commit` gets the GATI token and pushes the artifact's changes as a signed
commit. It runs nothing from the pull request and checks out nothing, and
refuses changes outside `paths`, under `.github`, or to anything but regular
files. That way the job holding write access never runs anything the pull
request controls, such as a `//go:generate` line or a dependency's code in a
Dependabot pull request.

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

- No changes: both jobs pass, `commit` is skipped.
- Changes on a pull request branch: they're pushed as a signed commit, and the
  jobs pass. Checks run again on the new commit, which is now the pull request's
  head.
- A command fails: `fix` fails, and nothing is committed.
- Changes that can't be pushed (fork pull requests, the default branch, merge
  queue branches, changes under `.github`): `fix` fails and the diff is in the
  logs. Run the same commands locally.
- Another autofix call pushed first: the commit goes on top of theirs if they
  changed different files, otherwise `commit` fails.
- Someone else pushed since checkout: the fixes are stale, so `commit` fails,
  and checks run again on the new push.
- If the commands change files that the autofix commit at HEAD already changed,
  `fix` fails instead of committing again, so commands that never converge can't
  loop.

Autofix commits carry an `Autofix: true` trailer, which is how jobs recognize
each other's commits.

### Tokens

Commits pushed with the default `GITHUB_TOKEN`
[don't trigger workflow runs](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication#using-the-github_token-in-a-workflow),
so checks would never run on the autofix commit. `commit` gets a GitHub App
token for `gati-profile` instead, which needs `contents: write` on the
repository. Only `commit` gets it, and only when there's something to push.

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
| `gati-profile`      | Required. GATI v2 profile for the token that pushes. See [Tokens](#tokens).         |                     |
| `runs-on`           | Runner to use.                                                                      | `ubuntu-latest`     |

## Outputs

| Name        | Description                                          |
| ----------- | ---------------------------------------------------- |
| `skipped`   | Whether the pull request changed no file in `paths`. |
| `changed`   | Whether the commands changed any files.              |
| `committed` | Whether an autofix commit was pushed.                |
