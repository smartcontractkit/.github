# delete-deployments

> Deletes the spammy deployment notifications added to PRs

## Inputs

| Name            | Description                                                                                                                                | Required | Default                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------------------------- |
| `github-token`  | GitHub token to use for authentication                                                                                                     | Yes      | `${{ github.token }}`      |
| `environment`   | The environment to filter deployments by                                                                                                   | No       | —                          |
| `ref`           | The ref to filter deployments by                                                                                                           | Yes      | —                          |
| `dry-run`       | Whether to actually delete deployments or not                                                                                              | No       | —                          |
| `num-of-pages`  | Number of pages (100 per page) to fetch deployments from. Set to `all` to fetch all deployments. Must be "all" or a number greater than 0. | No       | `all`                      |
| `starting-page` | Page to start fetching deployments from. Only valid if `num-of-pages` is set to a number. Must be greater than or equal to 0.              | No       | —                          |
| `repository`    | Owner and repository name to delete deployments from (e.g., `smartcontractkit/chainlink`). Defaults to the current repository.             | No       | `${{ github.repository }}` |

## Example Usage

```yaml
name: Cleanup integration deployments
on:
  workflow_dispatch:
  schedule:
    # every 10 mins
    - cron: "*/10 * * * *"

jobs:
  cleanup:
    name: Clean up integration environment deployments
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4
        with:
          persist-credentials: false

      - name: Clean up integration environment
        uses: smartcontractkit/.github/actions/delete-deployments@delete-deployments/v1
        with:
          environment: integration
          # Delete 300 deployments at a time
          num-of-pages: 3
          # We start with page 2 because usually the first 200 deployments are still active, so we cannot delete them
          starting-page: 2
```
