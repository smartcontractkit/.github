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
| `file-patterns`       | A comma or newline-separated list of glob patterns to include when determining changed modules. Only files matching these patterns are considered. Supports negations (e.g. `!**/*_test.go`).                                                                                                          | ❌       | `**/*.go,**/go.mod,**/go.sum` |
| `module-patterns`     | A comma or newline-separated list of glob patterns to match module paths to include. Supports negations (e.g. `!**/test/**`).                                                                                                                                                                          | ❌       | `**`                          |
| `no-change-behaviour` | Defines what happens when the event has no changeset (e.g. `schedule`, `workflow_dispatch`). Options:<br> - `all`: All modules considered changed.<br> - `root`: Only the root module (`.`).<br> - `latest-commit`: Modules changed in the latest commit.<br> - `none`: No modules considered changed. | ❌       | `all`                         |

---

## 📤 Outputs

| Name                    | Description                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `modified-modules-csv`  | A comma-separated list of changed Go module paths, relative to the current working directory. |
| `modified-modules-json` | A JSON array of changed Go module paths, relative to the current working directory.           |
