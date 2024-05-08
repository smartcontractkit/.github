# cleanup-old-branches

Cleans up or deletes old (stale) branches in a GitHub repository.

Criteria for branch deletion:

1. The branch is not the default branch;
2. The branch is not a protected branch;
3. The branch is older than a specified number of days;
4. The branch prefix does not match any in a specified list of branch prefixes
   to keep; and
5. The branch is not included in a specified list of branches to keep.

## Example of Scheduled Workflow

```yaml
name: Cleanup Old Branches
on:
  schedule:
    # Runs at 00:00 UTC every Monday
    - cron: "0 0 * * 1"
jobs:
  cleanup-old-branches:
    runs-on: ubuntu-latest
    steps:
      - uses: smartcontractkit/.github/actions/cleanup-old-branches@main
        with:
          branch-days-to-keep: 30
          branch-prefixes-to-keep: "release/"
          branches-to-keep: "main,develop"
          checkout-repo: "true"
          dry-run: "false"
          gh-token: ${{ secrets.GH_TOKEN }}
```
