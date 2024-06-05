# wait-for-workflow-job

Waits for a job in a workflow to complete.
This is useful when you need to wait for a specific (required) job to complete but do not need the result of the whole workflow itself.

```yaml
name: example

on:
  merge_group:
  pull_request:

jobs:
  run-job:
    name: Wait For Job
    runs-on:
      labels: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Checkout repository
        uses: actions/checkout@V4
      ... dispatch the workflow you want and get its workflow run id, then:
      - name: Get Job Results
        uses: smartcontractkit/.github/wait-for-workflow-job@main
        with:
          repo: smartcontractkit/chainlink
          workflow-run-id: ${{ steps.dispatch.outputs.run-id }}
          job-name: "Core Tests (go_core_tests)"
          github-token: ${{ github.Token }} # token needs permissions to read action results
```
