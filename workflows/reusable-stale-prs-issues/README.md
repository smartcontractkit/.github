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
      id-token: write
    stale-prs:
      uses: smartcontractkit/.github/.github/workflows/reusable-stale-prs-issues.yml@<ref>
      with:
        days-before-pr-stale: 30 # Optional, default value is "30"
      secrets:
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### GATI token

By default, the workflow acts with `GH_TOKEN`, or the workflow's `GITHUB_TOKEN`
when unset. PRs and issues closed by `GITHUB_TOKEN` don't trigger workflow
events (e.g. `pull_request: closed`). Set `gati-profile` to mint a token from
GATI instead, so they do:

```yaml
with:
  gati-profile: <profile>
```

The profile needs `issues: write`, `pull-requests: write`, `actions: write`, and
`contents: write` when `delete-branch` is on. `GH_TOKEN` is ignored when
`gati-profile` is set.

The caller must grant `id-token: write` whether or not `gati-profile` is set,
because GitHub checks a reusable workflow's job permissions before the run
starts.

## Migrating from v1 to v2

1. Grant `id-token: write` to the calling job. Without it, v2 fails before it
   starts.
2. Optionally, drop `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. It's the default
   now.
3. Optionally, set `gati-profile` so PRs and issues closed by the workflow
   trigger workflow events. See [GATI token](#gati-token).

```diff
 jobs:
   stale-prs:
     permissions:
       actions: write
       contents: write
       issues: write
       pull-requests: write
+      id-token: write
-    uses: smartcontractkit/.github/.github/workflows/reusable-stale-prs-issues.yml@reusable-stale-prs-issues/v1
+    uses: smartcontractkit/.github/.github/workflows/reusable-stale-prs-issues.yml@reusable-stale-prs-issues/v2
-    secrets:
-      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
