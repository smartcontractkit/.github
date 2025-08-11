# apidiff-go

Uses [apidiff](https://pkg.go.dev/golang.org/x/exp/cmd/apidiff) CLI to analyze
pull requests for breaking changes in a Go module's exported symbols.

## Features

Will analyze the changes introduced by a pull request and comment on the pull
request with it's findings.

- Installs `apidiff` if not found on the system already
- Analyzes root module, or any modules nested in a repository (although only 1
  at a time)
- Enforce compatible changes by failing the action if any incompatible changes
  are found
- Full summary for all changes found, posted as job output

## Usage

### Inputs

| input                | description                                                                        | default                                     |
| -------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------- |
| `directory`          | the root directory of the repository                                               | `./`                                        |
| `go-mod-path`        | the relative path (relative to the root of the repository) to the root of a module | `.`                                         |
| `base-ref`           | the base ref to compare to - if a branch it will find the common ancestor          | `${{ github.event.pull_request.base.ref }}` |
| `head-ref`           | the head ref to compare from - if a branch it will use the `HEAD`                  | `${{ github.event.pull_request.head.ref }}` |
| `enforce-compatible` | whether the action should fail if incompatible (breaking) changes are found        | `true`                                      |

### Example Workflow

```yaml
name: Analyze API Changes
on:
  pull_request:

jobs:
  analyze:
    permissions:
      pull-requests: write
      contents: read
    runs-on: ubuntu-latest
    steps:
      - name: Checkout the repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Go
        uses: actions/setup-go@v5
        # uses: ./.github/actions/setup-go
        with:
          go-version-file: "go.mod"
          cache: false

      - name: Analyze API Changes
        uses: smartcontractkit/.github/actions/apidiff-go@<ref>
        with:
          go-mod-path: ./path-to-nested-go-mod # defaults to .
        env:
          GITHUB_TOKEN: ${{ github.token }}
```
