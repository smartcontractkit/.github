# Reusable Stale PRs/Issues

This workflow analyzes pull requests and issues to identify and close stale ones
that have not had any activity for a specified period. It will first add a stale
label to the issue or PR, and if there is still no activity after a specified
duration, it will close the issue or PR. It can also delete the branch if the PR
is closed.

It should be run on a nightly schedule. It's a thin wrapper with defaults set
for https://github.com/actions/stale.

## Usage

```yaml
name: Manage stale Issues and PRs

on:
  schedule:
    - cron: "0 0 * * *" # Will be triggered every day at midnight UTC
  jobs:
    permissions:
      actions: write
      contents: write
      issues: write
      pull-requests: write
    stale-prs:
      uses: smartcontractkit/.github/.github/workflows/reusable-stale-prs-issues.yml@<ref>
      with:
        days-before-pr-stale: 30 # Optional, default value is "30"
      secrets:
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
