# Release Lock Action

A GitHub Action that releases a deployment lock by deleting the lock branch
created by the [acquire-lock](../acquire-lock) action. This action ensures
proper cleanup of locks and optionally removes lock-related comments from other
PRs.

## Overview

This action is designed to work in tandem with the `acquire-lock` action. When a
PR that holds a deployment lock is closed or merged, this action releases the
lock by deleting the lock branch and cleaning up any "Deploy blocked" comments
posted to other PRs.

## Features

- **Safe lock release**: Only deletes lock branches owned by the current PR
- **Automatic comment cleanup**: Removes "Deploy blocked" comments from other
  PRs after lock is released
- **Idempotent**: Safe to run even if the lock doesn't exist or is owned by
  another PR
- **Flexible**: Works with PR closures, merges, and manual workflow runs

## Inputs

| Input              | Required | Default                            | Description                                                                     |
| ------------------ | -------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| `lock`             | Yes      | -                                  | The name of the lock to release (must match the lock name used in acquire-lock) |
| `pr`               | No       | `github.event.pull_request.number` | The pull request number that owns the lock                                      |
| `cleanup_comments` | No       | `"true"`                           | Whether to delete lock-related comments from other PRs (`"true"` or `"false"`)  |

## Outputs

This action does not produce outputs, but sets internal output variables for
conditional steps.

## Usage

### Basic Example with PR Closure

```yaml
name: Release Lock on PR Close
on:
  pull_request:
    types: [closed]

jobs:
  release-lock:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required for lock branch operations

      - name: Release deployment lock
        uses: ./.github/actions/release-lock
        with:
          lock: global-deploy-lock
```

### Advanced Example with Manual Trigger

```yaml
name: Manual Lock Release
on:
  workflow_dispatch:
    inputs:
      lock_name:
        description: "Name of the lock to release"
        required: true
        default: "global-deploy-lock"
      pr_number:
        description: "PR number that owns the lock"
        required: true

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Release lock
        uses: ./.github/actions/release-lock
        with:
          lock: ${{ github.event.inputs.lock_name }}
          pr: ${{ github.event.inputs.pr_number }}
          cleanup_comments: "true"
```

### Example with Conditional Comment Cleanup

```yaml
name: Release Lock Without Cleanup
on:
  pull_request:
    types: [closed]

jobs:
  release-lock:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Release lock
        uses: ./.github/actions/release-lock
        with:
          lock: production-deploy-lock
          cleanup_comments: "false" # Keep comments for audit trail
```

### Combined Acquire and Release Workflow

```yaml
name: Deploy with Lock Management
on:
  pull_request:
    types: [opened, synchronize, reopened, closed]

jobs:
  deploy:
    if: github.event.action != 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Acquire lock
        uses: ./.github/actions/acquire-lock
        with:
          lock: deploy-lock
          pr: ${{ github.event.pull_request.number }}

      - name: Deploy
        run: echo "Deploying..."

  release-lock:
    if: github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Release lock
        uses: ./.github/actions/release-lock
        with:
          lock: deploy-lock
```

## How It Works

1. **Check Lock Existence**: Verifies if the lock branch exists on the remote
   repository
2. **Verify Ownership**: Reads the `LOCK_PR` file from the lock branch to
   confirm the current PR owns the lock
3. **Delete Lock Branch**: If the PR owns the lock, deletes the lock branch from
   the repository
4. **Cleanup Comments**: If `cleanup_comments` is enabled, searches all open PRs
   for "Deploy blocked" comments mentioning the current PR and deletes them

## Safety Features

- **Ownership verification**: The action will NOT delete a lock branch if the
  current PR doesn't own it
- **Idempotent operations**: Safe to run multiple times - won't error if lock
  doesn't exist
- **Graceful failures**: Comment deletion failures are logged but don't fail the
  action

## Requirements

- The workflow must have `write` permissions for `contents` and `pull-requests`
- The `GH_TOKEN` environment variable must be set (typically
  `${{ secrets.GITHUB_TOKEN }}`)
- The repository must be checked out with sufficient fetch depth (recommend
  `fetch-depth: 0`)

## Permissions

Add these permissions to your workflow:

```yaml
permissions:
  contents: write
  pull-requests: write
```

## Troubleshooting

### Lock not being deleted

**Issue**: Lock branch remains after PR is closed

**Solutions**:

- Verify the PR number matches the owner in the `LOCK_PR` file
- Check that the workflow has `contents: write` permission
- Manually delete the lock branch: `git push origin --delete <lock-name>`

### Comments not being cleaned up

**Issue**: "Deploy blocked" comments remain on other PRs

**Solutions**:

- Ensure `cleanup_comments` is set to `"true"` (it's the default)
- Verify the workflow has `pull-requests: write` permission

### Permission denied errors

Ensure your workflow has the required permissions:

```yaml
permissions:
  contents: write
  pull-requests: write
```

## Related Actions

- [acquire-lock](../acquire-lock) - Acquire a deployment lock

## License

MIT

## Author

@smartcontractkit
