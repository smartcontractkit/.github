# Get MCMS Tools Action

This GitHub Action fetches and builds the
[`mcms-tools`](https://github.com/smartcontractkit/mcms-tools) CLI.  
It outputs the path to the built CLI binary so other steps in your workflow can
use it.

## Usage

To use this GitHub Action, add the following step to your GitHub Actions
workflow YAML file:

```yaml
jobs:
  build-and-use-mcms:
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout your repo
        uses: actions/checkout@v4

      - name: Get and build MCMS tools
        uses: "./.github/actions/mcms/get-mcms-tools"
        id: get-mcms
        with:
          github_token: ${{ steps.setup-github-token.outputs.token }}

      - name: Use mcms CLI
        run: |
          ${{ steps.get-mcms.outputs.binary_path }} --help
```

## Inputs

| Input Name     | Description                                                        | Required | Default |
| -------------- | ------------------------------------------------------------------ | -------- | ------- |
| `github_token` | GitHub token with access to the `smartcontractkit/mcms-tools` repo | ✅ Yes   | —       |
| `ref`          | Optional git ref (branch, tag, or commit) to check out             | ❌ No    | `main`  |

## Outputs

| Output Name   | Description                            |
| ------------- | -------------------------------------- |
| `binary_path` | The path to the built mcms CLI binary. |
