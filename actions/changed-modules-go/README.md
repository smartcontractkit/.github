# changed-modules-go

A GitHub Action that determines which Go modules have changed for a given GitHub
event. It can be used to trigger workflows only for affected modules in
monorepos or multi-module Go projects.

## Features

- Detects which Go modules have changed between commits or pull requests.
- Supports flexible glob patterns for filtering files and module paths.
- Provides outputs in both CSV and JSON formats for easy downstream usage.
- Handles edge cases like scheduled or manually triggered workflows gracefully.

## Inputs

| Name                  | Description                                                                                                                                                                                                                                                                                            | Required | Default                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ----------------------------- |
| `repository-root`     | The path to the root of the checked out repository.                                                                                                                                                                                                                                                    | ❌       | `${{ github.workspace }}`     |
| `file-patterns`       | A comma or newline-separated list of glob patterns to include when determining changed modules. Only files matching these patterns are considered. Supports negations (e.g. `!**/*_test.go`).                                                                                                          | ❌       | `**/*.go,**/go.mod,**/go.sum` |
| `module-patterns`     | A comma or newline-separated list of glob patterns to match module paths to include. Supports negations (e.g. `!**/test/**`).                                                                                                                                                                          | ❌       | `**`                          |
| `no-change-behaviour` | Defines what happens when the event has no changeset (e.g. `schedule`, `workflow_dispatch`). Options:<br> - `all`: All modules considered changed.<br> - `root`: Only the root module (`.`).<br> - `latest-commit`: Modules changed in the latest commit.<br> - `none`: No modules considered changed. | ❌       | `all`                         |

---

## 📤 Outputs

| Name           | Description                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------- |
| `modules-csv`  | A comma-separated list of changed Go module paths, relative to the current working directory. |
| `modules-json` | A JSON array of changed Go module paths, relative to the current working directory.           |

## Example Usage

Here is an example that runs a matrix on changed modules only.

```yaml
name: example

on:
  merge_group:
  pull_request:
  push:
  workflow_dispatch:

  init:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
    outputs:
      changed-modules: ${{ steps.changed-modules.outputs.modules-json }}
    steps:
      - name: Checkout repo (needed to reference local action)
        uses: actions/checkout@v5
        with:
          persist-credentials: false

      - name: Changed modules
        id: changed-modules
        uses: smartcontractkit/.github/actions/changed-modules-go@<tag>
        with:
          no-change-behaviour: all
          file-patterns: |
            **/*.go
            **/go.mod
            **/go.sum
          module-patterns: |
            **
            !path/to/ignore/**

  lint:
    name: Lint ${{ matrix.modules }}
    needs: [ init ]
    runs-on: ubuntu-latest

    name: GolangCI Lint
    permissions:
      ...
    strategy:
      fail-fast: false
      matrix:
        modules: ${{ fromJson(needs.init.outputs.changed-modules) }}
    steps:
      - name: Checkout
        uses: actions/checkout@v5
        with:
          persist-credentials: false

      - name: Lint
        id: golang-lint
        uses: smartcontractkit/.github/actions/ci-lint-go@<tag>
        timeout-minutes: 20
        with:
          go-directory: ${{ matrix.modules }}
          only-new-issues: true
```
