# Codeowners Analysis

Analyzes changed files for a given PR, and displays current CODEOWNER
requirements.

## Acknowledgement

The CODEOWNERS parsing contained in this repo was translated from:
https://github.com/hmarr/codeowners

## Usage

### Inputs

| input          | description                                                                   | default |
| -------------- | ----------------------------------------------------------------------------- | ------- |
| `post-comment` | Whether to post a small comment on the PR summarizing codeowners requirements | `true`  |

### Example Workflow

```yaml
name: Codeowners Analysis Test
on:
  workflow_dispatch:
  pull_request:
    paths:
      - .github/workflows/codeowners-analysis.yml
jobs:
  analyze-changes:
    runs-on: ubuntu-latest
    permissions:
      contents: read # needed to read codeowners file
      pull-requests: read # needed to comment on PRs
      actions: read # needed to get summary url
    steps:
      - name: Checkout code
        uses: actions/checkout@v5
        with:
          fetch-depth: 1
      - name: Run Codeowners Analysis
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        uses: smartcontractkit/.github/actions/codeowners-review-analysis@<tag>
```

## Development

### Generated Types

See [src/generated/README.md](./src/generated/README.md) for more details.

### Local Testing

From the root of the `.github` repository, you can run
`./actions/codeowners-review-analysis/scripts/test.sh` to run tests.

- Update both `test.sh` and `payload.json` for your test case
