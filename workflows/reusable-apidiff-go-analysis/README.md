# Reusable apidiff-go analysis

A simple reusable workflow wrapper around the `apidiff-go` resuable Github
Action for conditional api analysis on a per-module basis.

- https://github.com/smartcontractkit/.github/tree/main/actions/apidiff-go

## Usage

### Inputs

Inputs are passed directly to the associated action, see that actions
documentation for more details.

- `file-patterns`, `module-patterns` - see
  [`changed-modules-go`](https://github.com/smartcontractkit/.github/tree/main/actions/changed-modules-go)
- ``enforce-compatible` - see
  [`apidiff-go`](https://github.com/smartcontractkit/.github/tree/main/actions/apidiff-go)

```yaml
name: Analyze API Changes

on:
  pull_request: {}

permissions: {}

jobs:
  analysis:
    uses: smartcontractkit/.github/.github/workflows/reusable-apidiff-go-analysis@<ref>
    permissions:
      pull-requests: write
      contents: read
    with: # note: showing default values of inputs
      file-patterns: |
        **/*.go
        **/go.mod
        **/go.sum
      module-patterns: |
        **
      enforce-compatible: false
```
