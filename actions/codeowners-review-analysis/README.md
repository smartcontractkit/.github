# Codeowners Review Analysis (CORA)

Analyzes changed files for a given PR, and displays current CODEOWNER
requirements.

## Acknowledgement

The CODEOWNERS parsing contained in this repo was translated from:
https://github.com/hmarr/codeowners

## Usage

### Inputs

| input                       | description                                                                   | default           |
| --------------------------- | ----------------------------------------------------------------------------- | ----------------- |
| `post-comment`              | Whether to post a small comment on the PR summarizing codeowners requirements | `true`            |
| `members-read-github-token` | A `GITHUB_TOKEN` with org-wide members:read permissions                       | `none` - required |

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

### Github GQL Notes

The `github-gql.ts` file contains a lot more logic than what is generally used
in CI environments. This is because of permissions. For the full request to
work, it requires org-level `members:read` permissions. This is unonbtainable
through the CI generated `GITHUB_TOKEN`. Without these permissions, it's not
posssible to see what team a user reviewed on behalf of. Which makes
understanding the state of the PR a little more difficult. GraphQL
[review node](https://docs.github.com/en/graphql/reference/objects#pullrequestreview)
with proper permissions:

```json
{
  "id": "<pr node id>",
  "url": "https://github.com/smartcontractkit/<repo>/pull/<pr number>#pullrequestreview-<pr id>",
  "state": "APPROVED",
  "submittedAt": "2025-09-18T20:18:50Z",
  "author": { "__typename": "User", "login": "erikburt" },
  "onBehalfOf": {
    "nodes": [
      {
        "id": "<id>",
        "slug": "example-team",
        "name": "Example Team"
      }
    ]
  }
}
```

Now, without `members:read` permissions.

```json
{
  "id": "<pr node id>",
  "url": "https://github.com/smartcontractkit/<repo>/pull/<pr number>#pullrequestreview-<pr id>",
  "state": "APPROVED",
  "submittedAt": "2025-09-18T20:18:50Z",
  "author": { "__typename": "User", "login": "erikburt" },
  "onBehalfOf": { "nodes": [] }
}
```
