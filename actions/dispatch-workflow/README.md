# dispatch-workflow

> Dispatch a workflow and output its workflow run id, requires workflow that is setup with a distinct run name

```yaml
name: example

on:
  merge_group:
  pull_request:

jobs:
  run-job:
    name: Dispatch Workflow
    runs-on:
      labels: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      - name: Dispatch workflow
        id: dispatch
        uses: smartcontractkit/.github/actions/dispatch-workflow@main
        with:
          repo: smartcontractkit/chainlink
          workflow: integration-tests.yml
          ref: some-ref-name-or-branch
          actor: your-actor-name
          distinct_run_name: ${{github.sha}}
          workflow-dispatch-fields: |
            --field distinct_run_name="${{github.sha}}" \
            --field evm-ref="${{github.sha}}"
          github-token: ${{ secrets.TOKEN }}
```

Example of a workflow with a distinct run name setup

```yaml
name: Integration Tests
run-name: Integration Tests ${{ inputs.distinct_run_name && inputs.distinct_run_name || '' }}
on:
  pull_request:
  workflow_dispatch:
    inputs:
      distinct_run_name:
        description: 'A unique identifier for this run, only use from other repos'
        required: false
        type: string
...
```
