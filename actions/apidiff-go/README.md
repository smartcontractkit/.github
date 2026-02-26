# apidiff-go

Uses [apidiff](https://pkg.go.dev/golang.org/x/exp/cmd/apidiff) CLI to analyze
exports and surface breaking changes in a Go module's exported symbols.

## Features

Will analyze changes included in specific events.

- Installs `apidiff` if not found on the system already
- Analyzes the changes for any specified modules within a repository
- Optionally fail the action if any incompatible (breaking) changes are found
- Full summary for all changes found, posted as job output

## Usage

### Inputs

| input                | description                                                                     | default                   |
| -------------------- | ------------------------------------------------------------------------------- | ------------------------- |
| `repository-root`    | the root directory of the repository                                            | `${{ github.workspace }}` |
| `module-directory`   | the directory containing the root of the Go module to analyze, relative to root | `./`                      |
| `base-ref-override`  | the base ref, overriding default behaviour                                      | N/A                       |
| `head-ref-override`  | the head ref, overriding default behaviour                                      | N/A                       |
| `enforce-compatible` | whether the action should fail if incompatible (breaking) changes are found     | `true`                    |
| `post-comment`       | whether to post a comment on PRs with the result of the diff                    | `true`                    |
| `apidiff-version`    | the version of apidiff to install, default is recommended                       | `latest`                  |

#### Head / Base Ref

The head and base ref are by default determined automatically based on which
Github event triggered the invocation.

- `pull_request` - uses the `pull_request.base.sha`/`pull_request.head.sha` from
  the
  [event payload](https://docs.github.com/en/webhooks/webhook-events-and-payloads?actionType=synchronize#pull_request).
- `push` - uses the `before`/`after` from the
  [event payload](https://docs.github.com/en/webhooks/webhook-events-and-payloads#push)
- `workflow_dispatch` events require `base-ref-override` and `head-ref-override`
  inputs.

#### Outputs

1. `version-recommendation` - based on the changes, this will output `patch`,
   `minor`, or `major`
2. `summary-path` - a copy of the summary, written to disk. To be used for
   release notes if needed
   - This should be written to a `summary.md` at the root of the module

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
        with:
          go-version-file: "go.mod"
          cache: false

      - name: Analyze API Changes
        uses: smartcontractkit/.github/actions/apidiff-go@<ref>
        with:
          module-directory: "./" # diff root module
        env:
          GITHUB_TOKEN: ${{ github.token }}
```

## v1 vs. v2

- `v1` supported performing diffing multiple modules in one invocation, `v2`
  doesn't support that

### Example

If you want to diff more than one module, it is recommended to use a matrix for
this. This example workflow will determine a list of changed modules for the
current event, and then will diff only the changed modules.

```yaml
name: Analyze API Changes

on:
  pull_request:

jobs:
  changed-modules:
    permissions:
      pull-requests: write
      contents: read
    runs-on: ubuntu-latest
    outputs:
      modules-json: ${{ steps.changed-modules.outputs.modules-json }}
  steps:
    - name: Checkout the repository
      uses: actions/checkout@v4
      with:
        fetch-depth: 0

      - name: Changed modules
        id: changed-modules
        uses: smartcontractkit/.github/actions/changed-modules-go@changed-modules-go/v1
        with:
          file-patterns: |
            **/*.go
            **/go.mod
            **/go.sum
          module-patterns: '**'

  analyze:
    name: Analyze ${{ matrix.modules }}
    needs: [ 'changed-modules' ]
    permissions:
      actions: read
      contents: read
      pull-requests: write
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        modules: ${{ fromJson(needs.changed-modules.outputs.modules-json) }}
    steps:
      - name: Checkout the repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Go
        uses: actions/setup-go@v5
        # uses: ./.github/actions/setup-go
        with:
          go-version-file: ${{matrix.modules}}/go.mod
          cache: false

      - name: Analyze API Changes
        uses: smartcontractkit/.github/actions/apidiff-go@<ref>
        with:
          module-directory: ${{ matrix.modules }}
          enforce-compatible: "false"
        env:
          GITHUB_TOKEN: ${{ github.token }}
```
