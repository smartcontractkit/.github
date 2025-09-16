# apidiff-go

Uses [apidiff](https://pkg.go.dev/golang.org/x/exp/cmd/apidiff) CLI to analyze
pull requests for breaking changes in a Go module's exported symbols.

## Features

Will analyze the changes introduced by a pull request and comment on the pull
request with it's findings.

- Installs `apidiff` if not found on the system already
- Analyzes the changes for any specified modules within a repository
- Optionally fail the action if any incompatible (breaking) changes are found
- Full summary for all changes found, posted as job output

## Usage

### Inputs

| input                | description                                                                       | default                                     |
| -------------------- | --------------------------------------------------------------------------------- | ------------------------------------------- |
| `directory`          | the root directory of the repository                                              | `./`                                        |
| `go-mod-paths`       | comma separated relative paths (to the root of the repository) to root of modules | `.`                                         |
| `base-ref`           | the base ref to compare to - if a branch it will find the common ancestor         | `${{ github.event.pull_request.base.ref }}` |
| `head-ref`           | the head ref to compare from - if a branch it will use the `HEAD`                 | `${{ github.event.pull_request.head.ref }}` |
| `enforce-compatible` | whether the action should fail if incompatible (breaking) changes are found       | `true`                                      |
| `apidiff-version`    | the version of apidiff to install, default is recommended                         | `latest`                                    |

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
          go-mod-paths: .,./module-1,./module-2 # compare 3 modules
        env:
          GITHUB_TOKEN: ${{ github.token }}
```
