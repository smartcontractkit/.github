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
