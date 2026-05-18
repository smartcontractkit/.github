# changed-roots

A GitHub Action that determines which package/module roots have changed for a
given GitHub event. It can be used to trigger workflows only for affected
packages or modules in monorepos — for any ecosystem that uses a marker file to
define a project root.

## Features

- Works with any ecosystem: Go (`go.mod`), Node.js (`package.json`), Helm
  (`Chart.yaml`), etc.
- Detects which roots have changed between commits or pull requests.
- Supports flexible glob patterns for filtering files and roots.
- Provides outputs in both CSV and JSON formats for easy downstream usage.
- Handles edge cases like scheduled or manually triggered workflows gracefully.

## Inputs

| Name                  | Description                                                                                                                                                                                                                                                                                    | Required | Default                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------- |
| `github-token`        | GitHub token for authentication.                                                                                                                                                                                                                                                               | ✅       | `${{ github.token }}`     |
| `repository-root`     | The path to the root of the checked out repository.                                                                                                                                                                                                                                            | ✅       | `${{ github.workspace }}` |
| `root-file`           | The marker file that defines a root (e.g. `go.mod`, `package.json`, `Chart.yaml`). Every directory containing this file is treated as a root.                                                                                                                                                  | ✅       |                           |
| `file-patterns`       | A comma or newline-separated list of glob patterns to include when determining changed roots. Only files matching these patterns are considered. Supports negations (e.g. `!**/*.test.ts`).                                                                                                    | ❌       | `**/*`                    |
| `root-patterns`       | A comma or newline-separated list of glob patterns to filter which roots are eligible. Supports negations (e.g. `!**/test/**`). Use `!__ROOT__` to exclude the repo root.                                                                                                                      | ❌       | `**`                      |
| `no-change-behaviour` | Defines what happens when the event has no changeset (e.g. `schedule`, `workflow_dispatch`). Options:<br> - `all`: All roots considered changed.<br> - `root`: Only the repo root (`.`).<br> - `latest-commit`: Roots changed in the latest commit.<br> - `none`: No roots considered changed. | ❌       | `all`                     |

## Outputs

| Name         | Description                                                                    |
| ------------ | ------------------------------------------------------------------------------ |
| `roots-csv`  | A comma-separated list of changed root paths, relative to the repository root. |
| `roots-json` | A JSON array of changed root paths, relative to the repository root.           |

## Example Usage

The following example runs a matrix job over all changed Go modules.

```yaml
name: example

on:
  merge_group:
  pull_request:
  push:
  workflow_dispatch:

jobs:
  init:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
    outputs:
      changed-roots: ${{ steps.changed-roots.outputs.roots-json }}
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4
        with:
          persist-credentials: false

      - name: Changed roots
        id: changed-roots
        uses: smartcontractkit/.github/actions/changed-roots@<tag>
        with:
          root-file: go.mod
          no-change-behaviour: all
          file-patterns: |
            **/*.go
            **/go.mod
            **/go.sum
          root-patterns: |
            **
            !path/to/ignore/**

  lint:
    name: Lint ${{ matrix.root }}
    needs: [init]
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        root: ${{ fromJson(needs.init.outputs.changed-roots) }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          persist-credentials: false

      - name: Lint
        uses: smartcontractkit/.github/actions/ci-lint-go@<tag>
        with:
          go-directory: ${{ matrix.root }}
```
