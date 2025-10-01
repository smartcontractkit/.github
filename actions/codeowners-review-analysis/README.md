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

### Triggering

With the below workflow, the best way to trigger the tool is to comment `.cora`.

- When you comment `.cora`, the action will add the `cora` label to your PR, and
  it will retrigger on any review events. This makes sure the information
  displayed is up-to-date.
- This will also work if you add the `cora` label manually, but it is not
  recommended as it has the a side-effect of triggering all workflows with the
  `labeled` trigger.

### Example Workflow

The most up-to-date workflow reference is available here:
https://github.com/smartcontractkit/chainlink/blob/develop/.github/workflows/codeowners-review-analysis.yaml

```yaml
name: "CodeOwners Review Analysis (cora)"

on:
  pull_request:
    types:
      - labeled # when adding 'cora' label

  pull_request_review:
    types:
      - submitted
      - edited
      - dismissed

  issue_comment:
    types: [created] # when commenting .cora

jobs:
  analyze-reviews:
    name: "analyze"
    runs-on: ubuntu-latest
    permissions:
      actions: read # needed to pull actions run url
      contents: read # needed to pull codeowners file
      id-token: write # used to assume aws role
      pull-requests: write # needed to read pull request and add comments
      issues: write # needed to add labels on PRs (weirdly)
    steps:
      - name: Run Conditions
        id: run-conditions
        env:
          ISSUE_COMMENT:
            ${{ github.event_name == 'issue_comment' &&
            contains(github.event.comment.body, '.cora') }}
          PR_LABEL:
            ${{ contains(github.event.pull_request.labels.*.name, 'cora') }}
        run: |
          if [[ "$ISSUE_COMMENT" == "true" ]]; then
            echo "cora-comment=true" | tee -a "${GITHUB_OUTPUT}"
            echo "run-cora=true" | tee -a "${GITHUB_OUTPUT}"
          elif [[ "$PR_LABEL" == "true" ]]; then
            echo "run-cora=true" | tee -a "${GITHUB_OUTPUT}"
          else
            echo "run-cora=false" | tee -a "${GITHUB_OUTPUT}"
            echo "To run this workflow, comment '.cora' on the PR."
            echo "Commenting this will add the 'cora' label to the PR, and enable it for future events."
            echo "Note: Adding the label manually will trigger other workflows, which is why we recommend commenting instead."
          fi

      - name: Add 'cora' label on comments
        if: ${{ steps.run-conditions.outputs.cora-comment == 'true' }}
        continue-on-error: true
        env:
          GITHUB_REPOSITORY: ${{ github.repository }}
          PULL_REQUEST_NUMBER:
            ${{ github.event.pull_request.number || github.event.issue.number }}
          GH_TOKEN: ${{ github.token }}
        run: |
          # See: https://docs.github.com/en/rest/issues/labels?apiVersion=2022-11-28#add-labels-to-an-issue
          gh api \
            --method POST \
            /repos/${GITHUB_REPOSITORY}/issues/${PULL_REQUEST_NUMBER}/labels \
            --input - <<< '{
            "labels": [
              "cora"
            ]
          }'

      - name: Setup github token
        id: setup-github-token
        if: ${{ steps.run-conditions.outputs.run-cora == 'true' }}
        uses: smartcontractkit/.github/actions/setup-github-token@setup-github-token/v1
        with:
          aws-role-arn: ${{ secrets.GATI_CODEOWNERS_IAM_ARN }}
          aws-lambda-url: ${{ secrets.GATI_CODEOWNERS_LAMBDA_URL }}
          aws-region: us-west-2

      - name: CODEOWNERS Review Analysis
        if: ${{ steps.run-conditions.outputs.run-cora == 'true' }}
        uses: smartcontractkit/.github/actions/codeowners-review-analysis@codeowners-review-analysis/v1
        env:
          GITHUB_TOKEN: ${{ github.token }}
        with:
          members-read-github-token:
            ${{ steps.setup-github-token.outputs.access-token }}
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
