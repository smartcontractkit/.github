# wait-for-workflows action

```yaml
name: example

on:
  merge_group:
  pull_request:

jobs:
  waitForWorkflows:
    name: Wait for workflows
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Checkout repository
        uses: actions/checkout@9bb56186c3b09b4f86b1c65136769dd318469633 # v4.1.2
        with:
          ref:
            ${{ github.event.pull_request.head.sha ||
            github.event.merge_group.head_sha }}

      - name: Wait for workflows
        id: wait
        # Go to https://github.com/smartcontractkit/.github/tags
        # To find the most recent version of wait-for-workflows
        uses: smartcontractkit/.github/actions/wait-for-workflows@<commit> # wait-for-workflows@x.y.z
        with:
          max-timeout: "900"
          polling-interval: "30"
          exclude-workflow-names: ""
          exclude-workflow-ids: ""
          github-token: ${{ secrets.GITHUB_TOKEN }}
        env:
          DEBUG: "true"

  afterWait:
    name: after-wait
    needs: [waitForWorkflows]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Check needs results
        if: needs.waitForWorkflows.result != 'success'
        run: exit 1
```
