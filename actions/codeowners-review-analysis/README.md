# Codeowners Review Analysis (CORA)

Analyzes changed files for a given PR, and displays current CODEOWNER
requirements.

## Acknowledgement

The CODEOWNERS parsing contained in this repo was translated from:
https://github.com/hmarr/codeowners

## Usage

### Inputs

| input                        | description                                                                   | default           |
| ---------------------------- | ----------------------------------------------------------------------------- | ----------------- |
| `post-comment`               | Whether to post a small comment on the PR summarizing codeowners requirements | `true`            |
| `members-read-github-token`  | A `GITHUB_TOKEN` with org-wide members:read permissions                       | `none` - required |
| `minimum-codeowners`         | The minimum number of CODEOWNERS required to trigger the analysis             | `4`               |
| `minimum-codeowners-entries` | The minumum number of CODEOWNERS entries (lines) to trigger the analysis.     | `2`               |

### Triggering

Analysis is automatically triggered when a pull request (PR) satisfies **both**
of the following conditions:

- `minimum-codeowners` – The total number of unique code owners associated with
  the PR must meet or exceed this threshold.
  - This value represents the count of distinct individuals listed as code
    owners across all relevant entries that apply to the files changed in the
    PR.
- `minimum-codeowners-entries` – The total number of code owner entries (or
  lines) matched by the PR must meet or exceed this threshold.
  - This refers to the number of individual lines in the CODEOWNERS file that
    are triggered by the files included in the PR.

### Example Workflow

You should use the reusable workflow to integrate `cora` into your repository.

```yaml
name: Codeowners Review Analysis

on:
  pull_request:
    types:
      - opened
      - reopened
      - synchronize
  pull_request_review:
    types:
      - submitted
      - edited
      - dismissed

# Cancel any in-progress runs for the same pull request when a new event is triggered
# - This is mainly to stop concurrent 'synchronizes' and 'review dismissal' events
concurrency:
  group:
    ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  cora:
    uses: smartcontractkit/.github/.github/workflows/reusable-codeowners-review-analysis.yml@<sha>
    with:
      cora-minimum-codeowners: 4
      cora-minimum-codeowners-entries: 2
    secrets:
      AWS_ROLE_GATI_ARN: ${{ secrets.GATI_CODEOWNERS_IAM_ARN }}
      AWS_LAMBDA_GATI_URL: ${{ secrets.GATI_CODEOWNERS_LAMBDA_URL }}
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
