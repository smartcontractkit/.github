# gha-workflow-validator

> Will validate workflow changes in a repository

## Usage

Add a workflow file at `.github/workflows/gha-workflow-validator.yml`

```
name: GHA Workflow Validation

on:
  pull_request:

jobs:
  validate-workflow-changes:
    permissions:
      contents: read
      pull-requests: write
    runs-on: ubuntu-latest

    steps:
      - name: GHA Workflow Validator
        uses: smartcontractkit/.github/actions/gha-workflow-validator@main
        env:
          GITHUB_TOKEN: ${{ github.token }}
```

## Development

1. Update dist: `pnpm nx run gha-workflow-validator:build`
2. Run tests: `pnpm nx run gha-workflow-validator:test`
3. Record Fixtures (new only):
   `NOCK_BACK_MODE=record pnpm nx run gha-workflow-validator:test`
4. Update Fixtures (existing only):
   `NOCK_BACK_MODE=update pnpm nx run gha-workflow-validator:test`

### Local Testing

From the root of the repository run
`./actions/gha-workflow-validator/scripts/test.sh`.

### Potential Future Features

1. Support for references to actions local to the repository
2. Support for ignoring lines or files through inlined comments
   (`# gha-validator ignore`)
3. Support for warnings and errors
4. Validate that the SHA-1 used points to the tag in the comment
5. Validate that the action is a part of some allowed set of actions
6. Validate that the `runs-on` field is using some allowed set of runners
